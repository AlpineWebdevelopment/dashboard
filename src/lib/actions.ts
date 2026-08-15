'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { BackgroundSettings, Calendar, CalendarEntry, Folder, List, MrrClient, OngoingActivity, Page, Person, Project, Prompt, Spreadsheet, SheetColumn, SheetRow, Task, Thought } from './supabase'
import { DEFAULT_BACKGROUND } from './supabase'

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
  updates: { id: string; list_id: string; position: number; done?: boolean }[]
) {
  if (!isConfigured()) return
  await Promise.all(
    updates.map(({ id, list_id, position, done }) =>
      db()
        .from('tasks')
        .update({ list_id, position, ...(done === undefined ? {} : { done }) })
        .eq('id', id)
    )
  )
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function reorderLists(updates: { id: string; position: number }[]) {
  if (!isConfigured()) return
  await Promise.all(updates.map(({ id, position }) => db().from('lists').update({ position }).eq('id', id)))
  revalidatePath('/tasks')
}

// ─── Projects (task grouping) ─────────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('projects')
      .select('*')
      .order('position', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function createProject(name: string, color = ''): Promise<Project | null> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data: existing } = await db()
    .from('projects')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
  const position = (existing?.[0]?.position ?? -1) + 1
  const { data, error } = await db()
    .from('projects')
    .insert({ name, position, color })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  return data
}

export async function renameProject(id: string, name: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('projects').update({ name }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
}

export async function setProjectColor(id: string, color: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('projects').update({ color }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
}

// Tasks survive their project — the project_id FK is `on delete set null`.
export async function deleteProject(id: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('projects').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
}

export async function setTaskProject(taskId: string, projectId: string | null) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('tasks').update({ project_id: projectId }).eq('id', taskId)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
}

// ─── People (task assignees) ──────────────────────────────────────────────────

export async function getPeople(): Promise<Person[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('people')
      .select('*')
      .order('position', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function createPerson(name: string): Promise<Person | null> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data: existing } = await db()
    .from('people')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
  const position = (existing?.[0]?.position ?? -1) + 1
  const { data, error } = await db()
    .from('people')
    .insert({ name, position })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  return data
}

export async function setPersonColor(id: string, color: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('people').update({ color }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
}

// Tasks survive their assignee — the assignee_id FK is `on delete set null`.
export async function deletePerson(id: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('people').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
}

export async function setTaskAssignee(taskId: string, personId: string | null) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('tasks').update({ assignee_id: personId }).eq('id', taskId)
  if (error) throw new Error(error.message)
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
  position?: number,
  project_id?: string | null,
  assignee_id?: string | null
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
      // omitted when unset so inserts still work before the projects/people migrations run
      ...(project_id ? { project_id } : {}),
      ...(assignee_id ? { assignee_id } : {}),
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
  updates: Partial<Pick<Task, 'title' | 'done' | 'priority' | 'due_date' | 'description' | 'list_id' | 'position' | 'project_id' | 'assignee_id' | 'color'>>
) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('tasks').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
}

// Card colour lives on the task itself, so a colour picked on one device shows up
// on every other one. Throws if supabase-task-color.sql hasn't been run — callers
// treat that as "no column yet" and keep the choice in the browser instead.
export async function setTaskColors(ids: string[], color: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  if (ids.length === 0) return
  const { error } = await db().from('tasks').update({ color }).in('id', ids)
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

// ─── Bulk task edits ──────────────────────────────────────────────────────────

export async function updateTasks(
  ids: string[],
  updates: Partial<Pick<Task, 'title' | 'done' | 'priority' | 'due_date' | 'description' | 'list_id' | 'position' | 'project_id' | 'assignee_id' | 'color'>>
) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  if (ids.length === 0) return
  const { error } = await db().from('tasks').update(updates).in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function deleteTasks(ids: string[]) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  if (ids.length === 0) return
  const { error } = await db().from('tasks').delete().in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
}

// ─── Ongoing (what people are working on right now) ───────────────────────────

