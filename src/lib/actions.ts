'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Folder, Page, Spreadsheet, SheetColumn, SheetRow, Task } from './supabase'

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

export async function getFolders(type: 'pages' | 'tables'): Promise<Folder[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('folders')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: true })
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

export async function createFolder(type: 'pages' | 'tables'): Promise<string> {
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

export async function renameFolder(id: string, name: string, type: 'pages' | 'tables') {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('folders').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/${type}`)
}

export async function deleteFolder(id: string, type: 'pages' | 'tables') {
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

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function createTask(
  title: string,
  priority: Task['priority'] = 'none',
  due_date?: string | null
): Promise<Task | null> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('tasks')
    .insert({ title, priority, due_date: due_date ?? null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
  return data
}

export async function updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'done' | 'priority' | 'due_date'>>) {
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
