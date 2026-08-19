'use client'

// "Who is this for?" — asked at the point a card is dropped into the Assigned
// column of the stage view.
//
// A stage is derived from the fields a task already carries, so there is no
// `stage` column to write: landing in Assigned *means* having an owner, and an
// owner is a choice only the person dragging can make. The drop therefore opens
// this rather than guessing, and nothing is written until a name is picked —
// which is why dismissing it needs no rollback. The card never moved.
//
// Deliberately not PersonPickerModal: that one is the board's *filter* picker
// and can create, recolour and delete people. Offering three destructive
// operations in response to a drag would be a trap. This only assigns.
//
// Anchored at the drop point and shaped like SchedulePopover, since the two are
// the same gesture answered two different ways.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { UserRound, UserX } from 'lucide-react'
import type { Person } from '@/lib/supabase'
import { PERSON_COLORS, resolvePersonColor } from '@/lib/people'

const WIDTH = 236
// Positioning is done from this estimate rather than by measuring after paint:
// measuring means setState inside an effect, and a short list of people is a
// predictable shape, so the guess is never far off.
const EST_HEIGHT = 260
const MARGIN = 8

export default function AssignPopover({
  anchor,
  people,
  current,
  label,
  onPick,
  onClose,
}: {
  anchor: { x: number; y: number }
  people: Person[]
  /** Who it belongs to now, or null when nobody. */
  current: string | null
  /** Card title, shown so you can tell which one you dropped. */
  label: string
  onPick: (personId: string | null) => void
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

  // Keep it on screen when the drop lands near an edge.
  const left = Math.max(MARGIN, Math.min(anchor.x, window.innerWidth - WIDTH - MARGIN))
  const top = Math.max(MARGIN, Math.min(anchor.y, window.innerHeight - EST_HEIGHT - MARGIN))

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, width: WIDTH }}
      className="z-[120] rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#17171f] shadow-xl p-3"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <UserRound size={12} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
        <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
          Assign to
        </p>
      </div>
      <p className="text-[12px] text-zinc-500 dark:text-zinc-200 truncate mb-2.5" title={label}>
        {label}
      </p>

      {people.length === 0 ? (
        <p className="text-[13px] text-zinc-500 dark:text-zinc-200 italic py-1">
          No people yet — add someone via the person button above the board.
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto -mx-1 px-1 space-y-1">
          {people.map((p, i) => {
            const color = PERSON_COLORS[resolvePersonColor(p, i)]
            return (
              <button
                key={p.id}
                onClick={() => onPick(p.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
                  current === p.id
                    ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                    : 'border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${color?.swatch ?? 'bg-zinc-400'}`} />
                <span className="truncate">{p.name}</span>
              </button>
            )
          })}
        </div>
      )}

      {current && (
        <button
          onClick={() => onPick(null)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08] hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all"
        >
          <UserX size={12} />
          Unassign
        </button>
      )}
    </div>,
    document.body
  )
}
