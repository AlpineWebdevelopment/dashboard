'use client'

import { useEffect, useState } from 'react'
import BackgroundControls from './BackgroundControls'
import { Image as ImageIcon, X } from 'lucide-react'

/**
 * Quick access to the wallpaper from the overview page. The controls themselves
 * live in BackgroundControls, which the settings page renders inline — this is
 * only the button and the modal around them.
 */
export default function BackgroundPicker() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Change background"
        className="hidden dark:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] panel bg-white/[0.04] hover:bg-white/[0.08] text-[13px] font-medium text-zinc-500 hover:text-zinc-200 transition-all duration-150"
      >
        <ImageIcon size={11} />
        Background
      </button>

      {open && (
        <div className="hidden dark:flex fixed inset-0 z-50 items-center justify-center p-4">
          {/* Light backdrop so the background stays visible while you tune it */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />

          <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1 w-full shrink-0 bg-gradient-to-r from-indigo-500/60 via-sky-500/60 to-emerald-500/60" />

            <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center">
                  <ImageIcon size={15} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-tight">Background</h2>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-200">Applies across the whole dashboard</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
              <BackgroundControls />
            </div>

            <div className="flex justify-end px-6 py-4 shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
