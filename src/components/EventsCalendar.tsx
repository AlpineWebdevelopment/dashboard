'use client'

import { useState, useTransition, useMemo, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock, Trash2 } from 'lucide-react'
import type { Event } from '@/lib/personal-db'
import type { Person, Project, Task } from '@/lib/supabase'
import TaskCardView, { toDateKey, useToday } from './TaskCardView'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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

const INPUT_CLS =
  'w-full panel bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-orange-500/50 transition-colors dark:[color-scheme:dark]'

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

export default function EventsCalendar({
  initialEvents,
  initialYear,
  initialMonth,
  initialDay,
  tasks,
  projects,
  people,
}: {
  initialEvents: Event[]
  initialYear: number
  initialMonth: number
  initialDay: number
  tasks: Task[]
  projects: Project[]
  people: Person[]
}) {
  const [view, setView] = useState<'month' | 'week'>('week')
  // null means "wherever today is" — see effectiveCursor. It only holds a date
  // once you've actually navigated somewhere.
  const [cursor, setCursor] = useState<Date | null>(null)
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', time: '', description: '', color: 'indigo' })
  const [, startTransition] = useTransition()

  const todayKey = useToday()
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

  const eventsForKey = (key: string) => events.filter((e) => e.date === key)
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
    await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
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

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
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

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {(view === 'week' ? cells.map((c) => DAYS[c.date!.getDay()]) : DAYS).map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="text-center text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
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
            // A week has seven columns to itself, so cards get to breathe;
            // a month cell only has room for the compact form.
            const compact = view === 'month'

            return (
              <div
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`bg-white dark:bg-[#101018] p-1.5 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
                  view === 'week' ? 'min-h-[26rem]' : 'min-h-[7rem]'
                } ${isSelected ? 'ring-1 ring-inset ring-orange-500/50' : ''}`}
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
                  {(compact ? dayTasks.slice(0, 3) : dayTasks).map((t) => renderTask(t, compact))}

                  {compact && dayTasks.length > 3 && (
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

      {/* Side panel */}
      <div className="lg:w-72 shrink-0">
        <div className="panel bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.07] rounded-xl p-4">
          {selectedDate ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(true)
                    setForm((f) => ({ ...f, date: activeKey ?? '' }))
                  }}
                  className="flex items-center gap-1 text-[13px] text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors"
                >
                  <Plus size={14} /> Add
                </button>
              </div>

              {eventsForKey(activeKey!).length === 0 && tasksForKey(activeKey!).length === 0 ? (
                <p className="text-[13px] text-zinc-500 dark:text-zinc-300">Nothing scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {eventsForKey(activeKey!).map((ev) => (
                    <div
                      key={ev.id}
                      className="group flex items-start gap-2 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${COLOR_DOTS[ev.color] ?? 'bg-indigo-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-800 dark:text-zinc-200 font-medium truncate">{ev.title}</div>
                        {ev.time && (
                          <div className="flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-300 mt-0.5">
                            <Clock size={10} /> {ev.time}
                          </div>
                        )}
                        {ev.description && (
                          <p className="text-[13px] text-zinc-500 dark:text-zinc-300 mt-0.5 truncate">{ev.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-300 hover:text-rose-400 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  {tasksForKey(activeKey!).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[12px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-300">
                        Tasks
                      </p>
                      {tasksForKey(activeKey!).map((t) => renderTask(t, false))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-300">Select a day to see what&apos;s on.</p>
          )}
        </div>

        {/* Add event form */}
        {showForm && (
          <div className="mt-3 panel bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.07] rounded-xl p-4">
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
      </div>
    </div>
  )
}
