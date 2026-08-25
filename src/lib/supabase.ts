import { createClient } from '@supabase/supabase-js'

export type List = {
  id: string
  title: string
  /**
   * '' for a list you made, 'done' for the board's permanent archive column.
   * Needs the `kind` column — rows read before it existed carry none at all, which
   * every check reads as an ordinary list.
   */
  kind: string
  position: number
  created_at: string
}

export type Project = {
  id: string
  name: string
  color: string
  position: number
  created_at: string
}

export type Person = {
  id: string
  name: string
  color: string
  position: number
  created_at: string
}

export type Task = {
  id: string
  title: string
  description: string
  done: boolean
  priority: 'none' | 'low' | 'medium' | 'high'
  /**
   * The matrix axes, independent of `priority`. Null = not triaged yet, which is
   * a real state and gets its own column in the matrix view.
   */
  urgent: boolean | null
  important: boolean | null
  /**
   * Being worked on right now — distinct from `done`, which is work finished.
   *
   * A mirror of the Ongoing page rather than a second answer beside it: a task
   * is flagged exactly while a live `ongoing_activities` row tracks it, and
   * that card is where the person, state and percentage live. The actions keep
   * the two in step both ways; nothing else should set this on its own.
   * Needs the `ongoing` column on `tasks` (supabase-task-ongoing.sql).
   */
  ongoing: boolean
  /** Card colour label ('' = none). Needs the `color` column on `tasks`. */
  color: string
  due_date: string | null
  list_id: string | null
  project_id: string | null
  assignee_id: string | null
  position: number
  created_at: string
  updated_at: string
}

/**
 * A card on the Ongoing page — what someone is working on right now.
 *
 * The one record of a piece of work in flight. A card with a `task_id` is a
 * board task being worked on, and its task carries `ongoing: true` for exactly
 * as long as the card is live; a card without one is an activity that never had
 * a task. Marking a task ongoing on the board creates one of these, and
 * archiving one un-marks the task — the two pages are one feature.
 */
export type OngoingActivity = {
  id: string
  /** Set when the card tracks a board task; null for a free-standing activity. */
  task_id: string | null
  /** Null lands the card in the Unassigned column rather than nowhere. */
  person_id: string | null
  /** Own name, or a snapshot of the task title for a tracked task. */
  title: string
  /** Free text — where they're at ('waiting on feedback', 'blocked'…). */
  state: string
  /** 0–100. Reaching 100 never removes the card; archiving does. */
  progress: number
  archived: boolean
  archived_at: string | null
  position: number
  created_at: string
  updated_at: string
}

export type Folder = {
  id: string
  name: string
  type: 'pages' | 'tables' | 'calendars'
  parent_folder_id: string | null
  created_at: string
}

export type Page = {
  id: string
  title: string
  content: string
  folder_id: string | null
  share_token: string | null
  created_at: string
  updated_at: string
}

export type SheetColumn = {
  id: string
  name: string
}

export type SheetRow = {
  id: string
  [colId: string]: string
}


export type Spreadsheet = {
  id: string
  name: string
  columns: SheetColumn[]
  rows: SheetRow[]
  folder_id: string | null
  share_token: string | null
  created_at: string
  updated_at: string
}

export type Whiteboard = {
  id: string
  name: string
  data: { elements: unknown[]; files: Record<string, unknown> } | null
  created_at: string
  updated_at: string
}

