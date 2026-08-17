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

/**
 * What a timeline entry represents.
 *
 * `status_change` is a normal pipeline move. `backfill` is one that skipped the
 * transition table — recorded separately so a reconstructed history never
 * passes for a real one. The rest carry no status at all.
 */
export type LeadEventKind =
  | 'status_change'
  | 'backfill'
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'

export const ACTIVITY_KINDS = ['call', 'email', 'meeting', 'note'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export type LeadEvent = {
  id: string
  lead_id: string
  from_status: LeadStatus | null
  /** Null for activity entries — a logged call has no destination status. */
  to_status: LeadStatus | null
  kind: LeadEventKind
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

/**
 * Same shape as a patch — a new lead is created at NEW and moved from there.
 *
 * created_at is writable here and nowhere else: a CSV import carries Meta's
 * original capture time, and a lead that says it arrived today when it arrived
 * three weeks ago is worse than useless in a worklist sorted by age.
 */
export type NewLead = LeadFieldPatch & { created_at?: string }

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
  /** Safe to render. Never a raw Postgres string. */
  message: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: CrmError }

/**
 * SQLSTATEs raised by the guard trigger and the RPCs. Branching on these rather
 * than on message text keeps the UI working if the wording in a migration is
 * ever changed — the migrations still raise in Hungarian, and none of it
 * reaches the screen.
 */
const ERROR_BY_CODE: Record<string, CrmError> = {
  CR001: {
    kind: 'illegal_transition',
    message: 'That status change is not allowed from where this lead is now.',
  },
  CR002: {
    kind: 'next_action_required',
    message: 'This status needs a date for the next step.',
  },
  CR003: {
    kind: 'next_action_in_past',
    message: 'The next step cannot be set to a date in the past.',
  },
  CR004: {
    kind: 'lost_reason_required',
    message: 'This status needs a reason.',
  },
  CR005: {
    kind: 'not_found',
    message: 'That lead no longer exists.',
  },
  CR006: {
    kind: 'unknown',
    message: 'The lead history cannot be edited.',
  },
  CR007: {
    kind: 'unknown',
    message: 'The client is missing a name or a start date.',
  },
  CR008: {
    kind: 'unknown',
    message: 'That is not a kind of activity this can record.',
  },
  // A second client for a lead that already converted. Reachable only if the
  // first client row was deleted, since CONVERTED is otherwise a dead end.
  '23505': {
    kind: 'unknown',
    message: 'This lead is already linked to a client.',
  },
}

const NOT_CONFIGURED: CrmError = {
  kind: 'not_configured',
  message: 'The CRM database is not configured — SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.',
}

function toCrmError(error: { code?: string; message?: string } | null): CrmError {
  if (!error) return { kind: 'unknown', message: 'Something went wrong.' }
  if (error.code && ERROR_BY_CODE[error.code]) return ERROR_BY_CODE[error.code]
  // Log the real thing for us; hand the UI something readable.
  console.error('[crm] unmapped database error', error.code, error.message)
  return { kind: 'unknown', message: 'That did not work. Please try again.' }
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

/**
 * Statuses from which a lead can legally become a customer.
 *
 * Read from lead_status_transitions rather than listed here, for the same
 * reason allowedTransitions() is: the table decides, and a TypeScript copy of
 * the edge list is a second source of truth waiting to drift. Currently this
 * resolves to DEMO_BOOKED, CONTRACT_MEET and DECISION_PENDING.
 */
export async function convertibleStatuses(): Promise<LeadStatus[]> {
  if (!crmConfigured()) return []
  const { data, error } = await crmDb()
    .from('lead_status_transitions')
    .select('from_status')
    .eq('to_status', 'CONVERTED')
  if (error) {
    console.error('[crm] convertibleStatuses', error.message)
    return []
  }
  return (data ?? []).map((r) => (r as { from_status: LeadStatus }).from_status)
}

/**
 * Leads that could be signed as a client right now.
 *
 * Feeds the picker on the MRR page. Leads already linked to a client are
 * excluded implicitly: converting sets them to CONVERTED, which is not one of
 * the statuses above.
 */
export async function listConvertibleLeads(): Promise<Lead[]> {
  if (!crmConfigured()) return []

  const statuses = await convertibleStatuses()
  if (statuses.length === 0) return []

  const { data, error } = await crmDb()
    .from('leads')
    .select('*')
    .in('status', statuses)
    .order('next_action_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[crm] listConvertibleLeads', error.message)
    return []
  }
  return (data ?? []).map((r) => toLead(r as LeadRow))
}

/** The mrr_clients columns the conversion RPC accepts. */
export type NewClientFromLead = {
  name: string
  description: string
  kind: 'recurring' | 'oneoff'
  setup_fee: number
  monthly_fee: number
  monthly_description: string
  start_date: string
  golive_date: string | null
  first_billing_date: string | null
  end_date: string | null
}

/**
 * Create the client and move the lead to CONVERTED as one transaction.
 *
 * Both halves live in crm_convert_lead_to_client (006) rather than being two
 * calls from here: PostgREST gives each request its own transaction, so doing
 * it in two steps could leave a converted lead with no client, or a client
 * whose lead never moved.
 */
export async function convertLeadToClient(
  leadId: string,
  client: NewClientFromLead,
  note?: string | null
): Promise<Result<{ id: string }>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const { data, error } = await crmDb().rpc('crm_convert_lead_to_client', {
    p_lead_id: leadId,
    p_client: client,
    p_note: note?.trim() || null,
  })

  if (error) return { ok: false, error: toCrmError(error) }
  if (!data) return { ok: false, error: ERROR_BY_CODE.CR005 }
  return { ok: true, data: data as { id: string } }
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

  // leads.lost_reason holds why a lead is closed *now*, and is cleared when it
  // reopens (see 003_transition_rpc.sql). So the reason is copied into the
  // event note as well — otherwise reopening a lead would erase any record of
  // why it was closed the first time.
  const reason = input.lostReason?.trim()
  const note = input.note?.trim() || (reason ? `Reason: ${reason}` : null)

  const { data, error } = await crmDb().rpc('crm_transition_lead', {
    p_lead_id: id,
    p_to_status: toStatus,
    p_next_action_at: input.nextActionAt ?? null,
    p_lost_reason: reason || null,
    p_note: note,
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

/**
 * Move a lead to any status, bypassing the transition table.
 *
 * For entering history that already happened — an old client imported as a new
 * lead has no way through the pipeline that reflects reality. The event is
 * written with kind 'backfill', so the timeline shows plainly that this was a
 * correction rather than a step someone actually walked.
 *
 * Guard CR004 still applies: closing a lead needs a reason whenever it happened.
 */
export async function backfillLeadStatus(
  id: string,
  toStatus: LeadStatus,
  input: { note?: string | null; occurredAt?: string | null; lostReason?: string | null } = {}
): Promise<Result<Lead>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const reason = input.lostReason?.trim()
  const note = input.note?.trim() || (reason ? `Reason: ${reason}` : null)

  const { data, error } = await crmDb().rpc('crm_backfill_lead_status', {
    p_lead_id: id,
    p_to_status: toStatus,
    p_note: note,
    p_occurred_at: input.occurredAt ?? null,
    p_lost_reason: reason || null,
  })

  if (error) return { ok: false, error: toCrmError(error) }
  if (!data) return { ok: false, error: ERROR_BY_CODE.CR005 }
  return { ok: true, data: toLead(data as LeadRow) }
}

/**
 * Record something that happened without moving the lead.
 *
 * A logged call also bumps contact_attempts, which is what the worklist's
 * attempt column counts. The counter is kept for calls only — an email is not
 * a chase attempt in the sense that column means.
 */
export async function logActivity(
  id: string,
  kind: ActivityKind,
  input: { note?: string | null; occurredAt?: string | null } = {}
): Promise<Result<LeadEvent>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const { data, error } = await crmDb().rpc('crm_log_activity', {
    p_lead_id: id,
    p_kind: kind,
    p_note: input.note?.trim() || null,
    p_occurred_at: input.occurredAt ?? null,
  })

  if (error) return { ok: false, error: toCrmError(error) }
  return { ok: true, data: data as LeadEvent }
}

/**
 * Correct a timeline entry.
 *
 * Only the date and the note. The database refuses anything else with CR006 —
 * which status change an entry records is not editable, so history can be
 * corrected but not rewritten.
 */
export async function updateLeadEvent(
  eventId: string,
  patch: { occurredAt?: string; note?: string | null }
): Promise<Result<LeadEvent>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const columns: Record<string, unknown> = {}
  if (patch.occurredAt !== undefined) columns.occurred_at = patch.occurredAt
  if (patch.note !== undefined) columns.note = patch.note?.trim() || null
  if (Object.keys(columns).length === 0) return { ok: false, error: ERROR_BY_CODE.CR005 }

  const { data, error } = await crmDb()
    .from('lead_events')
    .update(columns)
    .eq('id', eventId)
    .select('*')
    .single()

  if (error) return { ok: false, error: toCrmError(error) }
  if (!data) return { ok: false, error: ERROR_BY_CODE.CR005 }
  return { ok: true, data: data as LeadEvent }
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
