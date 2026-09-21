// Keeping publish_jobs in step with their posts. Server-only.
//
// A post is the thing you edit; a job is one post × one target, and it is the
// thing the engine runs. Only jobs still in `scheduled` have not touched Meta
// yet, so they are the only ones an edit may move, re-target or delete —
// anything further along is left exactly as the engine last wrote it.

import { db } from './db'
import type { JobStatus, PostStatus } from './types'

const IN_FLIGHT: JobStatus[] = ['creating', 'processing', 'publishing']

export function rollupStatus(statuses: JobStatus[]): PostStatus {
  const live = statuses.filter((s) => s !== 'cancelled')
  if (!live.length) return 'draft'
  if (live.some((s) => IN_FLIGHT.includes(s))) return 'publishing'
  if (live.some((s) => s === 'scheduled')) return 'scheduled'
  if (live.every((s) => s === 'published')) return 'published'
  if (live.every((s) => s === 'failed')) return 'failed'
  return 'partial'
}

/** Recomputes and stores each post's status from its jobs. */
export async function rollupPosts(postIds: string[]): Promise<void> {
  if (!postIds.length) return
  const client = db()
  const { data } = await client.from('social_publish_jobs').select('post_id,status').in('post_id', postIds)
  const byPost = new Map<string, JobStatus[]>()
  for (const id of postIds) byPost.set(id, [])
  for (const r of data ?? []) byPost.get(String(r.post_id))?.push(r.status as JobStatus)
  const now = new Date().toISOString()
  await Promise.all(
    [...byPost].map(([id, statuses]) =>
      client.from('social_posts').update({ status: rollupStatus(statuses), updated_at: now }).eq('id', id)
    )
  )
}

export async function logEvent(
  jobId: string,
  from: string | null,
  to: string | null,
  detail: Record<string, unknown> | null = null
): Promise<void> {
  const { error } = await db().from('social_job_events').insert({ job_id: jobId, from_status: from, to_status: to, detail })
  if (error) console.error('[social] event log failed', error.message)
}

type PostRow = { id: string; scheduled_at: string | null; status: PostStatus }

/**
 * Brings a scheduled post's jobs in line with its targets and time:
 * new target → new job, removed target → its unstarted job deleted, and every
 * unstarted job's run_at follows the post's time. Failed or cancelled jobs on a
 * still-selected target are re-armed, which is what "Schedule" on a post that
 * partly failed should mean.
 */
export async function syncJobs(postIds: string[], opts: { rearm?: boolean } = {}): Promise<void> {
  if (!postIds.length) return
  const client = db()
  const [{ data: posts }, { data: targets }, { data: jobs }] = await Promise.all([
    client.from('social_posts').select('id,scheduled_at,status').in('id', postIds),
    client.from('social_post_targets').select('post_id,account_id').in('post_id', postIds),
    client.from('social_publish_jobs').select('id,post_id,account_id,status').in('post_id', postIds),
  ])

  const inserts: Record<string, unknown>[] = []
  const deletes: string[] = []
  const now = new Date().toISOString()

  for (const p of (posts ?? []) as PostRow[]) {
    if (p.status === 'draft' || !p.scheduled_at) continue
    const want = new Set((targets ?? []).filter((t) => t.post_id === p.id).map((t) => String(t.account_id)))
    const have = (jobs ?? []).filter((j) => j.post_id === p.id)

    for (const j of have) {
      const status = j.status as JobStatus
      if (!want.has(String(j.account_id))) {
        if (status === 'scheduled' || status === 'failed' || status === 'cancelled') deletes.push(String(j.id))
        continue
      }
      if (status === 'scheduled') {
        await client.from('social_publish_jobs').update({ run_at: p.scheduled_at, updated_at: now }).eq('id', j.id)
      } else if (opts.rearm && (status === 'failed' || status === 'cancelled')) {
        await client
          .from('social_publish_jobs')
          .update({
            status: 'scheduled',
            run_at: p.scheduled_at,
            attempts: 0,
            lease_until: null,
            container_id: null,
            child_ids: null,
            publish_started_at: null,
            stage_started_at: null,
            error_kind: null,
            error_code: null,
            error_subcode: null,
            error_message: null,
            updated_at: now,
          })
          .eq('id', j.id)
        await logEvent(String(j.id), status, 'scheduled', { reason: 'rescheduled' })
      }
    }
    for (const accountId of want) {
      if (!have.some((j) => String(j.account_id) === accountId)) {
        inserts.push({ post_id: p.id, account_id: accountId, status: 'scheduled', run_at: p.scheduled_at })
      }
    }
  }

  if (deletes.length) await client.from('social_publish_jobs').delete().in('id', deletes)
  if (inserts.length) {
    const { error } = await client.from('social_publish_jobs').insert(inserts)
    if (error) throw error
  }
  await rollupPosts(postIds)
}

/**
 * Takes posts back to draft. Only unstarted jobs can go; returns how many posts
 * had a job already under way (those keep running).
 */
export async function unscheduleJobs(postIds: string[]): Promise<number> {
  if (!postIds.length) return 0
  const client = db()
  const { data: jobs } = await client.from('social_publish_jobs').select('id,post_id,status').in('post_id', postIds)
  const busy = new Set<string>()
  const removable: string[] = []
  for (const j of jobs ?? []) {
    const s = j.status as JobStatus
    if (s === 'scheduled' || s === 'failed' || s === 'cancelled') removable.push(String(j.id))
    else if (IN_FLIGHT.includes(s)) busy.add(String(j.post_id))
  }
  if (removable.length) await client.from('social_publish_jobs').delete().in('id', removable)
  await rollupPosts(postIds)
  return busy.size
}

/** Re-arms one failed job to run now. */
export async function retryJob(jobId: string): Promise<string | null> {
  const client = db()
  const { data: job } = await client.from('social_publish_jobs').select('id,post_id,status,remote_id').eq('id', jobId).single()
  if (!job) return null
  if (job.status !== 'failed' && job.status !== 'cancelled') return String(job.post_id)
  const now = new Date().toISOString()
  await client
    .from('social_publish_jobs')
    .update({
      status: job.remote_id ? 'published' : 'scheduled',
      run_at: now,
      attempts: 0,
      lease_until: null,
      // A failed container is useless; a remote_id is kept so it is never re-posted.
      container_id: null,
      child_ids: null,
      publish_started_at: null,
      stage_started_at: null,
      error_kind: null,
      error_code: null,
      error_subcode: null,
      error_message: null,
      updated_at: now,
    })
    .eq('id', jobId)
  await logEvent(jobId, String(job.status), 'scheduled', { reason: 'manual retry' })
  await rollupPosts([String(job.post_id)])
  return String(job.post_id)
}
