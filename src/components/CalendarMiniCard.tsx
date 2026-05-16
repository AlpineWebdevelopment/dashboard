'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Calendar, CalendarEntry } from '@/lib/supabase'
import { CalendarIcon, ICON_DEFS, isIconKey } from '@/lib/calendarIcons'
import { upsertCalendarEntry } from '@/lib/actions'
import { CalendarDays, Flame, ChevronLeft, ChevronRight } from 'lucide-react'

const COLOR_TEXT: Record<string, string> = {
  rose:    'text-rose-400',
  violet:  'text-violet-400',
  sky:     'text-sky-400',
  emerald: 'text-emerald-400',
  amber:   'text-amber-400',
  indigo:  'text-indigo-400',
  orange:  'text-orange-400',
}

const COLOR_BG: Record<string, string> = {
  rose:    'bg-rose-500',
  violet:  'bg-violet-500',
  sky:     'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  indigo:  'bg-indigo-500',
  orange:  'bg-orange-500',
}

const COLOR_BORDER: Record<string, string> = {
  rose:    'hover:border-rose-500/25',
  violet:  'hover:border-violet-500/25',
  sky:     'hover:border-sky-500/25',
  emerald: 'hover:border-emerald-500/25',
  amber:   'hover:border-amber-500/25',
  indigo:  'hover:border-indigo-500/25',
  orange:  'hover:border-orange-500/25',
}

type Status = 'green' | 'yellow' | 'red' | ''

const STATUS_BG: Record<string, string> = {
  green:  'bg-emerald-500',
  yellow: 'bg-amber-400',
  red:    'bg-rose-500',
  '':     '',
}

const NEXT_STATUS: Record<Status, Status> = {
  '':      'green',
  green:   'yellow',
  yellow:  'red',
  red:     '',
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function resolveStatus(entry: CalendarEntry | undefined): Status {
  if (!entry) return ''
  if (entry.status) return entry.status as Status
  if (entry.completed) return 'green'
  return ''
}

function getStreak(entries: CalendarEntry[]): number {
  const today = new Date()
  let streak = 0
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
    const e = entries.find((e) => e.date === ds)
    const s = resolveStatus(e)
    if (s === 'green') streak++
    else if (i > 0) break
  }
  return streak
}

