'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { saveScratchPad } from '@/lib/actions'
import { Check, Loader2 } from 'lucide-react'

export default function ScratchPad({ initial }: { initial: string }) {
  const [content, setContent] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  const save = useCallback(async (value: string) => {
    setStatus('saving')
    await saveScratchPad(value)
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2000)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setContent(value)
    setStatus('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 600)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-zinc-600">
          Scratch Pad
        </p>
        <span className="flex items-center gap-1 text-[10px] text-zinc-700 h-4">
          {status === 'saving' && (
            <><Loader2 size={9} className="animate-spin" /> Saving…</>
          )}
          {status === 'saved' && (
            <><Check size={9} className="text-emerald-500" /> Saved</>
          )}
        </span>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        placeholder="Dump your thoughts here…"
        rows={4}
        className="w-full bg-transparent px-5 pb-5 pt-1 text-sm text-zinc-300 placeholder-zinc-700 outline-none resize-none leading-relaxed"
      />
    </div>
  )
}
