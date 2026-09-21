'use server'

// Server actions for /tools/social.
//
// Everything goes through the service-role client (lib/social/db), because the
// social_* tables have RLS on with no policies — the same posture as finances
// and the CRM. /tools is already admin-only (ROLE_PATHS + src/proxy.ts); each
// action re-checks the role anyway, since a server action is a POST endpoint
// and hiding a button is not a gate.
//
// Pattern follows lib/finance-actions.ts: Zod at the boundary, safeParse, and
// a discriminated result the UI can render inline instead of a throw.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { currentAccount } from '@/lib/auth-server'
import { LIMITS, STORAGE_BUCKET, UPLOAD_ACCEPT } from './config'
import {
  assemblePosts,
  db,
  loadPostsByIds,
  POST_SELECT,
  socialConfigured,
  toAccount,
  toConnection,
  toSlot,
} from './db'
import { runTick, type TickSummary } from './engine'
import { retryJob as rearmJob, rollupPosts, syncJobs, unscheduleJobs } from './jobs'
import { autoFill } from './slots'
import { checkHealth, metaAppConfig } from './tokens'
import type {
  ActionResult,
  JobStatus,
  Platform,
  SocialAccount,
  SocialConnection,
  SocialError,
  SocialPost,
  SocialSlot,
} from './types'
import { hasErrors, inferPostType, validatePost } from './validate'

const BASE = '/tools/social'
const IN_FLIGHT: JobStatus[] = ['creating', 'processing', 'publishing']

function fail(kind: SocialError['kind'], message: string): { ok: false; error: SocialError } {
  return { ok: false, error: { kind, message } }
}

async function guard(): Promise<{ ok: false; error: SocialError } | null> {
  if (!socialConfigured()) {
    return fail('not_configured', 'SUPABASE_SERVICE_ROLE_KEY is missing from the environment.')
  }
  const account = await currentAccount()
  if (account?.role !== 'admin') return fail('not_allowed', 'You are not allowed to change this.')
  return null
}

function dbError(error: { code?: string; message?: string } | null | unknown): { ok: false; error: SocialError } {
  const e = error as { code?: string; message?: string } | null
  console.error('[social] database error', e?.code, e?.message ?? error)
  if (e?.code === '42P01' || e?.code === 'PGRST205') {
    return fail('not_configured', 'The social tables are missing. Run the Social Scheduler migration in Supabase.')
  }
  return fail('unknown', 'That did not work. Please try again.')
}

function invalid(parsed: { error: { issues: { message: string }[] } }) {
  return fail('invalid', parsed.error.issues[0]?.message ?? 'Invalid input.')
}

function touch() {
  revalidatePath(BASE, 'layout')
}

const Ids = z.array(z.uuid()).min(1).max(500)

// ─── Reads ──────────────────────────────────────────────────────────────────

export type SocialOverview = {
  configured: boolean
  metaConfigured: boolean
  tickConfigured: boolean
  tablesMissing: boolean
  connections: SocialConnection[]
  accounts: SocialAccount[]
  slots: SocialSlot[]
}

export async function getSocialOverview(): Promise<SocialOverview> {
  const base: SocialOverview = {
    configured: socialConfigured(),
    metaConfigured: !!metaAppConfig(),
    tickConfigured: !!process.env.SOCIAL_TICK_SECRET,
    tablesMissing: false,
    connections: [],
    accounts: [],
    slots: [],
  }
  if (!base.configured || (await currentAccount())?.role !== 'admin') return base
  const client = db()
  const [conns, accounts, slots] = await Promise.all([
    client.from('social_connections').select('*').order('created_at'),
    client.from('social_accounts').select('*').order('platform').order('name'),
    client.from('social_slots').select('*').order('time_local'),
  ])
  if (conns.error) {
    console.error('[social] overview failed', conns.error.code, conns.error.message)
    return { ...base, tablesMissing: true }
  }
  return {
    ...base,
    connections: (conns.data ?? []).map(toConnection),
    accounts: (accounts.data ?? []).map(toAccount),
    slots: (slots.data ?? []).map(toSlot),
  }
}

