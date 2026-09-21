// Meta error → what the engine does with it, and what the UI says about it.
//
// Codes from developers.facebook.com/docs/graph-api/guides/error-handling and
// the IG error-code reference (checked 2026-09-21). The rule of thumb: retry
// what might succeed unchanged, stop on anything that needs a human.

import type { ErrorKind } from './types'

export class MetaError extends Error {
  code: number | null
  subcode: number | null
  httpStatus: number | null
  /** Meta's own message, kept for the tooltip. */
  raw: string
  /** No response at all (timeout, DNS, reset) — the request may or may not have landed. */
  network: boolean
  kind: ErrorKind
  /** From X-Business-Use-Case-Usage when Meta says how long to back off. */
  retryAfterMs: number | null

  constructor(opts: {
    code?: number | null
    subcode?: number | null
    httpStatus?: number | null
    raw: string
    network?: boolean
    retryAfterMs?: number | null
  }) {
    const code = opts.code ?? null
    const subcode = opts.subcode ?? null
    const kind = classify(code, subcode, opts.httpStatus ?? null, !!opts.network)
    super(plainMessage(code, subcode, opts.raw, !!opts.network))
    this.name = 'MetaError'
    this.code = code
    this.subcode = subcode
    this.httpStatus = opts.httpStatus ?? null
    this.raw = opts.raw
    this.network = !!opts.network
    this.kind = kind
    this.retryAfterMs = opts.retryAfterMs ?? null
  }
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 368, 613, 80001, 80002, 80004])
const TRANSIENT_CODES = new Set([1, 2, -2, 9004, 9007])

export function classify(
  code: number | null,
  subcode: number | null,
  httpStatus: number | null,
  network: boolean
): ErrorKind {
  if (network) return 'transient'
  if (code === 190 || code === 102) return 'token'
  if (code === 9 && subcode === 2207042) return 'rate_limit' // IG daily publishing cap
  if (code !== null && RATE_LIMIT_CODES.has(code)) return 'rate_limit'
  if (code !== null && TRANSIENT_CODES.has(code)) return 'transient'
  if (code === null) return httpStatus !== null && httpStatus < 500 ? 'permanent' : 'transient'
  if (httpStatus !== null && httpStatus >= 500 && code !== 100) return 'transient'
  return 'permanent'
}

const SUBCODE_MESSAGES: Record<number, string> = {
  2207003: 'Meta took too long to download the media. It will be retried.',
  2207004: 'The image is larger than Instagram’s 8 MB limit.',
  2207005: 'Instagram does not accept this image format — it needs a JPEG.',
  2207006: 'Meta could not find the media. The upload may have been deleted.',
  2207008: 'The Instagram container expired before it was published.',
  2207009: 'The image’s aspect ratio is outside what Instagram accepts (4:5 to 1.91:1).',
  2207010: 'The caption is longer than Instagram’s 2,200 characters.',
  2207020: 'The media link expired while Meta was downloading it.',
  2207026: 'Instagram does not accept this video format. Export as H.264 MP4 with AAC audio.',
  2207027: 'Meta is still processing the media.',
  2207028: 'A carousel needs 2 to 10 items.',
  2207040: 'The caption mentions more than 20 accounts.',
  2207042: 'This Instagram account has hit its daily publishing limit.',
  2207050: 'The Instagram account is restricted or inactive. Check it in the Instagram app.',
  2207051: 'Instagram flagged this as possible spam and blocked it.',
  2207052: 'Meta could not download the media from its link.',
  2207057: 'The reel’s cover frame is outside the video’s length.',
  460: 'The Facebook password changed, so the connection was revoked. Reconnect.',
  463: 'The Facebook connection expired. Reconnect.',
  467: 'The Facebook connection is no longer valid. Reconnect.',
  458: 'The app was removed from your Facebook account. Reconnect.',
  492: 'You no longer have a role on this Page that allows posting.',
}

const CODE_MESSAGES: Record<number, string> = {
  1: 'Meta had a temporary problem. It will be retried.',
  2: 'Meta’s service is temporarily unavailable. It will be retried.',
  4: 'The app hit Meta’s rate limit. It will be retried later.',
  10: 'Meta refused permission for this action. Reconnect and grant every permission asked for.',
  17: 'Your account hit Meta’s rate limit. It will be retried later.',
  32: 'The Page hit Meta’s rate limit. It will be retried later.',
  36000: 'The image is larger than Instagram’s 8 MB limit.',
  36001: 'Instagram does not accept this image format — it needs a JPEG.',
  36003: 'The image’s aspect ratio is outside what Instagram accepts (4:5 to 1.91:1).',
  36004: 'The caption is longer than Instagram’s 2,200 characters.',
  100: 'Meta rejected one of the values sent.',
  190: 'The Facebook connection is no longer valid. Reconnect.',
  200: 'Meta refused permission. Check your role on the Page and reconnect.',
  352: 'The video format is not supported. Export as H.264 MP4 with AAC audio.',
  368: 'Meta temporarily blocked posting from this account. It will be retried later.',
  506: 'Meta rejected this as a duplicate of a recent post.',
  613: 'Too many calls in a short time. It will be retried later.',
  9004: 'Meta could not download the media from its link. It will be retried.',
  9007: 'Meta is still processing the media.',
  80001: 'The Page hit Meta’s rate limit. It will be retried later.',
  80002: 'The Instagram account hit Meta’s rate limit. It will be retried later.',
}

export function plainMessage(
  code: number | null,
  subcode: number | null,
  raw: string,
  network = false
): string {
  if (network) return 'Could not reach Meta. It will be retried.'
  if (subcode !== null && SUBCODE_MESSAGES[subcode]) return SUBCODE_MESSAGES[subcode]
  if (code !== null && code >= 200 && code <= 299) return CODE_MESSAGES[200]
  if (code !== null && CODE_MESSAGES[code]) {
    // 100 is a catch-all; Meta's own text is usually the more useful half.
    return code === 100 && raw ? `${CODE_MESSAGES[100]} ${raw}` : CODE_MESSAGES[code]
  }
  return raw || 'Meta returned an error.'
}
