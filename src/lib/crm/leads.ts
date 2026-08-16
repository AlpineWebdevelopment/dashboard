// Data access for the CRM. Server-side only — every function here goes through
// crmDb(), which carries the service-role key.
//
// The one rule this module exists to enforce: transitionLead() is the only way
// leads.status is ever written. createLead() always starts a lead at NEW, and
// updateLeadFields() is typed so that passing a status is a compile error, not
// a convention someone can forget. The database enforces the same thing from
// the other side (002_lead_status_guards.sql), so both layers have to fail
// before a lead can end up somewhere illegal.

import type { LeadStatus } from '@/lib/lead-status'
import { crmDb, crmConfigured } from './db'
import { parseFormAnswers, type FormAnswer, type FormAnswers } from './form-answers'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Lead = {
  id: string
  created_at: string
  updated_at: string
  status: LeadStatus
  company_name: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  niche: string | null
  source: string | null
  contact_attempts: number
  last_attempt_at: string | null
  next_action_at: string | null
  lost_reason: string | null
  notes: string | null
  /** Meta lead-ad import columns. meta_stage is Meta's stage, never ours. */
  meta_form: string | null
  meta_channel: string | null
  meta_stage: string | null
  meta_owner: string | null
  labels: string[]
  phone_secondary: string | null
  phone_whatsapp: string | null
  form_answers: FormAnswers | null
  form_answers_raw: string | null
}

export type LeadEvent = {
  id: string
  lead_id: string
  from_status: LeadStatus | null
  to_status: LeadStatus
  occurred_at: string
  note: string | null
}

/**
 * What updateLeadFields() will accept.
 *
 * `status?: never` is the point of this type: it makes
 * `updateLeadFields(id, { status: 'CONVERTED' })` fail to compile. Moving a
 * lead goes through transitionLead(), which is the only caller of the
 * crm_transition_lead RPC.
 */
export type LeadFieldPatch = Partial<
  Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'status' | 'form_answers'>
> & {
  status?: never
  /** Pass the pasted block; it is parsed into form_answers and stored raw. */
  form_answers_raw?: string | null
}

/** Same shape as a patch — a new lead is created at NEW and moved from there. */
export type NewLead = LeadFieldPatch

// ─── Errors ──────────────────────────────────────────────────────────────────

export type CrmErrorKind =
  | 'illegal_transition'
  | 'next_action_required'
  | 'next_action_in_past'
  | 'lost_reason_required'
  | 'not_found'
  | 'not_configured'
  | 'unknown'

export type CrmError = {
  kind: CrmErrorKind
  /** Hungarian, safe to render. Never a raw Postgres string. */
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: CrmError }

/**
 * SQLSTATEs raised by the guard trigger and the transition RPC. Branching on
 * these rather than on the message text keeps the UI working if the Hungarian
 * wording in the migration is ever reworded.
 */
const ERROR_BY_CODE: Record<string, CrmError> = {
  CR001: {
    kind: 'illegal_transition',
    message: 'Ez a státuszváltás nem megengedett.',
  },
  CR002: {
    kind: 'next_action_required',
    message: 'Ehhez a státuszhoz meg kell adnia a következő lépés dátumát.',
  },
  CR003: {
    kind: 'next_action_in_past',
    message: 'A következő lépés dátuma nem lehet múltbeli.',
  },
  CR004: {
    kind: 'lost_reason_required',
    message: 'Ehhez a státuszhoz meg kell adnia az indoklást.',
  },
  CR005: {
    kind: 'not_found',
    message: 'A lead nem található.',
  },
}

const NOT_CONFIGURED: CrmError = {
  kind: 'not_configured',
  message:
    'A CRM adatbázis nincs beállítva. Hiányzik a SUPABASE_SERVICE_ROLE_KEY a .env.local fájlból.',
}