/** Every post that is not settled history: drafts, scheduled, failures, and the last 30 days of published. */
export async function getPosts(): Promise<SocialPost[]> {
  if (!socialConfigured() || (await currentAccount())?.role !== 'admin') return []
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await db()
    .from('social_posts')
    .select(POST_SELECT)
    .or(`status.neq.published,updated_at.gte."${since}"`)
    .order('sort_key', { ascending: true })
    .limit(1000)
  if (error) {
    console.error('[social] posts failed', error.code, error.message)
    return []
  }
  return assemblePosts((data ?? []) as Record<string, unknown>[])
}

// ─── Accounts ───────────────────────────────────────────────────────────────

export async function setAccountEnabled(id: string, enabled: boolean): Promise<ActionResult<SocialAccount>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = z.object({ id: z.uuid(), enabled: z.boolean() }).safeParse({ id, enabled })
  if (!parsed.success) return invalid(parsed)
  const { data, error } = await db()
    .from('social_accounts')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) return dbError(error)
  touch()
  return { ok: true, data: toAccount(data) }
}

export async function refreshTokenHealth(): Promise<ActionResult<SocialOverview>> {
  const denied = await guard()
  if (denied) return denied
  const config = metaAppConfig()
  if (!config) return fail('not_configured', 'SOCIAL_META_APP_ID / SOCIAL_META_APP_SECRET are not set.')
  try {
    await checkHealth(config)
  } catch (err) {
    return dbError(err)
  }
  touch()
  return { ok: true, data: await getSocialOverview() }
}

export async function disconnectConnection(id: string): Promise<ActionResult> {
  const denied = await guard()
  if (denied) return denied
  if (!z.uuid().safeParse(id).success) return fail('invalid', 'Unknown connection.')
  const client = db()
  const { data: accounts } = await client.from('social_accounts').select('id').eq('connection_id', id)
  const accountIds = (accounts ?? []).map((a) => String(a.id))
  if (accountIds.length) {
    const { count } = await client
      .from('social_publish_jobs')
      .select('id', { count: 'exact', head: true })
      .in('account_id', accountIds)
      .in('status', IN_FLIGHT)
    if (count) return fail('invalid', 'A post is publishing through this connection right now. Try again in a minute.')
  }
  // The delete cascades to accounts, targets and jobs; posts that lose their
  // last job have to be rolled back to draft afterwards.
  const { data: affected } = accountIds.length
    ? await client.from('social_publish_jobs').select('post_id').in('account_id', accountIds)
    : { data: [] as { post_id: string }[] }
  const { error } = await client.from('social_connections').delete().eq('id', id)
  if (error) return dbError(error)
  await rollupPosts([...new Set((affected ?? []).map((j) => String(j.post_id)))])
  touch()
  return { ok: true, data: null }
}

export async function runPublisherNow(): Promise<ActionResult<TickSummary>> {
  const denied = await guard()
  if (denied) return denied
  try {
    const summary = await runTick()
    touch()
    return { ok: true, data: summary }
  } catch (err) {
    return dbError(err)
  }
}

// ─── Slots ──────────────────────────────────────────────────────────────────

const SlotInput = z.object({
  id: z.uuid().optional(),
  account_id: z.uuid(),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1, 'Pick at least one day.').max(7),
  time_local: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM.'),
  active: z.boolean().default(true),
})

export async function saveSlot(input: z.input<typeof SlotInput>): Promise<ActionResult<SocialSlot>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = SlotInput.safeParse(input)
  if (!parsed.success) return invalid(parsed)
  const { id, ...row } = parsed.data
  const payload = { ...row, weekdays: [...new Set(row.weekdays)].sort() }
  const q = id
    ? db().from('social_slots').update(payload).eq('id', id)
    : db().from('social_slots').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error || !data) return dbError(error)
  touch()
  return { ok: true, data: toSlot(data) }
}

export async function deleteSlot(id: string): Promise<ActionResult> {
  const denied = await guard()
  if (denied) return denied
  if (!z.uuid().safeParse(id).success) return fail('invalid', 'Unknown slot.')
  const { error } = await db().from('social_slots').delete().eq('id', id)
  if (error) return dbError(error)
  touch()
  return { ok: true, data: null }
}

// ─── Uploads ────────────────────────────────────────────────────────────────

const ACCEPTED = UPLOAD_ACCEPT.split(',')
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

const PrepareInput = z.object({
  mime: z.string().refine((m) => ACCEPTED.includes(m), 'Only JPEG, PNG, WebP, MP4 and MOV files.'),
  bytes: z.number().int().positive().max(LIMITS.uploadMaxBytes, 'Files over 50 MB can’t be stored on the free plan.'),
  wantJpeg: z.boolean(),
})

