'use client'

// One lead: who they are, where they are in the pipeline, and what happened.
//
// The status control is the point of this screen. It is populated exclusively
// from allowedTransitions(), which reads the lead_status_transitions table, so
// an illegal target is never rendered — not greyed out, absent. When the chosen
// target needs a date or a reason, the field appears and submit stays disabled
// until it is filled. The database checks all of it again anyway; this only
// spares the round-trip.

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, History, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { ACTIVITY_KINDS, type ActivityKind, type Lead, type LeadEvent } from '@/lib/crm/leads'
import {
  ACTIVE_STATUSES,
  LEAD_STATUS_LABELS,
  NEEDS_REASON,
  SUGGESTS_DATE,
  type LeadStatus,
} from '@/lib/lead-status'
import { due, formatDateTime, leadTitle, sinceShort, toLocalInput } from '@/lib/crm/format'
import {
  backfillStatusAction,
  deleteLeadAction,
  logActivityAction,
  transitionLeadAction,
  updateEventAction,
  updateLeadAction,
} from '@/lib/crm/actions'
import StatusBadge from './StatusBadge'
import { SIGNAL } from './signal'
import CustomSelect from '../CustomSelect'

const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
}

/** 'YYYY-MM-DDTHH:mm' for a datetime-local input, defaulting to now. */
function nowLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const inputClass =
  'w-full panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

const labelClass = 'block text-[13px] text-zinc-500 dark:text-zinc-200 mb-1'

const cardClass =
  'panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl'

