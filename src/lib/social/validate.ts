// Pre-schedule checks against Meta's published media rules (see config.ts).
//
// Pure and shared: the bulk editor runs it on every edit to paint cells, and
// the schedule action runs it again server-side before creating any job, so a
// post the UI calls invalid can never reach the engine.
//
// Errors block scheduling; warnings are things Meta may accept with a caveat,
// or that the engine handles by falling back (a long video on Facebook posts
// as a regular Page video instead of a reel).

import { AUDIO_CODECS_OK, FB_IMAGE_MIMES, LIMITS, VIDEO_CODECS_OK } from './config'
import type { Platform, PostType, SocialMedia } from './types'

export type Issue = {
  level: 'error' | 'warning'
  /** null = applies to the post whatever the target. */
  platform: Platform | null
  message: string
}

type MediaInfo = Pick<
  SocialMedia,
  | 'kind'
  | 'mime'
  | 'bytes'
  | 'jpeg_bytes'
  | 'has_jpeg'
  | 'width'
  | 'height'
  | 'duration_s'
  | 'video_codec'
  | 'audio_codec'
  | 'faststart'
  | 'fps'
  | 'purged'
>

export function countHashtags(caption: string): number {
  return (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length
}

export function countMentions(caption: string): number {
  return (caption.match(/(^|\s)@[\w.]+/g) ?? []).length
}

/** The type a set of media implies. There is no free choice: 1 image, 1 video, or several. */
export function inferPostType(media: Pick<SocialMedia, 'kind'>[]): PostType {
  if (media.length > 1) return 'carousel'
  return media[0]?.kind === 'video' ? 'reel' : 'image'
}

/**
 * How a video goes to a Facebook Page. A Page reel must be 3–90 s, portrait,
 * and at least 540 px on its short side; anything else posts as a regular
 * Page video, which has none of those limits.
 */
export function fbVideoMode(m: Pick<SocialMedia, 'duration_s' | 'width' | 'height'>): 'reel' | 'video' {
  const d = m.duration_s ?? 0
  const w = m.width ?? 0
  const h = m.height ?? 0
  const r = LIMITS.fbReel
  if (d < r.minSeconds || d > r.maxSeconds) return 'video'
  if (!w || !h || h <= w) return 'video'
  if (Math.min(w, h) < r.minShortSide) return 'video'
  return 'reel'
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

function igImageIssues(m: MediaInfo, label: string): Issue[] {
  const out: Issue[] = []
  const L = LIMITS.igImage
  const jpegBytes = m.mime === 'image/jpeg' && !m.has_jpeg ? m.bytes : m.jpeg_bytes
  if (m.mime !== 'image/jpeg' && !m.has_jpeg) {
    out.push({ level: 'error', platform: 'instagram', message: `${label}: Instagram needs a JPEG and no JPEG version was made. Re-upload it.` })
  } else if (jpegBytes !== null && jpegBytes > L.maxBytes) {
    out.push({ level: 'error', platform: 'instagram', message: `${label}: ${mb(jpegBytes)} is over Instagram’s 8 MB limit.` })
  }
  if (m.width && m.height) {
    const aspect = m.width / m.height
    if (aspect < L.minAspect - 0.005 || aspect > L.maxAspect + 0.005) {
      out.push({
        level: 'error',
        platform: 'instagram',
        message: `${label}: aspect ratio ${aspect.toFixed(2)} is outside Instagram’s 4:5 – 1.91:1. Crop it first.`,
      })
    }
    if (m.width < L.minWidth) {
      out.push({ level: 'warning', platform: 'instagram', message: `${label}: ${m.width}px wide — Instagram will upscale it to 320px.` })
    }
  }
  return out
}

function fbImageIssues(m: MediaInfo, label: string): Issue[] {
  const usesJpeg = !FB_IMAGE_MIMES.includes(m.mime)
  if (usesJpeg && !m.has_jpeg) {
    return [{ level: 'error', platform: 'facebook', message: `${label}: Facebook does not accept ${m.mime}, and no JPEG version was made.` }]
  }
  const bytes = usesJpeg ? m.jpeg_bytes ?? m.bytes : m.bytes
  if (bytes > LIMITS.fbImage.maxBytes) {
    return [{ level: 'error', platform: 'facebook', message: `${label}: ${mb(bytes)} is over Facebook’s 10 MB photo limit.` }]
  }
  return []
}

function videoContainerIssues(m: MediaInfo, label: string, platform: Platform): Issue[] {
  const out: Issue[] = []
  if (m.video_codec && !VIDEO_CODECS_OK.includes(m.video_codec)) {
    out.push({ level: 'error', platform, message: `${label}: video codec “${m.video_codec}” is not accepted. Export as H.264 (or HEVC) MP4.` })
  }
  if (platform === 'instagram' && m.audio_codec && !AUDIO_CODECS_OK.includes(m.audio_codec)) {
    out.push({ level: 'error', platform, message: `${label}: audio codec “${m.audio_codec}” is not accepted. Use AAC.` })
  }
  if (platform === 'instagram' && m.faststart === false) {
    out.push({
      level: 'warning',
      platform,
      message: `${label}: the file’s index (moov atom) is at the end. Instagram asks for it at the front — re-export with “fast start” / “web optimized” if it gets rejected.`,
    })
  }
  return out
}

function igReelIssues(m: MediaInfo, label: string): Issue[] {
  const out = videoContainerIssues(m, label, 'instagram')
  const R = LIMITS.igReel
  const d = m.duration_s ?? 0
  if (d && d < R.minSeconds) out.push({ level: 'error', platform: 'instagram', message: `${label}: ${d.toFixed(1)} s is shorter than a reel’s 3 s minimum.` })
  if (d > R.maxSeconds) out.push({ level: 'error', platform: 'instagram', message: `${label}: longer than a reel’s 15-minute maximum.` })
  if (m.fps && (m.fps < R.minFps - 0.5 || m.fps > R.maxFps + 0.5)) {
    out.push({ level: 'warning', platform: 'instagram', message: `${label}: ${m.fps.toFixed(0)} fps — Instagram asks for 23–60 fps.` })
  }
  if (m.width && m.height && Math.abs(m.width / m.height - 9 / 16) > 0.02) {
    out.push({ level: 'warning', platform: 'instagram', message: `${label}: not 9:16, so the Reels tab will crop or letterbox it.` })
  }
  return out
}

function fbVideoIssues(m: MediaInfo, label: string): Issue[] {
  const out = videoContainerIssues(m, label, 'facebook')
  if (fbVideoMode(m) === 'video') {
    const why =
      (m.duration_s ?? 0) > LIMITS.fbReel.maxSeconds
        ? 'longer than 90 s'
        : (m.width ?? 0) >= (m.height ?? 0)
          ? 'not portrait'
          : (m.duration_s ?? 0) < LIMITS.fbReel.minSeconds
            ? 'shorter than 3 s'
            : 'under 540 px wide'
    out.push({ level: 'warning', platform: 'facebook', message: `${label}: ${why}, so Facebook gets it as a regular Page video, not a reel.` })
  }
  return out
}

export function validatePost(input: {
  caption: string
  media: MediaInfo[]
  platforms: Platform[]
  /** Scheduling needs a target and a time; editing a draft does not. */
  forSchedule?: boolean
  scheduledAt?: string | null
  /** Editing a failed post whose time has passed must still be possible. */
  allowPast?: boolean
}): Issue[] {
  const { caption, media } = input
  const platforms = [...new Set(input.platforms)]
  const out: Issue[] = []

  if (!media.length) out.push({ level: 'error', platform: null, message: 'No media.' })
  if (media.some((m) => m.purged)) out.push({ level: 'error', platform: null, message: 'The files were deleted after publishing. Re-upload to post again.' })
  if (media.some((m) => m.bytes > LIMITS.uploadMaxBytes)) {
    out.push({ level: 'error', platform: null, message: 'A file is over the 50 MB upload limit.' })
  }
  if (input.forSchedule) {
    if (!platforms.length) out.push({ level: 'error', platform: null, message: 'Pick at least one account.' })
    if (!input.scheduledAt) out.push({ level: 'error', platform: null, message: 'Set a time.' })
    else if (!input.allowPast && new Date(input.scheduledAt).getTime() < Date.now() - 60_000) {
      out.push({ level: 'error', platform: null, message: 'The time is in the past.' })
    }
  }

  const type = inferPostType(media)
  const carousel = type === 'carousel'

  if (platforms.includes('instagram')) {
    const C = LIMITS.caption
    if (caption.length > C.igMaxChars) out.push({ level: 'error', platform: 'instagram', message: `Caption is ${caption.length} characters; Instagram allows 2,200.` })
    const tags = countHashtags(caption)
    if (tags > C.igMaxHashtags) out.push({ level: 'error', platform: 'instagram', message: `${tags} hashtags; Instagram allows 30.` })
    const mentions = countMentions(caption)
    if (mentions > C.igMaxMentions) out.push({ level: 'error', platform: 'instagram', message: `${mentions} @mentions; Instagram allows 20.` })
    if (carousel && (media.length < LIMITS.igCarousel.minItems || media.length > LIMITS.igCarousel.maxItems)) {
      out.push({ level: 'error', platform: 'instagram', message: `A carousel takes 2–10 items; this has ${media.length}.` })
    }
    if (carousel) {
      const aspects = media.filter((m) => m.width && m.height).map((m) => m.width! / m.height!)
      if (aspects.some((a) => Math.abs(a - aspects[0]) > 0.02)) {
        out.push({ level: 'warning', platform: 'instagram', message: 'Items have different shapes; Instagram crops them all to the first one’s.' })
      }
    }
    media.forEach((m, i) => {
      const label = carousel ? `Item ${i + 1}` : m.kind === 'video' ? 'Video' : 'Image'
      if (m.kind === 'image') out.push(...igImageIssues(m, label))
      else if (carousel) {
        out.push(...videoContainerIssues(m, label, 'instagram'))
        if ((m.duration_s ?? 0) < LIMITS.igReel.minSeconds) out.push({ level: 'error', platform: 'instagram', message: `${label}: shorter than 3 s.` })
      } else out.push(...igReelIssues(m, label))
    })
  }

  if (platforms.includes('facebook')) {
    if (caption.length > LIMITS.caption.fbMaxChars) out.push({ level: 'error', platform: 'facebook', message: 'Caption is over Facebook’s 63,206 characters.' })
    if (carousel && media.some((m) => m.kind === 'video')) {
      out.push({ level: 'error', platform: 'facebook', message: 'Facebook multi-photo posts take photos only. Untick Facebook or remove the video.' })
    }
    media.forEach((m, i) => {
      const label = carousel ? `Item ${i + 1}` : m.kind === 'video' ? 'Video' : 'Image'
      if (m.kind === 'image') out.push(...fbImageIssues(m, label))
      else if (!carousel) out.push(...fbVideoIssues(m, label))
    })
  }

  return out
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === 'error')
