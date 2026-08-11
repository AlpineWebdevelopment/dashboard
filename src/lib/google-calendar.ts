/**
 * Google Calendar REST client + OAuth, implemented on plain `fetch` so the
 * project picks up no new dependency. Everything here is stateless — the
 * database side of the sync lives in `google-sync.ts`.
 */

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/** Read-only: the dashboard never writes back to Google. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/** How much of the calendar we mirror, relative to today. */
export const SYNC_WINDOW_PAST_DAYS = Number(process.env.GOOGLE_SYNC_PAST_DAYS ?? 120)
export const SYNC_WINDOW_FUTURE_DAYS = Number(process.env.GOOGLE_SYNC_FUTURE_DAYS ?? 400)

// ── Configuration ─────────────────────────────────────────────────────────────

export type GoogleConfig = {
  clientId: string
  clientSecret: string
  appUrl: string | null
}

/** Returns null when the integration hasn't been configured yet. */
export function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, appUrl: normalizeAppUrl(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL) }
}

function normalizeAppUrl(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

/**
 * The OAuth redirect target. Derived from the incoming request so the same
 * build works on localhost and in production, unless pinned via APP_URL.
 */
export function getRedirectUri(req: Request): string {
  const configured = normalizeAppUrl(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL)
  const origin = configured ?? new URL(req.url).origin
  return `${origin}/api/google/callback`
}

/**
 * Push notifications require a public HTTPS URL Google can reach, so they are
 * only available once APP_URL points at a real deployment. Without it the
 * integration falls back to cron polling.
 */
export function getWebhookUrl(): string | null {
  const appUrl = normalizeAppUrl(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL)
  if (!appUrl) return null
  if (!appUrl.startsWith('https://')) return null
  if (/localhost|127\.0\.0\.1/.test(appUrl)) return null
  return `${appUrl}/api/google/webhook`
}

// ── Token encryption at rest ──────────────────────────────────────────────────
// Refresh tokens are long-lived credentials to a user's calendar, so they are
// encrypted with a key derived from AUTH_SECRET rather than stored as plaintext
// rows in Supabase.

const ENC_PREFIX = 'v1'

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET must be set to store Google credentials')
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return [
    ENC_PREFIX,
    Buffer.from(salt).toString('base64url'),
    Buffer.from(iv).toString('base64url'),
    Buffer.from(ct).toString('base64url'),
  ].join('.')
}

export async function decryptSecret(payload: string): Promise<string> {
  const [version, saltB64, ivB64, ctB64] = payload.split('.')
  if (version !== ENC_PREFIX || !saltB64 || !ivB64 || !ctB64) {
    throw new Error('Stored Google credential is malformed — reconnect the account')
  }
  const salt = new Uint8Array(Buffer.from(saltB64, 'base64url'))
  const iv = new Uint8Array(Buffer.from(ivB64, 'base64url'))
  const key = await deriveKey(salt)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, Buffer.from(ctB64, 'base64url'))
  return new TextDecoder().decode(pt)
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function buildAuthUrl(config: GoogleConfig, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    // offline + consent is what makes Google hand back a refresh token; without
    // it a re-authorisation returns only a short-lived access token.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${OAUTH_AUTH_URL}?${params}`
}

export type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type: string
}

export async function exchangeCode(config: GoogleConfig, code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function refreshAccessToken(config: GoogleConfig, refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(OAUTH_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => {
    // Revocation is best-effort: the local disconnect still needs to succeed.
  })
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function googleFetch(accessToken: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Google Calendar API ${path} failed (${res.status}): ${await res.text()}`)
  }
  return res
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) return ''
  const body = await res.json()
  return typeof body?.email === 'string' ? body.email : ''
}

export type GoogleCalendarListEntry = {
  id: string
  summary?: string
  description?: string
  timeZone?: string
  backgroundColor?: string
  primary?: boolean
  selected?: boolean
  accessRole?: string
  deleted?: boolean
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const out: GoogleCalendarListEntry[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({ maxResults: '250', showHidden: 'false' })
    if (pageToken) params.set('pageToken', pageToken)
    const body = await (await googleFetch(accessToken, `/users/me/calendarList?${params}`)).json()
    for (const item of body.items ?? []) if (!item.deleted) out.push(item)
    pageToken = body.nextPageToken
  } while (pageToken)
  return out
}

export type GoogleEvent = {
  id: string
  status?: string
  etag?: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  iCalUID?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
}

/**
 * Every event in the sync window, with recurring events already expanded into
 * individual instances by Google (`singleEvents`).
 */
export async function listEventsInWindow(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      showDeleted: 'false',
      maxResults: '250',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const body = await (
      await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`)
    ).json()
    out.push(...((body.items ?? []) as GoogleEvent[]))
    pageToken = body.nextPageToken
  } while (pageToken)
  return out
}

export type WatchChannel = { id: string; resourceId: string; expiration: string | null }