export type UploadTicket = {
  mediaId: string
  main: { path: string; token: string }
  thumb: { path: string; token: string }
  jpeg: { path: string; token: string } | null
}

/**
 * Signed upload tokens for one file. The browser uploads straight to Storage
 * with them — nothing large passes through this server — and then calls
 * finalizeUpload, which is what creates the rows.
 */
export async function prepareUpload(input: z.input<typeof PrepareInput>): Promise<ActionResult<UploadTicket>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = PrepareInput.safeParse(input)
  if (!parsed.success) return invalid(parsed)
  const mediaId = crypto.randomUUID()
  const dir = `media/${mediaId}`
  const paths = {
    main: `${dir}/original.${EXT[parsed.data.mime]}`,
    thumb: `${dir}/thumb.jpg`,
    jpeg: parsed.data.wantJpeg ? `${dir}/ig.jpg` : null,
  }
  const bucket = db().storage.from(STORAGE_BUCKET)
  const sign = async (path: string) => {
    const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: true })
    if (error || !data) throw error ?? new Error('No upload token')
    return { path, token: data.token }
  }
  try {
    const [main, thumb, jpeg] = await Promise.all([
      sign(paths.main),
      sign(paths.thumb),
      paths.jpeg ? sign(paths.jpeg) : Promise.resolve(null),
    ])
    return { ok: true, data: { mediaId, main, thumb, jpeg } }
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (/bucket/i.test(message)) {
      return fail('not_configured', 'The social-media Storage bucket is missing. Run the Social Scheduler migration.')
    }
    return dbError(err)
  }
}

const FinalizeInput = z.object({
  mediaId: z.uuid(),
  kind: z.enum(['image', 'video']),
  mime: z.string().refine((m) => ACCEPTED.includes(m)),
  bytes: z.number().int().positive(),
  jpegBytes: z.number().int().positive().nullable(),
  hasThumb: z.boolean(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationS: z.number().nonnegative().nullable(),
  videoCodec: z.string().max(8).nullable(),
  audioCodec: z.string().max(8).nullable(),
  faststart: z.boolean().nullable(),
  fps: z.number().nonnegative().max(1000).nullable(),
  originalName: z.string().max(300),
  sortKey: z.number(),
  targetIds: z.array(z.uuid()).max(50),
})

export async function finalizeUpload(input: z.input<typeof FinalizeInput>): Promise<ActionResult<SocialPost>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = FinalizeInput.safeParse(input)
  if (!parsed.success) return invalid(parsed)
  const f = parsed.data
  const client = db()

  // Trust the bucket, not the browser: the original must really be there.
  const dir = `media/${f.mediaId}`
  const { data: listed, error: listErr } = await client.storage.from(STORAGE_BUCKET).list(dir)
  if (listErr) return dbError(listErr)
  const names = new Set((listed ?? []).map((o) => o.name))
  const main = `original.${EXT[f.mime]}`
  if (!names.has(main)) return fail('invalid', 'The upload did not arrive. Try again.')

  const { error: mediaErr } = await client.from('social_media').insert({
    id: f.mediaId,
    storage_path: `${dir}/${main}`,
    jpeg_path: f.jpegBytes && names.has('ig.jpg') ? `${dir}/ig.jpg` : null,
    jpeg_bytes: f.jpegBytes && names.has('ig.jpg') ? f.jpegBytes : null,
    thumb_path: f.hasThumb && names.has('thumb.jpg') ? `${dir}/thumb.jpg` : null,
    kind: f.kind,
    mime: f.mime,
    bytes: f.bytes,
    width: f.width,
    height: f.height,
    duration_s: f.durationS,
    video_codec: f.videoCodec,
    audio_codec: f.audioCodec,
    faststart: f.faststart,
    fps: f.fps,
    original_name: f.originalName,
  })
  if (mediaErr) return dbError(mediaErr)

  const { data: post, error: postErr } = await client
    .from('social_posts')
    .insert({ post_type: f.kind === 'video' ? 'reel' : 'image', caption: '', sort_key: f.sortKey })
    .select('id')
    .single()
  if (postErr || !post) return dbError(postErr)

  await client.from('social_post_media').insert({ post_id: post.id, media_id: f.mediaId, position: 0 })
  const targets = await enabledAccountIds(f.targetIds)
  if (targets.length) {
    await client.from('social_post_targets').insert(targets.map((account_id) => ({ post_id: post.id, account_id })))
  }
  // No revalidatePath here or in updatePost: they run once per file / per cell
  // edit, the editor updates from the row returned, and every social page is
  // dynamic (client staleTime 0), so re-rendering the whole list buys nothing.
  const [full] = await loadPostsByIds([String(post.id)])
  return { ok: true, data: full }
}