export type OngoingActivityInput = {
  /** Set to track a board task, null for a free-standing activity. */
  task_id: string | null
  person_id: string | null
  title: string
  state: string
  progress: number
}

function clampProgress(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

export async function getOngoingActivities(): Promise<OngoingActivity[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('ongoing_activities')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as OngoingActivity[]
  } catch {
    return []
  }
}

export async function createOngoingActivity(input: OngoingActivityInput): Promise<OngoingActivity> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data: last } = await db()
    .from('ongoing_activities')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
  const position = (last?.[0]?.position ?? -1) + 1
  const { data, error } = await db()
    .from('ongoing_activities')
    .insert({ ...input, progress: clampProgress(input.progress), position })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/ongoing')
  return data as OngoingActivity
}

export async function updateOngoingActivity(
  id: string,
  updates: Partial<OngoingActivityInput>
): Promise<OngoingActivity> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('ongoing_activities')
    .update({
      ...updates,
      ...(updates.progress === undefined ? {} : { progress: clampProgress(updates.progress) }),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/ongoing')
  return data as OngoingActivity
}

// Hitting 100% leaves the card in place — only this takes it off the board.
export async function setOngoingArchived(id: string, archived: boolean): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db()
    .from('ongoing_activities')
    .update({ archived, archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/ongoing')
}

export async function deleteOngoingActivity(id: string): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('ongoing_activities').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/ongoing')
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

// ─── Background ───────────────────────────────────────────────────────────────
//
// Parked. The background is a per-browser cookie now (see lib/prefs) because
// `app_settings` holds a single row for everyone, and without accounts that
// means one shared wallpaper. Kept — not deleted — as the starting point for
// the per-user table once accounts land.

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

export async function getBackgroundSettings(): Promise<BackgroundSettings> {
  if (!isConfigured()) return DEFAULT_BACKGROUND
  try {
    const { data, error } = await db()
      .from('app_settings')
      .select('background_url, background_dim, background_blur')
      .eq('id', 1)
      .single()
    // Table missing (migration not run yet) or empty — fall back to no background
    if (error || !data) return DEFAULT_BACKGROUND
    return {
      url: data.background_url || null,
      dim: clamp(data.background_dim, 0, 1, DEFAULT_BACKGROUND.dim),
      blur: clamp(data.background_blur, 0, 40, DEFAULT_BACKGROUND.blur),
    }
  } catch {
    return DEFAULT_BACKGROUND
  }
}

export async function saveBackgroundSettings(settings: BackgroundSettings): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('app_settings').upsert({
    id: 1,
    background_url: settings.url || null,
    background_dim: clamp(settings.dim, 0, 1, DEFAULT_BACKGROUND.dim),
    background_blur: clamp(settings.blur, 0, 40, DEFAULT_BACKGROUND.blur),
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  // The background lives in the root layout, so every route below it is stale
  revalidatePath('/', 'layout')
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

// ─── Duplicate actions ────────────────────────────────────────────────────────

export async function duplicatePage(id: string): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const { data: page } = await db().from('pages').select('*').eq('id', id).single()
  if (!page) throw new Error('Not found')
  const { data, error } = await db()
    .from('pages')
    .insert({ title: `Copy of ${page.title || 'Untitled'}`, content: page.content, folder_id: page.folder_id })
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/pages')
  return data.id
}

export async function duplicateSpreadsheet(id: string): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const { data: sheet } = await db().from('spreadsheets').select('*').eq('id', id).single()
  if (!sheet) throw new Error('Not found')
  const { data, error } = await db()
    .from('spreadsheets')
    .insert({ name: `Copy of ${sheet.name || 'Untitled Table'}`, columns: sheet.columns, rows: sheet.rows, folder_id: sheet.folder_id })
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/tables')
  return data.id
}

export async function duplicateCalendar(id: string): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const { data: cal } = await db().from('calendars').select('*').eq('id', id).single()
  if (!cal) throw new Error('Not found')
  const { data, error } = await db()
    .from('calendars')
    .insert({ name: `Copy of ${cal.name}`, goal: cal.goal, color: cal.color, emoji: cal.emoji, description: cal.description, folder_id: cal.folder_id })
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/calendars')
  return data.id
}

export async function duplicateWhiteboard(id: string): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const { data: board } = await db().from('whiteboards').select('*').eq('id', id).single()
  if (!board) throw new Error('Not found')
  const { data, error } = await db()
    .from('whiteboards')
    .insert({ name: `Copy of ${board.name}`, data: board.data })
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/whiteboards')
  return data.id
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

export async function getPrompts(): Promise<Prompt[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('prompts')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) return []
    return (data ?? []) as Prompt[]
  } catch { return [] }
}

