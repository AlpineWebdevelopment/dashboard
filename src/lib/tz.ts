// Wall-clock ↔ UTC conversion for a named IANA zone, on Intl alone.
//
// Lifted out of lib/crm/availability.ts so the social scheduler can share it:
// both need "18:00 in Europe/Budapest on this date" as a UTC instant, and a
// date library for three functions was not worth the dependency.

/** Offset in ms of `timeZone` at a given UTC instant. */
export function tzOffsetMs(timeZone: string, date: Date): number {
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
export function zonedTimeToUtc(
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

/** A UTC instant, read as wall-clock parts in `timeZone`. `weekday` is 0 = Sun. */
export function partsInTz(date: Date, timeZone: string) {
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
  let hour = Number(map.hour)
  if (hour === 24) hour = 0
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    weekday: weekdays[map.weekday] ?? 0,
    dateStr: `${map.year}-${map.month}-${map.day}`,
  }
}
