'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { savePage, deletePage } from '@/lib/actions'
import { Save, Trash2, Check, Loader2 } from 'lucide-react'
import type { Page } from '@/lib/supabase'

export default function PageEditor({ page }: { page: Page }) {
  const [title, setTitle] = useState(page.title)
  const [content, setContent] = useState(page.content)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleting] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  function handleSave() {
    startTransition(async () => {
      await savePage(page.id, title, content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleDelete() {
    if (!confirm('Delete this page? This cannot be undone.')) return
    startDeleting(async () => {
      await deletePage(page.id)
    })
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount = content.length

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto px-8 py-10">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span>{wordCount} words</span>
          <span className="text-zinc-800">·</span>
          <span>{charCount} chars</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              saved
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <Save size={13} />
            )}
            {isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && textareaRef.current?.focus()}
        placeholder="Untitled"
        className="w-full bg-transparent text-3xl font-bold text-zinc-100 placeholder-zinc-700 outline-none mb-6 tracking-tight"
      />

      {/* Divider */}
      <div className="h-px bg-white/[0.06] mb-8" />

      {/* Content */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing…"
        className="w-full flex-1 bg-transparent text-[15px] leading-8 text-zinc-300 placeholder-zinc-700 outline-none resize-none min-h-[60vh]"
      />
    </div>
  )
}
