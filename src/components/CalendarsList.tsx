'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { moveCalendarToFolder, deleteCalendar, deleteFolder, duplicateCalendar } from '@/lib/actions'
import { FolderOpen, FolderInput, Trash2, Copy } from 'lucide-react'
import type { Calendar, Folder } from '@/lib/supabase'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const COLOR_DOT: Record<string, string> = {
  rose:    'bg-rose-500',
  violet:  'bg-violet-500',
  sky:     'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  indigo:  'bg-indigo-500',
  orange:  'bg-orange-500',
}

const COLOR_HOVER: Record<string, string> = {
  rose:    'hover:border-rose-500/20 hover:bg-rose-500/[0.04]',
  violet:  'hover:border-violet-500/20 hover:bg-violet-500/[0.04]',
  sky:     'hover:border-sky-500/20 hover:bg-sky-500/[0.04]',
  emerald: 'hover:border-emerald-500/20 hover:bg-emerald-500/[0.04]',
  amber:   'hover:border-amber-500/20 hover:bg-amber-500/[0.04]',
  indigo:  'hover:border-indigo-500/20 hover:bg-indigo-500/[0.04]',
  orange:  'hover:border-orange-500/20 hover:bg-orange-500/[0.04]',
}

const COLOR_BAR: Record<string, string> = {
  rose:    'bg-rose-400/60',
  violet:  'bg-violet-400/60',
  sky:     'bg-sky-400/60',
  emerald: 'bg-emerald-400/60',
  amber:   'bg-amber-400/60',
  indigo:  'bg-indigo-400/60',
  orange:  'bg-orange-400/60',
}

type Props = {
  calendars: Calendar[]
  folders: Folder[]
  folderId: string | null
}

