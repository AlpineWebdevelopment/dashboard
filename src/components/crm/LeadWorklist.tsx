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

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Filter, Plus, Search, Upload, X } from 'lucide-react'
import type { Lead } from '@/lib/crm/leads'
import { ACTIVE_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '@/lib/lead-status'
import { due, leadTitle } from '@/lib/crm/format'
import { NewLeadDialog, CsvImportDialog } from './LeadDialogs'
import StatusBadge from './StatusBadge'
import CustomSelect from '../CustomSelect'

/**
 * Atrium's brand green. Spent once per screen and no more — here it marks the
 * overdue leads, which is the only thing on this page that needs to be noticed
 * from across the room. Status badges stay neutral on purpose: fifteen
 * colour-coded states is noise, not information.
 */
export const SIGNAL = '#6DBC61'

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

/**
 * A cell that shows one line and the whole value on hover.
 *
 * Whether the text was actually cut is measured rather than guessed: on mouse
 * enter, scrollWidth > clientWidth answers it exactly, for the column width as
 * it currently is. So a short value never pops up a box repeating itself, and a
 * long one never hides. Measuring at hover rather than at render is what keeps
 * this cheap — no resize observer per row, and the layout has long settled by
 * the time you point at something.
 *
 * Children opt into the measurement with `data-clip`; anything without it is
 * along for the ride. `force` covers what width cannot see — a value whose
 * newlines a one-line cell has flattened into spaces.
 */
function TruncatingCell({
  full,
  force = false,
  className = '',
  children,
}: {
  full: string
  force?: boolean
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)

  return (
    <div
      ref={ref}
      className={`group/cell relative min-w-0 ${className}`}
      onMouseEnter={() => {
        const el = ref.current
        if (!el) return
        setClipped(
          force ||
            Array.from(el.querySelectorAll<HTMLElement>('[data-clip]')).some(
              (n) => n.scrollWidth > n.clientWidth
            )
        )
      }}
    >
      {children}
      {clipped && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-80 max-w-md whitespace-pre-wrap wrap-break-word rounded-lg border border-zinc-200 dark:border-white/[0.10] bg-white dark:bg-zinc-900 px-3 py-2 text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-200 shadow-lg group-hover/cell:block"
        >
          {full}
        </span>
      )}
    </div>
  )
}

/**
 * Below md the table is two columns: who they are, and where they are.
 *
 * Five columns on a phone is five things too narrow to read. Notes, next step
 * and the call count all lose to a name and a status when there is only room
 * for two — those two are what identifies a row, and the rest is detail you
 * open the lead to see. The row is still sorted by due date, so the order on a
 * phone is the same order as on a desktop even with the dates hidden.
 *
 * Kept as constants rather than repeated in the header and the row, because
 * a grid whose two halves disagree about how many columns it has is a very
 * confusing thing to look at.
 *
 * Status is a fraction with a floor, not a content-sized track. Sized to its
 * content it would take whatever 'Offer out – awaiting decision' needs and
 * leave the name the remainder, so the widest status made the names beside it
 * unreadable. As a fraction it gets a fixed share whatever the label says, and
 * the badge truncates inside it — the floor stops it collapsing to nothing on
 * a narrow phone.
 */
const NARROW_HIDE = 'hidden md:block'

const ROW_COLS =
  'grid-cols-[minmax(0,1fr)_minmax(4.5rem,0.6fr)] ' +
  'md:grid-cols-[minmax(0,1.5fr)_minmax(6rem,1.4fr)_minmax(0,2.6fr)_minmax(0,1.1fr)_auto]'

function LeadRow({ lead, now }: { lead: Lead; now: number }) {
  const title = leadTitle(lead)
  // Meta rows rarely carry a company, so this column is whichever name the lead
  // actually has. The second line only appears when both exist and would
  // otherwise be lost.
  const subtitle = lead.company_name && lead.contact_name ? lead.contact_name : null
  const notes = lead.notes?.trim() ?? ''

  return (
    <Link
      href={`/atrium-crm/${lead.id}`}
      className={`grid ${ROW_COLS} items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-500/5 dark:hover:bg-white/[0.04] transition-colors`}
    >
      <TruncatingCell full={subtitle ? `${title}\n${subtitle}` : title}>
        <span data-clip="" className="block truncate text-sm text-zinc-800 dark:text-zinc-100">
          {title}
        </span>
        {subtitle && (
          <span
            data-clip=""
            className="block truncate text-[12px] text-zinc-500 dark:text-zinc-400"
          >
            {subtitle}
          </span>
        )}
      </TruncatingCell>
      <div className="min-w-0"><StatusBadge status={lead.status} /></div>
      {notes ? (
        <TruncatingCell full={notes} force={notes.includes('\n')} className={NARROW_HIDE}>
          <span data-clip="" className="block truncate text-[13px] text-zinc-500 dark:text-zinc-400">
            {notes}
          </span>
        </TruncatingCell>
      ) : (
        <span className={`text-[13px] text-zinc-400 dark:text-zinc-500 ${NARROW_HIDE}`}>—</span>
      )}
      <div className={`min-w-0 ${NARROW_HIDE}`}>
        <DueCell iso={lead.next_action_at} now={now} />
      </div>
      <div
        className={`font-mono text-[13px] text-zinc-400 dark:text-zinc-500 tabular-nums text-right w-10 ${NARROW_HIDE}`}
        title={
          lead.contact_attempts > 0
            ? `${lead.contact_attempts} call attempt${lead.contact_attempts === 1 ? '' : 's'} logged`
            : 'No calls logged yet'
        }
      >
        {lead.contact_attempts > 0 ? lead.contact_attempts : '—'}
      </div>
    </Link>
  )
}

