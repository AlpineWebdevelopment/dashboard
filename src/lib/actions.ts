'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentAccount } from './auth-server'
import type { LoginLink } from './login-hub'
import type { BackgroundSettings, ClientProject, ClientProjectStatus, ClientProjectTask, ClientTaskPhase, Folder, List, MrrClient, OngoingActivity, Page, Person, Project, Prompt, Spreadsheet, SheetColumn, SheetRow, Task, Thought } from './supabase'
import { DEFAULT_BACKGROUND, decodeClientProjectStatus, decodeClientTaskPhase } from './supabase'

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

// â”€â”€â”€ Folders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Share tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Spreadsheets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Lists (Kanban columns) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

/**
 * A system list's kind, or null when there is no such row — and also null when
 * the `kind` column does not exist yet, since the select simply errors. That is
 * the right answer for a board with no `kind` column: there is nothing
 * to protect yet, so nothing is refused.
 *
 * The database refuses these anyway (see the lists_guard_system trigger). This
 * is the courtesy that turns a raw Postgres exception into a sentence.
 */
async function systemKind(id: string): Promise<string | null> {
  const { data } = await db().from('lists').select('kind').eq('id', id).single()
  return data?.kind || null
}

export async function renameList(id: string, title: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  if (await systemKind(id)) {
    throw new Error('The Done list is part of the board and cannot be renamed.')
  }
  const { error } = await db().from('lists').update({ title }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
}

export async function deleteList(id: string) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  if (await systemKind(id)) {
    throw new Error('The Done list is part of the board and cannot be deleted. Empty it instead.')
  }
  const { error } = await db().from('lists').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  // Its cards become listless, which changes the home page's open-task count.
  revalidatePath('/')
}

export async function reorderCards(
  updates: { id: string; list_id: string; position: number; done?: boolean }[]
) {
  if (!isConfigured()) return
  await Promise.all(
    updates.map(({ id, list_id, position, done }) =>
      db()
        .from('tasks')
        // Finishing something ends it being in flight. Enforced here rather
        // than at each call site so every path into the Done list clears it —
        // the button, a drag, and whatever comes next.
        .update({ list_id, position, ...(done === undefined ? {} : { done, ...(done ? { ongoing: false } : {}) }) })
        .eq('id', id)
    )
  )
  // …and takes its card off the Ongoing board with it, so finishing a task in
  // one drag does not leave it listed as work in flight on the other page.
  const finished = updates.filter((u) => u.done).map((u) => u.id)
  if (finished.length > 0) {
    await syncOngoingCards(finished, false)
    revalidatePath('/ongoing')
  }
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function reorderLists(updates: { id: string; position: number }[]) {
  if (!isConfigured()) return
  await Promise.all(updates.map(({ id, position }) => db().from('lists').update({ position }).eq('id', id)))
  revalidatePath('/tasks')
}

// â”€â”€â”€ Projects (task grouping) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// Tasks survive their project â€” the project_id FK is `on delete set null`.
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

// â”€â”€â”€ People (task assignees) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  assignee_id?: string | null,
  /**
   * The matrix axes, when the card is being created straight into a quadrant.
   * A trailing options object rather than an eighth positional argument — seven
   * is already more than anyone can read at a call site.
   *
   * Left out of the insert entirely when undefined, so a board without the
   * urgent/important columns can still add cards. Pass them and the insert needs the
   * columns: creating a card *in a quadrant* has to record the quadrant, or the
   * card silently lands somewhere else.
   */
  flags?: { urgent: boolean | null; important: boolean | null }
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
      // omitted when unset so inserts still work before the projects/people tables exist
      ...(project_id ? { project_id } : {}),
      ...(assignee_id ? { assignee_id } : {}),
      ...(flags ?? {}),
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
  return data
}

/**
 * The columns a task edit is allowed to touch. updateTask and updateTasks took
 * the same list spelled out twice, and every new column had to be added to both.
 *
 * A `type` and not an exported const: this module is 'use server', where every
 * *runtime* export must be an async function. Types are erased before that rule
 * applies, but keeping it module-local removes the question entirely.
 */
type TaskUpdate = Partial<
  Pick<
    Task,
    | 'title'
    | 'done'
    | 'priority'
    | 'due_date'
    | 'description'
    | 'list_id'
    | 'position'
    | 'project_id'
    | 'assignee_id'
    | 'color'
    | 'ongoing'
    | 'urgent'
    | 'important'
  >
>

