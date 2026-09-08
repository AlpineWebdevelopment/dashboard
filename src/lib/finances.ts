// The maths behind /finances.
//
// Every summary figure here replaces one cell of the spreadsheet this page was
// ported from, and each is commented with the cell it came from. The numbers
// must agree with it exactly — that agreement is how the import was verified.
//
// Pure functions only: no 'use server', no Supabase, so the client bundle can
// recompute totals optimistically after an edit instead of re-fetching.

import { monthIdxOf } from './mrr'
import type { FinanceAccount, FinanceContribution, FinanceEntry } from './finance-types'

// ─── Summary ─────────────────────────────────────────────────────────────────

/** Össz Bevétel — was `=SUMIF(C2:C999,">=0")`. */
export function totalIncome(entries: FinanceEntry[]): number {
  return entries.reduce((sum, e) => (e.amount >= 0 ? sum + e.amount : sum), 0)
}

/** Össz Kiadás — was `=SUMIF(C2:C999,"<0")*-1`, i.e. reported positive. */
export function totalExpense(entries: FinanceEntry[]): number {
  return entries.reduce((sum, e) => (e.amount < 0 ? sum - e.amount : sum), 0)
}

/**
 * Tőke — was `=SUM(G69:I69)`, the three per-person column totals.
 *
 * Summed from the rows rather than from stored per-account totals: two of those
 * three cells in the sheet were hand-typed numbers rather than SUMs, so they
 * could drift from the rows beneath them. (They happened not to have.)
 */
export function capital(contributions: FinanceContribution[]): number {
  return contributions.reduce((sum, c) => sum + c.amount, 0)
}

/** Profit — was `=G10-E2`, which reduces to the ledger's own net. */
export function profit(entries: FinanceEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0)
}

/** Közös Egyenleg — was `=SUM(C2:C999)+E2`: what is actually in the pot. */
export function balance(entries: FinanceEntry[], contributions: FinanceContribution[]): number {
  return profit(entries) + capital(contributions)
}

/** Profit % — was `=G8/G4`. Returns null rather than Infinity on no income. */
export function profitPct(entries: FinanceEntry[]): number | null {
  const income = totalIncome(entries)
  return income === 0 ? null : (profit(entries) / income) * 100
}

/** Per-account totals, in the accounts' own order. */
export function accountTotals(
  accounts: FinanceAccount[],
  contributions: FinanceContribution[]
): { account: FinanceAccount; total: number; paidIn: number; takenOut: number; count: number }[] {
  return accounts.map((account) => {
    const rows = contributions.filter((c) => c.account_id === account.id)
    return {
      account,
      total: rows.reduce((s, c) => s + c.amount, 0),
      paidIn: rows.reduce((s, c) => (c.amount > 0 ? s + c.amount : s), 0),
      takenOut: rows.reduce((s, c) => (c.amount < 0 ? s - c.amount : s), 0),
      count: rows.length,
    }
  })
}

// ─── Monthly series (the chart) ──────────────────────────────────────────────

export type FinanceMonth = {
  /** year*12 + month, the same index convention as mrr.ts. */
  idx: number
  income: number
  expense: number
  net: number
  /** Balance at the end of this month: opening balance plus every net so far. */
  running: number
}

/**
 * Month-by-month income, expense and the running balance over them.
 *
 * Undated entries are the awkward part. Three imported rows carry money with no
 * date, so they belong to no month — but dropping them would leave the running
 * line ending somewhere other than the Közös Egyenleg tile, which reads as a
 * bug. They are therefore excluded from the bars (no month is misstated) and
 * folded into the opening balance instead, which is the most defensible reading
 * of an undated row and makes the line's endpoint exactly the true balance.
 */
