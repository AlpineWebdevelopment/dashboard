// Budapest wall-clock ↔ stored UTC, for the scheduler's inputs and labels.
//
// A <input type="datetime-local"> has no zone; its value is read as Budapest
// time whatever the browser's own zone is, so the table means the same thing
// on a laptop abroad.

import { partsInTz, zonedTimeToUtc } from '@/lib/tz'
import { SOCIAL_TZ } from './config'

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO instant → 'YYYY-MM-DDTHH:MM' in Budapest, for datetime-local. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const p = partsInTz(new Date(iso), SOCIAL_TZ)
  return `${p.dateStr}T${pad(p.hour)}:${pad(p.minute)}`
}

/** 'YYYY-MM-DDTHH:MM' read as Budapest → ISO instant (UTC). */
export function fromLocalInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  return zonedTimeToUtc(y, mo, d, h, mi, SOCIAL_TZ).toISOString()
}

/** A Budapest calendar day ('YYYY-MM-DD') at a Budapest wall time → ISO. */
export function budapestAt(dateStr: string, hour: number, minute: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return zonedTimeToUtc(y, m, d, hour, minute, SOCIAL_TZ).toISOString()
}

export function budapestParts(iso: string) {
  return partsInTz(new Date(iso), SOCIAL_TZ)
}

const LABEL = new Intl.DateTimeFormat('en-GB', {
  timeZone: SOCIAL_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** 'Mon 21 Sep, 18:00' in Budapest. */
export function formatWhen(iso: string | null): string {
  return iso ? LABEL.format(new Date(iso)) : ''
}

const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: SOCIAL_TZ, hour: '2-digit', minute: '2-digit', hour12: false })

export function formatTime(iso: string): string {
  return TIME.format(new Date(iso))
}

/** 'in 3 days' / '2 hours ago' — coarse, for token expiry lines. */
export function relative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const units: [number, string][] = [
    [86_400_000, 'day'],
    [3_600_000, 'hour'],
    [60_000, 'minute'],
  ]
  for (const [ms, name] of units) {
    if (abs >= ms) {
      const n = Math.round(abs / ms)
      const word = `${n} ${name}${n === 1 ? '' : 's'}`
      return diff >= 0 ? `in ${word}` : `${word} ago`
    }
  }
  return diff >= 0 ? 'in under a minute' : 'just now'
}

/** Today's Budapest date as 'YYYY-MM-DD'. */
export function todayStr(now = new Date()): string {
  return partsInTz(now, SOCIAL_TZ).dateStr
}

/** 'YYYY-MM-DD' plus n days, zone-free calendar arithmetic. */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** ISO weekday of a 'YYYY-MM-DD': 1 = Mon … 7 = Sun. */
export function isoWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return w === 0 ? 7 : w
}
