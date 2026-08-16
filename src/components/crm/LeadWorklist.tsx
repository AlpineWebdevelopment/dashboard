'use client'

// The screen you open in the morning.
//
// Default view is a worklist, not a board: leads sorted by when their next step
// is due, overdue at the top, so "who do I call now" is answered without a
// click. Grouping by status is a secondary toggle.
//
// Filtering happens in the browser rather than through the server. A one-person
// agency's pipeline is hundreds of rows, not millions — the whole set is
// already loaded, and filtering it locally is instant instead of a round-trip
// per keystroke.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Filter, Plus, Search, Upload, X } from 'lucide-react'
import type { Lead } from '@/lib/crm/leads'
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '@/lib/lead-status'
import { due, leadTitle } from '@/lib/crm/format'
import { NewLeadDialog, CsvImportDialog } from './LeadDialogs'

/**
 * Atrium's brand green. Spent once per screen and no more — here it marks the
 * overdue leads, which is the only thing on this page that needs to be noticed
 * from across the room. Status badges stay neutral on purpose: fifteen
 * colour-coded states is noise, not information.
 */
export const SIGNAL = '#6DBC61'

const selectClass =
  'panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-zinc-800 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className="inline-block rounded-md border border-zinc-300/60 dark:border-white/[0.10] bg-zinc-500/5 dark:bg-white/[0.04] px-2 py-0.5 text-[12px] text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
      {LEAD_STATUS_LABELS[status]}
    </span>
  )
}

function DueCell({ iso, now }: { iso: string | null; now: number }) {
  const d = due(iso, new Date(now))
  if (d.none) {
    return <span className="font-mono text-[13px] text-zinc-400 dark:text-zinc-500">—</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[13px]">
      {d.overdue && (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: SIGNAL }}
        />
      )}
      <span
        className={d.overdue ? '' : 'text-zinc-500 dark:text-zinc-400'}
        style={d.overdue ? { color: SIGNAL } : undefined}
      >
        {d.text}
      </span>
    </span>
  )
}

function LeadRow({ lead, now }: { lead: Lead; now: number }) {
  return (
    <Link
      href={`/atrium-crm/${lead.id}`}
      className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-500/5 dark:hover:bg-white/[0.04] transition-colors"
    >
      <div className="min-w-0">
        <div className="truncate text-sm text-zinc-800 dark:text-zinc-100">{leadTitle(lead)}</div>
        {lead.company_name && lead.contact_name && (
          <div className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">
            {lead.contact_name}
          </div>
        )}
      </div>
      <div className="min-w-0"><StatusBadge status={lead.status} /></div>
      <div className="min-w-0 truncate text-[13px] text-zinc-500 dark:text-zinc-400">
        {lead.niche || '—'}
      </div>
      <div className="min-w-0"><DueCell iso={lead.next_action_at} now={now} /></div>
      <div
        className="font-mono text-[13px] text-zinc-400 dark:text-zinc-500 tabular-nums text-right w-10"
        title={`${lead.contact_attempts} kísérlet`}
      >
        {lead.contact_attempts > 0 ? lead.contact_attempts : '—'}
      </div>
    </Link>
  )
}

const HEADERS = ['Cégnév', 'Státusz', 'Niche', 'Következő lépés', 'Kís.']

