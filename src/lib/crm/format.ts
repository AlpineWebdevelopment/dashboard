// Display helpers for the CRM. Shared by both screens so the worklist
// and the detail page never phrase the same date two different ways.

/** What a lead is called when it has no company name — Meta rows often don't. */
export function leadTitle(lead: {
  company_name: string | null
  contact_name: string | null
  email: string | null
}): string {
  return (
    lead.company_name?.trim() ||
    lead.contact_name?.trim() ||
    lead.email?.trim() ||
    'Unnamed lead'
  )
}

export type Due = {
  text: string
  /** Due now or in the past. The one place the worklist spends its accent. */
  overdue: boolean
  /** No date at all — nothing scheduled. */
  none: boolean
}

const DAY = 86_400_000

/** Calendar days between two instants, ignoring the time of day. */
function dayDelta(target: Date, from: Date): number {
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  const b = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((a - b) / DAY)
}

/**
 * 'due today', '2 days overdue', 'in 3 days'.
 *
 * Overdue is measured against the actual timestamp, not the calendar day, so a
 * step due at 09:00 reads as overdue at 09:01 rather than at midnight. The
 * wording uses calendar days, because 'due today' is what a person expects to
 * see all day.
 */
export function due(iso: string | null, now: Date = new Date()): Due {
  if (!iso) return { text: 'no date', overdue: false, none: true }

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return { text: 'no date', overdue: false, none: true }
  }

  const overdue = date.getTime() <= now.getTime()
  const days = dayDelta(date, now)

  if (days === 0) return { text: overdue ? 'due today' : 'today', overdue, none: false }
  if (days === -1) return { text: '1 day overdue', overdue, none: false }
  if (days === 1) return { text: 'tomorrow', overdue, none: false }
  if (days < 0) return { text: `${Math.abs(days)} days overdue`, overdue, none: false }
  return { text: `${days} days from now`, overdue, none: false }
}

/**
 * How long ago, in as few characters as possible: 'now', '12m', '5h', '3d',
 * '2w', '4mo', '2y'.
 *
 * For the age shown on every pipeline card, where the question is only ever
 * "has this been sitting" and the answer has to fit beside two icons. Precision
 * drops off deliberately as the number grows — the difference between 5h and 6h
 * is worth a character, the difference between 14mo and 15mo is not.
 *
 * Weeks stop at 8 and months at 12 rather than running on, so nothing ever
 * reads '73w'.
 */
export function sinceShort(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return '—'

  // A date in the future is a next step, not an age. Clamping to 'now' beats
  // rendering a negative one — it happens when a backfilled event is dated
  // ahead, which is allowed.
  const ms = Math.max(0, now.getTime() - then.getTime())
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  const weeks = Math.floor(days / 7)
  if (weeks < 9) return `${weeks}w`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`

  return `${Math.floor(days / 365)}y`
}

/** Absolute date for tooltips and the timeline. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** 'YYYY-MM-DDTHH:mm' in local time, for a datetime-local input value. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** The inverse: a datetime-local value back to an ISO instant. */
export function fromLocalInput(value: string): string | null {
  if (!value?.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
