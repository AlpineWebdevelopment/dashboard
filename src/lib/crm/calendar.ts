// Data access for the booking calendar. Server-side only — everything here
// goes through crmDb(), which carries the service-role key.
//
// The tables are created by supabase-atrium-calendar.sql, which is run by hand.
// Until someone runs it every read here answers `{ missing: true }` rather than
// throwing, so the CRM keeps working and the calendar section explains what to
// do instead of the whole page failing. That distinction is worth the extra
// type: a missing table is a setup step, not an outage.

import { crmConfigured, crmDb } from './db'
import {
  computeAdminSlots,
  dateStrInTz,
  type AdminDay,
  type BusyInterval,
  type CalendarSettings,
  type ManualBlock,
} from './availability'

/** The settings table holds exactly one row, at this id. */
export const SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export type CalendarSettingsRow = CalendarSettings & {
  id: string
  updated_at: string
}

/**
 * Why the calendar has nothing to show.
 *
 * 'not_configured' is a missing service-role key — the same state the lead list
 * reports. 'missing_tables' is the SQL file not yet run. They are told apart
 * because the fix is different, and guessing wrong costs an hour in the wrong
 * dashboard.
 */
export type CalendarUnavailable = 'not_configured' | 'missing_tables'

export type CalendarLoad =
  | { ok: true; settings: CalendarSettingsRow; days: AdminDay[]; booked: BookedSlot[] }
  | { ok: false; reason: CalendarUnavailable; message: string }

/**
 * A booking, with enough of the lead attached to name it on the grid.
 *
 * Both ends are carried because the buffers widen a booking across slots either
 * side of it: the grid marks those busy too, and only the rows inside
 * [start, end) are the meeting itself.
 */
export type BookedSlot = {
  start: string
  end: string
  leadId: string
  leadName: string
}

/** PostgREST's code for "that table does not exist". */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || /Could not find the table/i.test(error.message ?? '')
}

const NOT_CONFIGURED = {
  ok: false as const,
  reason: 'not_configured' as const,
  message:
    'The CRM database is not configured — SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.',
}

const MISSING_TABLES = {
  ok: false as const,
  reason: 'missing_tables' as const,
  message:
    'The calendar tables do not exist yet. Run supabase-atrium-calendar.sql in the SQL editor of this project.',
}

/** The settings row, or why it could not be read. */
export async function getCalendarSettings(): Promise<
  { ok: true; settings: CalendarSettingsRow } | { ok: false; reason: CalendarUnavailable; message: string }