export default function CalendarsList({ calendars: initial, folders: initialFolders, folderId }: Props) {
  const [calendars, setCalendars] = useState(initial)
  const [folders, setFolders] = useState(initialFolders)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => { setFolders(initialFolders) }, [initialFolders])

  function handleDragStart(e: React.DragEvent, calendarId: string) {
    e.dataTransfer.setData('calendarId', calendarId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault()
    const calendarId = e.dataTransfer.getData('calendarId')
    if (!calendarId) return
    setDragOverFolderId(null)
    setCalendars((prev) => prev.filter((c) => c.id !== calendarId))
    startTransition(async () => {
      await moveCalendarToFolder(calendarId, targetFolderId)
      router.refresh()
    })
  }

  function handleMoveToRoot(calendarId: string) {
    setCalendars((prev) => prev.filter((c) => c.id !== calendarId))
    startTransition(async () => {
      await moveCalendarToFolder(calendarId, null)
      router.refresh()
    })
  }

  function handleDeleteCalendar(e: React.MouseEvent, calendarId: string, calendarName: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${calendarName}"? This cannot be undone.`)) return
    setCalendars((prev) => prev.filter((c) => c.id !== calendarId))
    startTransition(async () => {
      await deleteCalendar(calendarId)
      router.refresh()
    })
  }

  function handleDeleteFolder(e: React.MouseEvent, targetId: string, folderName: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete folder "${folderName}"? This cannot be undone.`)) return
    setFolders((prev) => prev.filter((f) => f.id !== targetId))
    startTransition(async () => {
      await deleteFolder(targetId, 'calendars')
      router.refresh()
    })
  }

  function handleDuplicateCalendar(e: React.MouseEvent, calendarId: string) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      await duplicateCalendar(calendarId)
      router.refresh()
    })
  }

  if (folderId) {
    return (
      <>
        {folders.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">Folders</p>
            <div className="space-y-1.5">
              {folders.map((folder) => (
                <div key={folder.id} className="group/row relative">
                  <Link
                    href={`/calendars?folder=${folder.id}`}
                    className="group relative flex items-center gap-4 px-5 py-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09] transition-all duration-200 overflow-hidden"
                  >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-6 rounded-r-full bg-amber-400/50 transition-all duration-200" />
                    <FolderOpen size={14} className="shrink-0 text-zinc-400 dark:text-zinc-600 group-hover:text-amber-400/70 transition-colors" />
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors truncate">{folder.name}</p>
                  </Link>
                  <button
                    onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
                    title="Delete folder"
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {calendars.length === 0 && folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
            <p className="text-sm text-zinc-500 mb-1">No calendars yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-700">Hit "New Calendar" or drag one here</p>
          </div>
        ) : calendars.length === 0 ? null : (
          <div className="space-y-1.5">
            {calendars.map((cal, i) => {
              const dot = COLOR_DOT[cal.color] ?? 'bg-rose-500'
              const bar = COLOR_BAR[cal.color] ?? 'bg-rose-400/60'
              const hover = COLOR_HOVER[cal.color] ?? COLOR_HOVER.rose
              return (
                <div
                  key={cal.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cal.id)}
                  className="group/row relative"
                >
                  <Link
                    href={`/calendars/${cal.id}`}
                    className={`group relative flex items-center justify-between px-5 py-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] ${hover} transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing`}
                  >
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full ${bar} transition-all duration-200`} />
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-700 tabular-nums w-5 text-right shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                          {cal.name}
                        </p>
                        {cal.goal && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5 truncate">{cal.goal}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-6">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors tabular-nums block">{timeAgo(cal.updated_at)}</span>
                      <span className="text-[10px] text-zinc-300 dark:text-zinc-800 tabular-nums block mt-0.5">created {timeAgo(cal.created_at)}</span>
                    </div>
                  </Link>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5">
                    <button
                      onClick={() => handleMoveToRoot(cal.id)}
                      title="Move to root"
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all"
                    >
                      <FolderInput size={10} />
                      Move out
                    </button>
                    <button
                      onClick={(e) => handleDuplicateCalendar(e, cal.id)}
                      title="Duplicate"
                      className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCalendar(e, cal.id, cal.name)}
                      title="Delete calendar"
                      className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {folders.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">Folders</p>
          <div className="space-y-1.5">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="group/row relative"
                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id) }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                <Link
                  href={`/calendars?folder=${folder.id}`}
                  className={`group relative flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-all duration-200 overflow-hidden ${
                    dragOverFolderId === folder.id
                      ? 'border-amber-400/40 bg-amber-400/[0.06] scale-[1.01]'
                      : 'border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09]'
                  }`}
                >
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full bg-amber-400/50 transition-all duration-200 ${dragOverFolderId === folder.id ? 'h-6' : 'h-0 group-hover:h-6'}`} />
                  <FolderOpen size={14} className={`shrink-0 transition-colors ${dragOverFolderId === folder.id ? 'text-amber-400/80' : 'text-zinc-400 dark:text-zinc-600 group-hover:text-amber-400/70'}`} />
                  <p className={`text-sm font-medium transition-colors truncate ${dragOverFolderId === folder.id ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200'}`}>
                    {folder.name}
                  </p>
                  {dragOverFolderId === folder.id && (
                    <span className="ml-auto text-[10px] text-amber-400/70 shrink-0">Drop to move</span>
                  )}
                </Link>
                <button
                  onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
                  title="Delete folder"
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {folders.length > 0 && calendars.length > 0 && (
        <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">Calendars</p>
      )}

      {calendars.length > 0 && (
        <div className="space-y-1.5">
          {calendars.map((cal, i) => {
            const dot = COLOR_DOT[cal.color] ?? 'bg-rose-500'
            const bar = COLOR_BAR[cal.color] ?? 'bg-rose-400/60'
            const hover = COLOR_HOVER[cal.color] ?? COLOR_HOVER.rose
            return (
              <div key={cal.id} draggable onDragStart={(e) => handleDragStart(e, cal.id)} className="group/row relative">
                <Link
                  href={`/calendars/${cal.id}`}
                  className={`group relative flex items-center justify-between px-5 py-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] ${hover} transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing`}
                >
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full ${bar} transition-all duration-200`} />
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-700 tabular-nums w-5 text-right shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                        {cal.name}
                      </p>
                      {cal.goal && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5 truncate">{cal.goal}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 ml-6 tabular-nums">
                    created {timeAgo(cal.created_at)}
                  </span>
                </Link>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5">
                  <button
                    onClick={(e) => handleDuplicateCalendar(e, cal.id)}
                    title="Duplicate"
                    className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteCalendar(e, cal.id, cal.name)}
                    title="Delete calendar"
                    className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
