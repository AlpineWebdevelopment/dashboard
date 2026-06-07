'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Calendar, CalendarEntry, Folder, List, Page, Spreadsheet, SheetColumn, SheetRow, Task } from './supabase'

function isConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function db() {
  if (!isConfigured()) throw new Error('Supabase env vars not configured')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function getFolders(type: 'pages' | 'tables' | 'calendars'): Promise<Folder[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db().from('folders').select('*').eq('type', type).order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function getFolder(id: string): Promise<Folder | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db().from('folders').select('*').eq('id', id).single()
    if (error) throw error
    return data
  } catch {
    return null
  }
}

export async function createFolder(type: 'pages' | 'tables' | 'calendars'): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('folders')
    .insert({ type, name: 'Untitled Folder' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/${type}`)
  return data.id
}

export async function renameFolder(id: string, name: string, type: 'pages' | 'tables' | 'calendars') {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('folders').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/${type}`)
}

export async function deleteFolder(id: string, type: 'pages' | 'tables' | 'calendars') {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('folders').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/${type}`)
  redirect(`/${type}`)
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function getPages(): Promise<Page[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('pages')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function getPagesByFolder(folderId: string | null): Promise<Page[]> {
  if (!isConfigured()) return []
  try {
    if (folderId) {
      const { data, error } = await db()
        .from('pages')
        .select('*')
        .eq('folder_id', folderId)
        .order('updated_at', { ascending: false })
      if (error) return []
      return data ?? []
    } else {
      // Try folder_id IS NULL; if column doesn't exist yet, fall back to all pages
      const { data, error } = await db()
        .from('pages')
        .select('*')
        .is('folder_id', null)
        .order('updated_at', { ascending: false })
      if (error) {
        const { data: all } = await db()
          .from('pages')
          .select('*')
          .order('updated_at', { ascending: false })
        return all ?? []
      }
      return data ?? []
    }
  } catch {
    return []
  }
}

export async function getPage(id: string): Promise<Page | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db().from('pages').select('*').eq('id', id).single()
    if (error) throw error
    return data
  } catch {
    return null
  }
}

export async function createPage(folderId?: string | null) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('pages')
    .insert({ title: 'Untitled', content: '', folder_id: folderId ?? null })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/pages')
  redirect(`/pages/${data.id}`)
}

export async function savePage(id: string, title: string, content: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db()
    .from('pages')
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pages')
  revalidatePath(`/pages/${id}`)
}

export async function deletePage(id: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('pages').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pages')
  redirect('/pages')
}

export async function movePageToFolder(pageId: string, folderId: string | null) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db()
    .from('pages')
    .update({ folder_id: folderId })
    .eq('id', pageId)
  if (error) throw new Error(error.message)
  revalidatePath('/pages')
}

// ─── Share tokens ─────────────────────────────────────────────────────────────

export async function generatePageShareToken(id: string): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const token = crypto.randomUUID()
  const { error } = await db().from('pages').update({ share_token: token }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/pages/${id}`)
  return token
}

export async function generateSpreadsheetShareToken(id: string): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const token = crypto.randomUUID()
  const { error } = await db().from('spreadsheets').update({ share_token: token }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/tables/${id}`)
  return token
}

export async function revokePageShareToken(id: string): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('pages').update({ share_token: null }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/pages/${id}`)
}

