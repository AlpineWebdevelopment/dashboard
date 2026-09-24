'use client'

// /finances — ported from penzugyek-2026.xlsx.
//
// The five tiles are the spreadsheet's summary box (E1:I10), each one a formula
// recomputed in lib/finances.ts rather than a stored number. They must agree
// with the sheet to the forint; that agreement is how the import was verified.
//
// Rows are held in local state and patched after each mutation, the way
// MrrBoard does, so an edit lands immediately instead of waiting on a refetch.

import { useMemo, useState, useTransition } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import {
  balance,
  capital,
  monthlySeries,
  profit,
  profitPct,
  totalExpense,
  totalIncome,
} from '@/lib/finances'
import { fmtMoney } from '@/lib/mrr'
import { deleteFinanceContribution, deleteFinanceEntry, deleteFinanceAccount } from '@/lib/finance-actions'
import type {
  FinanceAccount,
  FinanceContribution,
  FinanceEntry,
  FinanceSettings,
} from '@/lib/finance-types'
import BalanceChart from './BalanceChart'
import EntryModal from './EntryModal'
import LedgerTable from './LedgerTable'
import PartnersPanel from './PartnersPanel'
import RemindersCard from './RemindersCard'
import { cardClass } from './ui'

type Modal =
  | { mode: 'entry'; record: FinanceEntry | null }
  | { mode: 'contribution'; record: FinanceContribution | null; accountId?: string }

