'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { moveTableToFolder } from '@/lib/actions'
import { FolderOpen, FolderInput } from 'lucide-react'
import type { Spreadsheet, Folder } from '@/lib/supabase'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

type Props = {
  sheets: Spreadsheet[]
  folders: Folder[]
  folderId: string | null
}

export default function TablesList({ sheets: initial, folders, folderId }: Props) {
  const [sheets, setSheets] = useState(initial)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleDragStart(e: React.DragEvent, tableId: string) {
    e.dataTransfer.setData('tableId', tableId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault()
    const tableId = e.dataTransfer.getData('tableId')
    if (!tableId) return

    setDragOverFolderId(null)

    setSheets((prev) => prev.filter((s) => s.id !== tableId))

    startTransition(async () => {
      await moveTableToFolder(tableId, targetFolderId)
      router.refresh()
    })
  }

  function handleMoveToRoot(tableId: string) {
    setSheets((prev) => prev.filter((s) => s.id !== tableId))
    startTransition(async () => {
      await moveTableToFolder(tableId, null)
      router.refresh()
    })
  }

  if (folderId) {
    // ── Folder view ──────────────────────────────────────────────────────────
    return (
      <>
        {/* Subfolders */}
        {folders.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">Folders</p>
            <div className="space-y-1.5">
              {folders.map((folder) => (
                <Link
                  key={folder.id}
                  href={`/tables?folder=${folder.id}`}
                  className="group relative flex items-center gap-4 px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09] transition-all duration-200 overflow-hidden"
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-6 rounded-r-full bg-amber-400/50 transition-all duration-200" />
                  <FolderOpen size={14} className="shrink-0 text-zinc-400 dark:text-zinc-600 group-hover:text-amber-400/70 transition-colors" />
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors truncate">{folder.name}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {sheets.length === 0 && folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
            <p className="text-sm text-zinc-500 mb-1">No tables yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-700">Hit "New Table" or drag tables here from the root</p>
          </div>
        ) : sheets.length === 0 ? null : (
          <div className="space-y-1.5">
            {sheets.map((sheet, i) => (
              <div
                key={sheet.id}
                draggable
                onDragStart={(e) => handleDragStart(e, sheet.id)}
                className="group/row relative"
              >
                <Link
                  href={`/tables/${sheet.id}`}
                  className="group relative flex items-center justify-between px-5 py-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09] transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing"
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-emerald-400/60 transition-all duration-200" />
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-700 tabular-nums w-5 text-right shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                        {sheet.name || 'Untitled Table'}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
                        {sheet.columns.length} col{sheet.columns.length !== 1 ? 's' : ''} ·{' '}
                        {sheet.rows.length} row{sheet.rows.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 ml-6 tabular-nums">
                    created {timeAgo(sheet.created_at)}
                  </span>
                </Link>
                <button
                  onClick={() => handleMoveToRoot(sheet.id)}
                  title="Move to root"
                  className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all"
                >
                  <FolderInput size={10} />
                  Move out
                </button>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  // ── Root view ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Folders */}
      {folders.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">
            Folders
          </p>
          <div className="space-y-1.5">
            {folders.map((folder) => (
              <div
                key={folder.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id) }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                <Link
                  href={`/tables?folder=${folder.id}`}
                  className={`group relative flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-all duration-200 overflow-hidden ${
                    dragOverFolderId === folder.id
                      ? 'border-amber-400/40 bg-amber-400/[0.06] scale-[1.01]'
                      : 'border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09]'
                  }`}
                >
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-amber-400/50 transition-all duration-200 ${dragOverFolderId === folder.id ? 'h-6' : 'h-0 group-hover:h-6'}`} />
                  <FolderOpen
                    size={14}
                    className={`shrink-0 transition-colors ${dragOverFolderId === folder.id ? 'text-amber-400/80' : 'text-zinc-400 dark:text-zinc-600 group-hover:text-amber-400/70'}`}
                  />
                  <p className={`text-sm font-medium transition-colors truncate ${dragOverFolderId === folder.id ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200'}`}>
                    {folder.name}
                  </p>
                  {dragOverFolderId === folder.id && (
                    <span className="ml-auto text-[10px] text-amber-400/70 shrink-0">Drop to move</span>
                  )}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables */}
      {folders.length > 0 && sheets.length > 0 && (
        <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">
          Tables
        </p>
      )}

      {sheets.length > 0 && (
        <div className="space-y-1.5">
          {sheets.map((sheet, i) => (
            <div
              key={sheet.id}
              draggable
              onDragStart={(e) => handleDragStart(e, sheet.id)}
            >
              <Link
                href={`/tables/${sheet.id}`}
                className="group relative flex items-center justify-between px-5 py-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09] transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing"
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-emerald-400/60 transition-all duration-200" />
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-700 tabular-nums w-5 text-right shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                      {sheet.name || 'Untitled Table'}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
                      {sheet.columns.length} col{sheet.columns.length !== 1 ? 's' : ''} ·{' '}
                      {sheet.rows.length} row{sheet.rows.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 ml-6 tabular-nums">
                  {timeAgo(sheet.updated_at)}
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