export function monthlySeries(
  entries: FinanceEntry[],
  contributions: FinanceContribution[]
): FinanceMonth[] {
  const dated = entries.filter((e) => e.entry_date)
  if (dated.length === 0) return []

  const buckets = new Map<number, { income: number; expense: number }>()
  for (const e of dated) {
    const idx = monthIdxOf(e.entry_date!)
    const b = buckets.get(idx) ?? { income: 0, expense: 0 }
    if (e.amount >= 0) b.income += e.amount
    else b.expense -= e.amount
    buckets.set(idx, b)
  }

  const undatedNet = entries.reduce((s, e) => (e.entry_date ? s : s + e.amount), 0)
  let running = capital(contributions) + undatedNet

  const first = Math.min(...buckets.keys())
  const last = Math.max(...buckets.keys())
  const out: FinanceMonth[] = []
  // Walk every month in the span, not just the ones with rows, so a quiet month
  // is a flat segment rather than a gap the line jumps across.
  for (let idx = first; idx <= last; idx++) {
    const b = buckets.get(idx) ?? { income: 0, expense: 0 }
    const net = b.income - b.expense
    running += net
    out.push({ idx, income: b.income, expense: b.expense, net, running })
  }
  return out
}

// ─── Amount expressions ──────────────────────────────────────────────────────

/**
 * Evaluate an arithmetic amount, the way the spreadsheet's cells did.
 *
 * Nine imported cells were expressions rather than numbers — `-1203.44*333.5`,
 * `80*384.4` — an original currency amount times a HUF rate, and neither operand
 * survives anywhere else. Keeping the field expression-capable means new rows can
 * be entered the same way.
 *
 * A hand-written recursive-descent parser rather than `eval` or `new Function`:
 * this string arrives in a POST body, and a server action is a public endpoint.
 * Accepts `,` as a decimal separator and ignores spaces, since the amounts are
 * read off Hungarian bank statements.
 */
export function evalAmount(input: string): { ok: true; value: number } | { ok: false } {
  const src = input.replace(/\s+/g, '').replace(/,/g, '.')
  if (!src || !/^[0-9+\-*/().]+$/.test(src)) return { ok: false }

  let pos = 0
  const peek = () => src[pos]

  function parseExpr(): number | null {
    let left = parseTerm()
    if (left === null) return null
    for (;;) {
      const op = peek()
      if (op !== '+' && op !== '-') return left
      pos++
      const right = parseTerm()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
  }

  function parseTerm(): number | null {
    let left = parseFactor()
    if (left === null) return null
    for (;;) {
      const op = peek()
      if (op !== '*' && op !== '/') return left
      pos++
      const right = parseFactor()
      if (right === null) return null
      if (op === '/' && right === 0) return null
      left = op === '*' ? left * right : left / right
    }
  }

  function parseFactor(): number | null {
    const sign = peek()
    if (sign === '+' || sign === '-') {
      pos++
      const v = parseFactor()
      return v === null ? null : sign === '-' ? -v : v
    }
    if (peek() === '(') {
      pos++
      const v = parseExpr()
      if (v === null || peek() !== ')') return null
      pos++
      return v
    }
    const start = pos
    while (pos < src.length && /[0-9.]/.test(src[pos])) pos++
    if (pos === start) return null
    const n = Number(src.slice(start, pos))
    return Number.isFinite(n) ? n : null
  }

  const value = parseExpr()
  if (value === null || pos !== src.length || !Number.isFinite(value)) return { ok: false }
  // Round to the same precision the spreadsheet's cached results carried.
  return { ok: true, value: Math.round(value * 1e6) / 1e6 }
}

/** True when the text is more than a plain number, i.e. worth storing as a formula. */
export function isExpression(input: string): boolean {
  const src = input.replace(/\s+/g, '').replace(/,/g, '.')
  return /[+*/]/.test(src) || /\d-/.test(src)
}

/** Money with an explicit sign, for ledger rows where direction is the point. */
export function fmtSigned(n: number): string {
  const body = Math.abs(n).toLocaleString('hu-HU', { maximumFractionDigits: 2 })
  return `${n < 0 ? '−' : '+'}${body} Ft`
}
