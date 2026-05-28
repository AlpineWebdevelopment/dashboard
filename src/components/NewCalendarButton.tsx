'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCalendar } from '@/lib/actions'
import { ICON_KEYS, ICON_DEFS, CalendarIcon } from '@/lib/calendarIcons'
import { CalendarDays, Loader2, X } from 'lucide-react'

const COLORS = [
  { key: 'rose',    swatch: 'bg-rose-500'    },
  { key: 'violet',  swatch: 'bg-violet-500'  },
  { key: 'sky',     swatch: 'bg-sky-500'     },
  { key: 'emerald', swatch: 'bg-emerald-500' },
  { key: 'amber',   swatch: 'bg-amber-500'   },
  { key: 'indigo',  swatch: 'bg-indigo-500'  },
  { key: 'orange',  swatch: 'bg-orange-500'  },
]

export default function NewCalendarButton({ folderId }: { folderId?: string | null }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [color, setColor] = useState('rose')
  const [icon, setIcon] = useState('Target')
  const [pending, start] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim() || 'Untitled Calendar'
    start(async () => {
      const id = await createCalendar(n, goal.trim(), color, icon, folderId ?? null)
      setOpen(false)
      setName('')
      setGoal('')
      setColor('rose')
      setIcon('Target')
      router.push(`/calendars/${id}`)
    })
  }

  const selectedIconColor = ICON_DEFS[icon as keyof typeof ICON_DEFS]?.color ?? 'text-zinc-400'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 text-[13px] font-medium transition-all duration-150"
      >
        <CalendarDays size={13} />
        New Calendar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-rose-500/60 via-violet-500/60 to-sky-500/60" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center ${selectedIconColor}`}>
                    <CalendarIcon iconKey={icon} size={16} className={selectedIconColor} />
                  </div>
                  <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">New Calendar</h2>
                </div>
                <button onClick={() => setOpen(false)} className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Icon picker */}
                <div>
                  <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">Icon</label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {ICON_KEYS.map((key) => {
                      const { color: iconColor, label } = ICON_DEFS[key]
                      return (
                        <button
                          key={key}
                          type="button"
                          title={label}
                          onClick={() => setIcon(key)}
                          className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                            icon === key
                              ? 'bg-zinc-200 dark:bg-white/[0.12] ring-1 ring-zinc-300 dark:ring-white/20 scale-105'
                              : 'bg-zinc-100/60 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
                          } ${iconColor}`}
                        >
                          <CalendarIcon iconKey={key} size={15} className={iconColor} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Name</label>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Fitness, Reading, Hydration…"
                    className="w-full bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5">Daily goal</label>
                  <input
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="e.g. Work out for 30 min…"
                    className="w-full bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setColor(c.key)}
                        className={`w-7 h-7 rounded-full ${c.swatch} transition-all ${
                          color === c.key ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-[#111118] scale-110' : 'opacity-60 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setOpen(false)}
                    className="px-4 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={pending}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 border border-rose-500/20 text-rose-300 hover:bg-rose-500/30 disabled:opacity-40 transition-colors">
                    {pending && <Loader2 size={11} className="animate-spin" />}
                    {pending ? 'Creating…' : 'Create Calendar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