function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  multiline?: boolean
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {multiline ? (
        <textarea
          className={`${inputClass} min-h-[80px] resize-y`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

/**
 * One entry in the history, with its date and note editable in place.
 *
 * What the entry records is not editable — the database refuses any change to
 * lead_id, kind or the statuses with CR006. So a backfilled date can be
 * corrected without the timeline becoming a document someone maintains rather
 * than a record of what happened.
 */
function TimelineEntry({ event, leadId }: { event: LeadEvent; leadId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const [at, setAt] = useState(() => toLocalInput(event.occurred_at))
  const [note, setNote] = useState(event.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const isStatus = event.kind === 'status_change' || event.kind === 'backfill'

  function save() {
    setError(null)
    start(async () => {
      const result = await updateEventAction(leadId, event.id, { occurredAt: at, note })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <li className="group border-l border-zinc-200 dark:border-white/[0.10] pl-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {isStatus ? (
            // Both ends carry their pipe colour, so a move that changes the
            // colour — which is the kind worth noticing — is visible without
            // reading either label.
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-zinc-800 dark:text-white">
              {event.from_status ? (
                <StatusBadge status={event.from_status} />
              ) : (
                <span className="text-zinc-500 dark:text-zinc-200">Created</span>
              )}
              <span className="text-zinc-500 dark:text-zinc-200">→</span>
              {event.to_status ? (
                <StatusBadge status={event.to_status} />
              ) : (
                <span className="text-zinc-500 dark:text-zinc-200">—</span>
              )}
              {event.kind === 'backfill' && (
                <span className="rounded border border-zinc-300/60 dark:border-white/[0.10] px-1 py-0.5 text-[13px] text-zinc-500 dark:text-zinc-200">
                  corrected
                </span>
              )}
            </div>
          ) : (
            <div className="text-[13px] text-zinc-800 dark:text-white">
              {ACTIVITY_LABELS[event.kind as ActivityKind] ?? event.kind}
            </div>
          )}
        </div>

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md p-1 text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-zinc-800 dark:hover:text-white transition-all dark:text-zinc-200"
            aria-label="Edit this entry"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-1.5 space-y-2">
          <input
            type="datetime-local"
            className={inputClass}
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
          <input
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note"
          />
          {error && (
            <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] panel bg-zinc-100/60 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.10] text-zinc-800 dark:text-white disabled:opacity-50"
            >
              {pending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setAt(toLocalInput(event.occurred_at))
                setNote(event.note ?? '')
                setError(null)
              }}
              className="rounded-md px-2 py-1 text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="font-mono text-[13px] text-zinc-500 dark:text-zinc-200">
            {formatDateTime(event.occurred_at)}
          </div>
          {event.note && (
            <div className="mt-0.5 text-[13px] text-zinc-600 dark:text-zinc-100">
              {event.note}
            </div>
          )}
        </>
      )}
    </li>
  )
}

export default function LeadDetail({
  lead,
  events,
  allowed,
  serverNow,
}: {
  lead: Lead
  events: LeadEvent[]
  allowed: LeadStatus[]
  /** Seeds the overdue clock so hydration matches the server-rendered HTML. */
  serverNow: number
}) {
  const router = useRouter()
  const [savePending, startSave] = useTransition()
  const [movePending, startMove] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // ── status change ──────────────────────────────────────────────────────
  const [target, setTarget] = useState<LeadStatus | ''>('')
  const [nextAt, setNextAt] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const suggestsDate = target !== '' && SUGGESTS_DATE.has(target)
  const needsReason = target !== '' && NEEDS_REASON.has(target)
  const canMove = target !== '' && (!needsReason || reason.trim() !== '')

  function move() {
    if (!canMove) return
    setError(null)
    startMove(async () => {
      const result = await transitionLeadAction(lead.id, {
        toStatus: target as LeadStatus,
        nextActionAt: nextAt.trim() ? new Date(nextAt).toISOString() : '',
        lostReason: needsReason ? reason : '',
        note,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setTarget('')
      setNextAt('')
      setReason('')
      setNote('')
      router.refresh()
    })
  }

  // ── backfill: record a step that already happened ──────────────────────
  const [fixOpen, setFixOpen] = useState(false)
  const [fixTarget, setFixTarget] = useState<LeadStatus | ''>('')
  const [fixAt, setFixAt] = useState('')
  const [fixNote, setFixNote] = useState('')
  const [fixReason, setFixReason] = useState('')

  const fixNeedsReason = fixTarget !== '' && NEEDS_REASON.has(fixTarget)
  const canFix = fixTarget !== '' && (!fixNeedsReason || fixReason.trim() !== '')

  function backfill() {
    if (!canFix) return
    setError(null)
    startMove(async () => {
      const result = await backfillStatusAction(lead.id, {
        toStatus: fixTarget as LeadStatus,
        occurredAt: fixAt.trim() ? new Date(fixAt).toISOString() : '',
        lostReason: fixNeedsReason ? fixReason : '',
        note: fixNote,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setFixTarget('')
      setFixAt('')
      setFixNote('')
      setFixReason('')
      setFixOpen(false)
      router.refresh()
    })
  }

  // ── activity log ───────────────────────────────────────────────────────
  const [actKind, setActKind] = useState<ActivityKind>('call')
  const [actNote, setActNote] = useState('')
  const [actAt, setActAt] = useState('')

  function logIt() {
    setError(null)
    startSave(async () => {
      const result = await logActivityAction(lead.id, {
        kind: actKind,
        note: actNote,
        occurredAt: actAt.trim() ? new Date(actAt).toISOString() : '',
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setActNote('')
      setActAt('')
      router.refresh()
    })
  }

  // ── editable fields ────────────────────────────────────────────────────
  const [form, setForm] = useState({
    company_name: lead.company_name ?? '',
    contact_name: lead.contact_name ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    phone_secondary: lead.phone_secondary ?? '',
    phone_whatsapp: lead.phone_whatsapp ?? '',
    niche: lead.niche ?? '',
    source: lead.source ?? '',
    notes: lead.notes ?? '',
    next_action_at: toLocalInput(lead.next_action_at),
    form_answers_raw: lead.form_answers_raw ?? '',
    contact_attempts: String(lead.contact_attempts),
  })

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  function save() {
    setError(null)
    startSave(async () => {
      const result = await updateLeadAction(lead.id, {
        ...form,
        next_action_at: form.next_action_at
          ? new Date(form.next_action_at).toISOString()
          : '',
        // Left blank means "leave it alone", not "set it to NaN" — an empty
        // number input would otherwise fail validation and block the whole save.
        contact_attempts: form.contact_attempts.trim() === '' ? undefined : form.contact_attempts,
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm('Delete this lead? Its history goes with it.')) return
    startSave(async () => {
      const result = await deleteLeadAction(lead.id)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.push('/atrium-crm')
      router.refresh()
    })
  }

  const d = useMemo(
    () => due(lead.next_action_at, new Date(serverNow)),
    [lead.next_action_at, serverNow]
  )

  // The newest thing in the history. Events arrive newest-first, so it is the
  // head of the list; a lead nothing has happened to falls back to when it
  // arrived, which is the honest answer for a fresh import.
  const lastTouched = events[0]?.occurred_at ?? lead.created_at

  return (
    <div className="min-h-screen px-4 sm:px-8 pt-8 sm:pt-10 pb-16">
      <div className="max-w-5xl">
        <Link
          href="/atrium-crm"
          className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to leads
        </Link>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl text-zinc-800 dark:text-white truncate">{leadTitle(lead)}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500 dark:text-zinc-200">
              {lead.contact_name && lead.company_name && <span>{lead.contact_name}</span>}
              {lead.email && <span>{lead.email}</span>}
              {lead.phone && <span className="font-mono">{lead.phone}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              {!d.none && (
                <span
                  className="font-mono text-[13px]"
                  style={d.overdue ? { color: SIGNAL } : undefined}
                >
                  {d.text}
                </span>
              )}
              <span
                className="font-mono text-[13px] text-zinc-500 dark:text-zinc-200"
                title={`Last activity: ${formatDateTime(lastTouched)}`}
              >
                {sinceShort(lastTouched, new Date(serverNow))} since last activity
              </span>
              {lead.contact_attempts > 0 && (
                <span className="font-mono text-[13px] text-zinc-500 dark:text-zinc-200">
                  {lead.contact_attempts} call{lead.contact_attempts === 1 ? '' : 's'} logged
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={remove}
              disabled={savePending}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors dark:text-zinc-200"
              aria-label="Delete lead"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5">
          <div className="space-y-5">
            {/* ── Status change ────────────────────────────────────────── */}
            <section className={`${cardClass} p-4`}>
              <h2 className="text-sm text-zinc-800 dark:text-white mb-3">Change status</h2>

              {allowed.length === 0 ? (
                <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
                  This status is closed — there is no next step from here.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>New status</label>
                    <CustomSelect
                      value={target}
                      onChange={(v) => {
                        setTarget(v as LeadStatus | '')
                        setError(null)
                      }}
                      placeholder="Choose a status"
                      options={[
                        { value: '', label: 'Choose a status' },
                        ...allowed.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
                      ]}
                    />
                  </div>

                  {target !== '' && (
                    <div>
                      <label className={labelClass}>
                        Date for the next step (optional)
                      </label>
                      <input
                        type="datetime-local"
                        className={inputClass}
                        value={nextAt}
                        onChange={(e) => setNextAt(e.target.value)}
                      />
                      {suggestsDate && (
                        <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-200">
                          A lead can sit in this status a long time. Without a date it will not
                          appear in the due list.
                        </p>
                      )}
                    </div>
                  )}

                  {needsReason && (
                    <div>
                      <label className={labelClass}>
                        Reason — required for this status
                      </label>
                      <input
                        className={inputClass}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why this lead is closing"
                      />
                    </div>
                  )}

                  {target !== '' && (
                    <div>
                      <label className={labelClass}>Note for the history</label>
                      <input
                        className={inputClass}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  )}

                  <button
                    onClick={move}
                    disabled={!canMove || movePending}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-[#04210a] disabled:opacity-40 transition-opacity"
                    style={{ backgroundColor: SIGNAL }}
                  >
                    {movePending && <Loader2 size={14} className="animate-spin" />}
                    Save status
                  </button>
                </div>
              )}

              {/* ── Backfill ──────────────────────────────────────────────
                  A deliberate way round the pipeline, for history that already
                  happened. The first version of this was a grey text link and
                  nobody found it — six clicks got used to walk a lead to
                  Customer instead. It is a labelled button now: still visually
                  secondary to the normal move, but plainly there. */}
              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-white/[0.06]">
                {!fixOpen ? (
                  <>
                    <button
                      onClick={() => setFixOpen(true)}
                      className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.07] transition-colors"
                    >
                      <History size={14} />
                      Set any status
                    </button>
                    <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-200">
                      Skips the order above — for recording what already happened, like an old
                      client who is already a customer.
                    </p>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] text-zinc-600 dark:text-zinc-100">
                        Set any status, ignoring the usual order. For recording what already
                        happened.
                      </p>
                      <button
                        onClick={() => setFixOpen(false)}
                        className="shrink-0 rounded-md p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors dark:text-zinc-200"
                        aria-label="Close"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <CustomSelect
                      value={fixTarget}
                      onChange={(v) => {
                        setFixTarget(v as LeadStatus | '')
                        setError(null)
                      }}
                      placeholder="Choose a status"
                      options={[
                        { value: '', label: 'Choose a status' },
                        ...ACTIVE_STATUSES.filter((s) => s !== lead.status).map((s) => ({
                          value: s,
                          label: LEAD_STATUS_LABELS[s],
                        })),
                      ]}
                    />

                    <div>
                      <label className={labelClass}>When it happened (optional)</label>
                      <input
                        type="datetime-local"
                        className={inputClass}
                        value={fixAt}
                        onChange={(e) => setFixAt(e.target.value)}
                      />
                    </div>

                    {fixNeedsReason && (
                      <div>
                        <label className={labelClass}>Reason — required for this status</label>
                        <input
                          className={inputClass}
                          value={fixReason}
                          onChange={(e) => setFixReason(e.target.value)}
                          placeholder="Why this lead closed"
                        />
                      </div>
                    )}

                    <div>
                      <label className={labelClass}>Note for the history</label>
                      <input
                        className={inputClass}
                        value={fixNote}
                        onChange={(e) => setFixNote(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>

                    <button
                      onClick={backfill}
                      disabled={!canFix || movePending}
                      className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.10] rounded-lg px-3.5 py-2 text-sm text-zinc-800 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.10] disabled:opacity-40 transition-colors"
                    >
                      {movePending && <Loader2 size={14} className="animate-spin" />}
                      Correct status
                    </button>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
                      The history will show this as a correction, not a normal step.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* ── Activity log ─────────────────────────────────────────── */}
            <section className={`${cardClass} p-4`}>
              <h2 className="text-sm text-zinc-800 dark:text-white mb-1">Log something</h2>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mb-3">
                Record what happened without moving the lead. A logged call also raises the
                attempt count.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3">
                <div>
                  <label className={labelClass}>What happened</label>
                  <CustomSelect
                    value={actKind}
                    onChange={(v) => setActKind(v as ActivityKind)}
                    options={ACTIVITY_KINDS.map((k) => ({ value: k, label: ACTIVITY_LABELS[k] }))}
                  />
                </div>
                <div>
                  <label className={labelClass}>When (optional, defaults to now)</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={actAt}
                    onChange={(e) => setActAt(e.target.value)}
                    max={nowLocal()}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className={labelClass}>Note</label>
                <textarea
                  className={`${inputClass} min-h-[60px] resize-y`}
                  value={actNote}
                  onChange={(e) => setActNote(e.target.value)}
                  placeholder="No answer, try after 5pm"
                />
              </div>

              <button
                onClick={logIt}
                disabled={savePending}
                className="mt-3 inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.10] rounded-lg px-3.5 py-2 text-sm text-zinc-800 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.10] disabled:opacity-50 transition-colors"
              >
                {savePending && <Loader2 size={14} className="animate-spin" />}
                Add to history
              </button>
            </section>

            {/* ── Editable fields ──────────────────────────────────────── */}
            <section className={`${cardClass} p-4`}>
              <h2 className="text-sm text-zinc-800 dark:text-white mb-3">Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Company" value={form.company_name} onChange={(v) => set('company_name', v)} />
                <Field label="Contact" value={form.contact_name} onChange={(v) => set('contact_name', v)} />
                <Field label="E-mail" type="email" value={form.email} onChange={(v) => set('email', v)} />
                <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
                <Field label="Secondary phone" value={form.phone_secondary} onChange={(v) => set('phone_secondary', v)} />
                <Field label="WhatsApp" value={form.phone_whatsapp} onChange={(v) => set('phone_whatsapp', v)} />
                <Field label="Niche" value={form.niche} onChange={(v) => set('niche', v)} />
                <Field label="Source" value={form.source} onChange={(v) => set('source', v)} />
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Next step</label>
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={form.next_action_at}
                    onChange={(e) => set('next_action_at', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Call attempts</label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    className={inputClass}
                    value={form.contact_attempts}
                    onChange={(e) => set('contact_attempts', e.target.value)}
                  />
                  <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-200">
                    How many times you have rung without getting through. Logging a call raises
                    it; edit it here to correct or clear it.
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <Field label="Notes" value={form.notes} onChange={(v) => set('notes', v)} multiline />
              </div>

              <div className="mt-3">
                <label className={labelClass}>Form answers — raw paste</label>
                <textarea
                  className={`${inputClass} min-h-[90px] resize-y font-mono text-[13px]`}
                  value={form.form_answers_raw}
                  onChange={(e) => set('form_answers_raw', e.target.value)}
                  placeholder={'Form answers\nLead form ID…'}
                />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={savePending}
                  className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.10] rounded-lg px-3.5 py-2 text-sm text-zinc-800 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.10] disabled:opacity-50 transition-colors"
                >
                  {savePending && <Loader2 size={14} className="animate-spin" />}
                  Save details
                </button>
                {saved && (
                  <span className="text-[13px] text-zinc-500 dark:text-zinc-200">Saved</span>
                )}
              </div>
            </section>
          </div>

          {/* ── Right column ───────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Form answers, structured */}
            {lead.form_answers && lead.form_answers.answers.length > 0 && (
              <section className={`${cardClass} p-4`}>
                <h2 className="text-sm text-zinc-800 dark:text-white mb-1">Form answers</h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mb-3">
                  {lead.form_answers.submittedAtText && (
                    <>Submitted: {lead.form_answers.submittedAtText}</>
                  )}
                  {lead.form_answers.leadFormId && (
                    <span className="block font-mono">
                      Form: {lead.form_answers.leadFormId}
                    </span>
                  )}
                </p>
                <dl className="space-y-2.5">
                  {lead.form_answers.answers.map((a, i) => (
                    <div key={`${a.question}-${i}`}>
                      <dt className="text-[13px] text-zinc-500 dark:text-zinc-200">{a.question}</dt>
                      <dd className="text-sm text-zinc-800 dark:text-white">{a.answer || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Meta import fields, shown only when the lead came from a CSV */}
            {(lead.meta_form || lead.meta_channel || lead.meta_stage || lead.meta_owner ||
              lead.labels.length > 0) && (
              <section className={`${cardClass} p-4`}>
                <h2 className="text-sm text-zinc-800 dark:text-white mb-3">Meta data</h2>
                <dl className="space-y-2 text-[13px]">
                  {lead.meta_form && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-200 w-24 shrink-0">Form</dt>
                      <dd className="text-zinc-800 dark:text-white">{lead.meta_form}</dd>
                    </div>
                  )}
                  {lead.meta_channel && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-200 w-24 shrink-0">Channel</dt>
                      <dd className="text-zinc-800 dark:text-white">{lead.meta_channel}</dd>
                    </div>
                  )}
                  {lead.meta_stage && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-200 w-24 shrink-0">Meta stage</dt>
                      <dd className="text-zinc-800 dark:text-white">{lead.meta_stage}</dd>
                    </div>
                  )}
                  {lead.meta_owner && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-200 w-24 shrink-0">Owner</dt>
                      <dd className="text-zinc-800 dark:text-white">{lead.meta_owner}</dd>
                    </div>
                  )}
                  {lead.labels.length > 0 && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-200 w-24 shrink-0">Labels</dt>
                      <dd className="flex flex-wrap gap-1">
                        {lead.labels.map((l) => (
                          <span
                            key={l}
                            className="rounded border border-zinc-300/60 dark:border-white/[0.10] px-1.5 py-0.5 text-[13px] text-zinc-600 dark:text-zinc-100"
                          >
                            {l}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Timeline */}
            <section className={`${cardClass} p-4`}>
              <h2 className="text-sm text-zinc-800 dark:text-white mb-3">History</h2>
              {events.length === 0 ? (
                <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
                  Nothing recorded yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {events.map((e) => (
                    <TimelineEntry key={e.id} event={e} leadId={lead.id} />
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
