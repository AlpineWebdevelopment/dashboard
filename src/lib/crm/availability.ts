// Turning available hours into bookable slots.
//
// Pure functions — no database, no clock of their own beyond the `now` that is
// passed in. That is what lets the same code answer three different questions:
// what a visitor may book (computeAvailability), what the calendar screen draws
// (computeAdminSlots), and whether a slot someone just posted is genuinely free
// (validateSlot). If those three disagreed, a landing page could offer a time
// the calendar had already given away.
//
// All timezone arithmetic goes through Intl rather than getTimezoneOffset(), so
// the hours hold across a DST change: 10:00 means 10:00 in Budapest on both
// sides of the March jump, which a fixed offset would get wrong for half a day.

/** The single settings row, as the engine needs it. */
export type CalendarSettings = {
  slot_duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  min_notice_minutes: number
  booking_window_days: number
  timezone: string
  /** Keys '0' (Sun) … '6' (Sat) → the day's [from, to] 'HH:MM' ranges. */
  availability: Record<string, [string, string][]>
  /** 0–100: deterministically hide this share of otherwise-open slots. */
  fake_busy_percent?: number
}

export type BusyInterval = {
  starts_at: string
  ends_at: string
}

export type Slot = {
  /** ISO UTC instant. */
  start: string
  /** 'HH:MM' in the business timezone. */
  label: string
  /** Shown, but not bookable — a real appointment, or scarcity. */
  busy?: boolean
}

export type DayAvailability = {
  /** 'YYYY-MM-DD' in the business timezone. */
  date: string
  /** 0–6, Sunday first, matching the keys of `availability`. */
  weekday: number
  slots: Slot[]
}

/**
 * A stable 0–99 bucket for a slot.
 *
 * The scarcity dial hides a percentage of free slots. Which ones has to be the
 * same answer every time it is asked, or a slot would flicker between free and
 * taken on each page load, and one hidden from a visitor could still be booked
 * by posting its time directly. Hashing the instant gives every caller the same
 * verdict without storing a row per slot.
 */
function slotBucket(iso: string): number {
  let h = 0
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) >>> 0
  return h % 100
}

/** Offset in ms of `timeZone` at a given UTC instant. */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value
  let hour = Number(map.hour)
  if (hour === 24) hour = 0 // some engines emit 24 for midnight
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  )
  return asUTC - date.getTime()
}

/** A wall-clock time in `timeZone` → the UTC instant it names. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const offset = tzOffsetMs(timeZone, new Date(guess))
  return new Date(guess - offset)
}

/** A UTC instant, read as wall-clock parts in the business timezone. */
function partsInTz(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value
  const weekdays: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: weekdays[map.weekday] ?? 0,
    dateStr: `${map.year}-${map.month}-${map.day}`,
  }
}

