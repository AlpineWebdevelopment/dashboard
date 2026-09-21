// The publisher. One call = one tick: claim due jobs, move each one step (or a
// few, when Meta is quick) along its state machine, write the result, release.
//
// Called by /api/tools/social/tick (pg_cron → pg_net, once a minute, only when
// something is due) and by the "Run publisher now" button. Two ticks can
// overlap safely: social_claim_jobs leases rows with FOR UPDATE SKIP LOCKED,
// so a job belongs to exactly one tick until its lease runs out.

import { decryptSecret } from '@/lib/crypto'
import { ENGINE, FB_IMAGE_MIMES, STORAGE_BUCKET } from '../config'
import { db, signPath } from '../db'
import { MetaError } from '../errors'
import { logEvent, rollupPosts } from '../jobs'
import type { ErrorKind, JobStatus } from '../types'
import { StepFailure, type JobRow, type MediaRow, type StepContext, type StepResult } from './context'
import { stepFacebook } from './facebook'
import { stepInstagram } from './instagram'

export type TickSummary = {
  claimed: number
  processed: number
  published: number
  failed: number
  released: number
  purged: number
}

const TERMINAL: JobStatus[] = ['published', 'failed', 'cancelled']
/** Steps per job per tick — a carousel needs five: items → poll → parent → poll → publish. */
const MAX_STEPS = 6

type Row = Record<string, unknown>

export async function runTick(): Promise<TickSummary> {
  const started = Date.now()
  const client = db()
  const summary: TickSummary = { claimed: 0, processed: 0, published: 0, failed: 0, released: 0, purged: 0 }

  const { data, error } = await client.rpc('social_claim_jobs', { p_limit: ENGINE.claimLimit, p_lease_seconds: 180 })
  if (error) throw error
  const queue = [...((data ?? []) as JobRow[])]
  summary.claimed = queue.length
  const touchedPosts = new Set<string>()

  const worker = async () => {
    while (queue.length && Date.now() - started < ENGINE.budgetMs) {
      const job = queue.shift()!
      touchedPosts.add(job.post_id)
      const outcome = await processJob(job, started)
      summary.processed++
      if (outcome === 'published') summary.published++
      if (outcome === 'failed') summary.failed++
    }
  }
  await Promise.all(Array.from({ length: ENGINE.concurrency }, worker))

  // Out of time: hand the rest back rather than let their leases run out.
  if (queue.length) {
    await client.from('social_publish_jobs').update({ lease_until: null }).in('id', queue.map((j) => j.id))
    summary.released = queue.length
  }

  await rollupPosts([...touchedPosts])
  summary.purged = await purgeMedia().catch((err) => {
    console.error('[social] purge failed', err)
    return 0
  })
  return summary
}

