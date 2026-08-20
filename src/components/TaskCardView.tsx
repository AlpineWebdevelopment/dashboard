'use client'

// The visual body of a task card, shared by the Tasks board and the Events
// calendar so a card looks the same wherever it turns up. The board wraps this
// with drag handlers and an action row (passed as `children`); the calendar
// renders it read-only.

import { useSyncExternalStore } from 'react'
import type { Task } from '@/lib/supabase'
import { PERSON_COLORS } from '@/lib/people'
import { PROJECT_COLORS } from './ProjectBar'
import { Calendar, Flag, Folder, User } from 'lucide-react'

// Priority drives the card's background/theme.
export const PRIORITY_THEMES: Record<Task['priority'], { bg: string; border: string }> = {
  none:   { bg: 'bg-white dark:bg-[#13131e]',              border: 'border-zinc-200 dark:border-white/[0.07]' },
  low:    { bg: 'bg-sky-500/[0.07] dark:bg-sky-500/[0.09]', border: 'border-sky-500/25 dark:border-sky-400/25' },
  medium: { bg: 'bg-amber-400/[0.12] dark:bg-amber-400/[0.09]', border: 'border-amber-500/30 dark:border-amber-400/25' },
  high:   { bg: 'bg-rose-500/[0.09] dark:bg-rose-500/[0.12]', border: 'border-rose-500/35 dark:border-rose-400/30' },
}

