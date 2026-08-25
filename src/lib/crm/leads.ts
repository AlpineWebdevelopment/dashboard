// Data access for the CRM. Server-side only — every function here goes through
// crmDb(), which carries the service-role key.
//
// The one rule this module exists to enforce: transitionLead() is the only way
// leads.status is ever written. createLead() always starts a lead at NEW, and
// updateLeadFields() is typed so that passing a status is a compile error, not
// a convention someone can forget. The database enforces the same thing from
// the other side, with a guard trigger on `leads`, so both layers have to fail
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
  /**
   * When anything last happened to this lead — the newest lead_events row.
   *
   * Derived, not a column, and only filled in by listLeads(): getLead() leaves
   * it null because the lead page loads the whole timeline anyway and can read
   * the newest entry straight off it. Null therefore means "not looked up
   * here", not "nothing has happened" — a lead with no history at all is
   * simply absent from the aggregate, and callers fall back to created_at.
   */
  last_event_at: string | null
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
  /**
   * A file was attached, and a file was removed (lib/attachments.ts). Written
   * by the system, never chosen by hand — which is why both are absent from
   * ACTIVITY_KINDS below.
   *
   * Removing a file does not remove the entry that recorded attaching it. Both
   * stay, for the same reason a corrected status keeps the move it corrected:
   * the timeline is what happened, not what is currently true.
   *
   * 'file' rather than 'file_added' only because it shipped first and rows
   * already carry it — the pair is asymmetric in the database and symmetric
   * everywhere it is read.
   */
  | 'file'
  | 'file_removed'

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
  | 'not_a_customer'
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
 * than on message text keeps the UI working if the wording in the database is
 * ever changed — those functions still raise in Hungarian, and none of it
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
  CR009: {
    kind: 'not_a_customer',
    message: 'That lead is not a customer yet. Move it to Customer in the CRM first.',
  },
  // 23505 was mapped here for a second client landing on a unique index over
  // `mrr_clients.lead_id`. That index is gone — a lead holding several jobs is the
  // point now — and nothing else these RPCs touch is unique, so the entry would
  // survive only as a message that is no longer true. A 23505 arriving from
  // somewhere unforeseen falls through to toCrmError(), which logs the real code.
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
// form_answers is stored snake_case in jsonb and used
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

type LeadRow = Omit<Lead, 'form_answers' | 'last_event_at'> & { form_answers: unknown }

