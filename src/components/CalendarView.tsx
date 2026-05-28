'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import type { Calendar, CalendarEntry } from '@/lib/supabase'
import { saveCalendar, deleteCalendar, upsertCalendarEntry } from '@/lib/actions'
import { ICON_KEYS, ICON_DEFS, CalendarIcon, isIconKey } from '@/lib/calendarIcons'
import {
  ChevronLeft, ChevronRight, Flame, Target, Check,
  Trash2, Settings, Loader2, TrendingUp,
} from 'lucide-react'

type Status = 'green' | 'yellow' | 'red' | ''

const COLORS = {
  rose:    { light: 'bg-rose-500/20',    text: 'text-rose-400',    ring: 'ring-rose-500/40',    border: 'border-rose-500/25',    filled: 'bg-rose-500'    },
  violet:  { light: 'bg-violet-500/20',  text: 'text-violet-400',  ring: 'ring-violet-500/40',  border: 'border-violet-500/25',  filled: 'bg-violet-500'  },
  sky:     { light: 'bg-sky-500/20',     text: 'text-sky-400',     ring: 'ring-sky-500/40',     border: 'border-sky-500/25',     filled: 'bg-sky-500'     },
  emerald: { light: 'bg-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500/40', border: 'border-emerald-500/25', filled: 'bg-emerald-500' },
  amber:   { light: 'bg-amber-500/20',   text: 'text-amber-400',   ring: 'ring-amber-500/40',   border: 'border-amber-500/25',   filled: 'bg-amber-500'   },
  indigo:  { light: 'bg-indigo-500/20',  text: 'text-indigo-400',  ring: 'ring-indigo-500/40',  border: 'border-indigo-500/25',  filled: 'bg-indigo-500'  },
  orange:  { light: 'bg-orange-500/20',  text: 'text-orange-400',  ring: 'ring-orange-500/40',  border: 'border-orange-500/25',  filled: 'bg-orange-500'  },
} as const
type ColorKey = keyof typeof COLORS

const COLOR_SWATCHES: { key: ColorKey; bg: string }[] = [
  { key: 'rose',    bg: 'bg-rose-500'    },
  { key: 'violet',  bg: 'bg-violet-500'  },
  { key: 'sky',     bg: 'bg-sky-500'     },
  { key: 'emerald', bg: 'bg-emerald-500' },
  { key: 'amber',   bg: 'bg-amber-500'   },
  { key: 'indigo',  bg: 'bg-indigo-500'  },
  { key: 'orange',  bg: 'bg-orange-500'  },
]