function toCrmError(error: { code?: string; message?: string } | null): CrmError {
  if (!error) return { kind: 'unknown', message: 'Ismeretlen hiba történt.' }
  if (error.code && ERROR_BY_CODE[error.code]) return ERROR_BY_CODE[error.code]
  // Log the real thing for us; hand the UI something readable.
  console.error('[crm] unmapped database error', error.code, error.message)
  return { kind: 'unknown', message: 'A művelet nem sikerült. Próbálja újra.' }
}

// ─── Row mapping ─────────────────────────────────────────────────────────────
//
// form_answers is stored snake_case in jsonb (see 001_leads.sql) and used
// camelCase in TypeScript, so it crosses this boundary explicitly.

type StoredFormAnswers = {
  lead_form_id?: string | null
  submitted_at?: string | null
  submitted_at_text?: string | null
  answers?: FormAnswer[]
}

function readFormAnswers(value: unknown): FormAnswers | null {
  if (!value || typeof value !== 'object') return null
  const v = value as StoredFormAnswers
  return {
    leadFormId: v.lead_form_id ?? null,
    submittedAt: v.submitted_at ?? null,
    submittedAtText: v.submitted_at_text ?? null,
    answers: Array.isArray(v.answers) ? v.answers : [],
  }
}

function writeFormAnswers(parsed: FormAnswers): StoredFormAnswers {
  return {
    lead_form_id: parsed.leadFormId,
    submitted_at: parsed.submittedAt,
    submitted_at_text: parsed.submittedAtText,
    answers: parsed.answers,
  }
}

type LeadRow = Omit<Lead, 'form_answers'> & { form_answers: unknown }

function toLead(row: LeadRow): Lead {
  return {
    ...row,
    labels: row.labels ?? [],
    form_answers: readFormAnswers(row.form_answers),
  }
}

/** Turns a patch into the column values to send, parsing any pasted form block. */
function toColumns(patch: LeadFieldPatch): Record<string, unknown> {
  const { form_answers_raw, ...rest } = patch
  const columns: Record<string, unknown> = { ...rest }

  if (form_answers_raw !== undefined) {
    columns.form_answers_raw = form_answers_raw
    columns.form_answers = form_answers_raw?.trim()
      ? writeFormAnswers(parseFormAnswers(form_answers_raw))
      : null
  }
  return columns
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export type LeadFilter = {
  status?: LeadStatus | null
  niche?: string | null
  /** Only leads whose next step is due now or overdue. */
  dueOnly?: boolean
  search?: string | null
}

/**
 * The worklist order: soonest next step first, undated leads last. Overdue
 * rows sort to the top for free, because a past timestamp is a smaller one.
 */
export async function listLeads(filter: LeadFilter = {}): Promise<Lead[]> {
  if (!crmConfigured()) return []

  let q = crmDb().from('leads').select('*')

  if (filter.status) q = q.eq('status', filter.status)
  if (filter.niche) q = q.eq('niche', filter.niche)
  if (filter.dueOnly) q = q.lte('next_action_at', new Date().toISOString())
  if (filter.search?.trim()) {
    const p = `%${filter.search.trim()}%`
    q = q.or(
      `company_name.ilike.${p},contact_name.ilike.${p},email.ilike.${p},phone.ilike.${p}`
    )
  }

  const { data, error } = await q
    .order('next_action_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[crm] listLeads', error.message)
    return []
  }
  return (data ?? []).map((r) => toLead(r as LeadRow))
}

export async function getLead(id: string): Promise<Lead | null> {
  if (!crmConfigured()) return null
  const { data, error } = await crmDb().from('leads').select('*').eq('id', id).single()
  if (error || !data) return null
  return toLead(data as LeadRow)
}

export async function getLeadEvents(leadId: string): Promise<LeadEvent[]> {
  if (!crmConfigured()) return []
  const { data, error } = await crmDb()
    .from('lead_events')
    .select('*')
    .eq('lead_id', leadId)
    .order('occurred_at', { ascending: false })
  if (error) {
    console.error('[crm] getLeadEvents', error.message)
    return []
  }
  return (data ?? []) as LeadEvent[]
}