export default function LeadWorklist({
  initialLeads,
  niches,
  serverNow,
}: {
  initialLeads: Lead[]
  niches: string[]
  serverNow: number
}) {
  // Seeded from the server so hydration matches, then ticked every minute —
  // leave this screen open through the morning and rows cross into overdue on
  // their own. The clock is deliberately not corrected on mount: server/client
  // skew is seconds, the first tick fixes it, and setting state straight from
  // an effect just buys a cascading render.
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const [status, setStatus] = useState<LeadStatus | ''>('')
  const [niche, setNiche] = useState('')
  const [dueOnly, setDueOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [grouped, setGrouped] = useState(false)
  const [dialog, setDialog] = useState<'new' | 'import' | null>(null)

  const leads = initialLeads

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (status && l.status !== status) return false
      if (niche && l.niche !== niche) return false
      if (dueOnly) {
        if (!l.next_action_at) return false
        if (new Date(l.next_action_at).getTime() > now) return false
      }
      if (q) {
        const hay = [l.company_name, l.contact_name, l.email, l.phone, l.niche]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [leads, status, niche, dueOnly, search, now])

  const overdueCount = useMemo(
    () =>
      filtered.filter((l) => l.next_action_at && new Date(l.next_action_at).getTime() <= now)
        .length,
    [filtered, now]
  )

  const groups = useMemo(() => {
    if (!grouped) return null
    return LEAD_STATUSES.map((s) => ({
      status: s,
      leads: filtered.filter((l) => l.status === s),
    })).filter((g) => g.leads.length > 0)
  }, [grouped, filtered])

  const anyFilter = status !== '' || niche !== '' || dueOnly || search.trim() !== ''

  return (
    <div className="max-w-6xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl text-zinc-800 dark:text-white">Leadek</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
            {filtered.length} lead
            {overdueCount > 0 && (
              <>
                {' · '}
                <span style={{ color: SIGNAL }}>{overdueCount} esedékes</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDialog('import')}
            className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-white/[0.07] transition-colors"
          >
            <Upload size={14} />
            CSV importálás
          </button>
          <button
            onClick={() => setDialog('new')}
            className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-white/[0.07] transition-colors"
          >
            <Plus size={14} />
            Új lead
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés"
            className="panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors w-44"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus | '')}
          className={selectClass}
        >
          <option value="">Minden státusz</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select value={niche} onChange={(e) => setNiche(e.target.value)} className={selectClass}>
          <option value="">Minden niche</option>
          {niches.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 cursor-pointer">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
            className="accent-current"
            style={{ accentColor: SIGNAL }}
          />
          Csak esedékes
        </label>

        <button
          onClick={() => setGrouped((g) => !g)}
          className={`inline-flex items-center gap-1.5 panel border rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
            grouped
              ? 'bg-zinc-200/70 dark:bg-white/[0.09] border-zinc-300 dark:border-white/[0.14] text-zinc-800 dark:text-white'
              : 'bg-zinc-100/60 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300'
          }`}
        >
          <Filter size={14} />
          Státusz szerint
        </button>

        {anyFilter && (
          <button
            onClick={() => {
              setStatus('')
              setNiche('')
              setDueOnly(false)
              setSearch('')
            }}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[13px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors"
          >
            <X size={13} />
            Szűrők törlése
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-3 px-3 py-2 border-b border-zinc-200 dark:border-white/[0.06] text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          {HEADERS.map((h, i) => (
            <div key={h} className={i === HEADERS.length - 1 ? 'text-right w-10' : ''}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {leads.length === 0
              ? 'Még nincs lead. Vegyen fel egyet, vagy importáljon CSV-ből.'
              : 'Nincs a szűrésnek megfelelő lead.'}
          </p>
        ) : groups ? (
          <div className="p-1.5">
            {groups.map((g) => (
              <div key={g.status} className="mb-3 last:mb-0">
                <div className="px-3 pt-2 pb-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                  {LEAD_STATUS_LABELS[g.status]}
                  <span className="ml-1.5 font-mono text-zinc-400 dark:text-zinc-500">
                    {g.leads.length}
                  </span>
                </div>
                {g.leads.map((l) => (
                  <LeadRow key={l.id} lead={l} now={now} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-1.5">
            {filtered.map((l) => (
              <LeadRow key={l.id} lead={l} now={now} />
            ))}
          </div>
        )}
      </div>

      {dialog === 'new' && <NewLeadDialog onClose={() => setDialog(null)} />}
      {dialog === 'import' && <CsvImportDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
