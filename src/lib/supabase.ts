import { createClient } from '@supabase/supabase-js'

export type Page = {
  id: string
  title: string
  content: string
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
