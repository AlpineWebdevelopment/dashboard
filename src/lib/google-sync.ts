/**
 * The stateful half of the Google Calendar integration: token storage, the
 * sync engine, and push-notification channel management.
 *
 * Sync strategy — every pass re-reads the whole sync window for each enabled
 * calendar and reconciles it against the mirror. That is a little more traffic
 * than Google's incremental `syncToken` protocol, but for a personal calendar
 * it is one or two HTTP requests, and it is self-healing: there is no token to
 * invalidate, no 410 recovery path, and a deletion or an event dragged out of
 * the window can never leave a ghost row behind. A content hash short-circuits
 * the database writes whenever nothing actually changed.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  EventRow,
  GoogleConfig,
  fingerprint,
  getGoogleConfig,
  getWebhookUrl,
  googleEventToRow,
  listCalendars,
  listEventsInWindow,
  mapGoogleColor,
  refreshAccessToken,
  revokeToken,
  stopChannel,
  syncWindow,
  watchCalendar,
  decryptSecret,
  encryptSecret,
} from './google-calendar'

const ACCOUNT_ID = 'default'
/** Renew a push channel once it has less than this long to live. */
const CHANNEL_RENEW_BEFORE_MS = 24 * 60 * 60 * 1000
/** Collapse the burst of notifications Google sends for a single edit. */
const MIN_SYNC_INTERVAL_MS = 3_000

export type GoogleAccount = {
  id: string
  email: string
  refresh_token_enc: string
  access_token_enc: string | null
  access_token_expires_at: string | null
  scope: string
  time_zone: string
  webhook_token: string
  last_sync_at: string | null
  last_sync_source: string
  last_error: string | null
  sync_revision: number
}

export type GoogleCalendarRow = {
  id: string
  account_id: string
  summary: string
  description: string
  time_zone: string
  color: string
  primary_cal: boolean
  sync_enabled: boolean
  content_hash: string | null
  channel_id: string | null
  channel_resource_id: string | null
  channel_expiration: string | null
  last_synced_at: string | null
}

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Google Calendar sync needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — the OAuth tokens live in a table that is not reachable with the anon key.'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// ── Account storage ───────────────────────────────────────────────────────────

export async function getAccount(): Promise<GoogleAccount | null> {
  const { data } = await admin().from('google_accounts').select('*').eq('id', ACCOUNT_ID).maybeSingle()
  return (data as GoogleAccount | null) ?? null
}

async function patchAccount(patch: Record<string, unknown>): Promise<void> {
  await admin()
    .from('google_accounts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', ACCOUNT_ID)
}