async function processJob(initial: JobRow, tickStarted: number): Promise<JobStatus> {
  const client = db()
  let job = initial

  const [{ data: post }, { data: account }] = await Promise.all([
    client
      .from('social_posts')
      .select('id,caption,post_type,social_post_media(position, social_media(*))')
      .eq('id', job.post_id)
      .maybeSingle(),
    client.from('social_accounts').select('*').eq('id', job.account_id).maybeSingle(),
  ])

  if (!post) {
    await finish(job, 'cancelled', { error_message: 'The post was deleted.' })
    return 'cancelled'
  }
  if (!account) return fail(job, 'permanent', null, null, 'The account was removed.')
  if (!account.enabled) return fail(job, 'permanent', null, null, 'The account is switched off in Accounts.')
  if (account.token_status === 'invalid') {
    return fail(job, 'token', 190, null, 'The Facebook connection is no longer valid. Reconnect.')
  }

  // Idempotency: anything with a remote id is live.
  if (job.remote_id) {
    await finish(job, 'published', {})
    return 'published'
  }

  const media: MediaRow[] = [...((post.social_post_media as Row[] | null) ?? [])]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((pm) => pm.social_media as MediaRow)
    .filter(Boolean)
  if (!media.length) return fail(job, 'permanent', null, null, 'The post has no media.')

  let token: string
  try {
    token = await decryptSecret(String(account.token_enc))
  } catch {
    return fail(job, 'token', null, null, 'The stored token could not be read. Reconnect.')
  }

  // From here on the job is visibly in flight, so the editor locks the post
  // instead of letting an edit race the publish.
  if (job.status === 'scheduled') {
    const now = new Date().toISOString()
    await client
      .from('social_publish_jobs')
      .update({ status: 'creating', stage_started_at: now, updated_at: now })
      .eq('id', job.id)
    job = { ...job, status: 'creating', stage_started_at: now }
  }

  const platform = account.platform as 'facebook' | 'instagram'
  const ctx: StepContext = {
    job,
    post: { id: String(post.id), caption: String(post.caption ?? ''), post_type: post.post_type as StepContext['post']['post_type'] },
    media,
    account: {
      id: String(account.id),
      platform,
      external_id: String(account.external_id),
      page_id: String(account.page_id),
    },
    token,
    save: async (patch) => {
      const { error } = await client
        .from('social_publish_jobs')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', job.id)
      if (error) throw new Error(`Could not save progress: ${error.message}`)
      job = { ...job, ...patch }
      ctx.job = job
    },
    mediaUrl: async (m) => {
      const path =
        platform === 'instagram'
          ? m.kind === 'image'
            ? m.jpeg_path ?? m.storage_path
            : m.storage_path
          : m.kind === 'image' && !FB_IMAGE_MIMES.includes(m.mime)
            ? m.jpeg_path ?? m.storage_path
            : m.storage_path
      return signPath(path, ENGINE.mediaUrlSeconds)
    },
    saveQuota: async (usage, total) => {
      await client
        .from('social_accounts')
        .update({ quota: { usage, total, checked_at: new Date().toISOString() } })
        .eq('id', account.id)
    },
    fbReelsLast24h: async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString()
      const { data } = await client
        .from('social_publish_jobs')
        .select('published_at, social_posts!inner(post_type)')
        .eq('account_id', account.id)
        .eq('status', 'published')
        .eq('social_posts.post_type', 'reel')
        .gte('published_at', since)
        .order('published_at', { ascending: true })
      return { count: data?.length ?? 0, oldest: (data?.[0]?.published_at as string | undefined) ?? null }
    },
  }

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (
        job.status === 'processing' &&
        job.stage_started_at &&
        Date.now() - new Date(job.stage_started_at).getTime() > ENGINE.processingTimeoutMs
      ) {
        return fail(job, 'permanent', null, null, 'Meta was still processing the media after 3 hours. Try again.')
      }

      const result: StepResult = platform === 'facebook' ? await stepFacebook(ctx) : await stepInstagram(ctx)

      if (result.status === 'published') {
        await finish(job, 'published', { remote_id: result.remoteId, permalink: result.permalink })
        return 'published'
      }

      // Going back to `creating` after getting further is a rebuild; those count
      // as attempts so a container that keeps expiring cannot loop for ever.
      const rebuilt = result.status === 'creating' && job.status !== 'scheduled' && job.status !== 'creating'
      const attempts = job.attempts + (rebuilt ? 1 : 0)
      if (rebuilt && attempts >= ENGINE.maxAttempts) {
        return fail(job, 'permanent', null, null, result.note ?? 'Gave up after rebuilding the post several times.')
      }

      const carryOn = result.runAt === null && Date.now() - tickStarted < ENGINE.budgetMs + 10_000
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = {
        ...(result.patch ?? {}),
        status: result.status,
        attempts,
        run_at: (result.runAt ?? new Date()).toISOString(),
        stage_started_at: result.status !== job.status ? now : job.stage_started_at,
        error_kind: null,
        error_code: null,
        error_subcode: null,
        error_message: result.note ?? null,
        updated_at: now,
      }
      // Carrying on keeps the lease; stopping releases it for the next tick.
      if (!carryOn) patch.lease_until = null
      const { error } = await client.from('social_publish_jobs').update(patch).eq('id', job.id)
      if (error) throw new Error(`Could not save job: ${error.message}`)
      if (result.status !== job.status || result.note) {
        await logEvent(job.id, job.status, result.status, result.note ? { note: result.note } : null)
      }
      job = { ...job, ...(result.patch ?? {}), status: result.status, attempts, stage_started_at: patch.stage_started_at as string | null }
      ctx.job = job
      if (!carryOn) return job.status
    }
    // Out of steps for this tick: pick up again next minute.
    await client.from('social_publish_jobs').update({ lease_until: null }).eq('id', job.id)
    return job.status
  } catch (err) {
    return handleError(job, err)
  }
}

async function handleError(job: JobRow, err: unknown): Promise<JobStatus> {
  if (err instanceof MetaError) {
    console.error('[social] meta error', job.id, err.code, err.subcode, err.raw)
    if (err.kind === 'token') {
      await db()
        .from('social_accounts')
        .update({ token_status: 'invalid', last_error: err.message, updated_at: new Date().toISOString() })
        .eq('id', job.account_id)
      return fail(job, 'token', err.code, err.subcode, err.message, err.raw)
    }
    if (err.kind === 'permanent') return fail(job, 'permanent', err.code, err.subcode, err.message, err.raw)
    if (err.kind === 'rate_limit') {
      // Waiting out a limit is not a failed attempt.
      const wait = err.retryAfterMs ?? (err.subcode === 2207042 ? 3600_000 : 30 * 60_000)
      return defer(job, job.attempts, wait, 'rate_limit', err)
    }
    return backoff(job, 'transient', err.code, err.subcode, err.message, err.raw)
  }
  if (err instanceof StepFailure) {
    return err.permanent ? fail(job, 'permanent', null, null, err.message) : backoff(job, 'transient', null, null, err.message)
  }
  console.error('[social] job crashed', job.id, err)
  return backoff(job, 'transient', null, null, err instanceof Error ? err.message : 'Unexpected error.')
}

