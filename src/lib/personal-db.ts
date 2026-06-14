import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// Vercel's filesystem is read-only except /tmp
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

let _db: Database.Database | null = null

function getDb() {
  if (!_db) {
    _db = new Database(path.join(DATA_DIR, 'personal.db'))
    _db.pragma('journal_mode = WAL')
    migrate(_db)
  }
  return _db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      title     TEXT NOT NULL,
      date      TEXT NOT NULL,
      time      TEXT,
      description TEXT,
      color     TEXT DEFAULT 'indigo',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assistant_tasks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      done       INTEGER DEFAULT 0,
      priority   TEXT DEFAULT 'none',
      due_date   TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      content    TEXT NOT NULL,
      tags       TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      message    TEXT NOT NULL,
      remind_at  TEXT NOT NULL,
      fired      INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory_kv (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

// ── Auth helper ───────────────────────────────────────────────────────────────
export function checkAuth(req: Request): boolean {
  const secret = process.env.PERSONAL_API_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
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

export function getEvents(from: string, to?: string): Event[] {
  const db = getDb()
  if (to) {
    return db.prepare('SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, time').all(from, to) as Event[]
  }
  return db.prepare('SELECT * FROM events WHERE date = ? ORDER BY time').all(from) as Event[]
}

export function getEventsRange(from: string, to: string): Event[] {
  return getDb().prepare('SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, time').all(from, to) as Event[]
}

export function createEvent(data: Omit<Event, 'id' | 'created_at'>): Event {
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO events (title, date, time, description, color) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).get(data.title, data.date, data.time ?? null, data.description ?? null, data.color ?? 'indigo') as Event
  return result
}

export function updateEvent(id: number, data: Partial<Omit<Event, 'id' | 'created_at'>>): Event | null {
  const db = getDb()
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(data), id]
  db.prepare(`UPDATE events SET ${fields} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Event | null
}

export function deleteEvent(id: number) {
  getDb().prepare('DELETE FROM events WHERE id = ?').run(id)
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

export function getTasks(status: 'pending' | 'done' | 'all' = 'pending'): AssistantTask[] {
  const db = getDb()
  if (status === 'all') return db.prepare('SELECT * FROM assistant_tasks ORDER BY created_at DESC').all() as AssistantTask[]
  const done = status === 'done' ? 1 : 0
  return db.prepare('SELECT * FROM assistant_tasks WHERE done = ? ORDER BY created_at DESC').all(done) as AssistantTask[]
}

export function createTask(data: { title: string; due_date?: string; priority?: string }): AssistantTask {
  const db = getDb()
  return db.prepare(
    'INSERT INTO assistant_tasks (title, due_date, priority) VALUES (?, ?, ?) RETURNING *'
  ).get(data.title, data.due_date ?? null, data.priority ?? 'none') as AssistantTask
}

export function updateTask(id: number, data: Partial<{ done: boolean; title: string; due_date: string; priority: string }>): AssistantTask | null {
  const db = getDb()
  const fields = Object.entries(data).map(([k, v]) => `${k} = ?`).join(', ')
  const values = [...Object.values(data), id]
  db.prepare(`UPDATE assistant_tasks SET ${fields} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM assistant_tasks WHERE id = ?').get(id) as AssistantTask | null
}

export function deleteTask(id: number) {
  getDb().prepare('DELETE FROM assistant_tasks WHERE id = ?').run(id)
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export type Note = {
  id: number
  content: string
  tags: string | null
  created_at: string
}

export function getNotes(query?: string): Note[] {
  const db = getDb()
  if (query) {
    return db.prepare("SELECT * FROM notes WHERE content LIKE ? OR tags LIKE ? ORDER BY created_at DESC").all(`%${query}%`, `%${query}%`) as Note[]
  }
  return db.prepare('SELECT * FROM notes ORDER BY created_at DESC LIMIT 50').all() as Note[]
}

export function createNote(data: { content: string; tags?: string }): Note {
  const db = getDb()
  return db.prepare('INSERT INTO notes (content, tags) VALUES (?, ?) RETURNING *').get(data.content, data.tags ?? null) as Note
}

export function deleteNote(id: number) {
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id)
}

// ── Reminders ─────────────────────────────────────────────────────────────────
export type Reminder = {
  id: number
  message: string
  remind_at: string
  fired: boolean
  created_at: string
}

export function getDueReminders(): Reminder[] {
  return getDb().prepare(
    "SELECT * FROM reminders WHERE fired = 0 AND remind_at <= datetime('now')"
  ).all() as Reminder[]
}

export function createReminder(data: { message: string; remind_at: string }): Reminder {
  return getDb().prepare(
    'INSERT INTO reminders (message, remind_at) VALUES (?, ?) RETURNING *'
  ).get(data.message, data.remind_at) as Reminder
}

export function markReminderFired(id: number) {
  getDb().prepare('UPDATE reminders SET fired = 1 WHERE id = ?').run(id)
}

// ── Memory key-value ──────────────────────────────────────────────────────────
export type MemoryEntry = { key: string; value: string; updated_at: string }

export function getAllMemory(): MemoryEntry[] {
  return getDb().prepare('SELECT * FROM memory_kv ORDER BY key').all() as MemoryEntry[]
}

export function getMemory(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM memory_kv WHERE key = ?').get(key) as { value: string } | null
  return row?.value ?? null
}

export function setMemory(key: string, value: string) {
  getDb().prepare(
    "INSERT INTO memory_kv (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).run(key, value)
}
