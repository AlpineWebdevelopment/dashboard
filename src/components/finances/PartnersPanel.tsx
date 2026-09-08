'use client'

// Privát pénzmozgások — the partner side of the pot.
//
// The spreadsheet gave each person a column, which caps the list at however many
// columns were drawn. Here each is a row in finance_accounts, so a fourth can
// join without a migration. Their contributions summed are the Tőke the summary
// starts from.

import { useMemo, useState, useTransition } from 'react'
import { ChevronDown, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import { accountTotals, fmtSigned } from '@/lib/finances'
import { fmtDate, fmtMoney } from '@/lib/mrr'
import { createFinanceAccount, updateFinanceAccount } from '@/lib/finance-actions'
import {
  FINANCE_ACCENTS,
  type FinanceAccent,
  type FinanceAccount,
  type FinanceContribution,
} from '@/lib/finance-types'
import { ACCENT_DOT, ACCENT_TEXT, cardClass, inputClass, labelClass } from './ui'

export default function PartnersPanel({
  accounts,
  contributions,
  onAddContribution,
  onEditContribution,
  onDeleteContribution,
  onAccountSaved,
  onDeleteAccount,
  pendingId,
}: {
  accounts: FinanceAccount[]
  contributions: FinanceContribution[]
  onAddContribution: (accountId: string) => void
  onEditContribution: (row: FinanceContribution) => void
  onDeleteContribution: (row: FinanceContribution) => void
  onAccountSaved: (saved: FinanceAccount) => void
  onDeleteAccount: (account: FinanceAccount, rowCount: number) => void
  pendingId: string | null
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<FinanceAccount | null | 'new'>(null)

  const totals = useMemo(() => accountTotals(accounts, contributions), [accounts, contributions])
  const active = totals.filter((t) => !t.account.archived)
  const archived = totals.filter((t) => t.account.archived)

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Privát pénzmozgások</h2>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
        >
          <Plus size={13} />
          Account
        </button>
      </div>

      <div className="space-y-2">
        {[...active, ...archived].map(({ account, total, paidIn, takenOut, count }) => {
          const rows = contributions
            .filter((c) => c.account_id === account.id)
            .sort((a, b) => {
              if (a.entry_date && b.entry_date) return a.entry_date < b.entry_date ? 1 : -1
              if (a.entry_date) return -1
              if (b.entry_date) return 1
              return 0
            })
          const isOpen = open === account.id
          return (
            <div key={account.id} className={cardClass}>
              <div className="flex items-center gap-3 p-4 group">
                <button
                  onClick={() => setOpen(isOpen ? null : account.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  aria-expanded={isOpen}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ACCENT_DOT[account.accent]}`} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-zinc-900 dark:text-white truncate">
                      {account.name}
                      {account.archived && (
                        <span className="ml-2 text-[12px] font-normal text-zinc-500 dark:text-zinc-200">
                          archived
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] text-zinc-500 dark:text-zinc-200" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {count} {count === 1 ? 'movement' : 'movements'} · in {fmtMoney(paidIn)} · out {fmtMoney(takenOut)}
                    </span>
                  </span>
                </button>

                <span
                  className={`text-[15px] font-semibold shrink-0 ${ACCENT_TEXT[account.accent]}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmtMoney(total)}
                </span>

                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onAddContribution(account.id)}
                    aria-label={`Add movement for ${account.name}`}
                    className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    onClick={() => setEditing(account)}
                    aria-label={`Edit ${account.name}`}
                    className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => onDeleteAccount(account, count)}
                    aria-label={`Delete ${account.name}`}
                    className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <ChevronDown
                  size={14}
                  className={`shrink-0 text-zinc-500 dark:text-zinc-200 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </div>

              {isOpen && (
                <div className="px-4 pb-3 border-t border-zinc-200 dark:border-white/[0.05]">
                  {rows.length === 0 ? (
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-200 py-3">No movements yet.</p>
                  ) : (
                    <ul>
                      {rows.map((c) => (
                        <li
                          key={c.id}
                          className="group/row flex items-center gap-3 py-1.5 border-b border-zinc-100 dark:border-white/[0.03] last:border-0"
                        >
                          <span
                            className="text-[12px] text-zinc-500 dark:text-zinc-200 w-20 shrink-0"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {c.entry_date ? fmtDate(c.entry_date) : 'No date'}
                          </span>
                          <span className="text-[13px] text-zinc-800 dark:text-zinc-200 flex-1 min-w-0 truncate group-hover/row:opacity-0 transition-opacity">
                            {c.subject || '—'}
                          </span>
                          <span
                            className={`text-[13px] font-medium shrink-0 ${
                              c.amount < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {fmtSigned(c.amount)}
                          </span>
                          <span className="flex items-center gap-1 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            {pendingId === c.id ? (
                              <Loader2 size={13} className="animate-spin text-zinc-500 dark:text-zinc-200" />
                            ) : (
                              <>
                                <button
                                  onClick={() => onEditContribution(c)}
                                  aria-label="Edit movement"
                                  className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => onDeleteContribution(c)}
                                  aria-label="Delete movement"
                                  className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {accounts.length === 0 && (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-200 py-4">
            No accounts yet. Add one to start tracking who put what into the pot.
          </p>
        )}
      </div>

      {editing && (
        <AccountModal
          account={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            onAccountSaved(saved)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

// ─── Account modal ───────────────────────────────────────────────────────────

function AccountModal({
  account,
  onClose,
  onSaved,
}: {
  account: FinanceAccount | null
  onClose: () => void
  onSaved: (saved: FinanceAccount) => void
}) {
  const [name, setName] = useState(account?.name ?? '')
  const [accent, setAccent] = useState<FinanceAccent>(account?.accent ?? 'teal')
  const [archived, setArchived] = useState(account?.archived ?? false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const input = { name, accent, archived }
      const res = account
        ? await updateFinanceAccount(account.id, input)
        : await createFinanceAccount(input)
      if (!res.ok) return setError(res.error.message)
      onSaved(res.data)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500/60 via-teal-500/60 to-indigo-500/60" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
              {account ? 'Edit account' : 'New account'}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="account-name">
                Name
              </label>
              <input
                id="account-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Colour</label>
              <CustomSelect
                value={accent}
                onChange={(v) => setAccent(v as FinanceAccent)}
                options={FINANCE_ACCENTS.map((a) => ({ value: a, label: a }))}
                ariaLabel="Colour"
              />
            </div>

            {account && (
              <label className="flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                  className="accent-zinc-900 dark:accent-white"
                />
                Archived — keeps the history, hides it from the picker
              </label>
            )}

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
                {account ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
