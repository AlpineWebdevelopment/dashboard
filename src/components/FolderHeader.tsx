'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { renameFolder, deleteFolder } from '@/lib/actions'
import { Trash2, Check, Loader2 } from 'lucide-react'
import type { Folder } from '@/lib/supabase'

export default function FolderHeader({ folder }: { folder: Folder }) {
  const [name, setName] = useState(folder.name)
  const [saved, setSaved] = useState(false)
  const [isRenaming, startRename] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const router = useRouter()

  function handleBlur() {
    if (name === folder.name) return
    startRename(async () => {
      await renameFolder(folder.id, name, folder.type)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleDelete() {
    if (!confirm('Delete this folder? Its contents will be moved back to the root.')) return
    startDelete(async () => {
      await deleteFolder(folder.id, folder.type)
    })
  }

  return (
    <div className="flex items-start justify-between mb-8">
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="w-full bg-transparent text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-800 outline-none tracking-tight leading-tight"
        />
        {saved && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1">
            <Check size={10} /> Renamed
          </span>
        )}
        {isRenaming && (
          <span className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">
            <Loader2 size={10} className="animate-spin" /> Saving…
          </span>
        )}
      </div>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 dark:text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-all mt-1"
      >
        {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        Delete folder
      </button>
    </div>
  )
}
