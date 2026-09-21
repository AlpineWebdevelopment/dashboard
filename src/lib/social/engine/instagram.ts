// Instagram publishing steps (Instagram API with Facebook Login).
//
//   image     POST /{ig}/media image_url                         ┐
//   reel      POST /{ig}/media media_type=REELS video_url        ├→ poll status_code → media_publish
//   carousel  children (is_carousel_item) → poll → CAROUSEL     ┘
//
// media_type=VIDEO is deprecated for feed video (2023); only carousel *items*
// still use it. Containers expire 24 h after creation; an expired one is
// rebuilt from scratch rather than failing the post.

import { graphGet, graphPost } from '../graph'
import { MetaError } from '../errors'
import { inSeconds, StepFailure, type StepContext, type StepResult } from './context'

const POLL = 60

type StatusCode = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED'

async function containerStatus(ctx: StepContext, id: string) {
  return graphGet<{ status_code?: StatusCode; status?: string }>(id, ctx.token, { fields: 'status_code,status' })
}

async function childStatuses(ctx: StepContext, ids: string[]) {
  return graphGet<Record<string, { status_code?: StatusCode; status?: string }>>('', ctx.token, {
    ids: ids.join(','),
    fields: 'status_code,status',
  })
}

/** Start over: containers are cheap and single-use. */
function rebuild(note: string): StepResult {
  return {
    status: 'creating',
    runAt: null,
    patch: { container_id: null, child_ids: null, publish_started_at: null },
    note,
  }
}

async function permalinkOf(ctx: StepContext, mediaId: string): Promise<string | null> {
  try {
    return (await graphGet<{ permalink?: string }>(mediaId, ctx.token, { fields: 'permalink' })).permalink ?? null
  } catch {
    return null
  }
}

/** After an unanswered media_publish: find the media it made by caption and time. */
async function findPublished(ctx: StepContext): Promise<StepResult> {
  const since = new Date(ctx.job.publish_started_at ?? ctx.job.run_at).getTime() - 120_000
  const r = await graphGet<{ data: { id: string; caption?: string; permalink?: string; timestamp?: string }[] }>(
    `${ctx.account.external_id}/media`,
    ctx.token,
    { fields: 'id,caption,permalink,timestamp', limit: 10 }
  )
  const caption = ctx.post.caption.trim()
  const hit = r.data.find(
    (m) => (m.caption ?? '').trim() === caption && (!m.timestamp || new Date(m.timestamp).getTime() >= since)
  )
  // The container says PUBLISHED, so it is live either way; without a match we
  // still record it (by container id) so nothing ever publishes it again.
  if (hit) return { status: 'published', remoteId: hit.id, permalink: hit.permalink ?? null }
  return { status: 'published', remoteId: `container:${ctx.job.container_id}`, permalink: null }
}

async function create(ctx: StepContext): Promise<StepResult> {
  const ig = ctx.account.external_id
  const caption = ctx.post.caption

  // A container saved by an attempt that died before its status was written.
  if (ctx.job.container_id) return { status: 'processing', runAt: null }

  if (ctx.post.post_type === 'image') {
    const r = await graphPost<{ id: string }>(`${ig}/media`, ctx.token, {
      image_url: await ctx.mediaUrl(ctx.media[0]),
      caption,
    })
    await ctx.save({ container_id: r.id })
    // Images are usually ready at once; check now instead of a tick later.
    return { status: 'processing', runAt: null, patch: { container_id: r.id } }
  }

  if (ctx.post.post_type === 'reel') {
    const r = await graphPost<{ id: string }>(`${ig}/media`, ctx.token, {
      media_type: 'REELS',
      video_url: await ctx.mediaUrl(ctx.media[0]),
      caption,
      share_to_feed: true,
    })
    await ctx.save({ container_id: r.id })
    return { status: 'processing', runAt: inSeconds(POLL), patch: { container_id: r.id } }
  }

  // Carousel: one item container per media, persisted as we go.
  const children = [...(ctx.job.child_ids ?? [])]
  for (let i = children.length; i < ctx.media.length; i++) {
    const m = ctx.media[i]
    const url = await ctx.mediaUrl(m)
    const r = await graphPost<{ id: string }>(
      `${ig}/media`,
      ctx.token,
      m.kind === 'image'
        ? { image_url: url, is_carousel_item: true }
        : { media_type: 'VIDEO', video_url: url, is_carousel_item: true }
    )
    children.push(r.id)
    await ctx.save({ child_ids: children })
  }
  const hasVideo = ctx.media.some((m) => m.kind === 'video')
  return { status: 'processing', runAt: hasVideo ? inSeconds(POLL) : null, patch: { child_ids: children } }
}

