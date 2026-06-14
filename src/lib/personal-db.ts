import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export function checkAuth(req: Request): boolean {
  const secret = process.env.PERSONAL_API_SECRET || '8R1gEq6T5iIdAHMwPXQjZOphomfCGveB'
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ── Events ────────────────────────────────────────────────────────────────────
export type Event = {
  id: number
  title: string
  date: string
  time: string | null
  description: string | null
  color: string
  created_at: string
}

export async function getEventsRange(from: string, to: string): Promise<Event[]> {
  const { data } = await getSupabase()
    .from('events')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date').order('time')
  return (data ?? []) as Event[]
}

export async function createEvent(data: Omit<Event, 'id' | 'created_at'>): Promise<Event> {
  const { data: row } = await getSupabase().from('events').insert(data).select().single()
  return row as Event
}

export async function updateEvent(id: number, data: Partial<Omit<Event, 'id' | 'created_at'>>): Promise<Event | null> {
  const { data: row } = await getSupabase().from('events').update(data).eq('id', id).select().single()
  return row as Event | null
}

export async function deleteEvent(id: number): Promise<void> {
  await getSupabase().from('events').delete().eq('id', id)
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export type AssistantTask = {
  id: number
  title: string
  done: boolean
  priority: string
  due_date: string | null
  created_at: string
}

export async function getTasks(status: 'pending' | 'done' | 'all' = 'pending'): Promise<AssistantTask[]> {
  let q = getSupabase().from('assistant_tasks').select('*').order('created_at', { ascending: false })
  if (status === 'pending') q = q.eq('done', false)
  if (status === 'done') q = q.eq('done', true)
  const { data } = await q
  return (data ?? []) as AssistantTask[]
}

export async function createTask(data: { title: string; due_date?: string; priority?: string }): Promise<AssistantTask> {
  const { data: row } = await getSupabase()
    .from('assistant_tasks')
    .insert({ title: data.title, due_date: data.due_date ?? null, priority: data.priority ?? 'none' })
    .select().single()
  return row as AssistantTask
}

export async function updateTask(id: number, data: Partial<{ done: boolean; title: string; due_date: string; priority: string }>): Promise<AssistantTask | null> {
  const { data: row } = await getSupabase().from('assistant_tasks').update(data).eq('id', id).select().single()
  return row as AssistantTask | null
}

export async function deleteTask(id: number): Promise<void> {
  await getSupabase().from('assistant_tasks').delete().eq('id', id)
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export type Note = {
  id: number
  content: string
  tags: string | null
  created_at: string
}

export async function getNotes(query?: string): Promise<Note[]> {
  let q = getSupabase().from('notes').select('*').order('created_at', { ascending: false }).limit(50)
  if (query) q = q.or(`content.ilike.%${query}%,tags.ilike.%${query}%`)
  const { data } = await q
  return (data ?? []) as Note[]
}

export async function createNote(data: { content: string; tags?: string }): Promise<Note> {
  const { data: row } = await getSupabase()
    .from('notes').insert({ content: data.content, tags: data.tags ?? null }).select().single()
  return row as Note
}

export async function deleteNote(id: number): Promise<void> {
  await getSupabase().from('notes').delete().eq('id', id)
}

// ── Reminders ─────────────────────────────────────────────────────────────────
export type Reminder = {
  id: number
  message: string
  remind_at: string
  fired: boolean
  created_at: string
}

export async function getDueReminders(): Promise<Reminder[]> {
  const { data } = await getSupabase()
    .from('reminders')
    .select('*')
    .eq('fired', false)
    .lte('remind_at', new Date().toISOString())
  return (data ?? []) as Reminder[]
}

export async function createReminder(data: { message: string; remind_at: string }): Promise<Reminder> {
  const { data: row } = await getSupabase().from('reminders').insert(data).select().single()
  return row as Reminder
}

export async function markReminderFired(id: number): Promise<void> {
  await getSupabase().from('reminders').update({ fired: true }).eq('id', id)
}

// ── Memory key-value ──────────────────────────────────────────────────────────
export type MemoryEntry = { key: string; value: string; updated_at: string }

export async function getAllMemory(): Promise<MemoryEntry[]> {
  const { data } = await getSupabase().from('memory_kv').select('*').order('key')
  return (data ?? []) as MemoryEntry[]
}

export async function getMemory(key: string): Promise<string | null> {
  const { data } = await getSupabase().from('memory_kv').select('value').eq('key', key).single()
  return (data as any)?.value ?? null
}

export async function setMemory(key: string, value: string): Promise<void> {
  await getSupabase()
    .from('memory_kv')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}
