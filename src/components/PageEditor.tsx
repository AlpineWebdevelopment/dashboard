'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { savePage, deletePage } from '@/lib/actions'
import { Check, Loader2, Trash2 } from 'lucide-react'
import type { Page } from '@/lib/supabase'

export default function PageEditor({ page }: { page: Page }) {
  const [title, setTitle] = useState(page.title)
  const [content, setContent] = useState(page.content)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isDeleting, startDeleting] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef({ title, content })

  useEffect(() => {
    latestRef.current = { title, content }
  }, [title, content])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  function triggerSave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveStatus('idle')
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      const { title: t, content: c } = latestRef.current
      await savePage(page.id, t, c)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value)
    triggerSave()
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    triggerSave()
  }

  function handleDelete() {
    if (!confirm('Delete this page? This cannot be undone.')) return
    startDeleting(async () => { await deletePage(page.id) })
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-8 sm:mb-10 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] text-zinc-700 tabular-nums">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span className="text-zinc-800">·</span>
          <span>{content.length} chars</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-save indicator */}
          <span className="flex items-center gap-1 text-[11px] h-4 transition-opacity">
            {saveStatus === 'saving' && <><Loader2 size={10} className="animate-spin text-zinc-600" /><span className="text-zinc-600">Saving…</span></>}
            {saveStatus === 'saved'  && <><Check size={10} className="text-emerald-500" /><span className="text-emerald-500">Saved</span></>}
          </span>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-150"
          >
            <Trash2 size={12} />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        onKeyDown={(e) => e.key === 'Enter' && textareaRef.current?.focus()}
        placeholder="Untitled"
        className="w-full bg-transparent text-2xl sm:text-[28px] font-semibold text-zinc-100 placeholder-zinc-800 outline-none mb-6 sm:mb-8 tracking-tight leading-tight"
      />

      <div className="h-px bg-gradient-to-r from-white/[0.07] via-white/[0.04] to-transparent mb-6 sm:mb-8" />

      {/* Body */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleContentChange}
        placeholder="Start writing…"
        className="w-full flex-1 bg-transparent text-[15px] leading-[1.8] text-zinc-400 placeholder-zinc-800 outline-none resize-none min-h-[50vh]"
      />
    </div>
  )
}
