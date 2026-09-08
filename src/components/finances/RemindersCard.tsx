'use client'

// The two limits from G1/G2 and the note from I5:I9.
//
// They sat in the spreadsheet with no formula touching them, and they stay that
// way here: numbers to look at, not thresholds. No progress bars and no warning
// when the revenue approaches one — the billing app already does that, and a
// second system raising the same alarm would only be a second thing to trust.

import { useState, useTransition } from 'react'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { fmtMoney } from '@/lib/mrr'
import { updateFinanceSettings } from '@/lib/finance-actions'
import type { FinanceSettings } from '@/lib/finance-types'
import { cardClass, inputClass, labelClass } from './ui'

export default function RemindersCard({ settings }: { settings: FinanceSettings | null }) {
  const [current, setCurrent] = useState(settings)
  const [editing, setEditing] = useState(false)
  const [flat, setFlat] = useState(String(settings?.flat_tax_limit ?? 0))
  const [vat, setVat] = useState(String(settings?.vat_exempt_limit ?? 0))
  const [year, setYear] = useState(settings?.limits_year ?? '')
  const [reminder, setReminder] = useState(settings?.reminder ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!current) {
    return (
      <div className={`${cardClass} p-5`}>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
          Reminders are unavailable — the finance_settings row is missing.
        </p>
      </div>
    )
  }

  function save() {
    setError(null)
    start(async () => {
      const res = await updateFinanceSettings({
        flat_tax_limit: Number(flat.replace(/\s/g, '')),
        vat_exempt_limit: Number(vat.replace(/\s/g, '')),
        limits_year: year,
        reminder,
      })
      if (!res.ok) return setError(res.error.message)
      setCurrent(res.data)
      setEditing(false)
    })
  }

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Emlékeztetők</h2>
        {editing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={save}
              disabled={pending}
              aria-label="Save reminders"
              className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              onClick={() => setEditing(false)}
              aria-label="Cancel"
              className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            aria-label="Edit reminders"
            className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="limits-year">
              Év
            </label>
            <input
              id="limits-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="flat-limit">
              Átalányadó bevételi limit
            </label>
            <input
              id="flat-limit"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              className={inputClass}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="vat-limit">
              AAM bevételi limit
            </label>
            <input
              id="vat-limit"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              className={inputClass}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="reminder-note">
              Jegyzet
            </label>
            <textarea
              id="reminder-note"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>
          {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      ) : (
        <dl className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-zinc-500 dark:text-zinc-200">
              Átalányadó limit{current.limits_year && ` (${current.limits_year})`}
            </dt>
            <dd
              className="text-[13px] font-medium text-zinc-800 dark:text-white whitespace-nowrap"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtMoney(current.flat_tax_limit)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-zinc-500 dark:text-zinc-200">
              AAM limit{current.limits_year && ` (${current.limits_year})`}
            </dt>
            <dd
              className="text-[13px] font-medium text-zinc-800 dark:text-white whitespace-nowrap"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtMoney(current.vat_exempt_limit)}
            </dd>
          </div>
          {current.reminder && (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-200 pt-1 border-t border-zinc-200 dark:border-white/[0.05]">
              {current.reminder}
            </p>
          )}
        </dl>
      )}
    </div>
  )
}
