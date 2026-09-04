'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Check, Loader2, Trash2, ClipboardCopy, ClipboardCheck } from 'lucide-react'
import { savePrompt, deletePrompt } from '@/lib/actions'
import type { Prompt } from '@/lib/supabase'

type Props = { prompt: Prompt }

export default function PromptEditor({ prompt }: Props) {
  const [title, setTitle] = useState(prompt.title)
  const [content, setContent] = useState(prompt.content)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [copied, setCopied] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstChange = useRef(true)

  const triggerSave = useCallback(
    (nextTitle: string, nextContent: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(async () => {
        await savePrompt(prompt.id, nextTitle || 'Untitled Prompt', nextContent)
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2000)
      }, 1000)
    },
    [prompt.id]
  )

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setTitle(val)
    if (isFirstChange.current) { isFirstChange.current = false }
    triggerSave(val, content)
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)
    if (isFirstChange.current) { isFirstChange.current = false }
    triggerSave(title, val)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${title || 'Untitled Prompt'}"? This cannot be undone.`)) return
    await deletePrompt(prompt.id)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-11 md:top-0 z-10 flex items-center gap-3 px-4 sm:px-8 h-11 border-b border-zinc-200 dark:border-white/[0.06] bg-white/95 dark:bg-[rgba(7,7,15,0.9)] backdrop-blur-xl shrink-0">
        <Link
          href="/prompts"
          className="flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors shrink-0"
        >
          <ChevronLeft size={13} />
          Prompts
        </Link>

        <div className="w-px h-4 panel bg-zinc-200 dark:bg-white/[0.07] shrink-0" />

        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          placeholder="Untitled Prompt"
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-zinc-800 dark:text-white outline-none placeholder-zinc-500 dark:placeholder-zinc-400 truncate"
        />

        <div className="flex items-center gap-2 shrink-0">
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-200">
              <Loader2 size={10} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-[12px] text-emerald-400">
              <Check size={10} /> Saved
            </span>
          )}
          <button
            onClick={handleCopy}
            title="Copy prompt to clipboard"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 border border-orange-200 dark:border-orange-500/20 transition-all"
          >
            {copied ? <ClipboardCheck size={11} className="text-emerald-500" /> : <ClipboardCopy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDelete}
            title="Delete prompt"
            className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 px-4 sm:px-8 py-6 max-w-3xl w-full mx-auto">
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Write your prompt here…"
          className="w-full min-h-[calc(100vh-8rem)] bg-transparent text-sm text-zinc-700 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 outline-none resize-none leading-relaxed font-mono"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
