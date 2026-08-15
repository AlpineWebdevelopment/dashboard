import { createClient } from '@supabase/supabase-js'

export type List = {
  id: string
  title: string
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
  /** Card colour label ('' = none). Needs supabase-task-color.sql. */
  color: string
  due_date: string | null
  list_id: string | null
  project_id: string | null
  assignee_id: string | null
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

export type Calendar = {
  id: string
  name: string
  description: string
  color: string
  emoji: string
  goal: string
  folder_id: string | null
  created_at: string
  updated_at: string
}

export type CalendarEntry = {
  id: string
  calendar_id: string
  date: string // YYYY-MM-DD
  completed: boolean
  status: 'green' | 'yellow' | 'red' | ''
  note: string
  created_at: string
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

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set. Add them to .env.local')
  return createClient(url, key)
}

export const supabase = (() => {
  try { return getSupabaseClient() } catch { return null }
})()