/**
 * Finished work is not work in flight, so `done: true` always clears `ongoing`.
 *
 * Applied in the actions rather than at each call site: done is set from the
 * Done button, from a drag into the archive, and from a card created straight
 * into it, and a rule enforced in one place cannot be forgotten by the next
 * path added.
 */
function withDoneClearsOngoing(updates: TaskUpdate): TaskUpdate {
  return updates.done ? { ...updates, ongoing: false } : updates
}

/**
 * One card, one edit. Spelled as the bulk call so the ongoing rules below run
 * on every path — a second single-row copy of them is exactly what drifted.
 */
export async function updateTask(
  id: string,
  updates: TaskUpdate
) {
  return updateTasks([id], updates)
}

// Card colour lives on the task itself, so a colour picked on one device shows up
// on every other one. Throws if `tasks.color` does not exist — callers
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
  // Before the delete, while the card can still be found by task id. A card for
  // a task that no longer exists is not work in flight, whatever the row says.
  await syncOngoingCards([id], false)
  const { error } = await db().from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
  revalidatePath('/ongoing')
}

// â”€â”€â”€ Bulk task edits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateTasks(
  ids: string[],
  updates: TaskUpdate
) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  if (ids.length === 0) return
  const patch = withDoneClearsOngoing(updates)
  const { error } = await db().from('tasks').update(patch).in('id', ids)
  if (error) throw new Error(error.message)
  // The flag moved, so the cards have to follow it. After the write, so a
  // rejected update never leaves a card behind for a task that is not flagged.
  if (patch.ongoing !== undefined) {
    await syncOngoingCards(ids, patch.ongoing)
    revalidatePath('/ongoing')
  }
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function deleteTasks(ids: string[]) {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  if (ids.length === 0) return
  // See deleteTask: archive first, while the cards still resolve.
  await syncOngoingCards(ids, false)
  const { error } = await db().from('tasks').delete().in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/tasks')
  revalidatePath('/')
  revalidatePath('/ongoing')
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

// ─── Ongoing: the flag and the card are the same thing ────────────────────────
//
// Marking a task ongoing on the board and adding a card here used to be two
// unrelated acts with two separate displays. They are one act now: a task is
// flagged exactly while a live card tracks it, and the card is where its
// person, state and percentage live. `tasks.ongoing` stays the column the board
// draws its dotted edge from — it is a mirror of the card, never a second
// answer to the same question.
//
// Both directions are enforced here rather than at the call sites, for the
// reason withDoneClearsOngoing is: the flag is set from the card toggle, the
// detail panel, a bulk edit and a drag into Done, and a rule kept in one place
// cannot be forgotten by the next path added.

/** The `ongoing_activities` columns the sync needs, without the rest of a row. */
type CardStub = { id: string; task_id: string | null; archived: boolean; created_at: string }

/**
 * Board → card. Bring each task's card in line with the flag it was just given.
 *
 * Unflagging archives rather than deletes, and flagging brings back the newest
 * archived card for that task rather than adding a second one, so a mis-click
 * and its correction leave the state and percentage where they were.
 *
 * Silent on failure: without the `ongoing_activities` table there is no card to
 * keep in step, and the flag the caller asked for has already saved.
 */
async function syncOngoingCards(ids: string[], ongoing: boolean) {
  if (ids.length === 0) return
  try {
    const { data, error } = await db()
      .from('ongoing_activities')
      .select('id, task_id, archived, created_at')
      .in('task_id', ids)
    if (error) throw error
    const rows = (data ?? []) as CardStub[]

    if (!ongoing) {
      const live = rows.filter((r) => !r.archived).map((r) => r.id)
      if (live.length === 0) return
      const { error: archiveError } = await db()
        .from('ongoing_activities')
        .update({ archived: true, archived_at: new Date().toISOString() })
        .in('id', live)
      if (archiveError) throw archiveError
      return
    }

    // Finished work is not work in flight, so a card is never made or brought
    // back for a done task — the ongoing toggle is offered on archived cards
    // too, and this is the one place that can say no to it.
    const { data: open, error: openError } = await db()
      .from('tasks')
      .select('id, title, assignee_id')
      .in('id', ids)
      .eq('done', false)
    if (openError) throw openError
    const openTasks = (open ?? []) as { id: string; title: string | null; assignee_id: string | null }[]

    // Put the flag back where the card was refused, so the two never disagree.
    const refused = ids.filter((id) => !openTasks.some((t) => t.id === id))
    if (refused.length > 0) {
      await db().from('tasks').update({ ongoing: false }).in('id', refused)
    }
    if (openTasks.length === 0) return

    // Already on the board — a second card for the same task would split the
    // one piece of work in two, which is the thing this merge undoes.
    const covered = new Set(rows.filter((r) => !r.archived).map((r) => r.task_id))

    // Otherwise the newest archived card for the task, restored where it was,
    // so unflagging and flagging again does not cost the state and percentage.
    const revive = new Map<string, CardStub>()
    for (const row of rows) {
      if (!row.archived || !row.task_id || covered.has(row.task_id)) continue
      const best = revive.get(row.task_id)
      if (!best || row.created_at > best.created_at) revive.set(row.task_id, row)
    }
    for (const key of [...revive.keys()]) {
      if (!openTasks.some((t) => t.id === key)) revive.delete(key)
    }
    if (revive.size > 0) {
      const { error: restoreError } = await db()
        .from('ongoing_activities')
        .update({ archived: false, archived_at: null })
        .in('id', [...revive.values()].map((r) => r.id))
      if (restoreError) throw restoreError
    }

    const missing = openTasks.filter((t) => !covered.has(t.id) && !revive.has(t.id))
    if (missing.length === 0) return

    const { data: last } = await db()
      .from('ongoing_activities')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
    let position = (last?.[0]?.position ?? -1) + 1

    // Same shape a card added by hand gets: the task's assignee is who is doing
    // it, and the state and percentage start empty for whoever picks it up.
    const { error: insertError } = await db()
      .from('ongoing_activities')
      .insert(
        missing.map((t) => ({
          task_id: t.id,
          person_id: t.assignee_id ?? null,
          title: (t.title ?? '').trim(),
          state: '',
          progress: 0,
          position: position++,
        }))
      )
    if (insertError) throw insertError
  } catch {
    // See above — the flag saved, there is just no card table to mirror it into.
  }
}

/**
 * Card → board. Point `tasks.ongoing` at the truth: flagged exactly while a
 * live card tracks the task.
 *
 * Derived rather than toggled, so archiving one of two cards on the same task
 * cannot unflag work that is still on the board.
 */
async function refreshTaskOngoing(taskId: string | null | undefined) {
  if (!taskId) return
  const { data, error } = await db()
    .from('ongoing_activities')
    .select('id')
    .eq('task_id', taskId)
    .eq('archived', false)
    .limit(1)
  if (error) return
  // The result is ignored on purpose: a board without the `ongoing` column has
  // nothing to keep in step, and the card itself already saved.
  await db().from('tasks').update({ ongoing: (data?.length ?? 0) > 0 }).eq('id', taskId)
}

/**
 * Put a task in the Done list, the way the board's Done button does.
 *
 * Setting `done` on its own is not enough. The lists view places cards by
 * `list_id`, so a finished task left in its old column keeps reading as open
 * there — the drift isFinished() exists to paper over. Newest-first, to match
 * the order the archive column is kept in.
 */
async function finishTask(taskId: string) {
  const { data: lists } = await db().from('lists').select('id').eq('kind', 'done').limit(1)
  const doneListId = (lists?.[0] as { id: string } | undefined)?.id ?? null

  // A board with no Done list has nowhere to put it; the flag is all there is.
  if (!doneListId) {
    await db().from('tasks').update({ done: true, ongoing: false }).eq('id', taskId)
    return
  }

  const { data: top } = await db()
    .from('tasks')
    .select('position')
    .eq('list_id', doneListId)
    .neq('id', taskId)
    .order('position', { ascending: true })
    .limit(1)
  const position = top?.[0] ? ((top[0] as { position: number }).position ?? 1000) - 500 : 1000

  await db()
    .from('tasks')
    .update({ done: true, ongoing: false, list_id: doneListId, position })
    .eq('id', taskId)
}

/** The task a card tracks, before an edit changes or removes it. */
async function trackedTask(activityId: string): Promise<string | null> {
  const { data } = await db()
    .from('ongoing_activities')
    .select('task_id')
    .eq('id', activityId)
    .single()
  return (data as { task_id: string | null } | null)?.task_id ?? null
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
  // A card tracking a task *is* that task being ongoing, so the board says so.
  await refreshTaskOngoing(input.task_id)
  revalidatePath('/ongoing')
  revalidatePath('/tasks')
  revalidatePath('/')
  return data as OngoingActivity
}

export async function updateOngoingActivity(
  id: string,
  updates: Partial<OngoingActivityInput>
): Promise<OngoingActivity> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  // Read before writing: pointing a card at a different task has to unflag the
  // one it used to track, and afterwards there is no record of which that was.
  const previousTask = updates.task_id === undefined ? null : await trackedTask(id)
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
  const saved = data as OngoingActivity
  if (previousTask && previousTask !== saved.task_id) await refreshTaskOngoing(previousTask)
  await refreshTaskOngoing(saved.task_id)
  revalidatePath('/ongoing')
  revalidatePath('/tasks')
  revalidatePath('/')
  return saved
}

