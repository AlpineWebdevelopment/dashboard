'use server'

// Server actions for /finances.
//
// These reach Supabase with the service-role key (crmDb), because the finance
// tables have RLS enabled with no policy at all — the same posture as the CRM
// and attachments. The anon key is public and the coworker account arrives as
// `anon` too, so the ledger must not be readable with it.
//
// Authentication is a layer up: src/proxy.ts refuses any request without a
// valid gt_session cookie, and ROLE_PATHS already confines the coworker role to
// /client-projects and /settings. Writes still re-check the role here — a server
// action is a POST endpoint with a generated name, so hiding the button in the
// UI is not a gate.
//
// Validation follows src/lib/crm/actions.ts rather than the older MRR block in
// actions.ts: Zod at the boundary, always safeParse, and a discriminated result
// instead of a throw, so the board can render the message inline.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { crmConfigured, crmDb } from './crm/db'
import { currentAccount } from './auth-server'
import { evalAmount, isExpression } from './finances'
import {
  FINANCE_ACCENTS,
  FINANCE_SETTINGS_ID,
  decodeFinanceAccent,
  type FinanceAccent,
  type FinanceAccount,
  type FinanceContribution,
  type FinanceEntry,
  type FinanceSettings,
} from './finance-types'

const PATH = '/finances'

export type FinanceError = {
  kind: 'not_configured' | 'not_allowed' | 'invalid' | 'not_found' | 'unknown'
  /** Safe to render. Never a raw Postgres string. */
  message: string
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: FinanceError }

function fail(kind: FinanceError['kind'], message: string): { ok: false; error: FinanceError } {
  return { ok: false, error: { kind, message } }
}

/** Config + role check, run at the top of every mutation. */
async function guard(): Promise<{ ok: false; error: FinanceError } | null> {
  if (!crmConfigured()) {
    return fail(
      'not_configured',
      'Finances is not configured — SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.'
    )
  }
  const account = await currentAccount()
  if (account?.role !== 'admin') return fail('not_allowed', 'You are not allowed to change this.')
  return null
}

function dbError(error: { code?: string; message?: string } | null): FinanceError {
  console.error('[finances] database error', error?.code, error?.message)
  return { kind: 'unknown', message: 'That did not work. Please try again.' }
}

// ─── Row mapping ─────────────────────────────────────────────────────────────
//
// `amount` is a numeric column, which PostgREST hands back as a string. Every
// read coerces here so nothing downstream has to remember to.

type Row = Record<string, unknown>

