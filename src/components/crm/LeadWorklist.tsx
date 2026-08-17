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
import { Columns3, Filter, Plus, Rows3, Search, Upload, X } from 'lucide-react'
import type { Lead } from '@/lib/crm/leads'
import { ACTIVE_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '@/lib/lead-status'
import { due, leadTitle } from '@/lib/crm/format'
import { NewLeadDialog, CsvImportDialog } from './LeadDialogs'
import StatusBadge from './StatusBadge'
import LeadPipeline from './LeadPipeline'
import { SIGNAL } from './signal'
import CustomSelect from '../CustomSelect'

function DueCell({ iso, now }: { iso: string | null; now: number }) {
  const d = due(iso, new Date(now))
  if (d.none) {
    return <span className="font-mono text-[13px] text-zinc-500 dark:text-zinc-200">—</span>
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
        className={d.overdue ? '' : 'text-zinc-500 dark:text-zinc-200'}
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
          className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-80 max-w-md whitespace-pre-wrap wrap-break-word rounded-lg border border-zinc-200 dark:border-white/[0.10] bg-white dark:bg-zinc-900 px-3 py-2 text-[13px] leading-relaxed text-zinc-700 dark:text-white shadow-lg group-hover/cell:block"
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
        <span data-clip="" className="block truncate text-sm text-zinc-800 dark:text-white">
          {title}
        </span>
        {subtitle && (
          <span
            data-clip=""
            className="block truncate text-[13px] text-zinc-500 dark:text-zinc-200"
          >
            {subtitle}
          </span>
        )}
      </TruncatingCell>
      <div className="min-w-0"><StatusBadge status={lead.status} /></div>
      {notes ? (
        <TruncatingCell full={notes} force={notes.includes('\n')} className={NARROW_HIDE}>
          <span data-clip="" className="block truncate text-[13px] text-zinc-500 dark:text-zinc-200">
            {notes}
          </span>
        </TruncatingCell>
      ) : (
        <span className={`text-[13px] text-zinc-500 dark:text-zinc-200 ${NARROW_HIDE}`}>—</span>
      )}
      <div className={`min-w-0 ${NARROW_HIDE}`}>
        <DueCell iso={lead.next_action_at} now={now} />
      </div>
      <div
        className={`font-mono text-[13px] text-zinc-500 dark:text-zinc-200 tabular-nums text-right w-14 ${NARROW_HIDE}`}
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
    className: `${NARROW_HIDE} text-right w-14`,
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
  // Two shapes for one set of leads. The filters above sit outside this choice
  // on purpose: switching view keeps whatever you had narrowed down, so the
  // pipeline can be looked at through a search the same way the table is.
  const [view, setView] = useState<'table' | 'pipeline'>('table')

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
          <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-200">
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
            className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.07] transition-colors"
          >
            <Upload size={14} />
            Import CSV
          </button>
          <button
            onClick={() => setDialog('new')}
            className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.07] transition-colors"
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
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-200 pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors w-44"
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
          className="inline-flex items-center gap-2 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-zinc-700 dark:text-white cursor-pointer"
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

        {/* Grouping is a table-view idea. In the pipeline the leads are already
            grouped, by something coarser, so the button would be offering to do
            a thing the screen has just done. */}
        {view === 'table' && (
          <button
            onClick={() => setGrouped((g) => !g)}
            className={`inline-flex items-center gap-1.5 panel border rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
              grouped
                ? 'bg-zinc-200/70 dark:bg-white/[0.09] border-zinc-300 dark:border-white/[0.14] text-zinc-800 dark:text-white'
                : 'bg-zinc-100/60 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-100'
            }`}
          >
            <Filter size={14} />
            Group by status
          </button>
        )}

        {anyFilter && (
          <button
            onClick={() => {
              setStatus('')
              setDueOnly(false)
              setSearch('')
            }}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
          >
            <X size={13} />
            Clear filters
          </button>
        )}

        {/* ── View switch ──────────────────────────────────────────────────
            Pushed to the far end of the row, away from the filters. Changing
            the view changes nothing about which leads you are looking at, and
            standing apart from the controls that do is how it says so. */}
        <div className="ml-auto inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-100/60 dark:bg-white/[0.04] p-0.5">
          {([
            { key: 'table', label: 'Table', Icon: Rows3 },
            { key: 'pipeline', label: 'Pipeline', Icon: Columns3 },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              title={`${label} view`}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                view === key
                  ? 'bg-white dark:bg-white/[0.10] text-zinc-800 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The empty state is the same sentence whichever view is on, because it
          is about the leads and not about the shape they are drawn in. */}
      {filtered.length === 0 ? (
        <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl">
          <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-200">
            {leads.length === 0
              ? 'No leads yet. Add one, or import from CSV.'
              : 'No leads match these filters.'}
          </p>
        </div>
      ) : view === 'pipeline' ? (
        <LeadPipeline leads={filtered} now={now} />
      ) : (
        /* ── Table ────────────────────────────────────────────────────────
           No overflow-hidden: it would clip the note tooltips. Nothing inside
           needs clipping — the rows sit inside the panel's padding, so none of
           them reach the rounded corners. */
        <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl">
          <div
            className={`grid ${ROW_COLS} gap-3 px-3 py-2 border-b border-zinc-200 dark:border-white/[0.06] text-[13px] uppercase tracking-widest text-zinc-500 dark:text-zinc-200`}
          >
            {HEADERS.map((h) => (
              <div key={h.label} title={h.title} className={h.className}>
                {h.label}
              </div>
            ))}
          </div>

          {groups ? (
            <div className="p-1.5">
              {groups.map((g) => (
                <div key={g.status} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                    <StatusBadge status={g.status} />
                    <span className="font-mono text-[13px] text-zinc-500 dark:text-zinc-200">
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
      )}

      {dialog === 'new' && <NewLeadDialog onClose={() => setDialog(null)} />}
      {dialog === 'import' && <CsvImportDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
