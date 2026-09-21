// Row shapes for the social scheduler, as the UI sees them. Hand-written, like
// finance-types.ts. Token columns are deliberately absent: nothing that crosses
// to the browser carries one.

export type Platform = 'facebook' | 'instagram'
export type PostType = 'image' | 'reel' | 'carousel'
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed'
export type JobStatus =
  | 'scheduled'
  | 'creating'
  | 'processing'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'
export type ErrorKind = 'transient' | 'rate_limit' | 'permanent' | 'token'

export type SocialConnection = {
  id: string
  fb_user_id: string
  fb_name: string | null
  user_token_expires_at: string | null
  data_access_expires_at: string | null
  scopes: string[]
  status: 'ok' | 'expiring' | 'invalid'
  last_checked_at: string | null
}

export type IgQuota = { usage: number; total: number; checked_at: string }

export type SocialAccount = {
  id: string
  connection_id: string
  platform: Platform
  external_id: string
  page_id: string
  name: string | null
  username: string | null
  picture_url: string | null
  enabled: boolean
  token_status: 'ok' | 'invalid'
  last_error: string | null
  quota: IgQuota | null
}

export type SocialMedia = {
  id: string
  kind: 'image' | 'video'
  mime: string
  bytes: number
  jpeg_bytes: number | null
  has_jpeg: boolean
  width: number | null
  height: number | null
  duration_s: number | null
  video_codec: string | null
  audio_codec: string | null
  faststart: boolean | null
  fps: number | null
  original_name: string | null
  purged: boolean
  /** Short-lived signed URL for the UI. */
  thumb_url: string | null
}

export type SocialJob = {
  id: string
  post_id: string
  account_id: string
  status: JobStatus
  run_at: string
  attempts: number
  remote_id: string | null
  permalink: string | null
  error_kind: ErrorKind | null
  error_code: number | null
  error_subcode: number | null
  error_message: string | null
  published_at: string | null
}

export type SocialPost = {
  id: string
  post_type: PostType
  caption: string
  scheduled_at: string | null
  status: PostStatus
  sort_key: number
  created_at: string
  media: SocialMedia[]
  target_ids: string[]
  jobs: SocialJob[]
}

export type SocialSlot = {
  id: string
  account_id: string
  /** 1 = Mon … 7 = Sun */
  weekdays: number[]
  /** 'HH:MM' */
  time_local: string
  timezone: string
  active: boolean
}

export type SocialError = {
  kind: 'not_configured' | 'not_allowed' | 'invalid' | 'not_found' | 'meta' | 'unknown'
  /** Safe to render. */
  message: string
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: SocialError }
