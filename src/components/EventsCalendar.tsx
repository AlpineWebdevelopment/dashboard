'use client'

import { useState, useTransition, useMemo, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock, Trash2, MapPin, ExternalLink } from 'lucide-react'
import type { Event } from '@/lib/personal-db'
import type { Person, Project, Task } from '@/lib/supabase'
import TaskCardView, { toDateKey, useToday } from './TaskCardView'
import GoogleCalendarPanel, { type GoogleStatus } from './GoogleCalendarPanel'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** How often the calendar asks whether a Google sync has changed anything. */
const STATUS_POLL_MS = 10_000

/** Pixels per hour in the week view's time grid. */
const HOUR_HEIGHT = 48
const HOURS = Array.from({ length: 24 }, (_, i) => i)
/** Where the time grid scrolls to on open — early enough to catch a morning. */
const OPEN_AT_HOUR = 7

const COLOR_DOTS: Record<string, string> = {
  indigo: 'bg-indigo-400',
  rose: 'bg-rose-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  sky: 'bg-sky-400',
  violet: 'bg-violet-400',
  orange: 'bg-orange-400',
}

const COLOR_PILLS: Record<string, string> = {
  indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  sky: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
}

/** Timed blocks carry more weight than a pill, with the colour on the edge. */
const COLOR_BLOCKS: Record<string, string> = {
  indigo: 'bg-indigo-500/20 border-indigo-500 text-indigo-800 dark:text-indigo-100',
  rose: 'bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-100',
  emerald: 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-100',
  amber: 'bg-amber-500/20 border-amber-500 text-amber-900 dark:text-amber-100',
  sky: 'bg-sky-500/20 border-sky-500 text-sky-800 dark:text-sky-100',
  violet: 'bg-violet-500/20 border-violet-500 text-violet-800 dark:text-violet-100',
  orange: 'bg-orange-500/20 border-orange-500 text-orange-900 dark:text-orange-100',
}

const INPUT_CLS =
  'w-full panel bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-orange-500/50 transition-colors dark:[color-scheme:dark]'

const GRID_LINE = 'border-zinc-200 dark:border-white/[0.06]'

const CONNECT_ERRORS: Record<string, string> = {
  not_configured: 'Google Calendar is not configured on the server yet.',
  bad_state: 'That sign-in attempt expired. Try connecting again.',
  missing_code: 'Google did not return an authorisation code.',
  no_refresh_token: 'Google withheld a refresh token. Remove this app at myaccount.google.com/permissions, then reconnect.',
  sync_failed: 'Connected, but the first sync failed. Check the panel for details.',
  connect_failed: 'Could not connect to Google Calendar.',
  access_denied: 'Access was denied at the Google consent screen.',
}

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - x.getDay())
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

function isGoogle(event: Event): boolean {
  return event.source === 'google'
}

/** An event sits on the time grid only if it has a clock time of its own. */
function isTimed(event: Event): boolean {
  return !event.all_day && !!event.time
}

/** "09:00 – 10:30", "All day", or "" for a manual event with no time. */
function timeLabel(event: Event): string {
  if (event.all_day) return 'All day'
  if (!event.time) return ''
  if (event.end_time && event.end_date === event.date) return `${event.time} – ${event.end_time}`
  return event.time
}

/** "09:30" → 570. Anything unparseable sorts to midnight. */
function minutesOf(time: string | null | undefined): number {
  if (!time) return 0
  const [h, m] = time.split(':')
  const minutes = Number(h) * 60 + Number(m)
  return Number.isFinite(minutes) ? Math.min(Math.max(minutes, 0), 24 * 60) : 0
}

type Positioned = { event: Event; top: number; height: number; left: number; width: number }

/**
 * Places a day's timed events on the grid, side by side where they overlap.
 *
 * Events are swept in start order and gathered into clusters that share time.
 * Within a cluster each event takes the first column whose previous event has
 * already ended, so two overlapping meetings split the width, three split it
 * three ways, and an event that clears the cluster starts a fresh one at full
 * width — the same behaviour Google Calendar has.
 */