/**
 * The last column used to read "Att.", which said nothing. It counts logged
 * calls — a lead you have rung five times without getting through reads 5.
 */
const HEADERS: { label: string; title?: string; className?: string }[] = [
  { label: 'Company / name' },
  { label: 'Status' },
  { label: 'Notes', className: NARROW_HIDE },
  { label: 'Next step', className: NARROW_HIDE },
  {
    label: 'Calls',
    title: 'Call attempts logged against this lead',
    className: `${NARROW_HIDE} text-right w-10`,
  },
]

export default function LeadWorklist({
  initialLeads,
  serverNow,
}: {
  initialLeads: Lead[]
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
  const [dueOnly, setDueOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [grouped, setGrouped] = useState(false)
  const [dialog, setDialog] = useState<'new' | 'import' | null>(null)

  const leads = initialLeads

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (status && l.status !== status) return false
      if (dueOnly) {
        if (!l.next_action_at) return false
        if (new Date(l.next_action_at).getTime() > now) return false
      }
      if (q) {
        // Notes are searchable now that they are on screen — looking at a note
        // and being unable to search for it is the kind of gap you only notice
        // once. Niche has no column and no filter any more, but it is still
        // stored, so searching stays the way to find it.
        const hay = [l.company_name, l.contact_name, l.email, l.phone, l.niche, l.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [leads, status, dueOnly, search, now])

  const overdueCount = useMemo(
    () =>
      filtered.filter((l) => l.next_action_at && new Date(l.next_action_at).getTime() <= now)
        .length,
    [filtered, now]
  )

  const groups = useMemo(() => {
    if (!grouped) return null
    return ACTIVE_STATUSES.map((s) => ({
      status: s,
      leads: filtered.filter((l) => l.status === s),
    })).filter((g) => g.leads.length > 0)
  }, [grouped, filtered])

  const anyFilter = status !== '' || dueOnly || search.trim() !== ''

  return (
    <div className="max-w-6xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl text-zinc-800 dark:text-white">Leads</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
            {filtered.length} lead
            {overdueCount > 0 && (
              <>
                {' · '}
                <span style={{ color: SIGNAL }}>{overdueCount} due now</span>
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
            Import CSV
          </button>
          <button
            onClick={() => setDialog('new')}
            className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-white/[0.07] transition-colors"
          >
            <Plus size={14} />
            New lead
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
            placeholder="Search"
            className="panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors w-44"
          />
        </div>

        <CustomSelect
          value={status}
          onChange={(v) => setStatus(v as LeadStatus | '')}
          ariaLabel="Filter by status"
          small
          className="w-40"
          options={[
            { value: '', label: 'All statuses' },
            ...ACTIVE_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
          ]}
        />

        <label
          className="inline-flex items-center gap-2 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 cursor-pointer"
          title="Only leads whose next step is due now or overdue. Leads with no date set are hidden."
        >
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
            className="accent-current"
            style={{ accentColor: SIGNAL }}
          />
          Due now
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
          Group by status
        </button>

        {anyFilter && (
          <button
            onClick={() => {
              setStatus('')
              setDueOnly(false)
              setSearch('')
            }}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[13px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors"
          >
            <X size={13} />
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {/* No overflow-hidden: it would clip the note tooltips. Nothing inside
          needs clipping — the rows sit inside the panel's padding, so none of
          them reach the rounded corners. */}
      <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl">
        <div
          className={`grid ${ROW_COLS} gap-3 px-3 py-2 border-b border-zinc-200 dark:border-white/[0.06] text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500`}
        >
          {HEADERS.map((h) => (
            <div key={h.label} title={h.title} className={h.className}>
              {h.label}
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {leads.length === 0
              ? 'No leads yet. Add one, or import from CSV.'
              : 'No leads match these filters.'}
          </p>
        ) : groups ? (
          <div className="p-1.5">
            {groups.map((g) => (
              <div key={g.status} className="mb-3 last:mb-0">
                <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                  <StatusBadge status={g.status} />
                  <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">
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
