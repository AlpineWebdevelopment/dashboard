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
   * Being worked on right now. Distinct from `done`, which is work finished,
   * and from the Ongoing page's own table, which tracks progress per person.
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

/** A card on the Ongoing page — what someone is working on right now. */
export type OngoingActivity = {
  id: string
  /** Set when the card tracks a board task; null for a free-standing activity. */
  task_id: string | null
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
