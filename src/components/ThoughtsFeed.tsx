'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import type { Thought } from '@/lib/supabase'
import { createThought, deleteThought, togglePinThought } from '@/lib/actions'
import { Pin, Trash2, Zap } from 'lucide-react'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ThoughtCard({
  thought,
  onDelete,
  onPin,
}: {
  thought: Thought
  onDelete: (id: string) => void
  onPin: (id: string, pinned: boolean) => void
}) {
  return (
    <div
      className={`group relative rounded-2xl border px-4 py-3.5 transition-all duration-150 ${
        thought.pinned
          ? 'bg-amber-50/60 dark:bg-amber-500/[0.04] border-amber-200/70 dark:border-amber-500/20'
          : 'bg-white dark:bg-white/[0.02] border-zinc-100 dark:border-white/[0.06] hover:border-zinc-200 dark:hover:border-white/[0.1]'
      }`}
    >
      {thought.pinned && (
        <Pin size={10} className="absolute top-3.5 left-4 text-amber-400/70 fill-amber-400/30" />
      )}
      <p
        className={`text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words ${
          thought.pinned ? 'pl-4' : ''
        }`}
      >
        {thought.content}
      </p>
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[11px] text-zinc-300 dark:text-zinc-700 tabular-nums">
          {timeAgo(thought.created_at)}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onPin(thought.id, !thought.pinned)}
            title={thought.pinned ? 'Unpin' : 'Pin'}
            className={`p-1.5 rounded-lg transition-colors ${
              thought.pinned
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Pin size={12} />
          </button>
          <button
            onClick={() => onDelete(thought.id)}
            title="Delete"
            className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ThoughtsFeed({ initialThoughts }: { initialThoughts: Thought[] }) {
  const [thoughts, setThoughts] = useState(initialThoughts)
  const [input, setInput] = useState('')
  const [, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setThoughts(initialThoughts) }, [initialThoughts])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const text = input.trim()
    if (!text) return

    const optimistic: Thought = {
      id: `temp-${Date.now()}`,
      content: text,
      pinned: false,
      created_at: new Date().toISOString(),
    }

    setThoughts((prev) => {
      const pinned = prev.filter((t) => t.pinned)
      const unpinned = prev.filter((t) => !t.pinned)
      return [...pinned, optimistic, ...unpinned]
    })
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    startTransition(async () => {
      await createThought(text)
    })
  }

  function handleDelete(id: string) {
    setThoughts((prev) => prev.filter((t) => t.id !== id))
    startTransition(async () => { await deleteThought(id) })
  }

  function handlePin(id: string, pinned: boolean) {
    setThoughts((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, pinned } : t))
      return [...updated.filter((t) => t.pinned), ...updated.filter((t) => !t.pinned)]
    })
    startTransition(async () => { await togglePinThought(id, pinned) })
  }

  const pinned = thoughts.filter((t) => t.pinned)
  const unpinned = thoughts.filter((t) => !t.pinned)

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pb-12">
          {/* Capture area */}
          <div className="py-8 sm:py-10">
            <textarea
              ref={textareaRef}
              value={input}
              autoFocus
              onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind..."
              rows={3}
              className="w-full bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] rounded-2xl px-5 py-4 text-[15px] text-zinc-800 dark:text-zinc-200 placeholder-zinc-300 dark:placeholder-zinc-700 outline-none focus:border-zinc-300 dark:focus:border-white/[0.14] focus:bg-white dark:focus:bg-white/[0.04] resize-none transition-all leading-relaxed shadow-sm"
            />
            <div className="flex items-center justify-between mt-2.5 px-1">
              <span className="text-[11px] text-zinc-300 dark:text-zinc-700">
                Enter to save · Shift+Enter for new line
              </span>
              <button
                onClick={submit}
                disabled={!input.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Zap size={11} />
                Capture
              </button>
            </div>
          </div>

          {/* Feed */}
          {thoughts.length === 0 ? (
            <div className="text-center py-16">
              <Zap size={20} className="text-zinc-200 dark:text-zinc-800 mx-auto mb-3" />
              <p className="text-zinc-300 dark:text-zinc-700 text-sm">Nothing here yet. Start dumping.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pinned.map((t) => (
                <ThoughtCard key={t.id} thought={t} onDelete={handleDelete} onPin={handlePin} />
              ))}
              {pinned.length > 0 && unpinned.length > 0 && (
                <div className="border-t border-zinc-100 dark:border-white/[0.05] !my-4" />
              )}
              {unpinned.map((t) => (
                <ThoughtCard key={t.id} thought={t} onDelete={handleDelete} onPin={handlePin} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