async function enabledAccountIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const { data } = await db().from('social_accounts').select('id').in('id', ids).eq('enabled', true)
  return (data ?? []).map((a) => String(a.id))
}

// ─── Editing ────────────────────────────────────────────────────────────────

async function platformsById(): Promise<Map<string, Platform>> {
  const { data } = await db().from('social_accounts').select('id,platform')
  return new Map((data ?? []).map((a) => [String(a.id), a.platform as Platform]))
}

const busy = (p: SocialPost) => p.jobs.some((j) => IN_FLIGHT.includes(j.status))

function scheduleProblems(p: SocialPost, platforms: Map<string, Platform>, allowPast = false): string | null {
  const issues = validatePost({
    allowPast,
    caption: p.caption,
    media: p.media,
    platforms: p.target_ids.map((id) => platforms.get(id)).filter(Boolean) as Platform[],
    forSchedule: true,
    scheduledAt: p.scheduled_at,
  })
  const first = issues.find((i) => i.level === 'error')
  return hasErrors(issues) && first ? first.message : null
}

const UpdateInput = z.object({
  id: z.uuid(),
  caption: z.string().max(70_000).optional(),
  scheduled_at: z.iso.datetime({ offset: true }).nullable().optional(),
  target_ids: z.array(z.uuid()).max(50).optional(),
})

/**
 * One row edit. A post that is already scheduled stays scheduled only if the
 * edit leaves it valid — otherwise the edit is refused with the reason, rather
 * than letting an invalid post reach Meta.
 */
export async function updatePost(input: z.input<typeof UpdateInput>): Promise<ActionResult<SocialPost>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = UpdateInput.safeParse(input)
  if (!parsed.success) return invalid(parsed)
  const { id, ...patch } = parsed.data
  const [current] = await loadPostsByIds([id])
  if (!current) return fail('not_found', 'That post no longer exists.')
  if (busy(current)) return fail('invalid', 'This post is publishing right now and can’t be changed.')

  const targets = patch.target_ids ? await enabledAccountIds(patch.target_ids) : current.target_ids
  const next: SocialPost = {
    ...current,
    caption: patch.caption ?? current.caption,
    scheduled_at: patch.scheduled_at !== undefined ? patch.scheduled_at : current.scheduled_at,
    target_ids: targets,
  }
  if (current.status !== 'draft') {
    // The past-time rule applies when the time is what's being changed; a
    // failed post whose time has gone by still takes caption and target fixes.
    const problem = scheduleProblems(next, await platformsById(), patch.scheduled_at === undefined)
    if (problem) return fail('invalid', `${problem} Unschedule the post to make this change.`)
  }

  const client = db()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.caption !== undefined) row.caption = patch.caption
  if (patch.scheduled_at !== undefined) row.scheduled_at = patch.scheduled_at
  const { error } = await client.from('social_posts').update(row).eq('id', id)
  if (error) return dbError(error)
  if (patch.target_ids) {
    await client.from('social_post_targets').delete().eq('post_id', id)
    if (targets.length) {
      await client.from('social_post_targets').insert(targets.map((account_id) => ({ post_id: id, account_id })))
    }
  }
  if (current.status !== 'draft') await syncJobs([id])
  const [full] = await loadPostsByIds([id])
  return { ok: true, data: full }
}

