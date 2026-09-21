// Facebook Page publishing steps.
//
//   image     POST /{page}/photos (url, caption, published)              → done
//   carousel  POST /{page}/photos published=false per item, then
//             POST /{page}/feed attached_media                           → done
//   reel      /video_reels start → rupload file_url → finish(PUBLISHED)  → poll → done
//   video     POST /{page}/videos file_url                               → poll → done
//
// A video is a reel only when Facebook would take it as one (fbVideoMode);
// otherwise it goes up as a regular Page video.
//
// A reel's or video's id is kept in container_id while Facebook processes it and
// only becomes remote_id once it is live — remote_id means "published, never
// post again", and a video that fails processing must stay retryable.
//
// The publish call is the one that must not happen twice. Right before it the
// step stamps publish_started_at; if a later attempt finds that stamp with no
// remote_id, the earlier call may have landed, so it looks for the post on the
// Page before trying again.

import { LIMITS } from '../config'
import { graphGet, graphPost, ruploadHosted } from '../graph'
import { fbVideoMode } from '../validate'
import { inSeconds, StepFailure, type StepContext, type StepResult } from './context'

const POLL = 60

function absolute(permalink: string | undefined | null): string | null {
  if (!permalink) return null
  return permalink.startsWith('/') ? `https://www.facebook.com${permalink}` : permalink
}

/** Permalink lookup never fails a job — the post is already live by then. */
async function permalinkOf(id: string, token: string): Promise<string | null> {
  try {
    const r = await graphGet<{ permalink_url?: string }>(id, token, { fields: 'permalink_url' })
    return absolute(r.permalink_url)
  } catch {
    return null
  }
}

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

/** A post on the Page published since `since` with this exact text, if any. */
async function findPublished(ctx: StepContext, since: string): Promise<{ id: string; permalink: string | null } | null> {
  const r = await graphGet<{ data: { id: string; message?: string; permalink_url?: string }[] }>(
    `${ctx.account.external_id}/published_posts`,
    ctx.token,
    { fields: 'id,message,permalink_url,created_time', since: unix(since) - 120, limit: 25 }
  )
  const caption = ctx.post.caption.trim()
  const hits = r.data.filter((p) => (p.message ?? '').trim() === caption)
  if (!hits.length) return null
  // With no caption to match on, only an unambiguous single post counts.
  if (!caption && hits.length > 1) return null
  return { id: hits[0].id, permalink: absolute(hits[0].permalink_url) }
}

async function photo(ctx: StepContext): Promise<StepResult> {
  if (ctx.job.publish_started_at) {
    const found = await findPublished(ctx, ctx.job.publish_started_at)
    if (found) return { status: 'published', remoteId: found.id, permalink: found.permalink }
  }
  const url = await ctx.mediaUrl(ctx.media[0])
  await ctx.save({ publish_started_at: new Date().toISOString() })
  const r = await graphPost<{ id: string; post_id?: string }>(`${ctx.account.external_id}/photos`, ctx.token, {
    url,
    caption: ctx.post.caption,
    published: true,
  })
  const id = r.post_id ?? r.id
  return { status: 'published', remoteId: id, permalink: await permalinkOf(id, ctx.token) }
}

async function multiPhoto(ctx: StepContext): Promise<StepResult> {
  const children = [...(ctx.job.child_ids ?? [])]
  // Unpublished photos are harmless if we crash between them — they never
  // appear on the Page unless attached to a post.
  for (let i = children.length; i < ctx.media.length; i++) {
    const r = await graphPost<{ id: string }>(`${ctx.account.external_id}/photos`, ctx.token, {
      url: await ctx.mediaUrl(ctx.media[i]),
      published: false,
    })
    children.push(r.id)
    await ctx.save({ child_ids: children })
  }

  if (ctx.job.publish_started_at) {
    const found = await findPublished(ctx, ctx.job.publish_started_at)
    if (found) return { status: 'published', remoteId: found.id, permalink: found.permalink }
  }
  const params: Record<string, string> = { message: ctx.post.caption }
  children.forEach((id, i) => {
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
  })
  await ctx.save({ publish_started_at: new Date().toISOString() })
  const r = await graphPost<{ id: string }>(`${ctx.account.external_id}/feed`, ctx.token, params)
  return { status: 'published', remoteId: r.id, permalink: await permalinkOf(r.id, ctx.token) }
}

type VideoStatus = {
  status?: {
    video_status?: string
    uploading_phase?: { status?: string }
    processing_phase?: { status?: string; errors?: { code?: number; message?: string }[] }
    publishing_phase?: { status?: string }
  }
  permalink_url?: string
}

