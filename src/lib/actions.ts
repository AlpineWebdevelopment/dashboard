'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Folder, Page, Spreadsheet, SheetColumn, SheetRow } from './supabase'

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

// Returns the new folder id so the client can navigate to it
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
  // ON DELETE SET NULL moves contained items back to root
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

// folderId = null → root (no folder), folderId = 'id' → inside that folder
export async function getPagesByFolder(folderId: string | null): Promise<Page[]> {
  if (!isConfigured()) return []
  try {
    const query = db().from('pages').select('*').order('updated_at', { ascending: false })
    const { data, error } = folderId
      ? await query.eq('folder_id', folderId)
      : await query.is('folder_id', null)
    if (error) throw error
    return data ?? []
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
    const query = db().from('spreadsheets').select('*').order('updated_at', { ascending: false })
    const { data, error } = folderId
      ? await query.eq('folder_id', folderId)
      : await query.is('folder_id', null)
    if (error) throw error
    return data ?? []
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