export type Prompt = {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export type Thought = {
  id: string
  content: string
  pinned: boolean
  created_at: string
}

export type MrrClient = {
  id: string
  name: string
  description: string
  /** 'recurring' = setup fee + monthly fee; 'oneoff' = part job, one-time income only (setup_fee holds the amount) */
  kind: 'recurring' | 'oneoff'
  setup_fee: number
  monthly_fee: number
  monthly_description: string
  /** Contract date — first half of the setup fee is paid here (one-offs: payment date) */
  start_date: string // YYYY-MM-DD
  /** Second setup half paid + monthly billing starts. Null = still onboarding. */
  golive_date: string | null // YYYY-MM-DD
  /** Rare override: monthly billing starts this month instead of the go-live month */
  first_billing_date: string | null // YYYY-MM-DD
  end_date: string | null // YYYY-MM-DD
  /** The CRM lead this client was signed from, when it came through the pipeline. */
  lead_id: string | null
  created_at: string
  updated_at: string
}

/**
 * A piece of work being delivered for a client — the one board the client
 * account can see. Deliberately not the same thing as `MrrClient`, which is a
 * billing contract: a client can have several projects under one contract, and
 * the money never reaches this table.
 */
export type ClientProject = {
  id: string
  name: string
  /** Who it is for. Free text — these are not rows in any clients table. */
  client: string
  description: string
  status: ClientProjectStatus
  /** 0–100. Independent of `status`; a paused project keeps its figure. */
  progress: number
  /** YYYY-MM-DD, or null when nothing has been promised. */
  due_date: string | null
  /** Staging or live URL, shown as a link on the card. '' = none. */
  url: string
  /** The latest word for the client — what is happening right now. */
  note: string
  /**
   * The full roadmap, as written text. One per project and always read whole,
   * so it is a column here rather than a table of its own. Needs
   * supabase-client-project-tasks.sql; rows read before it existed carry none,
   * which the detail screen reads as "not written yet".
   */
  roadmap: string
  position: number
  created_at: string
  updated_at: string
}

export const CLIENT_PROJECT_STATUSES = [
  'planning',
  'in_progress',
  'review',
  'live',
  'paused',
] as const

export type ClientProjectStatus = (typeof CLIENT_PROJECT_STATUSES)[number]

/**
 * One step of a client project. Shaped to render as a board card — same four
 * priority levels as `Task`, so the two share PRIORITY_THEMES — but stored in
 * its own table, because these belong to a project rather than to a list and
 * the co-worker account reads them without seeing the personal board.
 */
export type ClientProjectTask = {
  id: string
  project_id: string
  title: string
  description: string
  phase: ClientTaskPhase
  priority: 'none' | 'low' | 'medium' | 'high'
  done: boolean
  /** Free text — 'Domi', 'Magdolna', 'Simon'. Not a `people` row. */
  owner: string
  position: number
  created_at: string
  updated_at: string
}

/**
 * The board's columns. 'parallel' is not a stage of the sequence — it is what
 * runs alongside it — which is why it sits between the sequence and the
 * backlog rather than inside either.
 */
export const CLIENT_TASK_PHASES = ['now', 'next', 'parallel', 'later'] as const

export type ClientTaskPhase = (typeof CLIENT_TASK_PHASES)[number]

export function decodeClientTaskPhase(raw: unknown): ClientTaskPhase {
  return CLIENT_TASK_PHASES.includes(raw as ClientTaskPhase)
    ? (raw as ClientTaskPhase)
    : 'next'
}

/** Anything unrecognised reads as 'planning' rather than blanking the card. */
export function decodeClientProjectStatus(raw: unknown): ClientProjectStatus {
  return CLIENT_PROJECT_STATUSES.includes(raw as ClientProjectStatus)
    ? (raw as ClientProjectStatus)
    : 'planning'
}

/** Storage bucket the background images live in. */
export const BACKGROUNDS_BUCKET = 'backgrounds'

export type BackgroundSettings = {
  /** Public URL of the chosen image, or null for no background. */
  url: string | null
  /** Opacity of the black overlay laid over the image, 0–1. */
  dim: number
  /** Blur radius applied to the image, in px. */
  blur: number
}

export const DEFAULT_BACKGROUND: BackgroundSettings = { url: null, dim: 0.55, blur: 0 }

/**
 * Public URL of a file in the backgrounds bucket. Mirrors what
 * `storage.getPublicUrl()` builds, but works on the server too, where the
 * browser client isn't available — the root layout needs it to paint the
 * wallpaper on the first response.
 */
export function backgroundUrl(name: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return ''
  return `${base}/storage/v1/object/public/${BACKGROUNDS_BUCKET}/${encodeURIComponent(name)}`
}

/** Inverse of `backgroundUrl` — the object name a chosen URL points at. */
export function backgroundName(url: string | null): string | null {
  if (!url) return null
  const last = url.split('/').pop()
  if (!last) return null
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set. Add them to .env.local')
  return createClient(url, key)
}

export const supabase = (() => {
  try { return getSupabaseClient() } catch { return null }
})()