async function videoStatus(ctx: StepContext, id: string) {
  return graphGet<VideoStatus>(id, ctx.token, { fields: 'status,permalink_url' })
}

function processingError(s: VideoStatus): string | null {
  const phase = s.status?.processing_phase
  if (s.status?.video_status === 'error' || phase?.status === 'error') {
    return phase?.errors?.[0]?.message ?? 'Facebook could not process the video.'
  }
  return null
}

async function pollVideo(ctx: StepContext): Promise<StepResult> {
  const id = ctx.job.container_id
  if (!id) throw new StepFailure('Lost track of the uploaded video.')
  const s = await videoStatus(ctx, id)
  const err = processingError(s)
  if (err) throw new StepFailure(err)
  const published = s.status?.publishing_phase?.status === 'complete' || s.status?.video_status === 'ready'
  if (published) return { status: 'published', remoteId: id, permalink: absolute(s.permalink_url) }
  return { status: 'processing', runAt: inSeconds(POLL) }
}

async function reel(ctx: StepContext): Promise<StepResult> {
  if (ctx.job.status === 'processing') return pollVideo(ctx)

  let videoId = ctx.job.container_id
  const resuming = !!videoId
  if (!videoId) {
    // Meta allows 30 API-published reels per Page per rolling 24 h. Checked
    // before anything is started, so a deferred job goes back to plain scheduled.
    const { count, oldest } = await ctx.fbReelsLast24h()
    if (count >= LIMITS.fbReelsPerDay) {
      const freeAt = oldest ? new Date(new Date(oldest).getTime() + 24 * 3600_000 + 60_000) : inSeconds(3600)
      return { status: 'scheduled', runAt: freeAt, note: 'Facebook reel limit (30 / 24 h) reached; deferred.' }
    }
    const start = await graphPost<{ video_id: string }>(`${ctx.account.external_id}/video_reels`, ctx.token, {
      upload_phase: 'start',
    })
    videoId = start.video_id
    await ctx.save({ container_id: videoId })
  }

  const current = resuming ? await videoStatus(ctx, videoId) : null
  if (current && processingError(current)) throw new StepFailure(processingError(current)!)
  if (current?.status?.uploading_phase?.status !== 'complete') {
    await ruploadHosted(videoId, ctx.token, await ctx.mediaUrl(ctx.media[0]))
  }

  // Already finished by an earlier attempt whose reply we never saw.
  const started = current?.status?.publishing_phase?.status
  if (ctx.job.publish_started_at && started && started !== 'not_started') {
    return { status: 'processing', runAt: inSeconds(POLL) }
  }

  await ctx.save({ publish_started_at: new Date().toISOString() })
  await graphPost(`${ctx.account.external_id}/video_reels`, ctx.token, {
    upload_phase: 'finish',
    video_id: videoId,
    video_state: 'PUBLISHED',
    description: ctx.post.caption,
  })
  return { status: 'processing', runAt: inSeconds(POLL) }
}

async function pageVideo(ctx: StepContext): Promise<StepResult> {
  if (ctx.job.status === 'processing' || ctx.job.container_id) return pollVideo(ctx)

  if (ctx.job.publish_started_at) {
    const r = await graphGet<{ data: { id: string; description?: string }[] }>(
      `${ctx.account.external_id}/videos`,
      ctx.token,
      { fields: 'id,description,created_time', since: unix(ctx.job.publish_started_at) - 120, limit: 25 }
    )
    const hit = r.data.find((v) => (v.description ?? '').trim() === ctx.post.caption.trim())
    if (hit) return { status: 'processing', runAt: inSeconds(POLL), patch: { container_id: hit.id } }
  }

  const fileUrl = await ctx.mediaUrl(ctx.media[0])
  await ctx.save({ publish_started_at: new Date().toISOString() })
  const r = await graphPost<{ id: string }>(`${ctx.account.external_id}/videos`, ctx.token, {
    file_url: fileUrl,
    description: ctx.post.caption,
    published: true,
  })
  return { status: 'processing', runAt: inSeconds(POLL), patch: { container_id: r.id } }
}

export async function stepFacebook(ctx: StepContext): Promise<StepResult> {
  switch (ctx.post.post_type) {
    case 'image':
      return photo(ctx)
    case 'carousel':
      if (ctx.media.some((m) => m.kind !== 'image')) {
        throw new StepFailure('Facebook multi-photo posts take photos only.')
      }
      return multiPhoto(ctx)
    case 'reel':
      return fbVideoMode(ctx.media[0]) === 'reel' ? reel(ctx) : pageVideo(ctx)
  }
}
