'use client'

// Add / edit dialog, shared by the ledger and the partner contributions — they
// are the same four fields, plus an account picker on the contribution side.
//
// Modal shell copied from MrrBoard.tsx: there is no shared Modal outside
// /tools. Note the scroll container is the panel itself here, not the overlay
// (this form has no dropdown that can spill past the panel edge), and nothing
// above the fixed backdrop carries `.panel` — a backdrop-filter would become
// the containing block for it.

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Wallet, Users, X } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import { evalAmount, isExpression } from '@/lib/finances'
import { fmtMoney } from '@/lib/mrr'
import {
  createFinanceContribution,
  createFinanceEntry,
  updateFinanceContribution,
  updateFinanceEntry,
} from '@/lib/finance-actions'
import type { FinanceAccount, FinanceContribution, FinanceEntry } from '@/lib/finance-types'
import { hintClass, inputClass, labelClass } from './ui'

type Props = {
  mode: 'entry' | 'contribution'
  /** Null to create. */
  record: FinanceEntry | FinanceContribution | null
  accounts: FinanceAccount[]
  defaultAccountId?: string
  onClose: () => void
  onSavedEntry?: (saved: FinanceEntry) => void
  onSavedContribution?: (saved: FinanceContribution) => void
}

export default function EntryModal({
  mode,
  record,
  accounts,
  defaultAccountId,
  onClose,
  onSavedEntry,
  onSavedContribution,
}: Props) {
  const [date, setDate] = useState(record?.entry_date ?? '')
  const [subject, setSubject] = useState(record?.subject ?? '')
  // The expression is what was typed, so it is what comes back for editing.
  const [amount, setAmount] = useState(
    record ? record.amount_formula || String(record.amount) : ''
  )
  const [accountId, setAccountId] = useState(
    (record as FinanceContribution | null)?.account_id ?? defaultAccountId ?? accounts[0]?.id ?? ''
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const parsed = amount.trim() ? evalAmount(amount) : null
  const preview = parsed?.ok && isExpression(amount) ? parsed.value : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const input = { entry_date: date, subject, amount }
      if (mode === 'entry') {
        const res = record
          ? await updateFinanceEntry(record.id, input)
          : await createFinanceEntry(input)
        if (!res.ok) return setError(res.error.message)
        onSavedEntry?.(res.data)
      } else {
        const withAccount = { ...input, account_id: accountId }
        const res = record
          ? await updateFinanceContribution(record.id, withAccount)
          : await createFinanceContribution(withAccount)
        if (!res.ok) return setError(res.error.message)
        onSavedContribution?.(res.data)
      }
      onClose()
    })
  }

  const title = `${record ? 'Edit' : 'Add'} ${mode === 'entry' ? 'entry' : 'contribution'}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500/60 via-teal-500/60 to-indigo-500/60" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center">
                {mode === 'entry' ? (
                  <Wallet size={15} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Users size={15} className="text-teal-600 dark:text-teal-400" />
                )}
              </div>
              <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'contribution' && (
              <div>
                <label className={labelClass}>Account</label>
                <CustomSelect
                  value={accountId}
                  onChange={setAccountId}
                  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                  ariaLabel="Account"
                />
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="finance-date">
                Dátum
              </label>
              <input
                id="finance-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
              <p className={hintClass}>Leave empty if the date is unknown — it sorts to the end.</p>
            </div>

            <div>
              <label className={labelClass} htmlFor="finance-subject">
                Tárgy
              </label>
              <input
                id="finance-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="order #1042, payout, meta…"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="finance-amount">
                Összeg (Ft)
              </label>
              <input
                id="finance-amount"
                type="text"
                inputMode="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="-12569  vagy  -33.46*333.5"
                className={inputClass}
                style={{ fontVariantNumeric: 'tabular-nums' }}
                required
              />
              <p className={hintClass}>
                {preview !== null ? (
                  <span className="text-zinc-700 dark:text-white">= {fmtMoney(preview)}</span>
                ) : parsed && !parsed.ok ? (
                  <span className="text-rose-600 dark:text-rose-400">Not a valid amount.</span>
                ) : (
                  <>
                    {mode === 'entry'
                      ? 'Negative is kiadás, positive bevétel.'
                      : 'Positive pays into the pot, negative takes back out.'}{' '}
                    Arithmetic works: <code>-33.46*333.5</code>.
                  </>
                )}
              </p>
            </div>

            {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-xl text-[13px] font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
              >
                {pending && <Loader2 size={13} className="animate-spin" />}
                {record ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