export default function CalendarMiniCard({
  calendar,
  entries: initialEntries,
}: {
  calendar: Calendar
  entries: CalendarEntry[]
}) {
  const router = useRouter()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [localEntries, setLocalEntries] = useState<CalendarEntry[]>(initialEntries)

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()

  const entryMap: Record<string, CalendarEntry> = {}
  for (const e of localEntries) entryMap[e.date] = e

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const streak = getStreak(localEntries)
  const colorText = COLOR_TEXT[calendar.color] ?? 'text-zinc-400'
  const colorBg = COLOR_BG[calendar.color] ?? 'bg-zinc-500'
  const colorBorder = COLOR_BORDER[calendar.color] ?? ''

  const todayDay = isCurrentMonth ? today.getDate() : -1
  const pastDays = isCurrentMonth ? Math.min(todayDay, daysInMonth) : daysInMonth
  let greenCount = 0, yellowCount = 0, redCount = 0
  for (let d = 1; d <= pastDays; d++) {
    const ds = toDateStr(viewYear, viewMonth, d)
    const s = resolveStatus(entryMap[ds])
    if (s === 'green') greenCount++
    else if (s === 'yellow') yellowCount++
    else if (s === 'red') redCount++
  }
  const greenPct = pastDays > 0 ? Math.round((greenCount / pastDays) * 100) : 0

  const hasValidIcon = isIconKey(calendar.emoji)
  const iconColor = hasValidIcon ? ICON_DEFS[calendar.emoji as keyof typeof ICON_DEFS].color : colorText

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11 }
      return m - 1
    })
  }, [])

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0 }
      return m + 1
    })
  }, [])

  const handleDayClick = useCallback((day: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const dateStr = toDateStr(viewYear, viewMonth, day)
    const current = resolveStatus(entryMap[dateStr])
    const next = NEXT_STATUS[current]

    setLocalEntries((prev) => {
      const existing = prev.find((e) => e.date === dateStr)
      if (existing) {
        return prev.map((e) => e.date === dateStr ? { ...e, status: next, completed: next === 'green' } : e)
      }
      return [...prev, { id: '', calendar_id: calendar.id, date: dateStr, status: next, completed: next === 'green', note: '', created_at: '' }]
    })

    upsertCalendarEntry(calendar.id, dateStr, next, '').then((saved) => {
      if (saved) {
        setLocalEntries((prev) => prev.map((e) =>
          e.date === dateStr ? { ...saved, status: saved.status || next } : e
        ))
      }
    }).catch(() => {
      setLocalEntries((prev) => prev.map((e) =>
        e.date === dateStr ? { ...e, status: current, completed: current === 'green' } : e
      ))
    })
  }, [viewYear, viewMonth, entryMap, calendar.id]) // eslint-disable-line

  return (
    <div
      className={`flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] ${colorBorder} p-4 transition-all duration-200 group cursor-default`}
      onDoubleClick={() => router.push(`/calendars/${calendar.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center shrink-0 ${iconColor}`}>
            {hasValidIcon
              ? <CalendarIcon iconKey={calendar.emoji} size={15} className={iconColor} />
              : <CalendarDays size={15} className={colorText} />
            }
          </div>
          <div className="min-w-0">
            <Link
              href={`/calendars/${calendar.id}`}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="text-[13px] font-semibold text-zinc-200 hover:text-white transition-colors truncate block"
            >
              {calendar.name}
            </Link>
            {calendar.goal && (
              <p className="text-[10px] text-zinc-600 truncate mt-0.5">{calendar.goal}</p>
            )}
          </div>
        </div>
        {streak > 0 && (
          <div className={`flex items-center gap-1 shrink-0 ${colorText}`}>
            <Flame size={11} />
            <span className="text-[12px] font-semibold tabular-nums">{streak}</span>
          </div>
        )}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={(e) => { e.stopPropagation(); prevMonth() }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors"
        >
          <ChevronLeft size={12} />
        </button>
        <span className="text-[10px] font-medium text-zinc-600 tabular-nums tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); nextMonth() }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="p-0.5 text-zinc-700 hover:text-zinc-400 transition-colors"
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            <span className="text-[8px] text-zinc-700 font-medium">{d}</span>
          </div>
        ))}
      </div>

      {/* Month dot grid */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {cells.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} className="aspect-square" />
          const dateStr = toDateStr(viewYear, viewMonth, day)
          const status = resolveStatus(entryMap[dateStr])
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr
          const hasBg = !!STATUS_BG[status]

          return (
            <div
              key={dateStr}
              onClick={(e) => handleDayClick(day, e)}
              onDoubleClick={(e) => e.stopPropagation()}
              className={`
                aspect-square rounded-md flex items-center justify-center cursor-pointer select-none
                ${isFuture ? 'opacity-20 cursor-default' : 'hover:opacity-80 active:scale-90 transition-transform'}
                ${hasBg ? STATUS_BG[status] : 'bg-white/[0.05] hover:bg-white/[0.09]'}
                ${isToday && !hasBg ? 'ring-1 ring-white/30' : ''}
              `}
            >
              <span className={`text-[9px] font-medium tabular-nums leading-none ${
                hasBg ? 'text-white/80' : isToday ? colorText : 'text-zinc-700'
              }`}>
                {day}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar + stats */}
      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2.5">
            {greenCount > 0  && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /><span className="text-zinc-500">{greenCount}</span></span>}
            {yellowCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /><span className="text-zinc-500">{yellowCount}</span></span>}
            {redCount > 0    && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /><span className="text-zinc-500">{redCount}</span></span>}
          </div>
          <span className={`font-semibold tabular-nums ${colorText}`}>{greenPct}%</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full ${colorBg} transition-all duration-300`}
            style={{ width: `${greenPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
