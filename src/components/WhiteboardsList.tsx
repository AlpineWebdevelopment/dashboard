'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteWhiteboard, duplicateWhiteboard } from '@/lib/actions'
import { PenTool, Clock, Copy, Trash2 } from 'lucide-react'
import type { Whiteboard } from '@/lib/supabase'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function WhiteboardsList({ boards: initial }: { boards: Whiteboard[] }) {
  const [boards, setBoards] = useState(initial)
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleDuplicate(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      await duplicateWhiteboard(id)
      router.refresh()
    })
  }

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setBoards((prev) => prev.filter((b) => b.id !== id))
    startTransition(async () => {
      await deleteWhiteboard(id)
      router.refresh()
    })
  }

  if (boards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 sm:py-28 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
        <div className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center mb-4">
          <PenTool size={16} className="text-zinc-400 dark:text-zinc-600" />
        </div>
        <p className="text-sm text-zinc-500 mb-1">No whiteboards yet</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-700">Hit &quot;New Whiteboard&quot; to start drawing</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {boards.map((board) => (
        <div key={board.id} className="group/card relative">
          <Link
            href={`/whiteboards/${board.id}`}
            className="group flex flex-col gap-3 p-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-fuchsia-500/20 hover:bg-fuchsia-500/[0.02] transition-all duration-200 overflow-hidden"
          >
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

          {/* Hover action buttons */}
          <div className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 flex items-center gap-0.5 transition-opacity">
            <button
              onClick={(e) => handleDuplicate(e, board.id)}
              title="Duplicate"
              className="flex items-center justify-center w-7 h-7 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-400 dark:text-zinc-600 hover:text-sky-500 dark:hover:text-sky-400 hover:border-sky-200 dark:hover:border-sky-500/20 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={(e) => handleDelete(e, board.id, board.name)}
              title="Delete"
              className="flex items-center justify-center w-7 h-7 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