/** Deletes posts, then any uploaded files no other post uses. */
export async function deletePosts(ids: string[]): Promise<ActionResult<string[]>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = Ids.safeParse(ids)
  if (!parsed.success) return invalid(parsed)
  const client = db()
  const posts = await loadPostsByIds(parsed.data)
  const deletable = posts.filter((p) => !busy(p))
  if (!deletable.length) return fail('invalid', 'Those posts are publishing right now and can’t be deleted.')
  const postIds = deletable.map((p) => p.id)
  const mediaIds = [...new Set(deletable.flatMap((p) => p.media.map((m) => m.id)))]

  const { error } = await client.from('social_posts').delete().in('id', postIds)
  if (error) return dbError(error)

  if (mediaIds.length) {
    const { data: stillUsed } = await client.from('social_post_media').select('media_id').in('media_id', mediaIds)
    const used = new Set((stillUsed ?? []).map((r) => String(r.media_id)))
    const orphans = mediaIds.filter((m) => !used.has(m))
    if (orphans.length) {
      const { data: rows } = await client
        .from('social_media')
        .select('id,storage_path,jpeg_path,thumb_path')
        .in('id', orphans)
      const paths = (rows ?? []).flatMap((r) => [r.storage_path, r.jpeg_path, r.thumb_path]).filter(Boolean) as string[]
      if (paths.length) await client.storage.from(STORAGE_BUCKET).remove(paths)
      await client.from('social_media').delete().in('id', orphans)
    }
  }
  touch()
  return { ok: true, data: postIds }
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

export type BulkResult = { posts: SocialPost[]; problems: { id: string; message: string }[] }

export async function schedulePosts(ids: string[]): Promise<ActionResult<BulkResult>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = Ids.safeParse(ids)
  if (!parsed.success) return invalid(parsed)
  const posts = await loadPostsByIds(parsed.data)
  const platforms = await platformsById()
  const problems: BulkResult['problems'] = []
  const ok: string[] = []
  for (const p of posts) {
    if (busy(p)) {
      problems.push({ id: p.id, message: 'Already publishing.' })
      continue
    }
    const problem = scheduleProblems(p, platforms)
    if (problem) problems.push({ id: p.id, message: problem })
    else ok.push(p.id)
  }
  if (ok.length) {
    const { error } = await db()
      .from('social_posts')
      .update({ status: 'scheduled', updated_at: new Date().toISOString() })
      .in('id', ok)
    if (error) return dbError(error)
    try {
      await syncJobs(ok, { rearm: true })
    } catch (err) {
      return dbError(err)
    }
  }
  touch()
  return { ok: true, data: { posts: await loadPostsByIds(parsed.data), problems } }
}

export async function unschedulePosts(ids: string[]): Promise<ActionResult<BulkResult>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = Ids.safeParse(ids)
  if (!parsed.success) return invalid(parsed)
  const stuck = await unscheduleJobs(parsed.data)
  const posts = await loadPostsByIds(parsed.data)
  const problems = posts
    .filter((p) => p.status === 'publishing')
    .map((p) => ({ id: p.id, message: 'Already publishing — it can’t be stopped now.' }))
  touch()
  return {
    ok: true,
    data: { posts, problems: stuck ? problems : [] },
  }
}

export async function retryJob(jobId: string): Promise<ActionResult<SocialPost>> {
  const denied = await guard()
  if (denied) return denied
  if (!z.uuid().safeParse(jobId).success) return fail('invalid', 'Unknown job.')
  const postId = await rearmJob(jobId)
  if (!postId) return fail('not_found', 'That job no longer exists.')
  touch()
  const [post] = await loadPostsByIds([postId])
  return { ok: true, data: post }
}

// ─── Bulk edits ─────────────────────────────────────────────────────────────

/** Runs updatePost's rules over many posts; posts that can't take the edit are reported, not failed. */
async function bulkEdit(
  ids: string[],
  edit: (p: SocialPost) => { caption?: string; scheduled_at?: string | null; target_ids?: string[] }
): Promise<ActionResult<BulkResult>> {
  const posts = await loadPostsByIds(ids)
  const platforms = await platformsById()
  const client = db()
  const problems: BulkResult['problems'] = []
  const changedScheduled: string[] = []

  for (const p of posts) {
    if (busy(p)) {
      problems.push({ id: p.id, message: 'Publishing right now.' })
      continue
    }
    const patch = edit(p)
    const next = { ...p, ...patch, target_ids: patch.target_ids ?? p.target_ids }
    if (p.status !== 'draft') {
      const problem = scheduleProblems(next, platforms, patch.scheduled_at === undefined)
      if (problem) {
        problems.push({ id: p.id, message: problem })
        continue
      }
    }
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.caption !== undefined) row.caption = patch.caption
    if (patch.scheduled_at !== undefined) row.scheduled_at = patch.scheduled_at
    const { error } = await client.from('social_posts').update(row).eq('id', p.id)
    if (error) return dbError(error)
    if (patch.target_ids) {
      await client.from('social_post_targets').delete().eq('post_id', p.id)
      if (patch.target_ids.length) {
        await client
          .from('social_post_targets')
          .insert(patch.target_ids.map((account_id) => ({ post_id: p.id, account_id })))
      }
    }
    if (p.status !== 'draft') changedScheduled.push(p.id)
  }
  if (changedScheduled.length) await syncJobs(changedScheduled)
  touch()
  return { ok: true, data: { posts: await loadPostsByIds(ids), problems } }
}

