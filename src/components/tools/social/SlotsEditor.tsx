'use client'

// An account's recurring time slots ("18:00 Mon–Fri"), edited in place. Lives
// inside an account row, which is already a panelled card, so nothing here
// carries `.panel` of its own.

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { deleteSlot, saveSlot } from '@/lib/social/actions'
import type { SocialSlot } from '@/lib/social/types'
import { btnPrimary, inputCls } from '@/components/tools/ui'

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function describeDays(days: number[]): string {
  const sorted = [...days].sort()
  if (sorted.length === 7) return 'Daily'
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays'
  if (sorted.join() === '6,7') return 'Weekends'
  return sorted.map((d) => DAY_NAMES[d - 1]).join(', ')
}

function DayToggles({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex gap-1">
      {DAYS.map((label, i) => {
        const day = i + 1
        const on = value.includes(day)
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={DAY_NAMES[i]}
            onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day])}
            className={`w-7 h-7 rounded-md border text-[12px] font-semibold transition-all duration-150 ${
              on
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-100 border-rose-500/30'
                : 'border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function SlotsEditor({
  accountId,
  slots,
  onChange,
}: {
  accountId: string
  slots: SocialSlot[]
  onChange: (slots: SocialSlot[]) => void
}) {
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
  const [time, setTime] = useState('18:00')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    setError(null)
    const res = await saveSlot({ account_id: accountId, weekdays: days, time_local: time, active: true })
    setBusy(false)
    if (!res.ok) return setError(res.error.message)
    onChange([...slots, res.data].sort((a, b) => a.time_local.localeCompare(b.time_local)))
  }

  const remove = async (id: string) => {
    const res = await deleteSlot(id)
    if (!res.ok) return setError(res.error.message)
    onChange(slots.filter((s) => s.id !== id))
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-white/[0.06]">
      <div className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
        Time slots <span className="normal-case tracking-normal font-normal">· Budapest time, used by Auto-fill</span>
      </div>
      {slots.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {slots.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] pl-2 pr-1 py-1 text-[13px] text-zinc-700 dark:text-zinc-200"
            >
              <span className="font-medium text-zinc-900 dark:text-white tabular-nums">{s.time_local}</span>
              {describeDays(s.weekdays)}
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label="Remove slot"
                className="p-0.5 rounded text-zinc-500 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-400"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <DayToggles value={days} onChange={setDays} />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={`${inputCls('rose', true)} w-[110px] py-1`}
          aria-label="Slot time"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !days.length}
          className={`${btnPrimary('rose', true)} px-2.5 py-1.5 text-[13px]`}
        >
          <Plus size={13} /> Add slot
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