export const PRIORITY_LABELS: Record<Task['priority'], string> = {
  none: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

// The colour picker paints the card's top accent line; the background is the
// priority's job (PRIORITY_THEMES).
export const CARD_STRIPS: Record<string, string> = {
  '':       '',
  red:      'bg-rose-400',
  orange:   'bg-orange-400',
  yellow:   'bg-amber-400',
  green:    'bg-emerald-400',
  blue:     'bg-sky-400',
  purple:   'bg-violet-400',
  pink:     'bg-pink-400',
}

// Priority colour washed over a frosted card. Alpha lives in
// --card-prio-alpha, which is 0 until a background image is set, so cards look
// untouched without one. Shades mirror PRIORITY_THEMES.
export const PRIORITY_TINTS: Record<Task['priority'], string> = {
  none:   '',
  low:    'rgb(56 189 248 / var(--card-prio-alpha))',
  medium: 'rgb(251 191 36 / var(--card-prio-alpha))',
  high:   'rgb(244 63 94 / var(--card-prio-alpha))',
}

export function formatDate(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function isOverdue(d: string | null) {
  if (!d) return false
  return new Date(d) < new Date(new Date().toDateString())
}

/**
 * `YYYY-MM-DD` in the *local* timezone. `toISOString()` converts to UTC first,
 * which lands on the wrong day for anyone east or west of it late in the day —
 * exactly the bug you'd hit assigning a task to "today" at 11pm.
 */
export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** `key` moved by `days`, staying in local time. Pure — safe during render. */
export function shiftDateKey(key: string, days: number) {
  const d = new Date(`${key}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

// "Today" is both impure and client-only: reading the clock during render is
// what the React compiler objects to, and the server (UTC) would answer with a
// different day than the browser either side of midnight. useSyncExternalStore
// returns null on the server and the real day on the client, with no effect and
// no cascading render. The value never changes within a session, so subscribing
// is a no-op.
const NEVER_CHANGES = () => () => {}
const clientToday = () => toDateKey(new Date())
const serverToday = () => null

/** Today as `YYYY-MM-DD`, or null while rendering on the server. */
export function useToday() {
  return useSyncExternalStore(NEVER_CHANGES, clientToday, serverToday)
}

type Props = {
  task: Task
  /** Structural, not the full row — the board passes a name/colour pair. */
  project?: { name: string; color: string } | null
  assignee?: { name: string; color: string } | null
  isArchived?: boolean
  isDragging?: boolean
  isSelected?: boolean
  /** Board cards are grabbable; calendar cards are not. */
  interactive?: boolean
  /** Tighter type and no description — for the month grid's short cells. */
  compact?: boolean
  /** Hide the due-date chip where the date is already implied (calendar). */
  hideDue?: boolean
  /** The board's bottom action row. */
  children?: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>

export default function TaskCardView({
  task,
  project,
  assignee,
  isArchived = false,
  isDragging = false,
  isSelected = false,
  interactive = false,
  compact = false,
  hideDue = false,
  children,
  className = '',
  style,
  ...rest
}: Props) {
  const overdue = isOverdue(task.due_date)

  // Archived work is done deliberating — it drops its priority tint and sits
  // back until you hover it.
  const effectivePriority = isArchived ? 'none' : task.priority
  const theme = PRIORITY_THEMES[effectivePriority]
  // `!!` also covers rows loaded before `tasks.ongoing` existed, where the field
  // comes back undefined rather than false.
  const ongoing = !!task.ongoing
  // `|| ''` also covers rows loaded before `tasks.color` existed.
  const colorKey = task.color || ''
  const strip = CARD_STRIPS[colorKey] ?? ''

  // Only meaningful once a background image is set — the alpha is 0 until then.
  const tintVars = (
    PRIORITY_TINTS[effectivePriority]
      ? { '--card-priority': PRIORITY_TINTS[effectivePriority] }
      : {}
  ) as React.CSSProperties

  const showDue = task.due_date && !hideDue
  const showMeta = showDue || task.priority !== 'none' || project || assignee

  /**
   * One border declaration, never two.
   *
   * Emitting the theme's colour *and* an ongoing colour leaves which of them
   * wins to the order Tailwind happens to write them in — same class of trap as
   * the group-hover one in STYLING.md. So the ongoing edge replaces the theme's
   * outright rather than layering on top of it.
   *
   * It is `border-2`, not `border`: at one pixel the dots are too small to read
   * as dots, and against `dark:border-white/[0.07]` they were invisible.
   */
  const edge =
    ongoing && !isArchived
      ? 'border-2 border-dotted border-amber-500/70 dark:border-amber-300/60'
      : `border ${theme.border}`

  return (
    <div
      {...rest}
      style={{ ...tintVars, ...style }}
      className={`group relative panel-card rounded-xl transition-all duration-150 overflow-hidden select-none ${theme.bg} ${edge} ${
        interactive ? 'cursor-grab active:cursor-grabbing' : ''
      } ${
        isDragging
          ? 'opacity-40 shadow-lg shadow-indigo-500/10'
          : 'hover:brightness-95 dark:hover:brightness-110 shadow-sm'
      } ${isArchived && !isDragging ? 'opacity-60 hover:opacity-100' : ''} ${
        // In flight: a paler card, so it reads as unsettled beside the solid
        // ones. Hover restores it — pale is for scanning the column, not for
        // making the card hard to read.
        ongoing && !isArchived && !isDragging ? 'opacity-75 hover:opacity-100' : ''
      } ${isSelected ? 'ring-2 ring-indigo-500/60' : ''} ${className}`}
    >
      {/* Colour strip */}
      {strip && <div className={`h-1 w-full ${strip}`} />}

      <div className={compact ? 'px-2.5 py-2' : 'px-3.5 py-3'}>
        <p className={`${compact ? 'text-[12px]' : 'text-sm'} transition-colors leading-snug group-hover:text-zinc-900 dark:group-hover:text-white ${
          isArchived ? 'text-zinc-500 dark:text-zinc-200 line-through decoration-zinc-400/50 dark:decoration-zinc-600' : 'text-zinc-700 dark:text-zinc-100'
        }`}>
          {task.title}
        </p>

        {task.description && !compact && (
          <p className="text-[12px] leading-snug text-zinc-500 dark:text-zinc-200 mt-1 line-clamp-2 whitespace-pre-line">
            {task.description}
          </p>
        )}

        {/* Meta row */}
        {showMeta && (
          <div className={`flex items-center gap-2 ${compact ? 'mt-1.5' : 'mt-2.5'} flex-wrap`}>
            {project && (
              <span className="flex items-center gap-1 text-[12px] font-medium px-1.5 py-0.5 rounded-md panel bg-zinc-100 dark:bg-white/[0.05] text-zinc-500 max-w-full dark:text-zinc-200">
                <Folder size={9} className={`shrink-0 ${PROJECT_COLORS[project.color]?.icon ?? ''}`} />
                <span className="truncate">{project.name}</span>
              </span>
            )}
            {assignee && (
              // text-shadow-none: the wallpaper shadow body sets is meant for
              // text sitting straight on the photo — on a small saturated chip
              // it just smears the name.
              <span className={`flex items-center gap-1 text-[12px] font-medium px-1.5 py-0.5 rounded-md max-w-full text-shadow-none ${
                PERSON_COLORS[assignee.color]?.chip ?? PERSON_COLORS.indigo.chip
              }`}>
                <User size={9} className="shrink-0" />
                <span className="truncate">{assignee.name}</span>
              </span>
            )}
            {showDue && (
              <span
                className={`flex items-center gap-1 text-[12px] font-medium px-1.5 py-0.5 rounded-md ${
                  overdue
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'panel bg-zinc-100 dark:bg-white/[0.05] text-zinc-500 dark:text-zinc-200'
                }`}
              >
                <Calendar size={9} />
                {formatDate(task.due_date)}
              </span>
            )}
            {task.priority !== 'none' && (
              <span
                className={`flex items-center gap-1 text-[12px] font-medium px-1.5 py-0.5 rounded-md ${
                  task.priority === 'high'
                    ? 'bg-rose-500/15 text-rose-400'
                    : task.priority === 'medium'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-sky-500/15 text-sky-400'
                }`}
              >
                <Flag size={9} />
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
