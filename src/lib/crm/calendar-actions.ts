'use server'

// Server actions for the booking calendar.
//
// Same posture as actions.ts: these are reachable by direct POST, not only
// through our own forms, so each one validates its input rather than trusting
// the caller. Authentication is a layer up — src/proxy.ts refuses any request
// to /atrium-crm without a valid gt_session cookie, and these live under that
// same matcher. The two public endpoints under /api/atrium do not, and they
// deliberately do not import from here.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  blockSlot,
  getCalendarSettings,
  relockSlot,
  saveCalendarSettings,
  unblockSlot,
  unlockSlot,
  type CalendarSettingsPatch,
} from './calendar'

const CRM_PATH = '/atrium-crm'

export type CalendarActionResult = { ok: true } | { ok: false; message: string }

/** 'HH:MM', 24-hour. The time inputs produce this; a direct POST might not. */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')

const rangeSchema = z.tuple([hhmm, hhmm]).refine(([from, to]) => from < to, {
  message: 'A day has to end after it starts',
})

/**
 * The weekly hours. Keys are '0'–'6', Sunday first, matching the engine and the
 * `availability` column. A day that is closed is simply absent — an empty array
 * would mean the same thing, but two ways to say it is one too many.
 */
const availabilitySchema = z.record(
  // A plain string key rather than an enum: z.record over an enum requires
  // every key to be present, and a closed day is an absent one.
  z.string().regex(/^[0-6]$/, 'Expected a weekday 0–6'),
  z.array(rangeSchema)
)

const settingsSchema = z.object({
  slot_duration_minutes: z.number().int().min(5).max(480),
  buffer_before_minutes: z.number().int().min(0).max(480),
  buffer_after_minutes: z.number().int().min(0).max(480),
  min_notice_minutes: z.number().int().min(0).max(60 * 24 * 30),
  booking_window_days: z.number().int().min(1).max(365),
  fake_busy_percent: z.number().int().min(0).max(100),
  // Checked against the runtime rather than a list: an invalid zone here would
  // make every slot calculation throw, and Intl already knows every valid name.
  timezone: z.string().trim().min(1).refine(isValidTimezone, 'Unknown timezone'),
  availability: availabilitySchema,
})

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function saveCalendarSettingsAction(
  input: z.input<typeof settingsSchema>
): Promise<CalendarActionResult> {
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid settings' }
  }

  const result = await saveCalendarSettings(parsed.data as CalendarSettingsPatch)
  if (!result.ok) return result

  revalidatePath(CRM_PATH)
  return { ok: true }
}

const isoInstant = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Invalid date')

/**
 * Block one slot out by hand.
 *
 * Only the start comes from the browser. The end is the slot length as the
 * database currently has it, so a caller cannot block out a fortnight by
 * posting its own end time.
 */
export async function blockSlotAction(startIso: string): Promise<CalendarActionResult> {
  const parsed = isoInstant.safeParse(startIso)
  if (!parsed.success) return { ok: false, message: 'Invalid date' }

  const found = await getCalendarSettings()
  if (!found.ok) return { ok: false, message: found.message }

  const start = new Date(parsed.data)
  const end = new Date(start.getTime() + found.settings.slot_duration_minutes * 60_000)

  const result = await blockSlot(start.toISOString(), end.toISOString())
  if (!result.ok) return result

  revalidatePath(CRM_PATH)
  return { ok: true }
}

export async function unblockSlotAction(blockId: string): Promise<CalendarActionResult> {
  const parsed = z.string().uuid().safeParse(blockId)
  if (!parsed.success) return { ok: false, message: 'Invalid block' }

  const result = await unblockSlot(parsed.data)
  if (!result.ok) return result

  revalidatePath(CRM_PATH)
  return { ok: true }
}

export async function unlockSlotAction(startIso: string): Promise<CalendarActionResult> {
  const parsed = isoInstant.safeParse(startIso)
  if (!parsed.success) return { ok: false, message: 'Invalid date' }

  const result = await unlockSlot(new Date(parsed.data).toISOString())
  if (!result.ok) return result

  revalidatePath(CRM_PATH)
  return { ok: true }
}

export async function relockSlotAction(startIso: string): Promise<CalendarActionResult> {
  const parsed = isoInstant.safeParse(startIso)
  if (!parsed.success) return { ok: false, message: 'Invalid date' }

  const result = await relockSlot(new Date(parsed.data).toISOString())
  if (!result.ok) return result

  revalidatePath(CRM_PATH)
  return { ok: true }
}