/** Every niche currently in use, for the filter dropdown. Free text column. */
export async function listNiches(): Promise<string[]> {
  if (!crmConfigured()) return []
  const { data, error } = await crmDb().from('leads').select('niche').not('niche', 'is', null)
  if (error) return []
  const set = new Set<string>()
  for (const row of data ?? []) {
    const n = (row as { niche: string | null }).niche?.trim()
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'hu'))
}

// ─── Transitions ─────────────────────────────────────────────────────────────

/**
 * The moves this status is allowed to make, read from lead_status_transitions.
 *
 * The edge list is not duplicated in TypeScript on purpose: the table is the
 * single source of truth, the trigger enforces it, and the UI renders exactly
 * what this returns. A status with no outgoing edges (CONVERTED, DISQUALIFIED)
 * yields an empty array, which is how the detail page knows to hide the control.
 */
export async function allowedTransitions(status: LeadStatus): Promise<LeadStatus[]> {
  if (!crmConfigured()) return []
  const { data, error } = await crmDb()
    .from('lead_status_transitions')
    .select('to_status')
    .eq('from_status', status)
  if (error) {
    console.error('[crm] allowedTransitions', error.message)
    return []
  }
  return (data ?? []).map((r) => (r as { to_status: LeadStatus }).to_status)
}

export type TransitionInput = {
  nextActionAt?: string | null
  lostReason?: string | null
  note?: string | null
}

/**
 * The only path that writes leads.status.
 *
 * Everything it could get wrong is caught inside Postgres by the trigger — an
 * illegal edge, a missing date, a missing reason — and comes back here as a
 * SQLSTATE that maps to a typed CrmError.
 */
export async function transitionLead(
  id: string,
  toStatus: LeadStatus,
  input: TransitionInput = {}
): Promise<Result<Lead>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const { data, error } = await crmDb().rpc('crm_transition_lead', {
    p_lead_id: id,
    p_to_status: toStatus,
    p_next_action_at: input.nextActionAt ?? null,
    p_lost_reason: input.lostReason ?? null,
    p_note: input.note ?? null,
  })

  if (error) return { ok: false, error: toCrmError(error) }
  if (!data) return { ok: false, error: ERROR_BY_CODE.CR005 }
  return { ok: true, data: toLead(data as LeadRow) }
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Always starts the lead at NEW — the default on the column. */
export async function createLead(input: NewLead): Promise<Result<Lead>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const { data, error } = await crmDb()
    .from('leads')
    .insert(toColumns(input))
    .select('*')
    .single()

  if (error) return { ok: false, error: toCrmError(error) }
  return { ok: true, data: toLead(data as LeadRow) }
}

/** Cannot touch status — see LeadFieldPatch. */
export async function updateLeadFields(
  id: string,
  patch: LeadFieldPatch
): Promise<Result<Lead>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const columns = toColumns(patch)
  if (Object.keys(columns).length === 0) {
    const current = await getLead(id)
    return current
      ? { ok: true, data: current }
      : { ok: false, error: ERROR_BY_CODE.CR005 }
  }

  const { data, error } = await crmDb()
    .from('leads')
    .update(columns)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return { ok: false, error: toCrmError(error) }
  if (!data) return { ok: false, error: ERROR_BY_CODE.CR005 }
  return { ok: true, data: toLead(data as LeadRow) }
}

/** Bumps the attempt counter and stamps the time. Used by the call buttons. */
export async function logContactAttempt(id: string): Promise<Result<Lead>> {
  const lead = await getLead(id)
  if (!lead) return { ok: false, error: ERROR_BY_CODE.CR005 }
  return updateLeadFields(id, {
    contact_attempts: lead.contact_attempts + 1,
    last_attempt_at: new Date().toISOString(),
  })
}

/** Bulk insert for the CSV import. Returns how many rows landed. */
export async function createLeads(rows: NewLead[]): Promise<Result<number>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }
  if (rows.length === 0) return { ok: true, data: 0 }

  const { data, error } = await crmDb()
    .from('leads')
    .insert(rows.map(toColumns))
    .select('id')

  if (error) return { ok: false, error: toCrmError(error) }
  return { ok: true, data: (data ?? []).length }
}
