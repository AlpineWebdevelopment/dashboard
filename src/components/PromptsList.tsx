'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deletePrompt, duplicatePrompt } from '@/lib/actions'
import { Sparkles, Copy, Trash2, Check, ClipboardCopy } from 'lucide-react'
import type { Prompt } from '@/lib/supabase'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function PromptsList({ prompts: initial }: { prompts: Prompt[] }) {
  const [prompts, setPrompts] = useState(initial)
  const [copied, setCopied] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function handleCopy(e: React.MouseEvent, id: string, content: string) {
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(content)
    setCopied(id)
    setTimeout(() => setCopied(null), 1800)
  }

  function handleDuplicate(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      await duplicatePrompt(id)
      router.refresh()
    })
  }

  function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setPrompts((prev) => prev.filter((p) => p.id !== id))
    startTransition(async () => {
      await deletePrompt(id)
      router.refresh()
    })
  }

  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 sm:py-28 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
        <div className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center mb-4">
          <Sparkles size={16} className="text-zinc-400 dark:text-zinc-600" />
        </div>
        <p className="text-sm text-zinc-500 mb-1">No prompts yet</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-700">Hit &quot;New Prompt&quot; to save your first one</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {prompts.map((prompt, i) => (
        <div key={prompt.id} className="group/row relative">
          <Link
            href={`/prompts/${prompt.id}`}
            className="group relative flex items-start justify-between px-5 py-4 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-orange-500/20 transition-all duration-200 overflow-hidden"
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-orange-400/60 transition-all duration-200" />
            <div className="flex items-start gap-4 min-w-0 flex-1 pr-28">
              <span className="text-[11px] text-zinc-400 dark:text-zinc-700 tabular-nums w-5 text-right shrink-0 mt-0.5">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                  {prompt.title || 'Untitled Prompt'}
                </p>
                {prompt.content ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5 line-clamp-2 leading-relaxed">
                    {prompt.content}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-700 mt-0.5 italic">Empty</p>
                )}
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 tabular-nums mt-0.5">
              {timeAgo(prompt.updated_at)}
            </span>
          </Link>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity">
            <button
              onClick={(e) => handleCopy(e, prompt.id, prompt.content)}
              title="Copy to clipboard"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-400 dark:text-zinc-600 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all"
            >
              {copied === prompt.id ? (
                <><Check size={11} className="text-emerald-500" /><span className="text-emerald-500">Copied</span></>
              ) : (
                <><ClipboardCopy size={11} />Copy</>
              )}
            </button>
            <button
              onClick={(e) => handleDuplicate(e, prompt.id)}
              title="Duplicate"
              className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={(e) => handleDelete(e, prompt.id, prompt.title)}
              title="Delete"
              className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