// Hitting 100% leaves the card in place — only this takes it off the board.
// Archiving a tracked card is also how a task stops being ongoing from this
// page: same act, same result as un-toggling the flag on the board.
export async function setOngoingArchived(id: string, archived: boolean): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const taskId = await trackedTask(id)
  const { error } = await db()
    .from('ongoing_activities')
    .update({ archived, archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await refreshTaskOngoing(taskId)
  revalidatePath('/ongoing')
  revalidatePath('/tasks')
  revalidatePath('/')
}

/**
 * Finish the work from this side: the card goes to 100% and into the archive,
 * and the task it tracks lands in Done.
 *
 * One action rather than three calls from the card, so the two can never end up
 * disagreeing halfway — and so closing something at 100% does not mean a second
 * pass over the board to mark the same piece of work done again.
 *
 * A free-standing card has no task to finish, so this is just an archive at
 * 100% for those; the page only offers it where there is a task.
 */
export async function completeOngoingActivity(id: string): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const taskId = await trackedTask(id)

  const { error } = await db()
    .from('ongoing_activities')
    .update({ progress: 100, archived: true, archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  // After the card, so `ongoing` is cleared against a board that already has no
  // live card for the task — the same order syncOngoingCards works in.
  if (taskId) await finishTask(taskId)

  revalidatePath('/ongoing')
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function deleteOngoingActivity(id: string): Promise<void> {
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const taskId = await trackedTask(id)
  const { error } = await db().from('ongoing_activities').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await refreshTaskOngoing(taskId)
  revalidatePath('/ongoing')
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
    // Table missing or empty — fall back to no background
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
        ? 'â€¦' + p.content.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' ') + 'â€¦'
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

// â”€â”€â”€ Prompts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Thoughts (Stream) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// ─── Login Hub ────────────────────────────────────────────────────────────────
//
// Links to accounts, added from the page because the URLs are personal. Links
// only — never a credential; the table is read with the anon key.

/**
 * Returns the links, or an error message when the table isn't there yet.
 *
 * The error is surfaced rather than swallowed into an empty list: a missing
 * table and an empty hub look identical otherwise, and that ambiguity has
 * already cost an afternoon on this project once.
 */
export async function getLoginLinks(): Promise<{ links: LoginLink[]; error?: string }> {
  if (!isConfigured()) return { links: [], error: 'Supabase env vars are not configured.' }
  try {
    const { data, error } = await db()
      .from('login_links')
      .select('*')
      .order('section')
      .order('service')
      .order('position')
      .order('created_at')
    if (error) return { links: [], error: error.message }
    return { links: (data ?? []) as LoginLink[] }
  } catch (e) {
    return { links: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export type LoginLinkInput = {
  section: string
  service: string
  brand: string
  label: string
  url: string
  hint: string | null
}

export async function createLoginLink(input: LoginLinkInput): Promise<{ link?: LoginLink; error?: string }> {
  if (!isConfigured()) return { error: 'Supabase is not configured' }
  const { data: last } = await db()
    .from('login_links')
    .select('position')
    .eq('section', input.section)
    .eq('service', input.service)
    .order('position', { ascending: false })
    .limit(1)
  const position = (last?.[0]?.position ?? -1) + 1
  const { data, error } = await db()
    .from('login_links')
    .insert({ ...input, position })
    .select('*')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/loginhub')
  return { link: data as LoginLink }
}

export async function updateLoginLink(
  id: string,
  updates: Partial<LoginLinkInput>
): Promise<{ error?: string }> {
  if (!isConfigured()) return { error: 'Supabase is not configured' }
  const { error } = await db().from('login_links').update(updates).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/loginhub')
  return {}
}

export async function deleteLoginLink(id: string): Promise<{ error?: string }> {
  if (!isConfigured()) return { error: 'Supabase is not configured' }
  const { error } = await db().from('login_links').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/loginhub')
  return {}
}

// ─── Client Projects ──────────────────────────────────────────────────────────
//
// The one board a co-worker account can open, so every write here is checked
// against the session rather than trusted. A server action is a POST endpoint
// with a generated name: the page hides the buttons for a client, but nothing
// stops that account from calling the action directly, and `canAccessPath`
// cannot tell an edit apart from a read — both arrive as a POST to
// /client-projects.

export type ClientProjectInput = {
  name: string
  client: string
  description: string
  status: ClientProjectStatus
  progress: number
  due_date: string | null
  url: string
  note: string
}

async function requireAdmin() {
  const account = await currentAccount()
  if (account?.role !== 'admin') throw new Error('Not allowed')
}

function clampPercent(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

export async function getClientProjects(): Promise<ClientProject[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('client_projects')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row: ClientProject) => ({
      ...row,
      status: decodeClientProjectStatus(row.status),
      progress: clampPercent(Number(row.progress)),
    }))
  } catch {
    return []
  }
}

export async function createClientProject(input: ClientProjectInput): Promise<ClientProject> {
  await requireAdmin()
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data: last } = await db()
    .from('client_projects')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
  const position = (last?.[0]?.position ?? -1) + 1
  const { data, error } = await db()
    .from('client_projects')
    .insert({ ...input, progress: clampPercent(input.progress), position })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/client-projects')
  return data as ClientProject
}

export async function updateClientProject(
  id: string,
  updates: Partial<ClientProjectInput>
): Promise<ClientProject> {
  await requireAdmin()
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('client_projects')
    .update({
      ...updates,
      ...(updates.progress === undefined ? {} : { progress: clampPercent(updates.progress) }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/client-projects')
  return data as ClientProject
}

export async function deleteClientProject(id: string): Promise<void> {
  await requireAdmin()
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('client_projects').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/client-projects')
}

// ─── Client project steps ─────────────────────────────────────────────────────
//
// Reads are open to both roles — the co-worker account's whole reason for
// existing is to see this board. Writes go through requireAdmin like the
// project rows themselves.

export type ClientProjectTaskInput = {
  title: string
  description: string
  phase: ClientTaskPhase
  priority: ClientProjectTask['priority']
  done: boolean
  owner: string
}

export async function getClientProject(id: string): Promise<ClientProject | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await db().from('client_projects').select('*').eq('id', id).single()
    if (error) throw error
    return {
      ...(data as ClientProject),
      status: decodeClientProjectStatus((data as ClientProject).status),
      progress: clampPercent(Number((data as ClientProject).progress)),
      roadmap: (data as ClientProject).roadmap ?? '',
    }
  } catch {
    return null
  }
}

export async function getClientProjectTasks(projectId: string): Promise<ClientProjectTask[]> {
  if (!isConfigured()) return []
  try {
    const { data, error } = await db()
      .from('client_project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row: ClientProjectTask) => ({
      ...row,
      phase: decodeClientTaskPhase(row.phase),
    }))
  } catch {
    return []
  }
}

/** Every project's step count in one round trip, for the list screen's chips. */
export async function getClientProjectTaskCounts(): Promise<Record<string, { open: number; total: number }>> {
  if (!isConfigured()) return {}
  try {
    const { data, error } = await db().from('client_project_tasks').select('project_id,done')
    if (error) throw error
    const counts: Record<string, { open: number; total: number }> = {}
    for (const row of (data ?? []) as { project_id: string; done: boolean }[]) {
      const c = (counts[row.project_id] ??= { open: 0, total: 0 })
      c.total += 1
      if (!row.done) c.open += 1
    }
    return counts
  } catch {
    return {}
  }
}

export async function createClientProjectTask(
  projectId: string,
  input: ClientProjectTaskInput
): Promise<ClientProjectTask> {
  await requireAdmin()
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data: last } = await db()
    .from('client_project_tasks')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1)
  const position = (last?.[0]?.position ?? -1) + 1
  const { data, error } = await db()
    .from('client_project_tasks')
    .insert({ ...input, project_id: projectId, position })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/client-projects')
  return data as ClientProjectTask
}

export async function updateClientProjectTask(
  id: string,
  updates: Partial<ClientProjectTaskInput>
): Promise<ClientProjectTask> {
  await requireAdmin()
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { data, error } = await db()
    .from('client_project_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/client-projects')
  return data as ClientProjectTask
}

export async function deleteClientProjectTask(id: string): Promise<void> {
  await requireAdmin()
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db().from('client_project_tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/client-projects')
}

export async function saveClientProjectRoadmap(id: string, roadmap: string): Promise<void> {
  await requireAdmin()
  if (!isConfigured()) throw new Error('Supabase is not configured')
  const { error } = await db()
    .from('client_projects')
    .update({ roadmap, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/client-projects')
}