function toLead(row: LeadRow): Lead {
  return {
    ...row,
    labels: row.labels ?? [],
    form_answers: readFormAnswers(row.form_answers),
    last_event_at: null,
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

  const leads = (data ?? []).map((r) => toLead(r as LeadRow))
  const lastEvents = await lastEventTimes()
  for (const lead of leads) lead.last_event_at = lastEvents.get(lead.id) ?? null
  return leads
}

/**
 * The newest event per lead, from the crm_lead_last_events RPC.
 *
 * One row per lead rather than every event, so this stays the same size as the
 * lead list however long the histories get. A failure here is not worth failing
 * the whole worklist over — an empty map means the ages fall back to created_at,
 * which is a slightly less useful screen rather than no screen.
 */
async function lastEventTimes(): Promise<Map<string, string>> {
  const { data, error } = await crmDb().rpc('crm_lead_last_events')
  if (error) {
    console.error('[crm] lastEventTimes', error.message)
    return new Map()
  }
  const rows = (data ?? []) as { lead_id: string; last_event_at: string | null }[]
  return new Map(
    rows.filter((r) => r.last_event_at).map((r) => [r.lead_id, r.last_event_at as string])
  )
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

/** Every edge, keyed by where it starts. Statuses with no way out are absent. */
export type TransitionMap = Partial<Record<LeadStatus, LeadStatus[]>>

/**
 * The whole edge list, for the pipeline board.
 *
 * allowedTransitions() answers for one status, which is all the lead page needs
 * — it knows which lead it is showing. The board does not: a drag has to be
 * judged legal or not while it is in the air, for whichever card is moving, and
 * asking the server per hover is not an option.
 *
 * This is still the table answering, at request time. The edges are read here
 * and sent to the browser; they are never written down in TypeScript, so the
 * board cannot come to believe in a move the trigger would refuse.
 */
export async function listTransitions(): Promise<TransitionMap> {
  if (!crmConfigured()) return {}
  const { data, error } = await crmDb()
    .from('lead_status_transitions')
    .select('from_status, to_status')
  if (error) {
    console.error('[crm] listTransitions', error.message)
    return {}
  }

  const map: TransitionMap = {}
  for (const row of (data ?? []) as { from_status: LeadStatus; to_status: LeadStatus }[]) {
    ;(map[row.from_status] ??= []).push(row.to_status)
  }
  return map
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
 * How many client rows each lead is carrying.
 *
 * A count rather than the set of ids it used to be, because a lead can hold more
 * than one: a customer who bought a site, then a retainer,
 * then a one-off job is three mrr_clients rows against one lead.
 *
 * That count is what splits the leads the MRR picker offers into its two lists.
 * Zero means nothing has been billed against this lead yet; anything above means
 * it is an existing customer, and a new client row would be another job for it.
 * The split is not just presentation — one list is a to-do and the other is an
 * archive, and merged they are a single dropdown holding every customer the
 * business has ever had.
 */
async function clientCountByLead(): Promise<Map<string, number>> {
  if (!crmConfigured()) return new Map()
  const { data, error } = await crmDb()
    .from('mrr_clients')
    .select('lead_id')
    .not('lead_id', 'is', null)
  if (error) {
    console.error('[crm] clientCountByLead', error.message)
    return new Map()
  }
  const counts = new Map<string, number>()
  for (const { lead_id } of (data ?? []) as { lead_id: string }[]) {
    counts.set(lead_id, (counts.get(lead_id) ?? 0) + 1)
  }
  return counts
}

/**
 * Customers with no revenue recorded against them.
 *
 * Leads that reached CONVERTED without a client row — dragged there on the
 * board, or moved from the lead page. They are the one thing the MRR page can
 * usefully nag about, and the "no jobs yet" side of the attach control. The
 * other side is listLinkedLeads(); both are customers already, because attaching
 * is a statement about a lead that has converted rather than a way of converting
 * one.
 *
 * The same list feeds the green count in the MRR header, which is why they can
 * never disagree.
 */
export async function listAttachableLeads(): Promise<Lead[]> {
  if (!crmConfigured()) return []

  const [counts, { data, error }] = await Promise.all([
    clientCountByLead(),
    crmDb()
      .from('leads')
      .select('*')
      .eq('status', 'CONVERTED')
      .order('updated_at', { ascending: false }),
  ])

  if (error) {
    console.error('[crm] listAttachableLeads', error.message)
    return []
  }
  return (data ?? [])
    .map((r) => toLead(r as LeadRow))
    .filter((l) => !counts.has(l.id))
}

/** A customer, carrying the number of jobs already billed against it. */
export type CustomerLead = Lead & { clientCount: number }

/**
 * Customers that already have revenue recorded — the mirror of
 * listAttachableLeads.
 *
 * It began as a naming crutch: the attach control had to be able to show the
 * lead a client was already linked to, and that lead is by definition missing
 * from the list of unattached ones. Now it is a list you pick from. A
 * customer coming back for a second service is chosen here, and the new client
 * row joins the ones already hanging off that lead instead of being refused by a
 * unique index.
 *
 * clientCount rides along because it is the only thing that tells these apart on
 * screen. Two customers called Acme are indistinguishable in a dropdown;
 * "Acme · 3 jobs" is not.
 */
export async function listLinkedLeads(): Promise<CustomerLead[]> {
  if (!crmConfigured()) return []

  const counts = await clientCountByLead()
  if (counts.size === 0) return []

  const { data, error } = await crmDb()
    .from('leads')
    .select('*')
    .in('id', [...counts.keys()])
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('[crm] listLinkedLeads', error.message)
    return []
  }
  return (data ?? []).map((r) => {
    const lead = toLead(r as LeadRow)
    return { ...lead, clientCount: counts.get(lead.id) ?? 0 }
  })
}

/**
 * Leads that could be signed as a client right now.
 *
 * Feeds the "new" side of the MRR picker: leads on their way to a first sale,
 * plus customers that never had one recorded. Leads with revenue already against
 * them are filtered out and offered by listLinkedLeads() instead. They are
 * perfectly valid to sign another job for, they just belong on the
 * other side of the switch.
 */
export async function listConvertibleLeads(): Promise<Lead[]> {
  if (!crmConfigured()) return []

  const [statuses, counts] = await Promise.all([convertibleStatuses(), clientCountByLead()])
  if (statuses.length === 0) return []

  const { data, error } = await crmDb()
    .from('leads')
    .select('*')
    // CONVERTED is included even though it cannot reach itself. A lead that got
    // to Customer on its own still needs a client creating for it, and leaving
    // it out was what made Customer a one-way door: out of every picker, with
    // its revenue permanently unattachable. crm_convert_lead_to_client skips
    // the transition for these.
    .in('status', [...statuses, 'CONVERTED'])
    .order('next_action_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[crm] listConvertibleLeads', error.message)
    return []
  }
  return (data ?? [])
    .map((r) => toLead(r as LeadRow))
    .filter((l) => !counts.has(l.id))
}

/**
 * Point a client at a lead, or at nothing.
 *
 * Only writes mrr_clients.lead_id. The lead must already be CONVERTED and its
 * status is never touched, so nothing here can move a lead through the
 * pipeline. That restriction is the whole point rather than a limitation: a
 * quieter second route into CONVERTED would skip both the transition table and
 * the revenue the real one collects.
 */
export async function linkLeadToClient(
  clientId: string,
  leadId: string | null
): Promise<Result<null>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const { error } = await crmDb().rpc('crm_link_lead_to_client', {
    p_client_id: clientId,
    p_lead_id: leadId,
  })

  if (error) return { ok: false, error: toCrmError(error) }
  return { ok: true, data: null }
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
  // reopens. So the reason is copied into the
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
