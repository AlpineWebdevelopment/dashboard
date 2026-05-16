import Link from 'next/link'
import type { Calendar, CalendarEntry } from '@/lib/supabase'
import { CalendarIcon, ICON_DEFS, isIconKey } from '@/lib/calendarIcons'
import { CalendarDays, Flame } from 'lucide-react'

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

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Use status if available, fall back to completed boolean for pre-migration data
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
  const todayDay = now.getDate()

  const entryMap: Record<string, CalendarEntry> = {}
  for (const e of entries) entryMap[e.date] = e

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = toDateStr(year, month, todayDay)
  const streak = getStreak(entries)
  const colorText = COLOR_TEXT[calendar.color] ?? 'text-zinc-400'
  const colorBg = COLOR_BG[calendar.color] ?? 'bg-zinc-500'
  const colorBorder = COLOR_BORDER[calendar.color] ?? ''

  // Count statuses for this month
  const pastDays = Math.min(todayDay, daysInMonth)
  let greenCount = 0, yellowCount = 0, redCount = 0, emptyCount = 0
  for (let d = 1; d <= pastDays; d++) {
    const ds = toDateStr(year, month, d)
    const s = resolveStatus(entryMap[ds])
    if (s === 'green') greenCount++
    else if (s === 'yellow') yellowCount++
    else if (s === 'red') redCount++
    else emptyCount++
  }
  const greenPct = pastDays > 0 ? Math.round((greenCount / pastDays) * 100) : 0

  const hasValidIcon = isIconKey(calendar.emoji)
  const iconColor = hasValidIcon ? ICON_DEFS[calendar.emoji as keyof typeof ICON_DEFS].color : colorText

  return (
    <Link
      href={`/calendars/${calendar.id}`}
      className={`flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] ${colorBorder} p-4 transition-all duration-200 group`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center shrink-0 ${iconColor}`}>
            {hasValidIcon
              ? <CalendarIcon iconKey={calendar.emoji} size={15} className={iconColor} />
              : <CalendarDays size={15} className={colorText} />
            }
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
              {calendar.name}
            </p>
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

      {/* Month dot grid */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {cells.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} className="aspect-square" />
          const dateStr = toDateStr(year, month, day)
          const status = resolveStatus(entryMap[dateStr])
          const isToday = dateStr === todayStr
          const isFuture = dateStr > todayStr
          const hasBg = STATUS_BG[status]

          return (
            <div
              key={dateStr}
              className={`
                aspect-square rounded-md flex items-center justify-center
                ${isFuture ? 'opacity-20' : ''}
                ${hasBg ? STATUS_BG[status] : 'bg-white/[0.05]'}
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
    </Link>
  )
}