export async function revokeSpreadsheetShareToken(id: string): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('spreadsheets').update({ share_token: null }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/tables/${id}`)
}

export async function getPageByShareToken(token: string): Promise<Page | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db().from('pages').select('*').eq('share_token', token).single()
    if (error) return null
    return data
  } catch { return null }
}

export async function getSpreadsheetByShareToken(token: string): Promise<Spreadsheet | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db().from('spreadsheets').select('*').eq('share_token', token).single()
    if (error) return null
    return data
  } catch { return null }
}

// ─── Spreadsheets ─────────────────────────────────────────────────────────────

export async function getSpreadsheets(): Promise<Spreadsheet[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('spreadsheets')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function getSpreadsheetsByFolder(folderId: string | null): Promise<Spreadsheet[]> {
  if (!isConfigured()) return []
  try {
    if (folderId) {
      const { data, error } = await db()
        .from('spreadsheets')
        .select('*')
        .eq('folder_id', folderId)
        .order('updated_at', { ascending: false })
      if (error) return []
      return data ?? []
    } else {
      const { data, error } = await db()
        .from('spreadsheets')
        .select('*')
        .is('folder_id', null)
        .order('updated_at', { ascending: false })
      if (error) {
        const { data: all } = await db()
          .from('spreadsheets')
          .select('*')
          .order('updated_at', { ascending: false })
        return all ?? []
      }
      return data ?? []
    }
  } catch {
    return []
  }
}

export async function getSpreadsheet(id: string): Promise<Spreadsheet | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db().from('spreadsheets').select('*').eq('id', id).single()
    if (error) throw error
    return data
  } catch {
    return null
  }
}

export async function createSpreadsheet(folderId?: string | null) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const defaultCol = { id: crypto.randomUUID(), name: 'Column 1' }
  const { data, error } = await db()
    .from('spreadsheets')
    .insert({
      name: 'Untitled Table',
      columns: [defaultCol],
      rows: [{ id: crypto.randomUUID() }],
      folder_id: folderId ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/tables')
  redirect(`/tables/${data.id}`)
}

export async function saveSpreadsheet(
  id: string,
  name: string,
  columns: SheetColumn[],
  rows: SheetRow[]
) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db()
    .from('spreadsheets')
    .update({ name, columns, rows, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tables')
  revalidatePath(`/tables/${id}`)
}

export async function deleteSpreadsheet(id: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('spreadsheets').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tables')
  redirect('/tables')
}

export async function moveTableToFolder(tableId: string, folderId: string | null) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db()
    .from('spreadsheets')
    .update({ folder_id: folderId })
    .eq('id', tableId)
  if (error) throw new Error(error.message)
  revalidatePath('/tables')
}

// ─── Lists (Kanban columns) ───────────────────────────────────────────────────

export async function getLists(): Promise<List[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('lists')
      .select('*')
      .order('position', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function createList(title: string): Promise<List | null> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data: existing } = await db().from('lists').select('position').order('position', { ascending: false }).limit(1)
  const position = (existing?.[0]?.position ?? -1) + 1
  const { data, error } = await db()
    .from('lists')
    .insert({ title, position })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  return data
}

export async function renameList(id: string, title: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('lists').update({ title }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
}

export async function deleteList(id: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('lists').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
}

export async function reorderCards(
  updates: { id: string; list_id: string; position: number }[]
) {
  if (!isConfigured()) return
  await Promise.all(
    updates.map(({ id, list_id, position }) =>
      db().from('tasks').update({ list_id, position }).eq('id', id)
    )
  )
  revalidatePath('/tasks')
  revalidatePath('/')
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('tasks')
      .select('*')
      .order('position', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function createTask(
  title: string,
  priority: Task['priority'] = 'none',
  due_date?: string | null,
  list_id?: string | null,
  position?: number
): Promise<Task | null> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('tasks')
    .insert({
      title,
      priority,
      due_date: due_date ?? null,
      list_id: list_id ?? null,
      position: position ?? 0,
      description: '',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
  return data
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, 'title' | 'done' | 'priority' | 'due_date' | 'description' | 'list_id' | 'position'>>
) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('tasks').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function deleteTask(id: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
}

// ─── Scratch Pad ──────────────────────────────────────────────────────────────

export async function getScratchPad(): Promise<string> {
  if (!isConfigured()) return ''
  try {
    const { data } = await db().from('scratch_pad').select('content').eq('id', 1).single()
    return data?.content ?? ''
  } catch {
    return ''
  }
}

export async function saveScratchPad(content: string) {
  if (!isConfigured()) return
  await db()
    .from('scratch_pad')
    .upsert({ id: 1, content, updated_at: new Date().toISOString() })
}

// ─── Search ───────────────────────────────────────────────────────────────────

export type SearchResult = {
  id: string
  title: string
  snippet: string
  type: 'page' | 'table'
  updated_at: string
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  if (!isConfigured() || !query.trim()) return []
  const q = query.trim()
  const pattern = `%${q}%`
  try {
    const [pagesRes, tablesRes] = await Promise.all([
      db()
        .from('pages')
        .select('id, title, content, updated_at')
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .limit(15),
      db()
        .from('spreadsheets')
        .select('id, name, updated_at')
        .ilike('name', pattern)
        .limit(10),
    ])
    const pages: SearchResult[] = (pagesRes.data ?? []).map((p) => {
      const idx = p.content?.toLowerCase().indexOf(q.toLowerCase()) ?? -1
      const snippet = idx >= 0
        ? '…' + p.content.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' ') + '…'
        : p.content?.slice(0, 100) ?? ''
      return { id: p.id, title: p.title || 'Untitled', snippet, type: 'page', updated_at: p.updated_at }
    })
    const tables: SearchResult[] = (tablesRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.name || 'Untitled Table',
      snippet: '',
      type: 'table',
      updated_at: t.updated_at,
    }))
    return [...pages, ...tables].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  } catch {
    return []
  }
}

// ─── Calendars ────────────────────────────────────────────────────────────────

export async function getCalendars(): Promise<Calendar[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('calendars')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function getCalendarsByFolder(folderId: string | null): Promise<Calendar[]> {
  if (!isConfigured()) return []
  try {
    if (folderId) {
      const { data, error } = await db()
        .from('calendars')
        .select('*')
        .eq('folder_id', folderId)
        .order('updated_at', { ascending: false })
      if (error) return []
      return data ?? []
    } else {
      const { data, error } = await db()
        .from('calendars')
        .select('*')
        .is('folder_id', null)
        .order('updated_at', { ascending: false })
      if (error) {
        const { data: all } = await db().from('calendars').select('*').order('updated_at', { ascending: false })
        return all ?? []
      }
      return data ?? []
    }
  } catch {
    return []
  }
}

export async function getCalendar(id: string): Promise<Calendar | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db().from('calendars').select('*').eq('id', id).single()
    if (error) throw error
    return data
  } catch {
    return null
  }
}

export async function createCalendar(
  name: string,
  goal: string,
  color: string,
  emoji: string,
  folderId?: string | null
): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('calendars')
    .insert({ name, goal, color, emoji, description: '', folder_id: folderId ?? null })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/calendars')
  return data.id
}

export async function saveCalendar(
  id: string,
  name: string,
  goal: string,
  color: string,
  emoji: string,
  description: string
) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db()
    .from('calendars')
    .update({ name, goal, color, emoji, description, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/calendars')
  revalidatePath(`/calendars/${id}`)
}

export async function deleteCalendar(id: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('calendars').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/calendars')
  redirect('/calendars')
}

export async function moveCalendarToFolder(calendarId: string, folderId: string | null) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db()
    .from('calendars')
    .update({ folder_id: folderId })
    .eq('id', calendarId)
  if (error) throw new Error(error.message)
  revalidatePath('/calendars')
}

// ─── Calendar Entries ─────────────────────────────────────────────────────────

export async function getCalendarEntries(calendarId: string): Promise<CalendarEntry[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('calendar_entries')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('date', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function upsertCalendarEntry(
  calendarId: string,
  date: string,
  status: 'green' | 'yellow' | 'red' | '',
  note: string
): Promise<CalendarEntry | null> {
  if (!isConfigured()) throw new Error('Supabase is not configured')

  // Try with status column (post-migration schema)
  const { data, error } = await db()
    .from('calendar_entries')
    .upsert(
      { calendar_id: calendarId, date, status, completed: status === 'green', note },
      { onConflict: 'calendar_id,date' }
    )
    .select()
    .single()

  if (!error) {
    revalidatePath(`/calendars/${calendarId}`)
    return data
  }

  // Fallback: status column not yet added — save without it
  const { data: data2, error: error2 } = await db()
    .from('calendar_entries')
    .upsert(
      { calendar_id: calendarId, date, completed: status === 'green', note },
      { onConflict: 'calendar_id,date' }
    )
    .select()
    .single()
  if (error2) throw new Error(error2.message)
  revalidatePath(`/calendars/${calendarId}`)
  return data2 ? { ...data2, status } : null
}

export async function getEntriesForCalendars(
  calendarIds: string[]
): Promise<Record<string, CalendarEntry[]>> {
  if (!isConfigured() || calendarIds.length === 0) return {}
  try {
    const { data, error } = await db()
      .from('calendar_entries')
      .select('*')
      .in('calendar_id', calendarIds)
    if (error) return {}
    const result: Record<string, CalendarEntry[]> = {}
    for (const id of calendarIds) result[id] = []
    for (const entry of (data ?? [])) {
      result[entry.calendar_id]?.push(entry)
    }
    return result
  } catch {
    return {}
  }
}

// ─── Whiteboards ──────────────────────────────────────────────────────────────

import type { Whiteboard } from './supabase'

export async function getWhiteboards(): Promise<Whiteboard[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('whiteboards')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false })
    if (error) return []
    return (data ?? []) as Whiteboard[]
  } catch { return [] }
}

export async function getWhiteboard(id: string): Promise<Whiteboard | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db()
      .from('whiteboards')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data as Whiteboard
  } catch { return null }
}

export async function createWhiteboard(): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const { data, error } = await db()
    .from('whiteboards')
    .insert({ name: 'Untitled Whiteboard', data: null })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/whiteboards')
  return data.id
}

export async function renameWhiteboard(id: string, name: string): Promise<void> {
  if (!isConfigured()) return
  await db().from('whiteboards').update({ name, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/whiteboards')
}

export async function saveWhiteboardData(id: string, data: object): Promise<void> {
  if (!isConfigured()) return
  await db().from('whiteboards').update({ data, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteWhiteboard(id: string): Promise<void> {
  if (!isConfigured()) return
  await db().from('whiteboards').delete().eq('id', id)
  revalidatePath('/whiteboards')
  redirect('/whiteboards')
}
