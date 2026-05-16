'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { savePage, deletePage } from '@/lib/actions'
import { Check, Loader2, Trash2, Save } from 'lucide-react'
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
      setTimeout(() => setSaved(false), 2500)
    })
  }

  function handleDelete() {
    if (!confirm('Delete this page? This cannot be undone.')) return
    startDeleting(async () => {
      await deletePage(page.id)
    })
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-8 py-10">
      {/* Floating toolbar */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2 text-[11px] text-zinc-700 tabular-nums">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span className="text-zinc-800">·</span>
          <span>{content.length} chars</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-150"
          >
            <Trash2 size={12} />
            Delete
          </button>

          <button
            onClick={handleSave}
            disabled={isPending}
            className={`relative overflow-hidden flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              saved
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-white/[0.06] border border-white/[0.1] text-zinc-300 hover:bg-white/[0.09] hover:text-zinc-100'
            }`}
          >
            {isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <Check size={12} />
            ) : (
              <Save size={12} />
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
        className="w-full bg-transparent text-[28px] font-semibold text-zinc-100 placeholder-zinc-800 outline-none mb-8 tracking-tight leading-tight"
      />

      {/* Subtle divider */}
      <div className="h-px bg-gradient-to-r from-white/[0.07] via-white/[0.04] to-transparent mb-8" />

      {/* Body */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing…"
        className="w-full flex-1 bg-transparent text-[15px] leading-[1.8] text-zinc-400 placeholder-zinc-800 outline-none resize-none min-h-[60vh]"
      />
    </div>
  )
}
