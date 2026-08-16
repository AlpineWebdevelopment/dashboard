// The 15 lead states and their Hungarian labels.
//
// This is the only place the labels exist. They are not stored in the database
// (the enum holds the codes, nothing else) and they are not repeated in
// components — a component that needs to show a status reads LEAD_STATUS_LABELS.
//
// The allowed moves between these states are NOT here. They live in the
// lead_status_transitions table, which is the single source of truth for the
// edges; duplicating them in TypeScript is how the two drift apart.

/** Mirrors the `lead_status` Postgres enum, in declaration order. */
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
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Új érdeklődő',
  CONTACTING: 'Hívás alatt',
  MEETING_BOOKED: 'Találkozó egyeztetve',
  MEETING_CALL: 'Újrahívás – nem jelent meg',
  QUALIFIED: 'Kvalifikált',
  DEMO_CALL: 'Demó – időpont egyeztetése',
  DEMO_BOOKED: 'Demó egyeztetve',
  CONTRACT_CALL: 'Szerződés – időpont egyeztetése',
  CONTRACT_MEET: 'Szerződéskötő találkozó',
  DECISION_PENDING: 'Ajánlat kint – döntésre vár',
  NURTURE: 'Későbbre',
  CONVERTED: 'Ügyfél',
  LOST: 'Elutasított',
  DISQUALIFIED: 'Nem célpiac',
  UNREACHABLE: 'Elérhetetlen',
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
}

export function leadStatusLabel(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status]
}
