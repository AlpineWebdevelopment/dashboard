import Link from 'next/link'
import type { Calendar, CalendarEntry } from '@/lib/supabase'
import { CalendarIcon, ICON_DEFS, isIconKey } from '@/lib/calendarIcons'
import { Flame } from 'lucide-react'

const COLOR_TEXT: Record<string, string> = {
  rose:    'text-rose-400',
  violet:  'text-violet-400',
  sky:     'text-sky-400',
  emerald: 'text-emerald-400',
  amber:   'text-amber-400',
  indigo:  'text-indigo-400',
  orange:  'text-orange-400',
}

const COLOR_BORDER: Record<string, string> = {
  rose:    'hover:border-rose-500/20',
  violet:  'hover:border-violet-500/20',
  sky:     'hover:border-sky-500/20',
  emerald: 'hover:border-emerald-500/20',
  amber:   'hover:border-amber-500/20',
  indigo:  'hover:border-indigo-500/20',
  orange:  'hover:border-orange-500/20',
}

type Status = 'green' | 'yellow' | 'red' | ''

const STATUS_BG: Record<Status, string> = {
  green:  'bg-emerald-500',
  yellow: 'bg-amber-400',
  red:    'bg-rose-500',
  '':     'bg-white/[0.06]',
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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

export default function CalendarMiniCard({
  calendar,
  entries,
}: {
  calendar: Calendar
  entries: CalendarEntry[]
}) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const entryMap: Record<string, CalendarEntry> = {}
  for (const e of entries) entryMap[e.date] = e

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = toDateStr(year, month, now.getDate())
  const streak = getStreak(entries)
  const colorText = COLOR_TEXT[calendar.color] ?? 'text-zinc-400'
  const colorBorder = COLOR_BORDER[calendar.color] ?? ''
  const iconColor = isIconKey(calendar.emoji) ? ICON_DEFS[calendar.emoji].color : colorText

  return (
    <Link
      href={`/calendars/${calendar.id}`}
      className={`block rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] ${colorBorder} p-4 transition-all duration-200 group`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.04] flex items-center justify-center shrink-0 ${iconColor}`}>
            <CalendarIcon iconKey={calendar.emoji} size={13} className={iconColor} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-zinc-300 group-hover:text-zinc-100 transition-colors truncate">
              {calendar.name}
            </p>
            {calendar.goal && (
              <p className="text-[10px] text-zinc-600 truncate mt-0.5">{calendar.goal}</p>
            )}
          </div>
        </div>
        {streak > 0 && (
          <div className={`flex items-center gap-1 shrink-0 ${colorText}`}>
            <Flame size={10} />
            <span className="text-[11px] font-semibold tabular-nums">{streak}</span>
          </div>
        )}
      </div>

      {/* Mini month dot grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} className="aspect-square" />
          const dateStr = toDateStr(year, month, day)
          const status = (entryMap[dateStr]?.status ?? '') as Status
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr
          const bg = isFuture ? 'bg-white/[0.03]' : STATUS_BG[status]
          return (
            <div
              key={dateStr}
              className={`aspect-square rounded-sm ${bg} ${isToday ? 'ring-1 ring-white/25' : ''} ${isFuture ? 'opacity-25' : ''}`}
            />
          )
        })}
      </div>

      <p className="text-[9px] text-zinc-700 mt-2 text-right">
        {now.toLocaleString('default', { month: 'long' })} {year}
      </p>
    </Link>
  )
}
