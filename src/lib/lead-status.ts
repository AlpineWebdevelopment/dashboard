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

export function leadStatusLabel(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status]
}

// ─── Pipes ───────────────────────────────────────────────────────────────────

/**
 * The seven stretches of the pipeline, which is how a lead is read at a glance.
 *
 * Sixteen statuses is the right resolution for deciding what to do with one
 * lead and the wrong resolution for scanning a list of them. The pipe is the
 * coarse answer — is this new, is it moving, is it dead — and it is the only
 * thing the colour of a badge encodes. The status itself is still written out;
 * the colour just saves you reading it.
 *
 * Display only. Nothing branches on a pipe: what a lead may do next comes from
 * lead_status_transitions, and two statuses sharing a colour says nothing about
 * whether one can reach the other.
 */
export type LeadPipe =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'disqualified'
  | 'lost'
  | 'nurture'

/** Pipeline order, for anything that needs to lay the pipes out in sequence. */
export const LEAD_PIPES: readonly LeadPipe[] = [
  'new',
  'contacted',
  'qualified',
  'converted',
  'nurture',
  'lost',
  'disqualified',
] as const

/**
 * The order the worklist sorts pipes into, hottest first.
 *
 * Not the same as LEAD_PIPES, and deliberately so. That one is the board's
 * left-to-right layout, which follows the pipeline as a lead travels it. This
 * one follows how much of your attention a lead deserves, which is a different
 * question with a different answer: the uncalled first, then the ones with
 * money attached, and everything finished sinks.
 *
 * New is at the very top, above even Qualified. It is the one pipe that ranks
 * by urgency rather than progress: a lead nobody has rung yet is the thing that
 * goes stale fastest, and every one of them needs a call. A qualified lead has
 * already been spoken to and has a date in the diary.
 */
export const LEAD_PIPE_SORT_RANK: Record<LeadPipe, number> = {
  new: 0,
  qualified: 1,
  contacted: 2,
  nurture: 3,
  // The bottom three. Distinct ranks rather than one shared rank, so the order
  // among them is at least predictable.
  converted: 4,
  lost: 5,
  disqualified: 6,
}

export const LEAD_PIPE_LABELS: Record<LeadPipe, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  disqualified: 'Not qualified',
  lost: 'Lost',
  nurture: 'Nurture',
}

export const LEAD_STATUS_PIPE: Record<LeadStatus, LeadPipe> = {
  NEW: 'new',

  // Reached out, nothing decided yet. A booked first meeting belongs here
  // rather than in qualified: getting someone into the diary is contact, not
  // yet a judgement about whether they are worth selling to.
  CONTACTING: 'contacted',
  MEETING_BOOKED: 'contacted',
  MEETING_CALL: 'contacted',
  UNREACHABLE_RETRY: 'contacted',

  // Worth pursuing, and being pursued. Everything between the first meeting
  // and the signature — the demos, the extra meetings, the contract, the offer
  // sitting with them.
  QUALIFIED: 'qualified',
  EXTRA_MEETING_BOOKED: 'qualified',
  EXTRA_MEETING_CALL: 'qualified',
  DEMO_BOOKED: 'qualified',
  DEMO_CALL: 'qualified',
  CONTRACT_MEET: 'qualified',
  CONTRACT_CALL: 'qualified',
  DECISION_PENDING: 'qualified',

  CONVERTED: 'converted',

  // Not now rather than not ever. Unreachable sits here because it is the same
  // situation from the other side — you have stopped working the lead but not
  // written it off, which is exactly why UNREACHABLE → UNREACHABLE_RETRY is an
  // edge in the transition table.
  NURTURE: 'nurture',
  UNREACHABLE: 'nurture',

  LOST: 'lost',
  DISQUALIFIED: 'disqualified',
}

export function leadPipe(status: LeadStatus): LeadPipe {
  return LEAD_STATUS_PIPE[status]
}

// ─── What a status asks for on the way in ────────────────────────────────────
//
// Both of these used to live in LeadDetail. They are here now because the
// pipeline board moves leads too, and two screens deciding separately which
// statuses need a reason is exactly how one of them ends up asking for the
// wrong thing.

/**
 * States where a follow-up date is the natural next thing to set — the ones a
 * lead can quietly rot in.
 *
 * A prompt, not a rule. The database used to refuse these without a future
 * date, which made it impossible to record a step that had already happened:
 * no future date honestly describes a call made in March.
 */
export const SUGGESTS_DATE: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  'UNREACHABLE_RETRY',
  'MEETING_CALL',
  'DEMO_CALL',
  'EXTRA_MEETING_CALL',
  'CONTRACT_CALL',
  'DECISION_PENDING',
  'NURTURE',
])

/**
 * States that cannot be entered without a reason. Guard CR004 refuses them, so
 * anything moving a lead has to collect one first rather than find out after.
 */
export const NEEDS_REASON: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  'LOST',
  'DISQUALIFIED',
  'UNREACHABLE',
])