const CaptionInput = z.object({
  ids: Ids,
  text: z.string().max(70_000),
  mode: z.enum(['replace', 'prepend', 'append']),
})

export async function applyCaption(input: z.input<typeof CaptionInput>): Promise<ActionResult<BulkResult>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = CaptionInput.safeParse(input)
  if (!parsed.success) return invalid(parsed)
  const { ids, text, mode } = parsed.data
  return bulkEdit(ids, (p) => {
    if (mode === 'replace' || !p.caption) return { caption: text }
    return { caption: mode === 'prepend' ? `${text}\n\n${p.caption}` : `${p.caption}\n\n${text}` }
  })
}

const TargetsInput = z.object({
  ids: Ids,
  accountIds: z.array(z.uuid()).max(50),
  mode: z.enum(['set', 'add', 'remove']),
})

export async function applyTargets(input: z.input<typeof TargetsInput>): Promise<ActionResult<BulkResult>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = TargetsInput.safeParse(input)
  if (!parsed.success) return invalid(parsed)
  const { ids, mode } = parsed.data
  const accountIds = mode === 'remove' ? parsed.data.accountIds : await enabledAccountIds(parsed.data.accountIds)
  return bulkEdit(ids, (p) => {
    if (mode === 'set') return { target_ids: accountIds }
    if (mode === 'add') return { target_ids: [...new Set([...p.target_ids, ...accountIds])] }
    return { target_ids: p.target_ids.filter((t) => !accountIds.includes(t)) }
  })
}

const TimesInput = z
  .array(z.object({ id: z.uuid(), scheduled_at: z.iso.datetime({ offset: true }).nullable() }))
  .min(1)
  .max(500)

export async function setTimes(input: z.input<typeof TimesInput>): Promise<ActionResult<BulkResult>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = TimesInput.safeParse(input)
  if (!parsed.success) return invalid(parsed)
  const byId = new Map(parsed.data.map((t) => [t.id, t.scheduled_at]))
  return bulkEdit([...byId.keys()], (p) => ({ scheduled_at: byId.get(p.id) ?? null }))
}

const FillInput = z.object({ ids: Ids, schedule: z.boolean() })

/** Gives the posts, in the order given, the next free slot times of their accounts. */
export async function autoFillSlots(input: z.input<typeof FillInput>): Promise<ActionResult<BulkResult>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = FillInput.safeParse(input)
  if (!parsed.success) return invalid(parsed)
  const client = db()
  const selected = new Set(parsed.data.ids)
  const posts = await loadPostsByIds(parsed.data.ids)
  const ordered = parsed.data.ids.map((id) => posts.find((p) => p.id === id)).filter(Boolean) as SocialPost[]

  const now = new Date()
  const [{ data: slotRows }, { data: others }] = await Promise.all([
    client.from('social_slots').select('*').eq('active', true),
    client
      .from('social_posts')
      .select('id,scheduled_at,social_post_targets(account_id)')
      .gte('scheduled_at', now.toISOString())
      .neq('status', 'published'),
  ])
  const slotsByAccount = new Map<string, SocialSlot[]>()
  for (const s of (slotRows ?? []).map(toSlot)) {
    if (!slotsByAccount.has(s.account_id)) slotsByAccount.set(s.account_id, [])
    slotsByAccount.get(s.account_id)!.push(s)
  }
  const takenByAccount = new Map<string, Set<number>>()
  for (const o of others ?? []) {
    if (selected.has(String(o.id)) || !o.scheduled_at) continue
    for (const t of (o.social_post_targets as { account_id: string }[] | null) ?? []) {
      if (!takenByAccount.has(t.account_id)) takenByAccount.set(t.account_id, new Set())
      takenByAccount.get(t.account_id)!.add(new Date(String(o.scheduled_at)).getTime())
    }
  }

  const movable = ordered.filter((p) => !busy(p) && p.status !== 'published')
  const result = autoFill({
    posts: movable.map((p) => ({ id: p.id, target_ids: p.target_ids })),
    slotsByAccount,
    takenByAccount,
    from: new Date(now.getTime() + 10 * 60_000),
  })

  const problems: BulkResult['problems'] = [
    ...ordered.filter((p) => !movable.includes(p)).map((p) => ({ id: p.id, message: 'Already publishing or published.' })),
    ...result.skipped.map((s) => ({ id: s.id, message: s.reason })),
  ]

  if (result.assigned.length) {
    const byId = new Map(result.assigned.map((a) => [a.id, a.scheduled_at]))
    const edited = await bulkEdit([...byId.keys()], (p) => ({ scheduled_at: byId.get(p.id)! }))
    if (!edited.ok) return edited
    problems.push(...edited.data.problems)
    if (parsed.data.schedule) {
      const scheduled = await schedulePosts([...byId.keys()])
      if (!scheduled.ok) return scheduled
      problems.push(...scheduled.data.problems)
    }
  }
  touch()
  return { ok: true, data: { posts: await loadPostsByIds(parsed.data.ids), problems } }
}

