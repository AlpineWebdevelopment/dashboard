import { createClient } from '@supabase/supabase-js'

export type List = {
  id: string
  title: string
  position: number
  created_at: string
}

export type Task = {
  id: string
  title: string
  description: string
  done: boolean
  priority: 'none' | 'low' | 'medium' | 'high'
  due_date: string | null
  list_id: string | null
  position: number
  created_at: string
  updated_at: string
}

export type Folder = {
  id: string
  name: string
  type: 'pages' | 'tables' | 'calendars'
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

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set. Add them to .env.local')
  return createClient(url, key)
}

export const supabase = (() => {
  try { return getSupabaseClient() } catch { return null }
})()