export default function FinancesBoard({
  initialAccounts,
  initialEntries,
  initialContributions,
  initialSettings,
}: {
  initialAccounts: FinanceAccount[]
  initialEntries: FinanceEntry[]
  initialContributions: FinanceContribution[]
  initialSettings: FinanceSettings | null
}) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [entries, setEntries] = useState(initialEntries)
  const [contributions, setContributions] = useState(initialContributions)
  const [modal, setModal] = useState<Modal | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // null = not toggled yet, which follows the layout in CSS: collapsed while the
  // ledger is stacked above Privát (below lg, where 170 rows bury everything
  // under them), open beside it. Resolving that in CSS rather than from
  // matchMedia on mount means a phone never paints the full table first.
  const [ledgerOpen, setLedgerOpen] = useState<boolean | null>(null)
  const [, startDelete] = useTransition()

  const stats = useMemo(() => {
    const pct = profitPct(entries)
    return {
      balance: balance(entries, contributions),
      capital: capital(contributions),
      income: totalIncome(entries),
      expense: totalExpense(entries),
      profit: profit(entries),
      pct,
    }
  }, [entries, contributions])

  const months = useMemo(() => monthlySeries(entries, contributions), [entries, contributions])

  function upsert<T extends { id: string }>(list: T[], row: T): T[] {
    const i = list.findIndex((x) => x.id === row.id)
    if (i === -1) return [row, ...list]
    const next = [...list]
    next[i] = row
    return next
  }

  function removeEntry(entry: FinanceEntry) {
    if (!confirm(`Delete "${entry.subject || 'this entry'}"? This can't be undone.`)) return
    setError(null)
    setPendingId(entry.id)
    startDelete(async () => {
      const res = await deleteFinanceEntry(entry.id)
      setPendingId(null)
      if (!res.ok) return setError(res.error.message)
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    })
  }

  function removeContribution(row: FinanceContribution) {
    if (!confirm(`Delete "${row.subject || 'this movement'}"? This can't be undone.`)) return
    setError(null)
    setPendingId(row.id)
    startDelete(async () => {
      const res = await deleteFinanceContribution(row.id)
      setPendingId(null)
      if (!res.ok) return setError(res.error.message)
      setContributions((prev) => prev.filter((c) => c.id !== row.id))
    })
  }

  function removeAccount(account: FinanceAccount, rowCount: number) {
    // The cascade takes the movements with it, so the Tőke drops by their sum —
    // say so rather than letting the balance move unexplained.
    const tail = rowCount > 0 ? ` and its ${rowCount} ${rowCount === 1 ? 'movement' : 'movements'}` : ''
    if (!confirm(`Delete "${account.name}"${tail}? This can't be undone.`)) return
    setError(null)
    startDelete(async () => {
      const res = await deleteFinanceAccount(account.id)
      if (!res.ok) return setError(res.error.message)
      setAccounts((prev) => prev.filter((a) => a.id !== account.id))
      setContributions((prev) => prev.filter((c) => c.account_id !== account.id))
    })
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-zinc-900 dark:text-white">Finances</h1>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-0.5">
            Közös főkönyv és a privát pénzmozgások.
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'entry', record: null })}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Add entry
        </button>
      </div>

      {error && (
        <p className="text-[13px] text-rose-600 dark:text-rose-400 mb-4" role="alert">
          {error}
        </p>
      )}

      {/* Summary — was E1:I10 */}
      {/* One per row on a phone: at half width even 20px figures like
          "2 074 753,02 Ft" broke across lines. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile
          label="Közös Egyenleg"
          value={fmtMoney(stats.balance)}
          sub="Tőke + a főkönyv nettója"
          strong
        />
        <StatTile label="Tőke" value={fmtMoney(stats.capital)} sub="Minden befektetés együtt" />
        <StatTile label="Össz Bevétel" value={fmtMoney(stats.income)} sub="Pozitív tételek" />
        <StatTile label="Össz Kiadás" value={fmtMoney(stats.expense)} sub="Negatív tételek" />
      </div>

      <div className={`${cardClass} p-4 sm:p-5 mb-4`}>
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 sm:gap-4 mb-4">
          <div>
            <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1">
              Profit
            </p>
            <p
              className={`text-[22px] sm:text-[26px] font-semibold leading-tight ${
                stats.profit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fmtMoney(stats.profit)}
              {stats.pct !== null && (
                <span className="text-[13px] sm:text-[15px] font-medium text-zinc-500 dark:text-zinc-200 ml-2">
                  {stats.pct.toLocaleString('hu-HU', { maximumFractionDigits: 1 })}%
                </span>
              )}
            </p>
          </div>
          <ul className="flex flex-wrap items-center sm:justify-end gap-x-3 gap-y-1 text-[12px] text-zinc-500 dark:text-zinc-200">
            <li className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/45 dark:bg-emerald-400/40" />
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500/45 dark:bg-rose-400/40 -ml-1" />
              Havi nettó
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
              Egyenleg
            </li>
          </ul>
        </div>
        <BalanceChart months={months} />
      </div>

      {/* grid-cols-1 and min-w-0, not the implicit column: an auto track sizes to
          the table's min-content, which pushed the whole card past a phone's edge. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <div className={`${cardClass} p-4 sm:p-5 min-w-0`}>
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
            <button
              type="button"
              onClick={() => setLedgerOpen((prev) => !(prev ?? window.matchMedia('(min-width: 64rem)').matches))}
              aria-expanded={ledgerOpen ?? undefined}
              aria-controls="ledger-body"
              className="group w-full flex items-center justify-between gap-3 text-left"
            >
              Közös főkönyv
              <span className="flex items-center gap-2 text-[12px] font-normal text-zinc-500 dark:text-zinc-200 group-hover:text-zinc-800 dark:group-hover:text-white transition-colors">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {entries.length} {entries.length === 1 ? 'row' : 'rows'}
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${
                    ledgerOpen === null ? '-rotate-90 lg:rotate-0' : ledgerOpen ? '' : '-rotate-90'
                  }`}
                />
              </span>
            </button>
          </h2>
          <div
            id="ledger-body"
            className={`mt-3 ${ledgerOpen === null ? 'hidden lg:block' : ledgerOpen ? '' : 'hidden'}`}
          >
            <LedgerTable
              entries={entries}
              onEdit={(record) => setModal({ mode: 'entry', record })}
              onDelete={removeEntry}
              pendingId={pendingId}
            />
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <div className={`${cardClass} p-4 sm:p-5`}>
            <PartnersPanel
              accounts={accounts}
              contributions={contributions}
              onAddContribution={(accountId) => setModal({ mode: 'contribution', record: null, accountId })}
              onEditContribution={(record) => setModal({ mode: 'contribution', record })}
              onDeleteContribution={removeContribution}
              onAccountSaved={(saved) => setAccounts((prev) => upsert(prev, saved))}
              onDeleteAccount={removeAccount}
              pendingId={pendingId}
            />
          </div>

          <RemindersCard settings={initialSettings} />
        </div>
      </div>

      {modal && (
        <EntryModal
          mode={modal.mode}
          record={modal.record}
          accounts={accounts.filter((a) => !a.archived)}
          defaultAccountId={modal.mode === 'contribution' ? modal.accountId : undefined}
          onClose={() => setModal(null)}
          onSavedEntry={(saved) => setEntries((prev) => upsert(prev, saved))}
          onSavedContribution={(saved) => setContributions((prev) => upsert(prev, saved))}
        />
      )}
    </>
  )
}

function StatTile({
  label,
  value,
  sub,
  strong,
}: {
  label: string
  value: string
  sub: string
  strong?: boolean
}) {
  return (
    <div className={`${cardClass} p-4 sm:p-5`}>
      <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5 sm:mb-2">
        {label}
      </p>
      <p
        className={`font-semibold text-zinc-900 dark:text-white leading-tight mb-1 ${
          strong ? 'text-[22px] sm:text-[26px]' : 'text-[18px] sm:text-[20px]'
        }`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-200">{sub}</p>
    </div>
  )
}
