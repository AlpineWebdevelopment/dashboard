'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { movePageToFolder } from '@/lib/actions'
import { FolderOpen, FolderInput } from 'lucide-react'
import type { Page, Folder } from '@/lib/supabase'

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
  pages: Page[]
  folders: Folder[]
  folderId: string | null
}

export default function PagesList({ pages: initial, folders, folderId }: Props) {
  const [pages, setPages] = useState(initial)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [dragOverRoot, setDragOverRoot] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleDragStart(e: React.DragEvent, pageId: string) {
    e.dataTransfer.setData('pageId', pageId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault()
    const pageId = e.dataTransfer.getData('pageId')
    if (!pageId) return

    setDragOverFolderId(null)
    setDragOverRoot(false)

    // Optimistic update
    setPages((prev) => prev.filter((p) => p.id !== pageId))

    startTransition(async () => {
      await movePageToFolder(pageId, targetFolderId)
      router.refresh()
    })
  }

  // In folder view — move item back to root
  function handleMoveToRoot(pageId: string) {
    setPages((prev) => prev.filter((p) => p.id !== pageId))
    startTransition(async () => {
      await movePageToFolder(pageId, null)
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
                  href={`/pages?folder=${folder.id}`}
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

        {pages.length === 0 && folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
            <p className="text-sm text-zinc-500 mb-1">No pages yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-700">Hit "New Page" or drag pages here from the root</p>
          </div>
        ) : pages.length === 0 ? null : (
          <div className="space-y-1.5">
            {pages.map((page, i) => (
              <div
                key={page.id}
                draggable
                onDragStart={(e) => handleDragStart(e, page.id)}
                className="group/row relative"
              >
                <Link
                  href={`/pages/${page.id}`}
                  className="group relative flex items-center justify-between px-5 py-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09] transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing"
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-sky-400/60 transition-all duration-200" />
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-700 tabular-nums w-5 text-right shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                        {page.title || 'Untitled'}
                      </p>
                      {page.content ? (
                        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5 truncate">
                          {page.content.slice(0, 72) + (page.content.length > 72 ? '…' : '')}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-400 dark:text-zinc-700 mt-0.5 italic">Empty</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 ml-6 tabular-nums">
                    created {timeAgo(page.created_at)}
                  </span>
                </Link>
                <button
                  onClick={() => handleMoveToRoot(page.id)}
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
                  href={`/pages?folder=${folder.id}`}
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

      {/* Pages */}
      {folders.length > 0 && pages.length > 0 && (
        <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">
          Pages
        </p>
      )}

      {pages.length === 0 && folders.length === 0 ? null : pages.length === 0 ? null : (
        <div className="space-y-1.5">
          {pages.map((page, i) => (
            <div
              key={page.id}
              draggable
              onDragStart={(e) => handleDragStart(e, page.id)}
            >
              <Link
                href={`/pages/${page.id}`}
                className="group relative flex items-center justify-between px-5 py-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09] transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing"
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-sky-400/60 transition-all duration-200" />
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-700 tabular-nums w-5 text-right shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                      {page.title || 'Untitled'}
                    </p>
                    {page.content ? (
                      <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5 truncate">
                        {page.content.slice(0, 72) + (page.content.length > 72 ? '…' : '')}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-400 dark:text-zinc-700 mt-0.5 italic">Empty</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-6">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors tabular-nums block">{timeAgo(page.updated_at)}</span>
                  <span className="text-[10px] text-zinc-300 dark:text-zinc-800 tabular-nums block mt-0.5">created {timeAgo(page.created_at)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
