'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Calendar, CalendarEntry } from '@/lib/supabase'
import { saveCalendar, deleteCalendar, upsertCalendarEntry } from '@/lib/actions'
import {
  ChevronLeft, ChevronRight, Flame, Target, Check,
  Trash2, Settings, X, Loader2, BookOpen,
} from 'lucide-react'

// ── Color system ──────────────────────────────────────────────────────────────

const COLORS = {
  rose:    { filled: 'bg-rose-500',    light: 'bg-rose-500/20',    text: 'text-rose-400',    ring: 'ring-rose-500/40',    border: 'border-rose-500/25',    label: 'Rose'    },
  violet:  { filled: 'bg-violet-500',  light: 'bg-violet-500/20',  text: 'text-violet-400',  ring: 'ring-violet-500/40',  border: 'border-violet-500/25',  label: 'Violet'  },
  sky:     { filled: 'bg-sky-500',     light: 'bg-sky-500/20',     text: 'text-sky-400',     ring: 'ring-sky-500/40',     border: 'border-sky-500/25',     label: 'Sky'     },
  emerald: { filled: 'bg-emerald-500', light: 'bg-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500/40', border: 'border-emerald-500/25', label: 'Emerald' },
  amber:   { filled: 'bg-amber-500',   light: 'bg-amber-500/20',   text: 'text-amber-400',   ring: 'ring-amber-500/40',   border: 'border-amber-500/25',   label: 'Amber'   },
  indigo:  { filled: 'bg-indigo-500',  light: 'bg-indigo-500/20',  text: 'text-indigo-400',  ring: 'ring-indigo-500/40',  border: 'border-indigo-500/25',  label: 'Indigo'  },
  orange:  { filled: 'bg-orange-500',  light: 'bg-orange-500/20',  text: 'text-orange-400',  ring: 'ring-orange-500/40',  border: 'border-orange-500/25',  label: 'Orange'  },
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date()
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

function getStreak(entries: CalendarEntry[]): number {
  const completed = new Set(entries.filter((e) => e.completed).map((e) => e.date))
  const today = new Date()
  let streak = 0
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
    if (completed.has(ds)) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}

function getBestStreak(entries: CalendarEntry[]): number {
  const sorted = entries
    .filter((e) => e.completed)
    .map((e) => e.date)
    .sort()
  if (!sorted.length) return 0
  let best = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
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
  const router = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [draftCompleted, setDraftCompleted] = useState(false)
  const [draftNote, setDraftNote] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [calName, setCalName] = useState(calendar.name)
  const [calGoal, setCalGoal] = useState(calendar.goal)
  const [calColor, setCalColor] = useState<ColorKey>((calendar.color as ColorKey) || 'rose')
  const [calDesc, setCalDesc] = useState(calendar.description)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [, startDelete] = useTransition()

  const c = COLORS[calColor] ?? COLORS.rose

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = viewDate.toLocaleString('default', { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const today = todayStr()

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
  const totalCompleted = entries.filter((e) => e.completed).length
  const monthCompleted = useMemo(() => {
    return entries.filter((e) => {
      if (!e.completed) return false
      const d = new Date(e.date + 'T00:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    }).length
  }, [entries, year, month])
  const monthPct = daysInMonth > 0 ? Math.round((monthCompleted / daysInMonth) * 100) : 0

  // ── Day selection ──────────────────────────────────────────────────────────
  function selectDay(dateStr: string) {
    const existing = entryMap[dateStr]
    setSelectedDate(dateStr)
    setDraftCompleted(existing?.completed ?? false)
    setDraftNote(existing?.note ?? '')
  }

  async function saveEntry() {
    if (!selectedDate) return
    setSavingEntry(true)
    const entry = await upsertCalendarEntry(calendar.id, selectedDate, draftCompleted, draftNote)
    if (entry) {
      setEntries((prev) => {
        const without = prev.filter((e) => e.date !== selectedDate)
        return [...without, entry].sort((a, b) => a.date.localeCompare(b.date))
      })
    }
    setSavingEntry(false)
    setSelectedDate(null)
  }

  // ── Settings save ──────────────────────────────────────────────────────────
  async function handleSaveSettings() {
    setSavingSettings(true)
    await saveCalendar(calendar.id, calName.trim() || 'Untitled', calGoal.trim(), calColor, calDesc.trim())
    setSavingSettings(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  function handleDelete() {
    if (!confirm('Delete this calendar and all its entries? This cannot be undone.')) return
    startDelete(async () => {
      await deleteCalendar(calendar.id)
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-3 h-3 rounded-full shrink-0 ${c.filled}`} />
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
              <input
                value={calName}
                onChange={(e) => setCalName(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/[0.16] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1.5">Daily goal</label>
              <input
                value={calGoal}
                onChange={(e) => setCalGoal(e.target.value)}
                placeholder="What to do each day…"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/[0.16] transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_SWATCHES.map(({ key, bg }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCalColor(key)}
                  className={`w-6 h-6 rounded-full ${bg} transition-all ${
                    calColor === key
                      ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-[#0a0a12] scale-110'
                      : 'opacity-50 hover:opacity-90'
                  }`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-1.5">Description</label>
            <textarea
              value={calDesc}
              onChange={(e) => setCalDesc(e.target.value)}
              placeholder="Optional notes about this calendar…"
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/[0.16] resize-none transition-colors"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={11} />
              Delete calendar
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                settingsSaved
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : `${c.light} ${c.text} border ${c.border} hover:opacity-90`
              }`}
            >
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
            <BookOpen size={11} className="text-zinc-600" />
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-600">This month</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-100 tabular-nums">{monthPct}%</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">{monthCompleted}/{daysInMonth} days</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 sm:px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={11} className="text-zinc-600" />
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-600">Best streak</span>
          </div>
          <p className="text-xl sm:text-2xl font-semibold text-zinc-100 tabular-nums">{bestStreak}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">day{bestStreak !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-zinc-200">
          {monthName} {year}
        </p>
        <button
          onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors"
        >
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
            if (!day) {
              return <div key={`pad-${idx}`} className="aspect-square border-r border-b border-white/[0.04] last:border-r-0" />
            }
            const dateStr = toDateStr(year, month, day)
            const entry = entryMap[dateStr]
            const completed = entry?.completed ?? false
            const hasNote = !!(entry?.note)
            const isToday = dateStr === today
            const isFuture = dateStr > today
            const isSelected = dateStr === selectedDate

            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && selectDay(dateStr)}
                disabled={isFuture}
                className={`
                  relative aspect-square flex flex-col items-center justify-center
                  border-r border-b border-white/[0.04] last:border-r-0
                  transition-all duration-150 group
                  ${isFuture ? 'opacity-25 cursor-default' : 'cursor-pointer'}
                  ${completed
                    ? `${c.filled}`
                    : isSelected
                      ? 'bg-white/[0.07]'
                      : isFuture ? '' : 'hover:bg-white/[0.05]'
                  }
                  ${isToday && !completed ? `ring-1 ring-inset ${c.ring}` : ''}
                `}
              >
                <span className={`text-xs sm:text-sm font-medium tabular-nums transition-colors ${
                  completed ? 'text-white' : isToday ? c.text : 'text-zinc-500 group-hover:text-zinc-300'
                }`}>
                  {day}
                </span>
                {completed && (
                  <Check size={8} className="text-white/60 absolute bottom-1" />
                )}
                {hasNote && !completed && (
                  <span className={`absolute bottom-1 w-1 h-1 rounded-full ${c.filled} opacity-70`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Day entry panel ── */}
      {selectedDate && (
        <div className={`rounded-2xl border ${c.border} bg-white/[0.03] p-4 sm:p-5 animate-in slide-in-from-bottom-2 duration-200`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-zinc-200">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </p>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {calGoal && (
            <p className="text-xs text-zinc-600 mb-3 italic">Goal: {calGoal}</p>
          )}

          {/* Completion toggle */}
          <button
            onClick={() => setDraftCompleted((v) => !v)}
            className={`flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border transition-all mb-3 ${
              draftCompleted
                ? `${c.filled} border-transparent text-white`
                : `border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]`
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
              draftCompleted ? 'border-white/60 bg-white/20' : 'border-zinc-600'
            }`}>
              {draftCompleted && <Check size={11} strokeWidth={3} />}
            </div>
            <span className="text-sm font-medium">
              {draftCompleted ? 'Completed ✓' : 'Mark as completed'}
            </span>
          </button>

          {/* Note */}
          <textarea
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Add a note for this day… (optional)"
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-white/[0.14] resize-none transition-colors mb-3"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSelectedDate(null)}
              className="px-4 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEntry}
              disabled={savingEntry}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${c.light} ${c.text} border ${c.border} hover:opacity-90`}
            >
              {savingEntry && <Loader2 size={11} className="animate-spin" />}
              {savingEntry ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Empty prompt ── */}
      {totalCompleted === 0 && !selectedDate && (
        <p className="text-center text-xs text-zinc-700 mt-4">
          Click any day to start tracking
        </p>
      )}
    </div>
  )
}