/** Registers a push notification channel. Google calls `address` on every change. */
export async function watchCalendar(
  accessToken: string,
  calendarId: string,
  address: string,
  token: string
): Promise<WatchChannel> {
  const body = await (
    await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
      method: 'POST',
      body: JSON.stringify({ id: crypto.randomUUID(), type: 'web_hook', address, token }),
    })
  ).json()
  return {
    id: body.id,
    resourceId: body.resourceId,
    expiration: body.expiration ? new Date(Number(body.expiration)).toISOString() : null,
  }
}

export async function stopChannel(accessToken: string, channelId: string, resourceId: string): Promise<void> {
  await fetch(`${CALENDAR_API}/channels/stop`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: channelId, resourceId }),
  }).catch(() => {
    // A channel that can't be stopped will expire on its own.
  })
}

// ── Mapping Google events onto dashboard event rows ───────────────────────────

const PALETTE = ['indigo', 'rose', 'emerald', 'amber', 'sky', 'violet', 'orange'] as const

/** Approximate hue of each palette colour, used to match Google's calendar colours. */
const PALETTE_HUES: Record<(typeof PALETTE)[number], number> = {
  rose: 350,
  orange: 25,
  amber: 45,
  emerald: 155,
  sky: 200,
  indigo: 240,
  violet: 270,
}

/** Picks the closest dashboard palette colour to a Google `#rrggbb` colour. */
export function mapGoogleColor(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return 'sky'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta < 0.05) return 'sky' // greys have no meaningful hue

  let hue: number
  if (max === r) hue = 60 * (((g - b) / delta) % 6)
  else if (max === g) hue = 60 * ((b - r) / delta + 2)
  else hue = 60 * ((r - g) / delta + 4)
  if (hue < 0) hue += 360

  let best: string = 'sky'
  let bestDistance = Infinity
  for (const name of PALETTE) {
    const raw = Math.abs(PALETTE_HUES[name] - hue)
    const distance = Math.min(raw, 360 - raw)
    if (distance < bestDistance) {
      bestDistance = distance
      best = name
    }
  }
  return best
}

/** Splits an instant into wall-clock date and time as seen in `timeZone`. */
export function inTimeZone(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  // Some ICU builds render midnight as hour 24 of the previous day.
  const hour = get('hour') === '24' ? '00' : get('hour')
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` }
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export type EventRow = {
  title: string
  date: string
  time: string | null
  end_date: string | null
  end_time: string | null
  all_day: boolean
  description: string | null
  location: string | null
  color: string
  source: 'google'
  google_event_id: string
  google_calendar_id: string
  google_ical_uid: string | null
  google_etag: string | null
  google_html_link: string | null
}

export function googleEventToRow(
  event: GoogleEvent,
  calendarId: string,
  calendarTimeZone: string,
  color: string
): EventRow | null {
  const start = event.start
  const end = event.end
  if (!start) return null

  let date: string
  let time: string | null = null
  let endDate: string | null = null
  let endTime: string | null = null
  let allDay = false

  if (start.date) {
    // All-day event. Google's end.date is exclusive, so a single-day event has
    // an end one day after its start — store the inclusive last day instead.
    allDay = true
    date = start.date
    endDate = end?.date ? addDays(end.date, -1) : start.date
    if (endDate < date) endDate = date
  } else if (start.dateTime) {
    const tz = start.timeZone ?? calendarTimeZone
    const startLocal = inTimeZone(start.dateTime, tz)
    date = startLocal.date
    time = startLocal.time
    if (end?.dateTime) {
      const endLocal = inTimeZone(end.dateTime, end.timeZone ?? tz)
      endDate = endLocal.date
      endTime = endLocal.time
    }
  } else {
    return null
  }

  return {
    title: event.summary?.trim() || '(no title)',
    date,
    time,
    end_date: endDate,
    end_time: endTime,
    all_day: allDay,
    description: event.description ?? null,
    location: event.location ?? null,
    color,
    source: 'google',
    google_event_id: event.id,
    google_calendar_id: calendarId,
    google_ical_uid: event.iCalUID ?? null,
    google_etag: event.etag ?? null,
    google_html_link: event.htmlLink ?? null,
  }
}

/** The [timeMin, timeMax] window synced on every pass, as RFC3339 instants. */
export function syncWindow(now = new Date()): { timeMin: string; timeMax: string; from: string; to: string } {
  const min = new Date(now)
  min.setUTCDate(min.getUTCDate() - SYNC_WINDOW_PAST_DAYS)
  const max = new Date(now)
  max.setUTCDate(max.getUTCDate() + SYNC_WINDOW_FUTURE_DAYS)
  return {
    timeMin: min.toISOString(),
    timeMax: max.toISOString(),
    from: min.toISOString().slice(0, 10),
    to: max.toISOString().slice(0, 10),
  }
}

/** Stable fingerprint of a fetch result, so unchanged calendars skip all writes. */
export async function fingerprint(events: GoogleEvent[]): Promise<string> {
  const material = events
    .map(e => `${e.id}:${e.etag ?? ''}`)
    .sort()
    .join('|')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return Buffer.from(digest).toString('base64url')
}
