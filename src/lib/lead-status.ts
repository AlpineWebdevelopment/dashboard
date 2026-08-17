// The 15 lead states and their display labels.
//
// This is the only place the labels exist. They are not stored in the database
// (the enum holds the codes, nothing else) and they are not repeated in
// components — a component that needs to show a status reads LEAD_STATUS_LABELS.
//
// The allowed moves between these states are NOT here. They live in the
// lead_status_transitions table, which is the single source of truth for the
// edges; duplicating them in TypeScript is how the two drift apart.

/**
 * Mirrors the `lead_status` Postgres enum, in declaration order.
 *
 * Includes retired values — this list has to match the database exactly, since
 * an old row may still carry one. Use ACTIVE_STATUSES for anything a person
 * chooses from.
 */
export const LEAD_STATUSES = [
  'NEW',
  'CONTACTING',
  'MEETING_BOOKED',
  'MEETING_CALL',
  'QUALIFIED',
  'DEMO_CALL',
  'DEMO_BOOKED',
  'CONTRACT_CALL',
  'CONTRACT_MEET',
  'DECISION_PENDING',
  'NURTURE',
  'CONVERTED',
  'LOST',
  'DISQUALIFIED',
  'UNREACHABLE',
  'UNREACHABLE_RETRY',
  'EXTRA_MEETING_BOOKED',
  'EXTRA_MEETING_CALL',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

/**
 * Statuses no longer part of the flow. Retired in migration 009, which removed
 * every edge into and out of them.
 *
 * `CONTACTING` modelled "we are ringing them", but every new lead gets rung —
 * it was true of every lead the moment it arrived, so it distinguished nothing
 * while costing a click.
 *
 * `QUALIFIED` sat between the meeting and what the meeting produced. A lead
 * that qualifies always leaves with a demo or a contract to arrange, and the
 * four states after it already say which — so it only repeated what the next
 * state was about to say.
 *
 * Both values stay in the enum because Postgres cannot drop one without
 * recreating the type, which would mean rebuilding every function that takes a
 * lead_status. Keeping them out of the UI achieves the same thing.
 */
export const RETIRED_STATUSES: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  'CONTACTING',
  'QUALIFIED',
])

/** What a person may pick. Everything except the retired values. */
export const ACTIVE_STATUSES = LEAD_STATUSES.filter((s) => !RETIRED_STATUSES.has(s))

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New lead',
  CONTACTING: 'Contacting (retired)',
  QUALIFIED: 'Qualified (retired)',
  UNREACHABLE_RETRY: 'Unreachable – ring again',
  MEETING_BOOKED: 'Meeting booked',
  MEETING_CALL: 'Rebook – no show',
  EXTRA_MEETING_BOOKED: 'Extra meeting booked',
  EXTRA_MEETING_CALL: 'Extra meeting – to schedule',
  DEMO_CALL: 'Demo – to schedule',
  DEMO_BOOKED: 'Demo booked',
  CONTRACT_CALL: 'Contract – to schedule',
  CONTRACT_MEET: 'Contract meeting',
  DECISION_PENDING: 'Offer out – awaiting decision',
  NURTURE: 'Nurture',
  CONVERTED: 'Customer',
  LOST: 'Lost',
  DISQUALIFIED: 'Not our market',
  UNREACHABLE: 'Unreachable',
}

/**
 * Display metadata only — what a state means at a glance.
 *
 * Not used to decide anything. Whether a state is reachable, and whether it is
 * a dead end, is answered by lead_status_transitions: a hard terminal is simply
 * a status with no outgoing edges there.
 */
export type LeadStatusKind = 'active' | 'parked' | 'terminal'

export const LEAD_STATUS_KIND: Record<LeadStatus, LeadStatusKind> = {
  NEW: 'active',
  CONTACTING: 'active',
  MEETING_BOOKED: 'active',
  MEETING_CALL: 'active',
  QUALIFIED: 'active',
  DEMO_CALL: 'active',
  DEMO_BOOKED: 'active',
  CONTRACT_CALL: 'active',
  CONTRACT_MEET: 'active',
  DECISION_PENDING: 'active',
  NURTURE: 'parked',
  CONVERTED: 'terminal',
  LOST: 'terminal',
  DISQUALIFIED: 'terminal',
  UNREACHABLE: 'terminal',
  // Still being chased, so it belongs in the worklist rather than among the
  // states you have stopped working.
  UNREACHABLE_RETRY: 'active',
  EXTRA_MEETING_BOOKED: 'active',
  EXTRA_MEETING_CALL: 'active',
}

export function leadStatusLabel(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status]
}
