'use client'

import { useState, useMemo, useTransition } from 'react'
import type { Calendar, CalendarEntry } from '@/lib/supabase'
import { saveCalendar, deleteCalendar, upsertCalendarEntry } from '@/lib/actions'
import {
  ChevronLeft, ChevronRight, Flame, Target, Check,
  Trash2, Settings, Loader2, TrendingUp,
} from 'lucide-react'

type Status = 'green' | 'yellow' | 'red' | ''

// ── Color system ──────────────────────────────────────────────────────────────

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

const EMOJIS = [
  '🏋️', '💧', '📚', '🥗', '😴', '🧘',
  '🎯', '💪', '🏃', '🍎', '✍️', '🎨',
  '🎵', '💊', '🌿', '☕', '🚴', '🧠',
  '💰', '📝', '🌅', '🦷', '🧹', '⭐',
]

const STATUS_BG: Record<Status, string> = {
  green:  'bg-emerald-500',
  yellow: 'bg-amber-400',
  red:    'bg-rose-500',
  '':     '',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  const greenSet = new Set(entries.filter((e) => e.status === 'green').map((e) => e.date))
  const today = new Date()
  let streak = 0
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
    if (greenSet.has(ds)) streak++
    else if (i > 0) break
  }
  return streak
}

function getBestStreak(entries: CalendarEntry[]): number {
  const sorted = entries.filter((e) => e.status === 'green').map((e) => e.date).sort()
  if (!sorted.length) return 0
  let best = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000
    if (diff === 1) { cur++; best = Math.max(best, cur) }
    else cur = 1
  }
  return best
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarView({
  calendar,
  initialEntries,
}: {
  calendar: Calendar
  initialEntries: CalendarEntry[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [viewDate, setViewDate] = useState(() => new Date())

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [calName, setCalName] = useState(calendar.name)
  const [calGoal, setCalGoal] = useState(calendar.goal)
  const [calColor, setCalColor] = useState<ColorKey>((calendar.color as ColorKey) || 'rose')
  const [calEmoji, setCalEmoji] = useState(calendar.emoji || '📅')
  const [calDesc, setCalDesc] = useState(calendar.description)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [, startDelete] = useTransition()

  const c = COLORS[calColor] ?? COLORS.rose
  const today = todayStr()

  // ── Calendar grid ──────────────────────────────────────────────────────────
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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const streak = useMemo(() => getStreak(entries), [entries])
  const bestStreak = useMemo(() => getBestStreak(entries), [entries])
  const monthGreen = useMemo(() =>
    entries.filter((e) => {
      if (e.status !== 'green') return false
      const d = new Date(e.date + 'T00:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    }).length
  , [entries, year, month])
  const monthPct = daysInMonth > 0 ? Math.round((monthGreen / daysInMonth) * 100) : 0

  // ── Click: cycle status + auto-save ───────────────────────────────────────
  function handleDayClick(dateStr: string) {
    const current = (entryMap[dateStr]?.status ?? '') as Status
    const next = cycleStatus(current)

    // Optimistic update
    setEntries((prev) => {
      const without = prev.filter((e) => e.date !== dateStr)
      const base = entryMap[dateStr]
      return [
        ...without,
        {
          id: base?.id ?? '',
          calendar_id: calendar.id,
          date: dateStr,
          completed: next === 'green',
          status: next,
          note: base?.note ?? '',
          created_at: base?.created_at ?? new Date().toISOString(),
        },
      ].sort((a, b) => a.date.localeCompare(b.date))
    })

    // Fire-and-forget save
    upsertCalendarEntry(calendar.id, dateStr, next, entryMap[dateStr]?.note ?? '')
      .then((saved) => {
        if (saved) {
          setEntries((prev) => {
            const without = prev.filter((e) => e.date !== dateStr)
            return [...without, saved].sort((a, b) => a.date.localeCompare(b.date))
          })
        }
      })
      .catch(() => {
        // Revert on error
        setEntries((prev) => {
          const without = prev.filter((e) => e.date !== dateStr)
          const base = entryMap[dateStr]
          if (!base) return without
          return [...without, base].sort((a, b) => a.date.localeCompare(b.date))
        })
      })
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  async function handleSaveSettings() {
    setSavingSettings(true)
    await saveCalendar(calendar.id, calName.trim() || 'Untitled', calGoal.trim(), calColor, calEmoji, calDesc.trim())
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  function handleDelete() {
    if (!confirm('Delete this calendar and all its entries? This cannot be undone.')) return
    startDelete(async () => { await deleteCalendar(calendar.id) })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{calEmoji}</span>
          <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-100 tracking-tight truncate">
            {calName}
          </h1>
        </div>
        <button
          onClick={() => setSettingsOpen((s) => !s)}
          className={`p-2 rounded-lg transition-colors shrink-0 ${settingsOpen ? `${c.light} ${c.text}` : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.05]'}`}
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

      {/* ── Settings panel ── */}
      {settingsOpen && (
        <div className="mb-6 p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1.5">Name</label>
              <input value={calName} onChange={(e) => setCalName(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/[0.16] transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1.5">Daily goal</label>
              <input value={calGoal} onChange={(e) => setCalGoal(e.target.value)} placeholder="What to do each day…"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/[0.16] transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-2">Icon</label>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setCalEmoji(e)}
                  className={`h-8 rounded-lg text-base transition-all ${calEmoji === e ? 'bg-white/[0.12] ring-1 ring-white/20 scale-110' : 'bg-white/[0.04] hover:bg-white/[0.08]'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_SWATCHES.map(({ key, bg }) => (
                <button key={key} type="button" onClick={() => setCalColor(key)}
                  className={`w-6 h-6 rounded-full ${bg} transition-all ${calColor === key ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-[#0a0a12] scale-110' : 'opacity-50 hover:opacity-90'}`} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1.5">Description</label>
            <textarea value={calDesc} onChange={(e) => setCalDesc(e.target.value)} placeholder="Optional notes…" rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/[0.16] resize-none transition-colors" />
          </div>

          <div className="flex items-center justify-between">
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
              <Trash2 size={11} />
              Delete calendar
            </button>
            <button onClick={handleSaveSettings} disabled={savingSettings}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                settingsSaved ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : `${c.light} ${c.text} border ${c.border} hover:opacity-90`
              }`}>
              {savingSettings ? <Loader2 size={11} className="animate-spin" /> : settingsSaved ? <Check size={11} /> : null}
              {savingSettings ? 'Saving…' : settingsSaved ? 'Saved' : 'Save settings'}
            </button>
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <div className={`rounded-xl border ${c.border} ${c.light} px-3 sm:px-4 py-3`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={11} className={c.text} />
            <span className={`text-[10px] font-semibold tracking-widest uppercase ${c.text}`}>Streak</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-100 tabular-nums">{streak}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">day{streak !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 sm:px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={11} className="text-zinc-600" />
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-600">This month</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-100 tabular-nums">{monthPct}%</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{monthGreen}/{daysInMonth} green</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 sm:px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={11} className="text-zinc-600" />
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-600">Best</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-100 tabular-nums">{bestStreak}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">day{bestStreak !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-zinc-200">{monthName} {year}</p>
        <button onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Month grid ── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden mb-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold tracking-widest uppercase text-zinc-700">
              {d[0]}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return (
              <div key={`pad-${idx}`} className="aspect-square border-r border-b border-white/[0.04] last:border-r-0" />
            )

            const dateStr = toDateStr(year, month, day)
            const status = (entryMap[dateStr]?.status ?? '') as Status
            const isToday = dateStr === today
            const isFuture = dateStr > today
            const statusBg = STATUS_BG[status]

            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && handleDayClick(dateStr)}
                disabled={isFuture}
                title={isFuture ? undefined : status ? `Click to change status` : `Click to mark`}
                className={`
                  relative aspect-square flex flex-col items-center justify-center gap-0.5
                  border-r border-b border-white/[0.04] last:border-r-0
                  transition-all duration-100
                  ${isFuture ? 'opacity-20 cursor-default' : 'cursor-pointer active:scale-95'}
                  ${statusBg || (isFuture ? '' : 'hover:bg-white/[0.05]')}
                  ${isToday && !status ? `ring-1 ring-inset ${c.ring}` : ''}
                `}
              >
                <span className={`text-[11px] sm:text-xs font-medium tabular-nums leading-none ${
                  status ? 'text-white' : isToday ? c.text : 'text-zinc-500'
                }`}>
                  {day}
                </span>
                <span className={`text-[10px] sm:text-[11px] leading-none transition-opacity ${
                  status ? 'opacity-80' : 'opacity-20'
                }`}>
                  {calEmoji}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-zinc-600">🟢 once</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span className="text-[10px] text-zinc-600">🟡 twice</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-[10px] text-zinc-600">🔴 three times</span>
        </div>
        <span className="text-[10px] text-zinc-700 ml-auto">click to cycle</span>
      </div>
    </div>
  )
}
