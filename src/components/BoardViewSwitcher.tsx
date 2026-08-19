'use client'

// The three shapes of the tasks board, and whether finished cards show.
//
// A new file rather than a ninth component inside the board's own 2000 lines.
// It owns no state: the board holds `view` and `showDone` because it renders
// from them, and this only reports the click.

import { Columns3, Grid2x2, Signpost, Eye, EyeOff } from 'lucide-react'
import { BOARD_VIEWS, BOARD_VIEW_LABELS, BOARD_VIEW_HINTS, type BoardView } from '@/lib/task-views'

const VIEW_ICONS: Record<BoardView, typeof Columns3> = {
  lists: Columns3,
  matrix: Grid2x2,
  stages: Signpost,
}

export default function BoardViewSwitcher({
  view,
  showDone,
  onChangeView,
  onToggleShowDone,
}: {
  view: BoardView
  showDone: boolean
  onChangeView: (view: BoardView) => void
  onToggleShowDone: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-100/60 dark:bg-white/[0.04] p-0.5">
        {BOARD_VIEWS.map((key) => {
          const Icon = VIEW_ICONS[key]
          return (
            <button
              key={key}
              onClick={() => onChangeView(key)}
              aria-pressed={view === key}
              title={BOARD_VIEW_HINTS[key]}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                view === key
                  ? 'bg-white dark:bg-white/[0.10] text-zinc-800 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{BOARD_VIEW_LABELS[key]}</span>
            </button>
          )
        })}
      </div>

      {/* Only outside the lists view. There, Done is a column with its own
          collapse control, and two controls for one idea is worse than one. */}
      {view !== 'lists' && (
        <button
          onClick={onToggleShowDone}
          aria-pressed={showDone}
          title={showDone ? 'Hide finished cards' : 'Show finished cards'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[13px] transition-colors ${
            showDone
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
              : 'border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
          }`}
        >
          {showDone ? <Eye size={13} /> : <EyeOff size={13} />}
          <span className="hidden sm:inline">Done</span>
        </button>
      )}
    </div>
  )
}