export async function saveConnection(opts: {
  email: string
  refreshToken: string
  accessToken: string
  expiresIn: number
  scope: string
  timeZone: string
}): Promise<void> {
  const row = {
    id: ACCOUNT_ID,
    email: opts.email,
    refresh_token_enc: await encryptSecret(opts.refreshToken),
    access_token_enc: await encryptSecret(opts.accessToken),
    access_token_expires_at: new Date(Date.now() + opts.expiresIn * 1000).toISOString(),
    scope: opts.scope,
    time_zone: opts.timeZone,
    webhook_token: crypto.randomUUID(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }
  await admin().from('google_accounts').upsert(row, { onConflict: 'id' })
}

/** Returns a usable access token, refreshing and re-persisting it when stale. */
export async function getAccessToken(account: GoogleAccount, config: GoogleConfig): Promise<string> {
  const expiresAt = account.access_token_expires_at ? Date.parse(account.access_token_expires_at) : 0
  if (account.access_token_enc && expiresAt > Date.now() + 60_000) {
    return decryptSecret(account.access_token_enc)
  }

  const refreshToken = await decryptSecret(account.refresh_token_enc)
  const tokens = await refreshAccessToken(config, refreshToken)
  await patchAccount({
    access_token_enc: await encryptSecret(tokens.access_token),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  })
  return tokens.access_token
}

export async function disconnect(): Promise<void> {
  const db = admin()
  const account = await getAccount()
  const config = getGoogleConfig()

  if (account && config) {
    try {
      const token = await getAccessToken(account, config)
      const { data: calendars } = await db.from('google_calendars').select('*').eq('account_id', ACCOUNT_ID)
      for (const cal of (calendars ?? []) as GoogleCalendarRow[]) {
        if (cal.channel_id && cal.channel_resource_id) {
          await stopChannel(token, cal.channel_id, cal.channel_resource_id)
        }
      }
      await revokeToken(await decryptSecret(account.refresh_token_enc))
    } catch {
      // Best-effort cleanup on Google's side; the local disconnect below is
      // what actually matters and must not be blocked by a network failure.
    }
  }

  await db.from('events').delete().eq('source', 'google')
  await db.from('google_calendars').delete().eq('account_id', ACCOUNT_ID)
  await db.from('google_accounts').delete().eq('id', ACCOUNT_ID)
}

// ── Calendar list ─────────────────────────────────────────────────────────────

export async function getCalendars(): Promise<GoogleCalendarRow[]> {
  const { data } = await admin()
    .from('google_calendars')
    .select('*')
    .eq('account_id', ACCOUNT_ID)
    .order('primary_cal', { ascending: false })
    .order('summary')
  return (data ?? []) as GoogleCalendarRow[]
}

/** Mirrors Google's calendar list, preserving the user's per-calendar choices. */
export async function refreshCalendarList(accessToken: string): Promise<GoogleCalendarRow[]> {
  const db = admin()
  const remote = await listCalendars(accessToken)
  const existing = await getCalendars()
  const known = new Map(existing.map(c => [c.id, c]))

  const rows = remote.map(cal => {
    const prior = known.get(cal.id)
    return {
      id: cal.id,
      account_id: ACCOUNT_ID,
      summary: cal.summary ?? cal.id,
      description: cal.description ?? '',
      time_zone: cal.timeZone ?? 'UTC',
      color: prior?.color ?? mapGoogleColor(cal.backgroundColor),
      primary_cal: cal.primary === true,
      // First time we see a calendar, respect whether it is shown in Google.
      sync_enabled: prior ? prior.sync_enabled : cal.primary === true || cal.selected === true,
      updated_at: new Date().toISOString(),
    }
  })

  if (rows.length) await db.from('google_calendars').upsert(rows, { onConflict: 'id' })

  // Drop calendars that vanished from the account, along with their events.
  const remoteIds = new Set(remote.map(c => c.id))
  for (const cal of existing) {
    if (!remoteIds.has(cal.id)) {
      await db.from('events').delete().eq('source', 'google').eq('google_calendar_id', cal.id)
      await db.from('google_calendars').delete().eq('id', cal.id)
    }
  }

  return getCalendars()
}

export async function setCalendarEnabled(calendarId: string, enabled: boolean): Promise<void> {
  const db = admin()
  await db
    .from('google_calendars')
    .update({ sync_enabled: enabled, content_hash: null, updated_at: new Date().toISOString() })
    .eq('id', calendarId)
  if (!enabled) {
    await db.from('events').delete().eq('source', 'google').eq('google_calendar_id', calendarId)
    await bumpRevision()
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export type SyncResult = {
  ok: boolean
  changed: boolean
  calendars: number
  events: number
  skipped?: 'not-connected' | 'debounced' | 'not-configured'
  error?: string
}

async function bumpRevision(): Promise<void> {
  const account = await getAccount()
  if (!account) return
  await patchAccount({ sync_revision: Number(account.sync_revision ?? 0) + 1 })
}

/**
 * Re-reads every enabled calendar and reconciles the mirror.
 *
 * @param trigger where the sync came from — surfaced in the UI as provenance
 * @param force   run even if a sync just happened (used by the manual button)
 */
export async function syncAll(trigger: 'webhook' | 'cron' | 'manual' | 'connect', force = false): Promise<SyncResult> {
  const config = getGoogleConfig()
  if (!config) return { ok: false, changed: false, calendars: 0, events: 0, skipped: 'not-configured' }

  try {
    // Inside the try: a missing service-role key or an unreachable database
    // must surface as a reported error, not an unhandled 500 at the route.
    const account = await getAccount()
    if (!account) return { ok: false, changed: false, calendars: 0, events: 0, skipped: 'not-connected' }

    if (!force && account.last_sync_at && Date.now() - Date.parse(account.last_sync_at) < MIN_SYNC_INTERVAL_MS) {
      return { ok: true, changed: false, calendars: 0, events: 0, skipped: 'debounced' }
    }

    const accessToken = await getAccessToken(account, config)
    const calendars = (await refreshCalendarList(accessToken)).filter(c => c.sync_enabled)

    let changed = false
    let events = 0
    for (const calendar of calendars) {
      const result = await syncCalendar(accessToken, calendar)
      changed = changed || result.changed
      events += result.events
    }

    await ensureWatchChannels(accessToken, calendars)
    await patchAccount({
      last_sync_at: new Date().toISOString(),
      last_sync_source: trigger,
      last_error: null,
      ...(changed ? { sync_revision: Number(account.sync_revision ?? 0) + 1 } : {}),
    })

    return { ok: true, changed, calendars: calendars.length, events }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Recording the failure is itself a database write, so it can fail too —
    // never let that mask the original error.
    await patchAccount({
      last_error: message,
      last_sync_at: new Date().toISOString(),
      last_sync_source: trigger,
    }).catch(() => {})
    return { ok: false, changed: false, calendars: 0, events: 0, error: message }
  }
}

async function syncCalendar(
  accessToken: string,
  calendar: GoogleCalendarRow
): Promise<{ changed: boolean; events: number }> {
  const db = admin()
  const { timeMin, timeMax, from, to } = syncWindow()

  const googleEvents = await listEventsInWindow(accessToken, calendar.id, timeMin, timeMax)
  const hash = await fingerprint(googleEvents)
  if (hash === calendar.content_hash) {
    await db
      .from('google_calendars')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', calendar.id)
    return { changed: false, events: googleEvents.length }
  }

  const syncRun = crypto.randomUUID()
  const rows: (EventRow & { google_sync_run: string })[] = []
  for (const event of googleEvents) {
    if (event.status === 'cancelled') continue
    const row = googleEventToRow(event, calendar.id, calendar.time_zone, calendar.color)
    if (row) rows.push({ ...row, google_sync_run: syncRun })
  }

  // Upsert in chunks so a busy calendar doesn't produce one enormous request.
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db
      .from('events')
      .upsert(rows.slice(i, i + 200), { onConflict: 'google_calendar_id,google_event_id' })
    if (error) throw new Error(`Failed to write events for ${calendar.summary}: ${error.message}`)
  }

  // Anything in the window that this pass didn't touch was deleted in Google.
  await db
    .from('events')
    .delete()
    .eq('source', 'google')
    .eq('google_calendar_id', calendar.id)
    .gte('date', from)
    .lte('date', to)
    .neq('google_sync_run', syncRun)

  // Keep the mirror bounded: drop anything that has fallen outside the window.
  await db.from('events').delete().eq('source', 'google').eq('google_calendar_id', calendar.id).lt('date', from)
  await db.from('events').delete().eq('source', 'google').eq('google_calendar_id', calendar.id).gt('date', to)

  await db
    .from('google_calendars')
    .update({ content_hash: hash, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', calendar.id)

  return { changed: true, events: rows.length }
}

// ── Push notification channels ────────────────────────────────────────────────

/**
 * Keeps a live `events.watch` channel on every enabled calendar. Channels are
 * short-lived by design, so this runs on each sync and renews anything within
 * a day of expiry. No-ops when there is no public HTTPS URL to receive them.
 */
export async function ensureWatchChannels(accessToken: string, calendars: GoogleCalendarRow[]): Promise<void> {
  const address = getWebhookUrl()
  if (!address) return

  const account = await getAccount()
  if (!account?.webhook_token) return

  const db = admin()
  for (const calendar of calendars) {
    const expiresAt = calendar.channel_expiration ? Date.parse(calendar.channel_expiration) : 0
    const healthy = calendar.channel_id && expiresAt > Date.now() + CHANNEL_RENEW_BEFORE_MS
    if (healthy) continue

    try {
      const channel = await watchCalendar(accessToken, calendar.id, address, account.webhook_token)
      // Replace the old channel only once the new one is live, so a failure
      // here never leaves the calendar with no notifications at all.
      if (calendar.channel_id && calendar.channel_resource_id) {
        await stopChannel(accessToken, calendar.channel_id, calendar.channel_resource_id)
      }
      await db
        .from('google_calendars')
        .update({
          channel_id: channel.id,
          channel_resource_id: channel.resourceId,
          channel_expiration: channel.expiration,
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendar.id)
    } catch {
      // A calendar without push still gets picked up by the cron poll.
    }
  }
}

/** Resolves the calendar a push notification belongs to, or null if unknown. */
export async function findCalendarByChannel(channelId: string): Promise<GoogleCalendarRow | null> {
  const { data } = await admin().from('google_calendars').select('*').eq('channel_id', channelId).maybeSingle()
  return (data as GoogleCalendarRow | null) ?? null
}

// ── Status for the UI ─────────────────────────────────────────────────────────

export type GoogleStatus = {
  configured: boolean
  connected: boolean
  email: string | null
  lastSyncAt: string | null
  lastSyncSource: string | null
  lastError: string | null
  revision: number
  pushEnabled: boolean
  calendars: { id: string; summary: string; color: string; enabled: boolean; primary: boolean }[]
}

export async function getStatus(): Promise<GoogleStatus> {
  const configured = getGoogleConfig() !== null
  if (!configured) {
    return {
      configured: false,
      connected: false,
      email: null,
      lastSyncAt: null,
      lastSyncSource: null,
      lastError: null,
      revision: 0,
      pushEnabled: false,
      calendars: [],
    }
  }

  const account = await getAccount()
  if (!account) {
    return {
      configured: true,
      connected: false,
      email: null,
      lastSyncAt: null,
      lastSyncSource: null,
      lastError: null,
      revision: 0,
      pushEnabled: getWebhookUrl() !== null,
      calendars: [],
    }
  }

  const calendars = await getCalendars()
  return {
    configured: true,
    connected: true,
    email: account.email,
    lastSyncAt: account.last_sync_at,
    lastSyncSource: account.last_sync_source || null,
    lastError: account.last_error,
    revision: Number(account.sync_revision ?? 0),
    pushEnabled: getWebhookUrl() !== null && calendars.some(c => c.channel_id !== null),
    calendars: calendars.map(c => ({
      id: c.id,
      summary: c.summary,
      color: c.color,
      enabled: c.sync_enabled,
      primary: c.primary_cal,
    })),
  }
}
