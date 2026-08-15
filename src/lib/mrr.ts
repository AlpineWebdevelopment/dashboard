import type { MrrClient } from './supabase'

// Month helpers — months are indexed as year*12 + monthOfYear

export function monthIdxOf(dateStr: string): number {
  const [y, m] = dateStr.split('-').map(Number)
  return y * 12 + (m - 1)
}

export function idxToDate(idx: number): Date {
  return new Date(Math.floor(idx / 12), idx % 12, 1)
}

export function idxLabel(idx: number): string {
  return idxToDate(idx).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export function idxLabelShort(idx: number, withYear: boolean): string {
  const d = idxToDate(idx)
  const m = d.toLocaleString('en-US', { month: 'short' })
  return withYear ? `${m} '${String(d.getFullYear()).slice(2)}` : m
}

export function fmtMoney(n: number): string {
  return `${n.toLocaleString('hu-HU', { maximumFractionDigits: 2 })} Ft`
}

/** Compact money: 1 500 000 → "1,5M Ft", 250 000 → "250k Ft". */
export function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}M Ft`
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}k Ft`
  return `${n.toLocaleString('hu-HU')} Ft`
}

export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Revenue math

/** Month the monthly fee starts billing: first_billing override, else go-live. Null = not billing yet (onboarding). */
export function billingStartIdx(c: MrrClient): number | null {
  const d = c.first_billing_date ?? c.golive_date
  return d ? monthIdxOf(d) : null
}

/** A recurring client is billed for every month from its billing-start month through its end month (inclusive). */
export function isActiveInMonth(c: MrrClient, idx: number): boolean {
  if (c.kind !== 'recurring') return false
  const start = billingStartIdx(c)
  if (start === null || start > idx) return false
  if (c.end_date && monthIdxOf(c.end_date) < idx) return false
  return true
}

export function mrrForMonth(clients: MrrClient[], idx: number): number {
  return clients.reduce((sum, c) => sum + (isActiveInMonth(c, idx) ? Number(c.monthly_fee) : 0), 0)
}

/** Setup fee is paid in halves: 50% in the contract month (start_date), 50% in the go-live month. */
export function setupFeesForMonth(clients: MrrClient[], idx: number): number {
  return clients.reduce((sum, c) => {
    if (c.kind !== 'recurring') return sum
    const half = Number(c.setup_fee) / 2
    if (monthIdxOf(c.start_date) === idx) sum += half
    if (c.golive_date && monthIdxOf(c.golive_date) === idx) sum += half
    return sum
  }, 0)
}

export function oneOffForMonth(clients: MrrClient[], idx: number): number {
  return clients.reduce(
    (sum, c) => sum + (c.kind === 'oneoff' && monthIdxOf(c.start_date) === idx ? Number(c.setup_fee) : 0),
    0
  )
}

/** Everything billed in a month: monthly fees + setup fee halves + one-off jobs. */
export function earnedForMonth(clients: MrrClient[], idx: number): number {
  return mrrForMonth(clients, idx) + setupFeesForMonth(clients, idx) + oneOffForMonth(clients, idx)
}

/** Second setup halves not yet received (clients still onboarding, i.e. no go-live date). */
export function outstandingSetup(clients: MrrClient[]): { total: number; count: number } {
  return clients.reduce(
    (acc, c) => {
      if (c.kind === 'recurring' && !c.golive_date) {
        acc.total += Number(c.setup_fee) / 2
        acc.count += 1
      }
      return acc
    },
    { total: 0, count: 0 }
  )
}