> {
  if (!crmConfigured()) return NOT_CONFIGURED

  const { data, error } = await crmDb()
    .from('crm_calendar_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle()

  if (error) return isMissingTable(error) ? MISSING_TABLES : { ...MISSING_TABLES, message: error.message }
  // The table exists but the seed row is gone — the same fix, since the SQL
  // file re-inserts it and is safe to re-run.
  if (!data) return MISSING_TABLES

  return { ok: true, settings: data as CalendarSettingsRow }
}

/**
 * Everything the engine needs besides the settings: what is booked, what is
 * blocked by hand, which hidden slots have been unlocked, and which days have
 * had their scarcity frozen.
 *
 * Read for a window a day wider than the booking window, so a slot that runs
 * over the horizon still knows about the appointment it collides with.
 */
async function loadCalendarState(settings: CalendarSettingsRow) {
  const db = crmDb()
  const nowIso = new Date().toISOString()
  const horizonIso = new Date(
    Date.now() + (settings.booking_window_days + 1) * 24 * 60 * 60_000
  ).toISOString()

  const [appts, blocks, overrides, pins] = await Promise.all([
    db
      .from('crm_appointments')
      .select('id,lead_id,starts_at,ends_at')
      .eq('status', 'booked')
      .gte('ends_at', nowIso)
      .lte('starts_at', horizonIso),
    db
      .from('crm_manual_blocks')
      .select('id,starts_at,ends_at')
      .gte('ends_at', nowIso)
      .lte('starts_at', horizonIso),
    db
      .from('crm_slot_overrides')
      .select('slot_start')
      .gte('slot_start', nowIso)
      .lte('slot_start', horizonIso),
    db.from('crm_day_fake_pins').select('day,fake_percent'),
  ])

  const appointments = (appts.data ?? []) as {
    id: string
    lead_id: string
    starts_at: string
    ends_at: string
  }[]

  const freed = new Set(
    ((overrides.data ?? []) as { slot_start: string }[]).map((o) =>
      new Date(o.slot_start).toISOString()
    )
  )

  const dayPins: Record<string, number> = {}
  for (const p of (pins.data ?? []) as { day: string; fake_percent: number }[]) {
    dayPins[p.day] = p.fake_percent
  }

  return {
    appointments,
    blocks: (blocks.data ?? []) as ManualBlock[],
    freed,
    dayPins,
  }
}

/** Who each appointment is with, so the grid can say more than 'booked'. */
async function namesForLeads(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()

  const { data } = await crmDb()
    .from('leads')
    .select('id,company_name,contact_name,email')
    .in('id', unique)

  const names = new Map<string, string>()
  for (const l of (data ?? []) as {
    id: string
    company_name: string | null
    contact_name: string | null
    email: string | null
  }[]) {
    names.set(l.id, l.company_name || l.contact_name || l.email || 'Unnamed lead')
  }
  return names
}

/** The whole calendar screen in one call. */
export async function loadAdminCalendar(now: Date = new Date()): Promise<CalendarLoad> {
  const found = await getCalendarSettings()
  if (!found.ok) return found

  const { settings } = found
  const { appointments, blocks, freed, dayPins } = await loadCalendarState(settings)

  const days = computeAdminSlots(
    settings,
    appointments as BusyInterval[],
    blocks,
    now,
    freed,
    dayPins
  )

  const names = await namesForLeads(appointments.map((a) => a.lead_id))
  const booked: BookedSlot[] = appointments.map((a) => ({
    start: new Date(a.starts_at).toISOString(),
    end: new Date(a.ends_at).toISOString(),
    leadId: a.lead_id,
    leadName: names.get(a.lead_id) ?? 'Unnamed lead',
  }))

  return { ok: true, settings, days, booked }
}

/**
 * The same state, for the public endpoints. Blocks count as busy there — a
 * visitor has no business knowing whether a time is taken by a meeting or by
 * you deciding not to work.
 */
export async function loadPublicCalendar(): Promise<
  | { ok: true; settings: CalendarSettingsRow; busy: BusyInterval[]; freed: Set<string>; dayPins: Record<string, number> }
  | { ok: false; reason: CalendarUnavailable; message: string }
> {
  const found = await getCalendarSettings()
  if (!found.ok) return found

  const { settings } = found
  const { appointments, blocks, freed, dayPins } = await loadCalendarState(settings)

  return {
    ok: true,
    settings,
    busy: [...appointments, ...blocks] as BusyInterval[],
    freed,
    dayPins,
  }
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export type CalendarSettingsPatch = {
  slot_duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  min_notice_minutes: number
  booking_window_days: number
  fake_busy_percent: number
  timezone: string
  availability: Record<string, [string, string][]>
}

export async function saveCalendarSettings(
  patch: CalendarSettingsPatch
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!crmConfigured()) return { ok: false, message: NOT_CONFIGURED.message }

  const { error } = await crmDb()
    .from('crm_calendar_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', SETTINGS_ID)

  if (error) {
    return { ok: false, message: isMissingTable(error) ? MISSING_TABLES.message : error.message }
  }
  return { ok: true }
}

/**
 * Freeze a day's scarcity percentage the first time it is touched by hand.
 *
 * Without this, blocking one slot on Thursday and then moving the global dial
 * would reshuffle which of Thursday's other slots are hidden — a day you had
 * just curated rearranging itself behind you. `ignoreDuplicates` keeps the
 * earliest pin, so the freeze happens once and later edits leave it alone.
 */
async function pinDay(startIso: string, settings: CalendarSettingsRow) {
  const day = dateStrInTz(startIso, settings.timezone)
  await crmDb()
    .from('crm_day_fake_pins')
    .upsert(
      { day, fake_percent: settings.fake_busy_percent ?? 0 },
      { onConflict: 'day', ignoreDuplicates: true }
    )
}

export type SlotResult = { ok: true } | { ok: false; message: string }

/** Block a slot out by hand, so nothing can be booked into it. */
export async function blockSlot(startIso: string, endIso: string): Promise<SlotResult> {
  const found = await getCalendarSettings()
  if (!found.ok) return { ok: false, message: found.message }

  const { error } = await crmDb()
    .from('crm_manual_blocks')
    .insert({ starts_at: startIso, ends_at: endIso })
  if (error) return { ok: false, message: error.message }

  await pinDay(startIso, found.settings)
  return { ok: true }
}

export async function unblockSlot(blockId: string): Promise<SlotResult> {
  if (!crmConfigured()) return { ok: false, message: NOT_CONFIGURED.message }

  const { error } = await crmDb().from('crm_manual_blocks').delete().eq('id', blockId)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** Force a slot the scarcity dial is hiding back into the visitor's list. */
export async function unlockSlot(startIso: string): Promise<SlotResult> {
  const found = await getCalendarSettings()
  if (!found.ok) return { ok: false, message: found.message }

  const { error } = await crmDb()
    .from('crm_slot_overrides')
    .upsert({ slot_start: startIso }, { onConflict: 'slot_start', ignoreDuplicates: true })
  if (error) return { ok: false, message: error.message }

  await pinDay(startIso, found.settings)
  return { ok: true }
}

export async function relockSlot(startIso: string): Promise<SlotResult> {
  const found = await getCalendarSettings()
  if (!found.ok) return { ok: false, message: found.message }

  const { error } = await crmDb().from('crm_slot_overrides').delete().eq('slot_start', startIso)
  if (error) return { ok: false, message: error.message }

  await pinDay(startIso, found.settings)
  return { ok: true }
}

/** Record a booking. Called by the public endpoint once the slot is validated. */
export async function createAppointment(
  leadId: string,
  startsAt: string,
  endsAt: string
): Promise<SlotResult> {
  if (!crmConfigured()) return { ok: false, message: NOT_CONFIGURED.message }

  const { error } = await crmDb()
    .from('crm_appointments')
    .insert({ lead_id: leadId, starts_at: startsAt, ends_at: endsAt, status: 'booked' })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