async function poll(ctx: StepContext): Promise<StepResult> {
  // Carousel still waiting on its items: the parent can only be made once all are FINISHED.
  if (ctx.post.post_type === 'carousel' && !ctx.job.container_id) {
    const ids = ctx.job.child_ids ?? []
    if (!ids.length) return rebuild('Carousel items were missing; recreating.')
    const statuses = await childStatuses(ctx, ids)
    const codes = ids.map((id) => statuses[id]?.status_code)
    const errored = ids.find((id) => statuses[id]?.status_code === 'ERROR')
    if (errored) throw new StepFailure(`Instagram rejected a carousel item: ${statuses[errored]?.status ?? 'processing error'}`)
    if (codes.includes('EXPIRED')) return rebuild('A carousel item expired; recreating.')
    if (!codes.every((c) => c === 'FINISHED')) return { status: 'processing', runAt: inSeconds(POLL) }

    const parent = await graphPost<{ id: string }>(`${ctx.account.external_id}/media`, ctx.token, {
      media_type: 'CAROUSEL',
      children: ids.join(','),
      caption: ctx.post.caption,
    })
    await ctx.save({ container_id: parent.id })
    return { status: 'processing', runAt: null, patch: { container_id: parent.id } }
  }

  const id = ctx.job.container_id
  if (!id) return rebuild('Container was missing; recreating.')
  const s = await containerStatus(ctx, id)
  switch (s.status_code) {
    case 'FINISHED':
      return { status: 'publishing', runAt: null }
    case 'PUBLISHED':
      return findPublished(ctx)
    case 'ERROR':
      throw new StepFailure(`Instagram could not process the media: ${s.status ?? 'unknown error'}`)
    case 'EXPIRED':
      return rebuild('Container expired; recreating.')
    default:
      return { status: 'processing', runAt: inSeconds(POLL) }
  }
}

async function publish(ctx: StepContext): Promise<StepResult> {
  const id = ctx.job.container_id
  if (!id) return rebuild('Container was missing; recreating.')

  if (ctx.job.publish_started_at) {
    const s = await containerStatus(ctx, id)
    if (s.status_code === 'PUBLISHED') return findPublished(ctx)
    if (s.status_code === 'EXPIRED') return rebuild('Container expired; recreating.')
  }

  // The daily cap is documented as both 50 and 100, so ask rather than assume.
  const limit = await graphGet<{ data: { quota_usage?: number; config?: { quota_total?: number } }[] }>(
    `${ctx.account.external_id}/content_publishing_limit`,
    ctx.token,
    { fields: 'quota_usage,config' }
  )
  const usage = limit.data?.[0]?.quota_usage ?? 0
  const total = limit.data?.[0]?.config?.quota_total ?? 0
  if (total) await ctx.saveQuota(usage, total)
  if (total && usage >= total) {
    return { status: 'publishing', runAt: inSeconds(3600), note: `Instagram daily limit reached (${usage}/${total}); deferred an hour.` }
  }

  await ctx.save({ publish_started_at: new Date().toISOString() })
  try {
    const r = await graphPost<{ id: string }>(`${ctx.account.external_id}/media_publish`, ctx.token, {
      creation_id: id,
    })
    return { status: 'published', remoteId: r.id, permalink: await permalinkOf(ctx, r.id) }
  } catch (err) {
    if (err instanceof MetaError && err.subcode === 2207008) return rebuild('Container expired; recreating.')
    throw err
  }
}

export async function stepInstagram(ctx: StepContext): Promise<StepResult> {
  switch (ctx.job.status) {
    case 'scheduled':
    case 'creating':
      return create(ctx)
    case 'processing':
      return poll(ctx)
    case 'publishing':
      return publish(ctx)
    default:
      throw new StepFailure(`Unexpected status ${ctx.job.status}`)
  }
}
