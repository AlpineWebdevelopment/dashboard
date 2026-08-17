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