function toEntry(r: Row): FinanceEntry {
  return {
    id: String(r.id),
    entry_date: (r.entry_date as string | null) ?? null,
    subject: String(r.subject ?? ''),
    amount: Number(r.amount),
    amount_formula: String(r.amount_formula ?? ''),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

function toContribution(r: Row): FinanceContribution {
  return {
    id: String(r.id),
    account_id: String(r.account_id),
    entry_date: (r.entry_date as string | null) ?? null,
    subject: String(r.subject ?? ''),
    amount: Number(r.amount),
    amount_formula: String(r.amount_formula ?? ''),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

function toAccount(r: Row): FinanceAccount {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    accent: decodeFinanceAccent(r.accent),
    position: Number(r.position ?? 0),
    archived: Boolean(r.archived),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

/**
 * The amount field accepts arithmetic, the way the spreadsheet's cells did:
 * `-1203.44*333.5` is an original currency amount times a HUF rate. Evaluated
 * with the parser in finances.ts, never with eval — this string arrives in a
 * POST body.
 */
const amountInput = z
  .string()
  .trim()
  .min(1, 'An amount is required')
  .refine((v) => evalAmount(v).ok, 'That is not a valid amount')

/** '' means "no date", which three imported rows genuinely have. */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Invalid date')

const entrySchema = z.object({
  entry_date: optionalDate,
  subject: z.string().trim().max(500),
  amount: amountInput,
})

const contributionSchema = entrySchema.extend({
  account_id: z.uuid(),
})

const accountSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(80),
  accent: z.enum(FINANCE_ACCENTS as unknown as [FinanceAccent, ...FinanceAccent[]]),
  archived: z.boolean().optional(),
})

const settingsSchema = z.object({
  flat_tax_limit: z.number().min(0),
  vat_exempt_limit: z.number().min(0),
  limits_year: z.string().trim().max(16),
  reminder: z.string().trim().max(500),
})

/** Both amount-bearing tables store the evaluated number and the expression. */
function amountFields(raw: string): { amount: number; amount_formula: string } {
  const parsed = evalAmount(raw)
  return {
    amount: parsed.ok ? parsed.value : 0,
    amount_formula: isExpression(raw) ? raw.trim() : '',
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────
//
// Swallow errors into empty values so a missing table renders an empty page
// rather than crashing the route, matching the getters in actions.ts.

export async function getFinanceAccounts(): Promise<FinanceAccount[]> {
  if (!crmConfigured()) return []
  try {
    const { data, error } = await crmDb()
      .from('finance_accounts')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(toAccount)
  } catch {
    return []
  }
}

export async function getFinanceEntries(): Promise<FinanceEntry[]> {
  if (!crmConfigured()) return []
  try {
    const { data, error } = await crmDb()
      .from('finance_entries')
      .select('*')
      .order('entry_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(toEntry)
  } catch {
    return []
  }
}

export async function getFinanceContributions(): Promise<FinanceContribution[]> {
  if (!crmConfigured()) return []
  try {
    const { data, error } = await crmDb()
      .from('finance_contributions')
      .select('*')
      .order('entry_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(toContribution)
  } catch {
    return []
  }
}

export async function getFinanceSettings(): Promise<FinanceSettings | null> {
  if (!crmConfigured()) return null
  try {
    const { data, error } = await crmDb()
      .from('finance_settings')
      .select('*')
      .eq('id', FINANCE_SETTINGS_ID)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      id: String(data.id),
      flat_tax_limit: Number(data.flat_tax_limit),
      vat_exempt_limit: Number(data.vat_exempt_limit),
      limits_year: String(data.limits_year ?? ''),
      reminder: String(data.reminder ?? ''),
    }
  } catch {
    return null
  }
}

// ─── Ledger entries ──────────────────────────────────────────────────────────

export async function createFinanceEntry(
  input: z.input<typeof entrySchema>
): Promise<ActionResult<FinanceEntry>> {
  const blocked = await guard()
  if (blocked) return blocked
  const parsed = entrySchema.safeParse(input)
  if (!parsed.success) return fail('invalid', parsed.error.issues[0]?.message ?? 'Check the fields.')

  const { data, error } = await crmDb()
    .from('finance_entries')
    .insert({
      entry_date: parsed.data.entry_date,
      subject: parsed.data.subject,
      ...amountFields(parsed.data.amount),
    })
    .select('*')
    .single()
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(PATH)
  return { ok: true, data: toEntry(data) }
}

export async function updateFinanceEntry(
  id: string,
  input: z.input<typeof entrySchema>
): Promise<ActionResult<FinanceEntry>> {
  const blocked = await guard()
  if (blocked) return blocked
  if (!z.uuid().safeParse(id).success) return fail('not_found', 'That entry no longer exists.')
  const parsed = entrySchema.safeParse(input)
  if (!parsed.success) return fail('invalid', parsed.error.issues[0]?.message ?? 'Check the fields.')

  const { data, error } = await crmDb()
    .from('finance_entries')
    .update({
      entry_date: parsed.data.entry_date,
      subject: parsed.data.subject,
      ...amountFields(parsed.data.amount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) return { ok: false, error: dbError(error) }
  if (!data) return fail('not_found', 'That entry no longer exists.')
  revalidatePath(PATH)
  return { ok: true, data: toEntry(data) }
}

export async function deleteFinanceEntry(id: string): Promise<ActionResult> {
  const blocked = await guard()
  if (blocked) return blocked
  if (!z.uuid().safeParse(id).success) return fail('not_found', 'That entry no longer exists.')

  const { error } = await crmDb().from('finance_entries').delete().eq('id', id)
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(PATH)
  return { ok: true, data: null }
}

// ─── Contributions ───────────────────────────────────────────────────────────

export async function createFinanceContribution(
  input: z.input<typeof contributionSchema>
): Promise<ActionResult<FinanceContribution>> {
  const blocked = await guard()
  if (blocked) return blocked
  const parsed = contributionSchema.safeParse(input)
  if (!parsed.success) return fail('invalid', parsed.error.issues[0]?.message ?? 'Check the fields.')

  const { data, error } = await crmDb()
    .from('finance_contributions')
    .insert({
      account_id: parsed.data.account_id,
      entry_date: parsed.data.entry_date,
      subject: parsed.data.subject,
      ...amountFields(parsed.data.amount),
    })
    .select('*')
    .single()
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(PATH)
  return { ok: true, data: toContribution(data) }
}

export async function updateFinanceContribution(
  id: string,
  input: z.input<typeof contributionSchema>
): Promise<ActionResult<FinanceContribution>> {
  const blocked = await guard()
  if (blocked) return blocked
  if (!z.uuid().safeParse(id).success) return fail('not_found', 'That row no longer exists.')
  const parsed = contributionSchema.safeParse(input)
  if (!parsed.success) return fail('invalid', parsed.error.issues[0]?.message ?? 'Check the fields.')

  const { data, error } = await crmDb()
    .from('finance_contributions')
    .update({
      account_id: parsed.data.account_id,
      entry_date: parsed.data.entry_date,
      subject: parsed.data.subject,
      ...amountFields(parsed.data.amount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) return { ok: false, error: dbError(error) }
  if (!data) return fail('not_found', 'That row no longer exists.')
  revalidatePath(PATH)
  return { ok: true, data: toContribution(data) }
}

export async function deleteFinanceContribution(id: string): Promise<ActionResult> {
  const blocked = await guard()
  if (blocked) return blocked
  if (!z.uuid().safeParse(id).success) return fail('not_found', 'That row no longer exists.')

  const { error } = await crmDb().from('finance_contributions').delete().eq('id', id)
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(PATH)
  return { ok: true, data: null }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function createFinanceAccount(
  input: z.input<typeof accountSchema>
): Promise<ActionResult<FinanceAccount>> {
  const blocked = await guard()
  if (blocked) return blocked
  const parsed = accountSchema.safeParse(input)
  if (!parsed.success) return fail('invalid', parsed.error.issues[0]?.message ?? 'Check the fields.')

  const { data: last } = await crmDb()
    .from('finance_accounts')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
  const position = (last?.[0]?.position ?? -1) + 1

  const { data, error } = await crmDb()
    .from('finance_accounts')
    .insert({ name: parsed.data.name, accent: parsed.data.accent, position })
    .select('*')
    .single()
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(PATH)
  return { ok: true, data: toAccount(data) }
}

export async function updateFinanceAccount(
  id: string,
  input: z.input<typeof accountSchema>
): Promise<ActionResult<FinanceAccount>> {
  const blocked = await guard()
  if (blocked) return blocked
  if (!z.uuid().safeParse(id).success) return fail('not_found', 'That account no longer exists.')
  const parsed = accountSchema.safeParse(input)
  if (!parsed.success) return fail('invalid', parsed.error.issues[0]?.message ?? 'Check the fields.')

  const { data, error } = await crmDb()
    .from('finance_accounts')
    .update({
      name: parsed.data.name,
      accent: parsed.data.accent,
      archived: parsed.data.archived ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) return { ok: false, error: dbError(error) }
  if (!data) return fail('not_found', 'That account no longer exists.')
  revalidatePath(PATH)
  return { ok: true, data: toAccount(data) }
}

/** Cascades: the account's contributions go with it, and the Tőke drops. */
export async function deleteFinanceAccount(id: string): Promise<ActionResult> {
  const blocked = await guard()
  if (blocked) return blocked
  if (!z.uuid().safeParse(id).success) return fail('not_found', 'That account no longer exists.')

  const { error } = await crmDb().from('finance_accounts').delete().eq('id', id)
  if (error) return { ok: false, error: dbError(error) }
  revalidatePath(PATH)
  return { ok: true, data: null }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function updateFinanceSettings(
  input: z.input<typeof settingsSchema>
): Promise<ActionResult<FinanceSettings>> {
  const blocked = await guard()
  if (blocked) return blocked
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return fail('invalid', parsed.error.issues[0]?.message ?? 'Check the fields.')

  const { data, error } = await crmDb()
    .from('finance_settings')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', FINANCE_SETTINGS_ID)
    .select('*')
    .maybeSingle()
  if (error) return { ok: false, error: dbError(error) }
  if (!data) return fail('not_found', 'The settings row is missing — run finances-schema.sql.')
  revalidatePath(PATH)
  return {
    ok: true,
    data: {
      id: String(data.id),
      flat_tax_limit: Number(data.flat_tax_limit),
      vat_exempt_limit: Number(data.vat_exempt_limit),
      limits_year: String(data.limits_year ?? ''),
      reminder: String(data.reminder ?? ''),
    },
  }
}
