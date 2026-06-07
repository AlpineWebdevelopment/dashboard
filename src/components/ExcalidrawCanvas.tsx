'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ChevronLeft, Check, Loader2, Trash2 } from 'lucide-react'
import { renameWhiteboard, saveWhiteboardData, deleteWhiteboard } from '@/lib/actions'
import type { Whiteboard } from '@/lib/supabase'

// Excalidraw must be loaded client-side only (uses canvas + browser APIs)
const Excalidraw = dynamic(
  async () => {
    const { Excalidraw } = await import('@excalidraw/excalidraw')
    return Excalidraw
  },
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#13131a]">
      <Loader2 size={24} className="animate-spin text-fuchsia-400" />
    </div>
  )}
)

type Props = { whiteboard: Whiteboard }

export default function ExcalidrawCanvas({ whiteboard }: Props) {
  const [name, setName] = useState(whiteboard.name)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isDark, setIsDark] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstChange = useRef(true)

  // Detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Debounced auto-save on canvas change
  const handleChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files: unknown) => {
      // Skip the very first onChange which fires on mount
      if (isFirstChange.current) { isFirstChange.current = false; return }

      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(async () => {
        await saveWhiteboardData(whiteboard.id, {
          elements: Array.from(elements),
          files: files ?? {},
        })
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2000)
      }, 1500)
    },
    [whiteboard.id]
  )

  // Rename on blur
  async function handleNameBlur() {
    if (name === whiteboard.name) return
    await renameWhiteboard(whiteboard.id, name || 'Untitled Whiteboard')
  }

  // Delete
  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteWhiteboard(whiteboard.id)
  }

  const initialData = whiteboard.data
    ? {
        elements: whiteboard.data.elements as never,
        appState: { theme: isDark ? 'dark' : 'light' } as never,
        files: whiteboard.data.files as never,
      }
    : undefined

  return (
    <div className="fixed inset-0 md:left-56 flex flex-col bg-white dark:bg-[#13131a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-11 border-b border-zinc-200 dark:border-white/[0.06] bg-white/95 dark:bg-[rgba(7,7,15,0.9)] backdrop-blur-xl shrink-0 z-10">
        <Link
          href="/whiteboards"
          className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors shrink-0"
        >
          <ChevronLeft size={13} />
          Whiteboards
        </Link>

        <div className="w-px h-4 bg-zinc-200 dark:bg-white/[0.07] shrink-0" />

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-zinc-800 dark:text-zinc-200 outline-none placeholder-zinc-400 dark:placeholder-zinc-700 truncate"
        />

        <div className="flex items-center gap-2 shrink-0">
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-600">
              <Loader2 size={10} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Check size={10} /> Saved
            </span>
          )}
          <button
            onClick={handleDelete}
            title="Delete whiteboard"
            className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <Excalidraw
          initialData={initialData}
          onChange={handleChange as never}
          theme={isDark ? 'dark' : 'light'}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: { saveFileToDisk: true },
            },
          }}
        />
      </div>
    </div>
  )
}
