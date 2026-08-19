'use client'

// The "add to calendar" menu for a single card.
//
// Opened by right-clicking a card on the board — which is also what a long
// press fires on touch, so the same menu serves phones without a separate
// gesture. Picking a day writes the task's due date, which is what the Events
// calendar reads, so the card turns up there straight away.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CalendarPlus, CalendarX2 } from 'lucide-react'
import { shiftDateKey, useToday } from './TaskCardView'

const WIDTH = 236
// Positioning is done from this estimate rather than by measuring after paint:
// measuring means setState inside an effect, and the content here is a fixed
// shape, so the guess is never far off.
const EST_HEIGHT = 250
const MARGIN = 8

export default function SchedulePopover({
  anchor,
  current,
  label,
  onPick,
  onClear,
  onClose,
}: {
  anchor: { x: number; y: number }
  /** The day it currently sits on, or null when it isn't on the calendar. */
  current: string | null
  /** Card title, shown so you can tell which one you right-clicked. */
  label: string
  onPick: (date: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Never null in practice — this only renders in response to a click — but the
  // hook is honest about the server case, so fall back rather than assert.
  const today = useToday() ?? ''
  const tomorrow = today ? shiftDateKey(today, 1) : ''

  // Keep it on screen when you right-click near an edge.
  const left = Math.max(MARGIN, Math.min(anchor.x, window.innerWidth - WIDTH - MARGIN))
  const top = Math.max(MARGIN, Math.min(anchor.y, window.innerHeight - EST_HEIGHT - MARGIN))

  const quick = [
    { key: today, text: 'Today' },
    { key: tomorrow, text: 'Tomorrow' },
  ]

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, width: WIDTH }}
      className="z-[120] rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#17171f] shadow-xl p-3"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <CalendarPlus size={12} className="shrink-0 text-orange-500 dark:text-orange-400" />
        <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
          Add to calendar
        </p>
      </div>
      <p className="text-[12px] text-zinc-500 dark:text-zinc-200 truncate mb-2.5" title={label}>
        {label}
      </p>

      <div className="flex gap-1.5 mb-2">
        {quick.map((q) => (
          <button
            key={q.text}
            onClick={() => onPick(q.key)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
              current === q.key
                ? 'border-orange-500/50 bg-orange-500/15 text-orange-600 dark:text-orange-300'
                : 'border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {q.text}
          </button>
        ))}
      </div>

      <input
        type="date"
        // Defaults to the day it's already on, otherwise today — so the picker
        // opens on the right month instead of 1970.
        value={current ?? today}
        onChange={(e) => e.target.value && onPick(e.target.value)}
        aria-label="Pick another day"
        className="w-full min-w-0 panel bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.07] rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-700 dark:text-zinc-100 outline-none focus:border-orange-500/50 transition-colors dark:[color-scheme:dark]"
      />

      {current && (
        <button
          onClick={onClear}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08] hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all"
        >
          <CalendarX2 size={12} />
          Remove from calendar
        </button>
      )}
    </div>,
    document.body
  )
}