const STATUS_BG: Record<Status, string> = {
  green:  'bg-emerald-500',
  yellow: 'bg-amber-400',
  red:    'bg-rose-500',
  '':     '',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function resolveStatus(entry: CalendarEntry | undefined): Status {
  if (!entry) return ''
  if (entry.status) return entry.status as Status
  if (entry.completed) return 'green'
  return ''
}

function cycleStatus(s: Status): Status {
  if (s === '')       return 'green'
  if (s === 'green')  return 'yellow'
  if (s === 'yellow') return 'red'
  return ''
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayStr() {
  const d = new Date()
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

function getStreak(entries: CalendarEntry[]): number {
  const map: Record<string, CalendarEntry> = {}
  for (const e of entries) map[e.date] = e
  const today = new Date()
  let streak = 0
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
    if (resolveStatus(map[ds]) === 'green') streak++
    else if (i > 0) break
  }
  return streak
}

function getBestStreak(entries: CalendarEntry[]): number {
  const sorted = entries.filter((e) => resolveStatus(e) === 'green').map((e) => e.date).sort()
  if (!sorted.length) return 0
  let best = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000
    if (diff === 1) { cur++; best = Math.max(best, cur) }
    else cur = 1
  }
  return best
}

export default function CalendarView({
  calendar,
  initialEntries,
}: {
  calendar: Calendar
  initialEntries: CalendarEntry[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [viewDate, setViewDate] = useState(() => new Date())

  // Keep a ref of the latest entries map so async callbacks always see current state
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [calName, setCalName] = useState(calendar.name)
  const [calGoal, setCalGoal] = useState(calendar.goal)
  const [calColor, setCalColor] = useState<ColorKey>((calendar.color as ColorKey) || 'rose')
  const [calIcon, setCalIcon] = useState(isIconKey(calendar.emoji) ? calendar.emoji : 'Target')
  const [calDesc, setCalDesc] = useState(calendar.description)
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsLatestRef = useRef({ calName, calGoal, calColor, calIcon, calDesc })
  const [, startDelete] = useTransition()

  const c = COLORS[calColor] ?? COLORS.rose
  const today = todayStr()

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = viewDate.toLocaleString('default', { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const entryMap = useMemo(() => {
    const m: Record<string, CalendarEntry> = {}
    for (const e of entries) m[e.date] = e
    return m
  }, [entries])

  const streak = useMemo(() => getStreak(entries), [entries])
  const bestStreak = useMemo(() => getBestStreak(entries), [entries])
  const monthGreen = useMemo(() =>
    entries.filter((e) => {
      if (resolveStatus(e) !== 'green') return false
      const d = new Date(e.date + 'T00:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    }).length
  , [entries, year, month])
  const monthPct = daysInMonth > 0 ? Math.round((monthGreen / daysInMonth) * 100) : 0

  // ── Click: cycle + immediate optimistic update + background save ───────────
  function handleDayClick(dateStr: string) {
    const current = resolveStatus(entryMap[dateStr])
    const next = cycleStatus(current)
    const prevEntry = entryMap[dateStr]

    // Apply immediately
    setEntries((prev) => {
      const without = prev.filter((e) => e.date !== dateStr)
      return [
        ...without,
        {
          id:          prevEntry?.id ?? '',
          calendar_id: calendar.id,
          date:        dateStr,
          completed:   next === 'green',
          status:      next,
          note:        prevEntry?.note ?? '',
          created_at:  prevEntry?.created_at ?? new Date().toISOString(),
        },
      ].sort((a, b) => a.date.localeCompare(b.date))
    })

    // Persist in background — on success reconcile with server id/timestamps
    upsertCalendarEntry(calendar.id, dateStr, next, prevEntry?.note ?? '')
      .then((saved) => {
        if (!saved) return
        setEntries((prev) => {
          const without = prev.filter((e) => e.date !== dateStr)
          // Preserve the status we applied (server may return null status pre-migration)
          return [...without, { ...saved, status: saved.status || next }]
            .sort((a, b) => a.date.localeCompare(b.date))
        })
      })
      .catch(() => {
        // Restore previous state on hard failure
        setEntries((prev) => {
          const without = prev.filter((e) => e.date !== dateStr)
          if (!prevEntry) return without
          return [...without, prevEntry].sort((a, b) => a.date.localeCompare(b.date))
        })
      })
  }

  function triggerSettingsSave(overrides: Partial<typeof settingsLatestRef.current> = {}) {
    const vals = { ...settingsLatestRef.current, ...overrides }
    settingsLatestRef.current = vals
    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current)
    setSettingsSaveStatus('idle')
    settingsTimerRef.current = setTimeout(async () => {
      setSettingsSaveStatus('saving')
      await saveCalendar(calendar.id, vals.calName.trim() || 'Untitled', vals.calGoal.trim(), vals.calColor, vals.calIcon, vals.calDesc.trim())
      setSettingsSaveStatus('saved')
      setTimeout(() => setSettingsSaveStatus('idle'), 2000)
    }, 800)
  }

  function handleDelete() {
    if (!confirm('Delete this calendar and all its entries? This cannot be undone.')) return
    startDelete(async () => { await deleteCalendar(calendar.id) })
  }

  const iconColor = isIconKey(calIcon) ? ICON_DEFS[calIcon].color : 'text-zinc-400'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center shrink-0 ${iconColor}`}>
            <CalendarIcon iconKey={calIcon} size={18} />
          </div>
          <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
            {calName}
          </h1>
        </div>
        <button
          onClick={() => setSettingsOpen((s) => !s)}
          className={`p-2 rounded-lg transition-colors shrink-0 ${settingsOpen ? `${c.light} ${c.text}` : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.05]'}`}
        >
          <Settings size={15} />
        </button>
      </div>

      {calGoal && !settingsOpen && (
        <div className={`flex items-center gap-2 mb-6 px-3 py-2 rounded-xl border ${c.border} ${c.light} w-fit`}>
          <Target size={12} className={c.text} />
          <span className={`text-xs font-medium ${c.text}`}>{calGoal}</span>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <div className="mb-6 p-5 rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Name</label>
              <input value={calName} onChange={(e) => { setCalName(e.target.value); triggerSettingsSave({ calName: e.target.value }) }}
                className="w-full bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Daily goal</label>
              <input value={calGoal} onChange={(e) => { setCalGoal(e.target.value); triggerSettingsSave({ calGoal: e.target.value }) }} placeholder="What to do each day…"
                className="w-full bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors" />
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">Icon</label>
            <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
              {ICON_KEYS.map((key) => {
                const { color, label } = ICON_DEFS[key]
                const selected = calIcon === key
                return (
                  <button key={key} type="button" title={label}
                    onClick={() => { setCalIcon(key); triggerSettingsSave({ calIcon: key }) }}
                    className={`aspect-square rounded-xl flex items-center justify-center transition-all ${selected ? 'bg-zinc-200 dark:bg-white/[0.12] ring-1 ring-zinc-300 dark:ring-white/20 scale-110' : 'bg-zinc-100/60 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08]'} ${color}`}>
                    <CalendarIcon iconKey={key} size={16} className={color} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_SWATCHES.map(({ key, bg }) => (
                <button key={key} type="button"
                  onClick={() => { setCalColor(key); triggerSettingsSave({ calColor: key }) }}
                  className={`w-6 h-6 rounded-full ${bg} transition-all ${calColor === key ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-[#0a0a12] scale-110' : 'opacity-50 hover:opacity-90'}`} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Description</label>
            <textarea value={calDesc} onChange={(e) => { setCalDesc(e.target.value); triggerSettingsSave({ calDesc: e.target.value }) }} placeholder="Optional notes…" rows={2}
              className="w-full bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] resize-none transition-colors" />
          </div>

          <div className="flex items-center justify-between">
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
              <Trash2 size={11} />Delete calendar
            </button>
            <span className="flex items-center gap-1 text-[11px] h-4">
              {settingsSaveStatus === 'saving' && <><Loader2 size={10} className="animate-spin text-zinc-400 dark:text-zinc-600" /><span className="text-zinc-400 dark:text-zinc-600">Saving…</span></>}
              {settingsSaveStatus === 'saved'  && <><Check size={10} className="text-emerald-500" /><span className="text-emerald-500">Saved</span></>}
            </span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <div className={`rounded-xl border ${c.border} ${c.light} px-3 sm:px-4 py-3`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={11} className={c.text} />
            <span className={`text-[10px] font-semibold tracking-widest uppercase ${c.text}`}>Streak</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{streak}</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">day{streak !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] px-3 sm:px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={11} className="text-zinc-400 dark:text-zinc-600" />
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600">This month</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{monthPct}%</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{monthGreen}/{daysInMonth} green</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] px-3 sm:px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={11} className="text-zinc-400 dark:text-zinc-600" />
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600">Best</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{bestStreak}</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">day{bestStreak !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{monthName} {year}</p>
        <button onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Month grid */}
      <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50/50 dark:bg-white/[0.02] overflow-hidden mb-4">
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-white/[0.06]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-700">
              {d[0]}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return (
              <div key={`pad-${idx}`} className="aspect-square border-r border-b border-zinc-200/60 dark:border-white/[0.04] last:border-r-0" />
            )

            const dateStr = toDateStr(year, month, day)
            const status = resolveStatus(entryMap[dateStr])
            const isToday = dateStr === today
            const isFuture = dateStr > today
            const statusBg = STATUS_BG[status]

            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && handleDayClick(dateStr)}
                disabled={isFuture}
                className={`
                  relative aspect-square flex flex-col items-center justify-center gap-px
                  border-r border-b border-zinc-200/60 dark:border-white/[0.04] last:border-r-0
                  transition-all duration-100
                  ${isFuture ? 'opacity-20 cursor-default' : 'cursor-pointer active:scale-95'}
                  ${statusBg || (isFuture ? '' : 'hover:bg-zinc-100 dark:hover:bg-white/[0.05]')}
                  ${isToday && !status ? `ring-1 ring-inset ${c.ring}` : ''}
                `}
              >
                <span className={`text-[11px] sm:text-xs font-medium tabular-nums leading-none ${
                  status ? 'text-white' : isToday ? c.text : 'text-zinc-500'
                }`}>
                  {day}
                </span>
                <span className={`transition-opacity ${status ? 'opacity-70' : 'opacity-15'}`}>
                  <CalendarIcon iconKey={calIcon} size={9} className={status ? 'text-white' : iconColor} />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600">Green — 1×</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600">Yellow — 2×</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600">Red — 3×</span>
        </div>
      </div>
    </div>
  )
}
