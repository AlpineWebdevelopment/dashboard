// Constants for the social scheduler. Safe for the browser: no secrets here.
//
// Every limit below was read off developers.facebook.com on 2026-09-21. Where
// the docs disagree with themselves (the IG daily cap: 100 in the guide, 50 in
// the reference) nothing is hard-coded — the engine asks Meta at publish time.

/** The one place the Graph API version is pinned. v26.0 shipped 2026-07-29. */
export const GRAPH_VERSION = 'v26.0'
export const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`
export const RUPLOAD_URL = `https://rupload.facebook.com/video-upload/${GRAPH_VERSION}`

/** The UI's clock. Everything in the database is UTC. */
export const SOCIAL_TZ = 'Europe/Budapest'

export const STORAGE_BUCKET = 'social-media'

/**
 * Requested at login. The first three publish to Pages, the next two to IG via
 * Facebook Login (the `instagram_business_*` names belong to Instagram Login,
 * a different product). business_management covers Pages reached through a
 * Business portfolio rather than a direct Page role.
 */
export const SOCIAL_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
]

export const LIMITS = {
  /** Supabase free plan: 50 MB per object. Raise with the bucket limit on Pro. */
  uploadMaxBytes: 50 * 1024 * 1024,
  caption: {
    igMaxChars: 2200,
    igMaxHashtags: 30,
    igMaxMentions: 20,
    fbMaxChars: 63206,
  },
  igImage: {
    maxBytes: 8 * 1024 * 1024,
    minAspect: 4 / 5,
    maxAspect: 1.91,
    minWidth: 320,
    maxWidth: 1440,
  },
  igReel: {
    minSeconds: 3,
    maxSeconds: 15 * 60,
    maxBytes: 300 * 1024 * 1024,
    minFps: 23,
    maxFps: 60,
  },
  igCarousel: { minItems: 2, maxItems: 10 },
  fbImage: { maxBytes: 10 * 1024 * 1024 },
  fbReel: { minSeconds: 3, maxSeconds: 90, minShortSide: 540, minFps: 24, maxFps: 60 },
  /** Meta: 30 API-published reels per Page per rolling 24h. */
  fbReelsPerDay: 30,
} as const

/** Formats Facebook takes as a photo. WebP is not on the list. */
export const FB_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff']
export const UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime'

export const VIDEO_CODECS_OK = ['avc1', 'avc3', 'hvc1', 'hev1']
export const AUDIO_CODECS_OK = ['mp4a']

/** Engine tuning. */
export const ENGINE = {
  claimLimit: 10,
  concurrency: 3,
  /**
   * Stop starting new jobs after this long. The route's maxDuration is 60 s and
   * one job is at most a few 15 s Graph calls, so this leaves it room to finish.
   */
  budgetMs: 30_000,
  maxAttempts: 6,
  pollSeconds: 60,
  /** Give up on a container Meta is still "processing" after this long. */
  processingTimeoutMs: 3 * 60 * 60 * 1000,
  /** Signed media URLs handed to Meta: one IG container lifetime. */
  mediaUrlSeconds: 24 * 60 * 60,
  /** Delete uploaded files this long after every target has published. */
  purgeAfterDays: 7,
}
