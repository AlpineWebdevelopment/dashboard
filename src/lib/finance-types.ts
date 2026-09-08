// Row types for the /finances tables.
//
// Split from finance-actions.ts on the attachment-types.ts precedent: the board
// and its child components import these, and pulling the actions module into the
// client bundle would drag the service-role Supabase client with it.
//
// Amounts come back from PostgREST as strings — the columns are `numeric`, since
// the FX conversions imported from the spreadsheet leave fractions. Everything
// here types them as `number` and the read side coerces, the same way
// `mrr.ts` already does with `Number(c.monthly_fee)`.

/** Presentation only — echoes the per-column tint the spreadsheet used. */
export const FINANCE_ACCENTS = [
  'teal', 'orange', 'emerald', 'indigo', 'rose', 'amber', 'sky', 'violet',
] as const

export type FinanceAccent = (typeof FINANCE_ACCENTS)[number]

/** Anything unrecognised reads as 'teal' rather than leaving a card unstyled. */
export function decodeFinanceAccent(raw: unknown): FinanceAccent {
  return FINANCE_ACCENTS.includes(raw as FinanceAccent) ? (raw as FinanceAccent) : 'teal'
}

/** A partner with money in the common pot. Was one column per person in the sheet. */
export type FinanceAccount = {
  id: string
  name: string
  accent: FinanceAccent
  position: number
  /** Keeps their history but drops them out of the picker. */
  archived: boolean
  created_at: string
  updated_at: string
}

/**
 * One row of the közös főkönyv.
 *
 * `amount` is signed, exactly as the sheet's single Pénzmozgás column:
 * positive is bevétel, negative kiadás. There is no separate direction field.
 */
export type FinanceEntry = {
  id: string
  /** YYYY-MM-DD, or null — three imported rows carry money with no date. */
  entry_date: string | null
  subject: string
  amount: number
  /** The expression the amount was typed as ('-1203.44*333.5'), or ''. */
  amount_formula: string
  created_at: string
  updated_at: string
}

/** One movement between a partner and the common pot. + = in, − = back out. */
export type FinanceContribution = {
  id: string
  account_id: string
  entry_date: string | null
  subject: string
  amount: number
  amount_formula: string
  created_at: string
  updated_at: string
}

/**
 * Singleton. The two limits sat in G1/G2 of the sheet with no formula touching
 * them, and the repayment schedule sat in I5:I9 as prose. They are reminders —
 * nothing measures against them here, because the billing app already does.
 */
export type FinanceSettings = {
  id: string
  flat_tax_limit: number
  vat_exempt_limit: number
  limits_year: string
  reminder: string
}

export const FINANCE_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'