async function backoff(
  job: JobRow,
  kind: ErrorKind,
  code: number | null,
  subcode: number | null,
  message: string,
  raw?: string
): Promise<JobStatus> {
  const attempts = job.attempts + 1
  if (attempts >= ENGINE.maxAttempts) {
    return fail(job, kind, code, subcode, `${message} (gave up after ${attempts} tries)`, raw)
  }
  // 2, 4, 8, 16, 32 minutes, capped at an hour, ±20% so retries don't bunch.
  const minutes = Math.min(60, 2 ** attempts)
  const ms = minutes * 60_000 * (0.8 + Math.random() * 0.4)
  return defer(job, attempts, ms, kind, { code, subcode, message, raw })
}

async function defer(
  job: JobRow,
  attempts: number,
  ms: number,
  kind: ErrorKind,
  err: { code: number | null; subcode: number | null; message: string; raw?: string }
): Promise<JobStatus> {
  const now = new Date()
  // Nothing has reached Meta yet: wait as plain `scheduled`, so the post stays
  // editable during the back-off instead of being locked for up to an hour.
  const untouched = !job.container_id && !job.child_ids?.length && !job.publish_started_at
  const status: JobStatus = untouched && job.status === 'creating' ? 'scheduled' : job.status
  await db()
    .from('social_publish_jobs')
    .update({
      status,
      attempts,
      run_at: new Date(now.getTime() + ms).toISOString(),
      lease_until: null,
      error_kind: kind,
      error_code: err.code,
      error_subcode: err.subcode,
      error_message: err.message,
      updated_at: now.toISOString(),
    })
    .eq('id', job.id)
  await logEvent(job.id, job.status, status, { kind, code: err.code, subcode: err.subcode, raw: err.raw ?? err.message, retry_in_s: Math.round(ms / 1000) })
  return status
}

async function fail(
  job: JobRow,
  kind: ErrorKind,
  code: number | null,
  subcode: number | null,
  message: string,
  raw?: string
): Promise<JobStatus> {
  await finish(job, 'failed', { error_kind: kind, error_code: code, error_subcode: subcode, error_message: message }, raw)
  return 'failed'
}

async function finish(job: JobRow, status: JobStatus, patch: Record<string, unknown>, raw?: string): Promise<void> {
  const now = new Date().toISOString()
  const row: Record<string, unknown> = { ...patch, status, lease_until: null, updated_at: now }
  if (status === 'published') {
    row.published_at = now
    row.error_kind = null
    row.error_code = null
    row.error_subcode = null
    row.error_message = null
  }
  await db().from('social_publish_jobs').update(row).eq('id', job.id)
  if (TERMINAL.includes(status)) {
    await logEvent(job.id, job.status, status, raw ? { raw } : (patch.error_message ? { message: patch.error_message } : null))
  }
}

/**
 * Deletes uploaded files once every post using them has fully published and
 * a week has passed (free plan: 1 GB of Storage). Thumbnails stay, so the
 * editor's history still has pictures.
 */
export async function purgeMedia(): Promise<number> {
  const client = db()
  const cutoff = new Date(Date.now() - ENGINE.purgeAfterDays * 86_400_000).toISOString()
  const { data } = await client
    .from('social_media')
    .select('id,storage_path,jpeg_path,created_at,social_post_media(social_posts(status,updated_at))')
    .is('purged_at', null)
    .lt('created_at', cutoff)
    .limit(50)

  const done = (data ?? []).filter((m) => {
    const posts = ((m.social_post_media as Row[] | null) ?? []).map((pm) => pm.social_posts as Row | null).filter(Boolean) as Row[]
    return posts.length > 0 && posts.every((p) => p.status === 'published' && String(p.updated_at) < cutoff)
  })
  if (!done.length) return 0

  const paths = done.flatMap((m) => [m.storage_path, m.jpeg_path]).filter(Boolean) as string[]
  const { error } = await client.storage.from(STORAGE_BUCKET).remove(paths)
  if (error) throw error
  await client.from('social_media').update({ purged_at: new Date().toISOString() }).in('id', done.map((m) => m.id))
  return done.length
}