function layoutTimedDay(events: Event[], key: string): Positioned[] {
  const items = events
    .map((event) => {
      const start = minutesOf(event.time)
      let end: number
      if (event.end_time && (event.end_date ?? event.date) === key) end = minutesOf(event.end_time)
      else if (event.end_date && event.end_date > key) end = 24 * 60
      // Google always sends an end; a hand-made event may not, so assume an hour.
      else end = start + 60
      if (end <= start) end = start + 30
      return { event, start, end: Math.min(end, 24 * 60) }
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const out: Positioned[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  function flush() {
    if (!cluster.length) return
    const columnEnds: number[] = []
    const placed = cluster.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.start)
      if (column === -1) {
        columnEnds.push(item.end)
        column = columnEnds.length - 1
      } else {
        columnEnds[column] = item.end
      }
      return { item, column }
    })
    for (const { item, column } of placed) {
      out.push({
        event: item.event,
        top: (item.start / 60) * HOUR_HEIGHT,
        // Floor at something readable so a 15-minute event is still clickable.
        height: Math.max(((item.end - item.start) / 60) * HOUR_HEIGHT, 18),
        left: (column / columnEnds.length) * 100,
        width: 100 / columnEnds.length,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush()
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return out
}

// Minutes since local midnight, re-read once a minute for the "now" line.
// Same reasoning as useToday in TaskCardView: reading the clock during render
// is impure, and the server has no business guessing the browser's time.
function subscribeToMinute(onChange: () => void) {
  const id = setInterval(onChange, 60_000)
  return () => clearInterval(id)
}
const clientNowMinutes = () => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}
const serverNowMinutes = () => null

function useNowMinutes() {
  return useSyncExternalStore(subscribeToMinute, clientNowMinutes, serverNowMinutes)
}

export type ConnectNotice = { kind: 'ok' | 'error'; code: string } | null

function noticeText(notice: ConnectNotice): { kind: 'ok' | 'error'; text: string } | null {
  if (!notice) return null
  if (notice.kind === 'ok') return { kind: 'ok', text: 'Google Calendar connected — your events are syncing.' }
  return { kind: 'error', text: CONNECT_ERRORS[notice.code] ?? `Google connection failed (${notice.code}).` }
}

export default function EventsCalendar({
  initialEvents,
  initialYear,
  initialMonth,
  initialDay,
  tasks,
  projects,
  people,
  connectNotice = null,
}: {
  initialEvents: Event[]
  initialYear: number
  initialMonth: number
  initialDay: number
  tasks: Task[]
  projects: Project[]
  people: Person[]
  connectNotice?: ConnectNotice
}) {
  const [view, setView] = useState<'month' | 'week'>('week')
  // null means "wherever today is" — see effectiveCursor. It only holds a date
  // once you've actually navigated somewhere.
  const [cursor, setCursor] = useState<Date | null>(null)
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', time: '', description: '', color: 'indigo' })
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null)
  const [notice, setNotice] = useState(() => noticeText(connectNotice))
  const [, startTransition] = useTransition()

  const todayKey = useToday()
  const nowMinutes = useNowMinutes()
  // Nothing picked yet means "today" — resolved on the client, so the server
  // simply renders no selection rather than guessing the wrong day.
  const activeKey = selectedKey ?? todayKey

  // Until you navigate, the view follows today. The server has no idea what
  // timezone you're in, so it paints its own date and the client corrects to
  // yours on hydration — which matters here because the week view would
  // otherwise open on the week of the 1st rather than the week you're in.
  const effectiveCursor = useMemo(
    () =>
      cursor ??
      (todayKey ? new Date(`${todayKey}T00:00:00`) : new Date(initialYear, initialMonth, initialDay)),
    [cursor, todayKey, initialYear, initialMonth, initialDay]
  )

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  // Tasks are handed over in full and bucketed here, so moving between months
  // never needs another round trip.
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_date) continue
      const key = t.due_date.slice(0, 10)
      const bucket = map.get(key)
      if (bucket) bucket.push(t)
      else map.set(key, [t])
    }
    return map
  }, [tasks])

  // The days the current view covers, plus the range to load events for.
  const { cells, rangeFrom, rangeTo, heading } = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(effectiveCursor)
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
      const end = days[6]
      const sameMonth = start.getMonth() === end.getMonth()
      return {
        cells: days.map((d) => ({ date: d, blank: false })),
        rangeFrom: toDateKey(start),
        rangeTo: toDateKey(end),
        heading: sameMonth
          ? `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
          : `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`,
      }
    }
    const y = effectiveCursor.getFullYear()
    const m = effectiveCursor.getMonth()
    const lead = new Date(y, m, 1).getDay()
    const count = new Date(y, m + 1, 0).getDate()
    const cells: { date: Date | null; blank: boolean }[] = [
      ...Array.from({ length: lead }, () => ({ date: null, blank: true })),
      ...Array.from({ length: count }, (_, i) => ({ date: new Date(y, m, i + 1), blank: false })),
    ]
    return {
      cells,
      rangeFrom: toDateKey(new Date(y, m, 1)),
      rangeTo: toDateKey(new Date(y, m, count)),
      heading: `${MONTHS[m]} ${y}`,
    }
  }, [view, effectiveCursor])

  /** Reloads the range currently on screen. */
  const refresh = useCallback(() => {
    startTransition(async () => {
      const res = await fetch(`/api/events?from=${rangeFrom}&to=${rangeTo}`)
      if (res.ok) setEvents(await res.json())
    })
  }, [rangeFrom, rangeTo])

  // Skip the fetch for the range the server already rendered.
  const seeded = useRef(true)
  useEffect(() => {
    if (seeded.current) {
      seeded.current = false
      return
    }
    startTransition(async () => {
      const res = await fetch(`/api/events?from=${rangeFrom}&to=${rangeTo}`)
      if (res.ok) setEvents(await res.json())
    })
  }, [rangeFrom, rangeTo])

  // Open the time grid on the working day rather than at midnight.
  const timeGridRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (view === 'week' && timeGridRef.current) {
      timeGridRef.current.scrollTop = OPEN_AT_HOUR * HOUR_HEIGHT
    }
  }, [view])

  // ── Live Google updates ─────────────────────────────────────────────────────
  // The sync writes straight to the database, so the browser needs to be told
  // when to look again. Polling a tiny revision counter is cheap; the visible
  // range is refetched only when that counter actually moves.
  const revisionRef = useRef<number | null>(null)

  // The polling effect must not be torn down and rebuilt every time the visible
  // range changes, so it reaches the current refresh through a ref.
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/google/status')
        if (!res.ok || cancelled) return
        const status: GoogleStatus = await res.json()
        if (cancelled) return

        const previous = revisionRef.current
        revisionRef.current = status.revision
        setGoogleStatus(status)
        if (previous !== null && status.revision !== previous) refreshRef.current()
      } catch {
        // Offline or a transient failure — the next tick will retry.
      }
    }

    poll()
    const timer = setInterval(poll, STATUS_POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [])

  // The notice itself came in as a prop from the server. Strip the parameters
  // so a refresh doesn't replay it.
  useEffect(() => {
    if (!connectNotice) return
    const params = new URLSearchParams(window.location.search)
    params.delete('google')
    params.delete('google_error')
    const query = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''))
  }, [connectNotice])

  // Steps from wherever the view currently sits, which is today until you move.
  function step(dir: -1 | 1) {
    setCursor(
      view === 'week'
        ? addDays(effectiveCursor, dir * 7)
        : new Date(effectiveCursor.getFullYear(), effectiveCursor.getMonth() + dir, 1)
    )
  }

  function goToday() {
    const now = new Date()
    setCursor(now)
    setSelectedKey(toDateKey(now))
  }

  // Switching to the week view should land on the week you were looking at,
  // not whatever the month cursor happens to point at (the 1st).
  function switchView(v: 'month' | 'week') {
    if (v === 'week' && activeKey) setCursor(new Date(`${activeKey}T00:00:00`))
    setView(v)
  }

  const eventsForKey = (key: string) =>
    events.filter((e) => {
      if (e.date === key) return true
      // Multi-day events (a holiday, a trip) run through to their end date.
      if (e.end_date) return key > e.date && key <= e.end_date
      return false
    })
  const tasksForKey = (key: string) => tasksByDay.get(key) ?? []

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, date: form.date || activeKey }),
    })
    if (res.ok) {
      const event = await res.json()
      setEvents((prev) => [...prev, event])
      setShowForm(false)
      setForm({ title: '', date: '', time: '', description: '', color: 'indigo' })
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
    if (res.ok) setEvents((prev) => prev.filter((e) => e.id !== id))
    else setNotice({ kind: 'error', text: (await res.json().catch(() => ({}))).error ?? 'Could not delete that event.' })
  }

  function renderTask(t: Task, compact: boolean) {
    return (
      <TaskCardView
        key={t.id}
        task={t}
        compact={compact}
        hideDue
        project={t.project_id ? projectById.get(t.project_id) ?? null : null}
        assignee={t.assignee_id ? personById.get(t.assignee_id) ?? null : null}
        isArchived={t.done}
      />
    )
  }

  const selectedDate = activeKey ? new Date(`${activeKey}T00:00:00`) : null

  // The selected day, as a strip above the grid rather than a column beside it
  // — the calendar wants that width for its columns. Entries lie side by side
  // and scroll sideways once there are more than fit.
  const dayStrip = (
    <div className="panel bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.07] rounded-xl px-4 py-3">
      {selectedDate && activeKey ? (
        <>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}
            </h3>
            <button
              onClick={() => {
                setShowForm(true)
                setForm((f) => ({ ...f, date: activeKey }))
              }}
              className="flex items-center gap-1 text-[13px] text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors shrink-0"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {eventsForKey(activeKey).length === 0 && tasksForKey(activeKey).length === 0 ? (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-300">Nothing scheduled.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
              {eventsForKey(activeKey).map((ev) => (
                <div
                  key={ev.id}
                  className="group flex items-start gap-2 w-60 shrink-0 p-2 rounded-lg border border-zinc-200 dark:border-white/[0.07] hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${COLOR_DOTS[ev.color] ?? 'bg-indigo-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-800 dark:text-zinc-200 font-medium truncate">{ev.title}</div>
                    {timeLabel(ev) && (
                      <div className="flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-300 mt-0.5">
                        <Clock size={10} /> {timeLabel(ev)}
                      </div>
                    )}
                    {ev.location && (
                      <div className="flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-300 mt-0.5">
                        <MapPin size={10} /> <span className="truncate">{ev.location}</span>
                      </div>
                    )}
                    {ev.description && (
                      <p className="text-[13px] text-zinc-500 dark:text-zinc-300 mt-0.5 truncate">{ev.description}</p>
                    )}
                  </div>
                  {isGoogle(ev) ? (
                    // Mirrored events are read-only: deleting here would just be
                    // undone by the next sync, so link out to Google instead.
                    ev.google_html_link && (
                      <a
                        href={ev.google_html_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Google Calendar"
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-300 hover:text-zinc-700 dark:hover:text-white transition-all shrink-0"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )
                  ) : (
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-300 hover:text-rose-400 transition-all shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              {tasksForKey(activeKey).map((t) => (
                <div key={t.id} className="w-60 shrink-0">
                  {renderTask(t, false)}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-zinc-500 dark:text-zinc-300">Select a day to see what&apos;s on.</p>
      )}
    </div>
  )

  // ── Week: an hour-ruled time grid ───────────────────────────────────────────
  // Day columns sit over one shared set of hour lines, so a 09:30 meeting lines
  // up across the week. Untimed entries — all-day events and tasks, which only
  // have a due date — go in the strip above rather than being forced onto a
  // clock position they don't have.
  //
  // Both grids are functions rather than values: `cells` only carries the blank
  // leading cells in month mode, so building the week grid eagerly would walk
  // them and dereference a null date.
  const renderWeekGrid = () => (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="min-w-[64rem]">
        {/* Day headers */}
        <div className="flex">
          <div className="w-14 shrink-0" />
          <div className="grid flex-1 grid-cols-7">
            {cells.map((cell) => {
              const date = cell.date!
              const key = toDateKey(date)
              const isToday = key === todayKey
              const isSelected = key === activeKey
              return (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`flex flex-col items-center gap-1 border-l py-2 transition-colors ${GRID_LINE} ${
                    isSelected ? 'bg-orange-500/[0.06]' : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-300">
                    {DAYS[date.getDay()]}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium ${
                      isToday
                        ? 'bg-orange-500 text-white'
                        : isSelected
                          ? 'text-orange-500 dark:text-orange-400'
                          : 'text-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* All-day / untimed strip */}
        <div className={`flex border-t ${GRID_LINE}`}>
          <div className="w-14 shrink-0 py-1.5 pr-2 text-right text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            All day
          </div>
          <div className="grid flex-1 grid-cols-7">
            {cells.map((cell) => {
              const key = toDateKey(cell.date!)
              const untimed = eventsForKey(key).filter((e) => !isTimed(e))
              const dayTasks = tasksForKey(key)
              return (
                <div
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`min-h-[2.25rem] max-h-40 space-y-1 overflow-y-auto border-l p-1 ${GRID_LINE} ${
                    key === activeKey ? 'bg-orange-500/[0.04]' : ''
                  }`}
                >
                  {untimed.map((ev) => (
                    <div
                      key={ev.id}
                      title={ev.title}
                      className={`truncate rounded px-1.5 py-0.5 text-[12px] leading-tight ${
                        COLOR_PILLS[ev.color] ?? COLOR_PILLS.indigo
                      }`}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayTasks.map((t) => renderTask(t, true))}
                </div>
              )
            })}
          </div>
        </div>

        {/* Hour grid */}
        <div ref={timeGridRef} className={`max-h-[34rem] overflow-y-auto border-t ${GRID_LINE}`}>
          <div className="relative flex" style={{ height: 24 * HOUR_HEIGHT }}>
            {/* Hour labels */}
            <div className="relative w-14 shrink-0">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500"
                  style={{ top: h * HOUR_HEIGHT }}
                >
                  {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            <div className="relative flex-1">
              {/* One ruled line per hour, drawn under every column at once */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className={`pointer-events-none absolute inset-x-0 border-t ${GRID_LINE}`}
                  style={{ top: h * HOUR_HEIGHT }}
                />
              ))}

              <div className="absolute inset-0 grid grid-cols-7">
                {cells.map((cell) => {
                  const key = toDateKey(cell.date!)
                  const blocks = layoutTimedDay(eventsForKey(key).filter(isTimed), key)
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedKey(key)}
                      className={`relative border-l ${GRID_LINE} ${key === activeKey ? 'bg-orange-500/[0.04]' : ''}`}
                    >
                      {blocks.map(({ event, top, height, left, width }) => (
                        <div
                          key={event.id}
                          title={`${timeLabel(event)} ${event.title}`.trim()}
                          style={{ top, height, left: `${left}%`, width: `calc(${width}% - 3px)` }}
                          className={`absolute overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 ${
                            COLOR_BLOCKS[event.color] ?? COLOR_BLOCKS.indigo
                          }`}
                        >
                          <div className="truncate text-[11px] font-medium leading-tight">{event.title}</div>
                          {height >= 34 && (
                            <div className="truncate text-[10px] leading-tight opacity-75">{timeLabel(event)}</div>
                          )}
                        </div>
                      ))}

                      {key === todayKey && nowMinutes !== null && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-10"
                          style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                        >
                          <div className="relative h-px bg-rose-500">
                            <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-rose-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Month: the compact overview ─────────────────────────────────────────────
  const renderMonthGrid = () => (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="min-w-[44rem]">
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border bg-zinc-200 dark:bg-white/[0.07] border-zinc-200 dark:border-white/[0.07]">
          {cells.map((cell, i) => {
            if (cell.blank) {
              return <div key={`empty-${i}`} className="bg-white dark:bg-[#101018] min-h-[7rem]" />
            }
            const date = cell.date!
            const key = toDateKey(date)
            const dayTasks = tasksForKey(key)
            const dayEvents = eventsForKey(key)
            const isToday = key === todayKey
            const isSelected = key === activeKey

            return (
              <div
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`bg-white dark:bg-[#101018] p-1.5 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03] min-h-[7rem] ${
                  isSelected ? 'ring-1 ring-inset ring-orange-500/50' : ''
                }`}
              >
                <span
                  className={`text-[13px] font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-orange-500 text-white'
                      : isSelected
                        ? 'text-orange-500 dark:text-orange-400'
                        : 'text-zinc-500 dark:text-zinc-200'
                  }`}
                >
                  {date.getDate()}
                </span>

                <div className="mt-1 space-y-1">
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`text-[12px] leading-tight truncate px-1.5 py-0.5 rounded ${
                        COLOR_PILLS[ev.color] ?? COLOR_PILLS.indigo
                      }`}
                    >
                      {ev.time ? `${ev.time} ` : ''}
                      {ev.title}
                    </div>
                  ))}

                  {/* The same card you see on the Tasks board */}
                  {dayTasks.slice(0, 3).map((t) => renderTask(t, true))}

                  {dayTasks.length > 3 && (
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-300 px-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <div
          className={`flex items-start justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] ${
            notice.kind === 'ok'
              ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-400'
              : 'border-rose-500/20 bg-rose-500/[0.08] text-rose-600 dark:text-rose-400'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Navigation + view switch */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => step(-1)}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => step(1)}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <h2 className="ml-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{heading}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            Today
          </button>
          <div className="flex items-center p-0.5 rounded-lg panel bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08]">
            {(['month', 'week'] as const).map((v) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-2.5 py-1 rounded-md text-[13px] font-medium capitalize transition-colors ${
                  view === v
                    ? 'bg-white dark:bg-white/[0.12] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {dayStrip}

      <div className="panel rounded-xl border border-zinc-200 bg-white dark:border-white/[0.07] dark:bg-[#101018]">
        {view === 'week' ? renderWeekGrid() : renderMonthGrid()}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {/* Add event form */}
        {showForm && (
          <div className="panel bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.07] rounded-xl p-4 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New Event</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-zinc-400 dark:text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-100"
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleAddEvent} className="space-y-2.5">
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Event title"
                className={INPUT_CLS}
              />
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className={INPUT_CLS}
              />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className={INPUT_CLS}
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)"
                rows={2}
                className={`${INPUT_CLS} resize-none`}
              />
              <div className="flex gap-1.5">
                {Object.entries(COLOR_DOTS).map(([color, cls]) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={`w-5 h-5 rounded-full ${cls} ${
                      form.color === color
                        ? 'ring-2 ring-zinc-400 dark:ring-white ring-offset-1 ring-offset-white dark:ring-offset-[#101018]'
                        : ''
                    }`}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Add Event
              </button>
            </form>
          </div>
        )}

        <GoogleCalendarPanel
          status={googleStatus}
          onStatusChange={(status) => {
            revisionRef.current = status.revision
            setGoogleStatus(status)
          }}
          onSynced={refresh}
        />
      </div>
    </div>
  )
}