export async function getPrompt(id: string): Promise<Prompt | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db().from('prompts').select('*').eq('id', id).single()
    if (error) return null
    return data as Prompt
  } catch { return null }
}

export async function createPrompt(): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const { data, error } = await db()
    .from('prompts')
    .insert({ title: 'Untitled Prompt', content: '' })
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/prompts')
  redirect(`/prompts/${data.id}`)
}

export async function savePrompt(id: string, title: string, content: string): Promise<void> {
  if (!isConfigured()) return
  await db()
    .from('prompts')
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/prompts')
  revalidatePath(`/prompts/${id}`)
}

export async function deletePrompt(id: string): Promise<void> {
  if (!isConfigured()) return
  await db().from('prompts').delete().eq('id', id)
  revalidatePath('/prompts')
  redirect('/prompts')
}

export async function duplicatePrompt(id: string): Promise<string> {
  if (!isConfigured()) throw new Error('Supabase not configured')
  const { data: prompt } = await db().from('prompts').select('*').eq('id', id).single()
  if (!prompt) throw new Error('Not found')
  const { data, error } = await db()
    .from('prompts')
    .insert({ title: `Copy of ${prompt.title}`, content: prompt.content })
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/prompts')
  return data.id
}

// ─── Thoughts (Stream) ────────────────────────────────────────────────────────

export async function getThoughts(): Promise<Thought[]> {
  if (!isConfigured()) return []
  const { data } = await db()
    .from('stream_items')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return (data as Thought[]) ?? []
}

export async function createThought(content: string): Promise<{ error?: string }> {
  if (!isConfigured()) return { error: 'Supabase not configured' }
  const { error } = await db().from('stream_items').insert({ content })
  if (error) return { error: error.message }
  return {}
}

export async function updateThought(id: string, content: string): Promise<void> {
  if (!isConfigured()) return
  await db().from('stream_items').update({ content }).eq('id', id)
}

export async function deleteThought(id: string): Promise<void> {
  if (!isConfigured()) return
  await db().from('stream_items').delete().eq('id', id)
  revalidatePath('/stream')
}

export async function togglePinThought(id: string, pinned: boolean): Promise<void> {
  if (!isConfigured()) return
  await db().from('stream_items').update({ pinned }).eq('id', id)
  revalidatePath('/stream')
}

// ─── MRR ──────────────────────────────────────────────────────────────────────

export type MrrClientInput = {
  name: string
  description: string
  kind: 'recurring' | 'oneoff'
  setup_fee: number
  monthly_fee: number
  monthly_description: string
  start_date: string // YYYY-MM-DD (contract date)
  golive_date: string | null
  first_billing_date: string | null
  end_date: string | null
}

export async function getMrrClients(): Promise<MrrClient[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('mrr_clients')
      .select('*')
      .order('start_date', { ascending: true })
    if (error) throw error
    return (data ?? []) as MrrClient[]
  } catch {
    return []
  }
}

export async function createMrrClient(input: MrrClientInput): Promise<MrrClient> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('mrr_clients')
    .insert(input)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/mrr')
  return data as MrrClient
}

export async function updateMrrClient(id: string, input: MrrClientInput): Promise<MrrClient> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('mrr_clients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/mrr')
  return data as MrrClient
}

export async function deleteMrrClient(id: string): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('mrr_clients').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/mrr')
}
