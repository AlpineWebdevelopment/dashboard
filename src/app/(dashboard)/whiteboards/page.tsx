export const dynamic = 'force-dynamic'

import { getWhiteboards } from '@/lib/actions'
import NewWhiteboardButton from '@/components/NewWhiteboardButton'
import Link from 'next/link'
import { PenTool, Clock } from 'lucide-react'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default async function WhiteboardsPage() {
  const boards = await getWhiteboards()

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        <div className="flex items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2 sm:mb-3">
              Creative
            </p>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
              Whiteboards
            </h1>
          </div>
          <div className="shrink-0">
            <NewWhiteboardButton />
          </div>
        </div>

        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
            <div className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center mb-4">
              <PenTool size={16} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-1">No whiteboards yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-700">Hit "New Whiteboard" to start drawing</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {boards.map((board, i) => (
              <Link
                key={board.id}
                href={`/whiteboards/${board.id}`}
                className="group relative flex flex-col gap-3 p-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-fuchsia-500/20 hover:bg-fuchsia-500/[0.02] transition-all duration-200 overflow-hidden"
              >
                {/* Preview area */}
                <div className="w-full h-24 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] flex items-center justify-center overflow-hidden">
                  <PenTool size={20} className="text-zinc-200 dark:text-zinc-800 group-hover:text-fuchsia-300/40 transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                    {board.name}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={10} className="text-zinc-400 dark:text-zinc-700" />
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-700 tabular-nums">
                      {timeAgo(board.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-fuchsia-400/0 group-hover:bg-fuchsia-400/50 transition-colors rounded-r-full" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
