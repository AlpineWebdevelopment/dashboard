'use client'

// The közös főkönyv. A real table rather than the card rows most of this app
// uses — three narrow columns over 166 rows read better aligned, and the
// precedent is the campaign table in /ads.
//
// With no categories on an entry (Tárgy stays one free-text field, exactly as in
// the spreadsheet), search over that text and the month filter are what make the
// ledger navigable at all.

import { useMemo, useState } from 'react'
import { Loader2, Pencil, Search, Trash2 } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import { fmtSigned } from '@/lib/finances'
import { fmtDate, idxLabel, monthIdxOf } from '@/lib/mrr'
import type { FinanceEntry } from '@/lib/finance-types'
import { inputClass } from './ui'

export default function LedgerTable({
  entries,
  onEdit,
  onDelete,
  pendingId,
}: {
  entries: FinanceEntry[]
  onEdit: (entry: FinanceEntry) => void
  onDelete: (entry: FinanceEntry) => void
  pendingId: string | null
}) {
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState('all')

  const monthOptions = useMemo(() => {
    const idxs = new Set<number>()
    for (const e of entries) if (e.entry_date) idxs.add(monthIdxOf(e.entry_date))
    return [
      { value: 'all', label: 'All months' },
      ...[...idxs].sort((a, b) => b - a).map((i) => ({ value: String(i), label: idxLabel(i) })),
    ]
  }, [entries])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = entries.filter((e) => {
      if (q && !e.subject.toLowerCase().includes(q)) return false
      if (month !== 'all') {
        if (!e.entry_date) return false
        if (monthIdxOf(e.entry_date) !== Number(month)) return false
      }
      return true
    })
    // Newest first, undated last — sorted here rather than trusting the server
    // order, so an optimistic insert lands in the right place immediately.
    return filtered.sort((a, b) => {
      if (a.entry_date && b.entry_date) {
        if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? 1 : -1
        return a.created_at < b.created_at ? 1 : -1
      }
      if (a.entry_date) return -1
      if (b.entry_date) return 1
      return a.created_at < b.created_at ? 1 : -1
    })
  }, [entries, query, month])

  const shown = rows.reduce((s, e) => s + e.amount, 0)
  const firstUndated = rows.findIndex((e) => !e.entry_date)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-400 pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Tárgy…"
            aria-label="Search entries"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="sm:w-52">
          <CustomSelect value={month} onChange={setMonth} options={monthOptions} ariaLabel="Month" />
        </div>
      </div>

      <p className="text-[12px] text-zinc-500 dark:text-zinc-200 mb-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {rows.length} {rows.length === 1 ? 'row' : 'rows'} · net {fmtSigned(shown)}
      </p>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-white/[0.05]">
              <th className="text-left font-semibold text-zinc-500 dark:text-zinc-200 py-2 pr-3 w-28">Dátum</th>
              <th className="text-left font-semibold text-zinc-500 dark:text-zinc-200 py-2 pr-3">Tárgy</th>
              <th className="text-right font-semibold text-zinc-500 dark:text-zinc-200 py-2 pl-3 w-36">Pénzmozgás</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[13px] text-zinc-500 dark:text-zinc-200">
                  Nothing matches.
                </td>
              </tr>
            )}
            {rows.map((e, i) => (
              <tr
                key={e.id}
                className={`group border-b border-zinc-100 dark:border-white/[0.03] ${
                  // The spreadsheet tinted each row from the sign of column C
                  // (`$C2<0` / `$C2>0`). Same reading, kept faint enough to sit
                  // under a wallpaper.
                  e.amount < 0 ? 'bg-rose-500/[0.03]' : 'bg-emerald-500/[0.03]'
                } ${i === firstUndated && firstUndated > 0 ? 'border-t-2 border-t-zinc-200 dark:border-t-white/[0.08]' : ''}`}
              >
                <td
                  className="py-2 pr-3 text-zinc-500 dark:text-zinc-200 align-top whitespace-nowrap"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {e.entry_date ? fmtDate(e.entry_date) : <span className="italic">No date</span>}
                </td>
                <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200 align-top">
                  {e.subject || <span className="text-zinc-400 dark:text-zinc-400">—</span>}
                  {e.amount_formula && (
                    <span
                      className="ml-2 text-[12px] text-zinc-500 dark:text-zinc-200"
                      title="The expression this amount was entered as"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      <code>={e.amount_formula}</code>
                    </span>
                  )}
                </td>
                <td
                  className={`py-2 pl-3 text-right align-top font-medium whitespace-nowrap ${
                    e.amount < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmtSigned(e.amount)}
                </td>
                <td className="py-2 pl-2 align-top">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {pendingId === e.id ? (
                      <Loader2 size={13} className="animate-spin text-zinc-500 dark:text-zinc-200" />
                    ) : (
                      <>
                        <button
                          onClick={() => onEdit(e)}
                          aria-label="Edit entry"
                          className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => onDelete(e)}
                          aria-label="Delete entry"
                          className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