/** Which business day an instant falls on — used to pin a day's scarcity. */
export function dateStrInTz(iso: string, timeZone: string): string {
  return partsInTz(new Date(iso), timeZone).dateStr
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Walk the booking window a day at a time, in the business timezone.
 *
 * The cursor is UTC midnight of today's business date, advanced in whole days
 * and re-read through the timezone each step. Advancing a local Date instead
 * would drift an hour across a DST boundary and eventually skip or repeat a day.
 */
function* daysInWindow(now: Date, windowDays: number, tz: string) {
  const cursor = partsInTz(now, tz)
  for (let i = 0; i <= windowDays; i++) {
    const instant = new Date(
      Date.UTC(cursor.year, cursor.month - 1, cursor.day) + i * 24 * 60 * 60_000
    )
    yield partsInTz(instant, tz)
  }
}

/**
 * The slots a visitor may book, grouped by day. Days with nothing open are
 * left out entirely, so a booking widget can render what it is given.
 *
 * `freed` holds slot starts unlocked by hand on the calendar screen, and
 * `dayPins` the scarcity percentage a day was frozen at when it was first
 * touched — see loadCalendarState() for where both come from.
 */
export function computeAvailability(
  settings: CalendarSettings,
  busy: BusyInterval[],
  now: Date = new Date(),
  freed: Set<string> = new Set(),
  dayPins: Record<string, number> = {}
): DayAvailability[] {
  const {
    slot_duration_minutes: dur,
    buffer_before_minutes: bufBefore,
    buffer_after_minutes: bufAfter,
    min_notice_minutes: minNotice,
    booking_window_days: windowDays,
    timezone: tz,
    availability,
    fake_busy_percent: fakeBusy = 0,
  } = settings

  const earliest = new Date(now.getTime() + minNotice * 60_000)

  // Busy times widened by the buffers, so the gap either side of a booking is
  // checked once here rather than per slot.
  const busyZones = busy.map((b) => ({
    start: new Date(b.starts_at).getTime() - bufBefore * 60_000,
    end: new Date(b.ends_at).getTime() + bufAfter * 60_000,
  }))

  const days: DayAvailability[] = []

  for (const dp of daysInWindow(now, windowDays, tz)) {
    const ranges = availability[String(dp.weekday)] ?? []
    if (ranges.length === 0) continue

    // A touched day keeps the percentage it was pinned at; the rest follow the
    // current global setting.
    const dayFake = dayPins[dp.dateStr] ?? fakeBusy

    const slots: Slot[] = []
    for (const [from, to] of ranges) {
      const fromMin = hhmmToMinutes(from)
      const toMin = hhmmToMinutes(to)
      for (let m = fromMin; m + dur <= toMin; m += dur) {
        const startUtc = zonedTimeToUtc(dp.year, dp.month, dp.day, Math.floor(m / 60), m % 60, tz)
        const endUtc = new Date(startUtc.getTime() + dur * 60_000)

        // Past, or inside the notice period — not shown at all, rather than
        // shown as taken. A visitor has no use for a time nobody can book.
        if (startUtc < earliest) continue

        const zoneStart = startUtc.getTime() - bufBefore * 60_000
        const zoneEnd = endUtc.getTime() + bufAfter * 60_000
        const conflict = busyZones.some((z) => zoneStart < z.end && zoneEnd > z.start)

        const iso = startUtc.toISOString()
        const faked = dayFake > 0 && slotBucket(iso) < dayFake && !freed.has(iso)

        slots.push({
          start: iso,
          label: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
          busy: conflict || faked,
        })
      }
    }

    if (slots.length > 0) days.push({ date: dp.dateStr, weekday: dp.weekday, slots })
  }

  return days
}

export type SlotKind = 'available' | 'booked' | 'blocked' | 'hidden' | 'unlocked'

export type AdminSlot = {
  start: string
  label: string
  kind: SlotKind
  /** Set when kind is 'blocked' — the row to delete to free it again. */
  blockId?: string
}

export type AdminDay = {
  date: string
  weekday: number
  slots: AdminSlot[]
}

export type ManualBlock = {
  id: string
  starts_at: string
  ends_at: string
}

/**
 * The same grid, as the calendar screen needs it: every slot classified rather
 * than filtered.
 *
 * Two deliberate differences from the visitor's view. The minimum notice is not
 * applied — you are looking at your own day and the next two hours are part of
 * it. And nothing is hidden: a slot the scarcity dial is holding back shows as
 * 'hidden', because a calendar that quietly omitted a third of its rows would
 * be unusable for judging how full you actually are.
 */
export function computeAdminSlots(
  settings: CalendarSettings,
  booked: BusyInterval[],
  blocks: ManualBlock[],
  now: Date = new Date(),
  freed: Set<string> = new Set(),
  dayPins: Record<string, number> = {}
): AdminDay[] {
  const {
    slot_duration_minutes: dur,
    buffer_before_minutes: bufBefore,
    buffer_after_minutes: bufAfter,
    booking_window_days: windowDays,
    timezone: tz,
    availability,
    fake_busy_percent: fakeBusy = 0,
  } = settings

  const bookedZones = booked.map((b) => ({
    start: new Date(b.starts_at).getTime() - bufBefore * 60_000,
    end: new Date(b.ends_at).getTime() + bufAfter * 60_000,
  }))

  const days: AdminDay[] = []

  for (const dp of daysInWindow(now, windowDays, tz)) {
    const ranges = availability[String(dp.weekday)] ?? []
    if (ranges.length === 0) continue

    const dayFake = dayPins[dp.dateStr] ?? fakeBusy

    const slots: AdminSlot[] = []
    for (const [from, to] of ranges) {
      const fromMin = hhmmToMinutes(from)
      const toMin = hhmmToMinutes(to)
      for (let m = fromMin; m + dur <= toMin; m += dur) {
        const startUtc = zonedTimeToUtc(dp.year, dp.month, dp.day, Math.floor(m / 60), m % 60, tz)
        const endUtc = new Date(startUtc.getTime() + dur * 60_000)
        if (endUtc <= now) continue // a slot already over is not a decision

        const start = startUtc.getTime()
        const end = endUtc.getTime()
        const iso = startUtc.toISOString()

        const isBooked = bookedZones.some((z) => start < z.end && end > z.start)
        const block = blocks.find(
          (b) => start < new Date(b.ends_at).getTime() && end > new Date(b.starts_at).getTime()
        )
        const isHidden = dayFake > 0 && slotBucket(iso) < dayFake

        let kind: SlotKind = 'available'
        let blockId: string | undefined
        if (isBooked) kind = 'booked'
        else if (block) {
          kind = 'blocked'
          blockId = block.id
        } else if (isHidden) kind = freed.has(iso) ? 'unlocked' : 'hidden'

        slots.push({
          start: iso,
          label: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
          kind,
          blockId,
        })
      }
    }

    if (slots.length > 0) days.push({ date: dp.dateStr, weekday: dp.weekday, slots })
  }

  return days
}

/**
 * Does this instant name a slot that is actually free right now?
 *
 * The booking endpoint asks this immediately before writing, against freshly
 * read data, because the visitor's list of times was built when their page
 * loaded and anything can have happened since. It re-uses computeAvailability
 * rather than repeating the rules, so a slot can never be bookable by one
 * definition and unavailable by the other.
 */
export function validateSlot(
  settings: CalendarSettings,
  busy: BusyInterval[],
  startIso: string,
  now: Date = new Date(),
  freed: Set<string> = new Set(),
  dayPins: Record<string, number> = {}
): { startsAt: string; endsAt: string } | null {
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) return null

  const iso = start.toISOString()
  for (const day of computeAvailability(settings, busy, now, freed, dayPins)) {
    for (const slot of day.slots) {
      if (slot.start !== iso) continue
      if (slot.busy) return null
      const end = new Date(start.getTime() + settings.slot_duration_minutes * 60_000)
      return { startsAt: iso, endsAt: end.toISOString() }
    }
  }
  return null
}