// ─── Carousels ──────────────────────────────────────────────────────────────

/** Merges 2–10 draft posts into one carousel, in the order given. */
export async function combineCarousel(ids: string[]): Promise<ActionResult<{ post: SocialPost; removed: string[] }>> {
  const denied = await guard()
  if (denied) return denied
  const parsed = z.array(z.uuid()).min(2, 'Select at least two posts.').max(10, 'A carousel takes at most 10 items.').safeParse(ids)
  if (!parsed.success) return invalid(parsed)
  const posts = await loadPostsByIds(parsed.data)
  const ordered = parsed.data.map((id) => posts.find((p) => p.id === id)).filter(Boolean) as SocialPost[]
  if (ordered.some((p) => p.status !== 'draft')) return fail('invalid', 'Only drafts can be combined. Unschedule them first.')
  const media = ordered.flatMap((p) => p.media)
  if (media.length > LIMITS.igCarousel.maxItems) return fail('invalid', `That makes ${media.length} items; a carousel takes at most 10.`)

  const first = ordered[0]
  const client = db()
  const { data: created, error } = await client
    .from('social_posts')
    .insert({
      post_type: inferPostType(media),
      caption: first.caption,
      scheduled_at: first.scheduled_at,
      sort_key: first.sort_key,
    })
    .select('id')
    .single()
  if (error || !created) return dbError(error)
  await client.from('social_post_media').insert(media.map((m, i) => ({ post_id: created.id, media_id: m.id, position: i })))
  if (first.target_ids.length) {
    await client.from('social_post_targets').insert(first.target_ids.map((account_id) => ({ post_id: created.id, account_id })))
  }
  const removed = ordered.map((p) => p.id)
  await client.from('social_posts').delete().in('id', removed)
  touch()
  const [post] = await loadPostsByIds([String(created.id)])
  return { ok: true, data: { post, removed } }
}

/** Breaks a draft carousel back into one post per item. */
export async function splitCarousel(id: string): Promise<ActionResult<{ posts: SocialPost[]; removed: string }>> {
  const denied = await guard()
  if (denied) return denied
  if (!z.uuid().safeParse(id).success) return fail('invalid', 'Unknown post.')
  const [post] = await loadPostsByIds([id])
  if (!post) return fail('not_found', 'That post no longer exists.')
  if (post.status !== 'draft') return fail('invalid', 'Unschedule the carousel before splitting it.')
  if (post.media.length < 2) return fail('invalid', 'That post is not a carousel.')

  const client = db()
  const newIds: string[] = []
  for (const [i, m] of post.media.entries()) {
    const { data: created, error } = await client
      .from('social_posts')
      .insert({
        post_type: m.kind === 'video' ? 'reel' : 'image',
        caption: post.caption,
        scheduled_at: null,
        sort_key: post.sort_key + i * 0.001,
      })
      .select('id')
      .single()
    if (error || !created) return dbError(error)
    newIds.push(String(created.id))
    await client.from('social_post_media').insert({ post_id: created.id, media_id: m.id, position: 0 })
    if (post.target_ids.length) {
      await client.from('social_post_targets').insert(post.target_ids.map((account_id) => ({ post_id: created.id, account_id })))
    }
  }
  await client.from('social_posts').delete().eq('id', id)
  await rollupPosts(newIds)
  touch()
  return { ok: true, data: { posts: await loadPostsByIds(newIds), removed: id } }
}
