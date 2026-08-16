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
import { ArrowLeft, Loader2, Phone, Trash2 } from 'lucide-react'
import type { Lead, LeadEvent } from '@/lib/crm/leads'
import { LEAD_STATUS_LABELS, type LeadStatus } from '@/lib/lead-status'
import { due, formatDateTime, leadTitle, toLocalInput } from '@/lib/crm/format'
import {
  deleteLeadAction,
  logAttemptAction,
  transitionLeadAction,
  updateLeadAction,
} from '@/lib/crm/actions'
import CustomSelect from '../CustomSelect'

const SIGNAL = '#6DBC61'

/** States that cannot be entered without a follow-up date (guard CR002). */
const NEEDS_DATE: ReadonlySet<string> = new Set([
  'CONTACTING', 'MEETING_CALL', 'DEMO_CALL', 'CONTRACT_CALL', 'DECISION_PENDING', 'NURTURE',
])

/** States that cannot be entered without a reason (guard CR004). */
const NEEDS_REASON: ReadonlySet<string> = new Set(['LOST', 'DISQUALIFIED', 'UNREACHABLE'])

const inputClass =
  'w-full panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

const labelClass = 'block text-[12px] text-zinc-500 dark:text-zinc-400 mb-1'

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

  const needsDate = target !== '' && NEEDS_DATE.has(target)
  const needsReason = target !== '' && NEEDS_REASON.has(target)
  const canMove =
    target !== '' &&
    (!needsDate || nextAt.trim() !== '') &&
    (!needsReason || reason.trim() !== '')

  function move() {
    if (!canMove) return
    setError(null)
    startMove(async () => {
      const result = await transitionLeadAction(lead.id, {
        toStatus: target as LeadStatus,
        nextActionAt: needsDate ? new Date(nextAt).toISOString() : '',
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
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  function logCall() {
    startSave(async () => {
      await logAttemptAction(lead.id)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm('Biztosan törli ezt a leadet? Az előzményei is törlődnek.')) return
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

  return (
    <div className="min-h-screen px-4 sm:px-8 pt-8 sm:pt-10 pb-16">
      <div className="max-w-5xl">
        <Link
          href="/atrium-crm"
          className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Vissza a leadekhez
        </Link>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl text-zinc-800 dark:text-white truncate">{leadTitle(lead)}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500 dark:text-zinc-400">
              {lead.contact_name && lead.company_name && <span>{lead.contact_name}</span>}
              {lead.email && <span>{lead.email}</span>}
              {lead.phone && <span className="font-mono">{lead.phone}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-md border border-zinc-300/60 dark:border-white/[0.10] bg-zinc-500/5 dark:bg-white/[0.04] px-2 py-0.5 text-[12px] text-zinc-600 dark:text-zinc-300">
                {LEAD_STATUS_LABELS[lead.status]}
              </span>
              {!d.none && (
                <span
                  className="font-mono text-[12px]"
                  style={d.overdue ? { color: SIGNAL } : undefined}
                >
                  {d.text}
                </span>
              )}
              <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">
                {lead.contact_attempts} kísérlet
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={logCall}
              disabled={savePending}
              className="inline-flex items-center gap-1.5 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-white/[0.07] transition-colors"
            >
              <Phone size={14} />
              Hívás rögzítése
            </button>
            <button
              onClick={remove}
              disabled={savePending}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              aria-label="Lead törlése"
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
              <h2 className="text-sm text-zinc-800 dark:text-white mb-3">Státusz módosítása</h2>

              {allowed.length === 0 ? (
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Ez a státusz lezárt, innen nincs további lépés.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Új státusz</label>
                    <CustomSelect
                      value={target}
                      onChange={(v) => {
                        setTarget(v as LeadStatus | '')
                        setError(null)
                      }}
                      placeholder="Válasszon státuszt"
                      options={[
                        { value: '', label: 'Válasszon státuszt' },
                        ...allowed.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
                      ]}
                    />
                  </div>

                  {needsDate && (
                    <div>
                      <label className={labelClass}>
                        Következő lépés dátuma — kötelező ehhez a státuszhoz
                      </label>
                      <input
                        type="datetime-local"
                        className={inputClass}
                        value={nextAt}
                        onChange={(e) => setNextAt(e.target.value)}
                      />
                    </div>
                  )}

                  {needsReason && (
                    <div>
                      <label className={labelClass}>
                        Indoklás — kötelező ehhez a státuszhoz
                      </label>
                      <input
                        className={inputClass}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Miért zárul le a lead"
                      />
                    </div>
                  )}

                  {target !== '' && (
                    <div>
                      <label className={labelClass}>Megjegyzés az előzményhez</label>
                      <input
                        className={inputClass}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Opcionális"
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
                    Státusz mentése
                  </button>
                </div>
              )}
            </section>

            {/* ── Editable fields ──────────────────────────────────────── */}
            <section className={`${cardClass} p-4`}>
              <h2 className="text-sm text-zinc-800 dark:text-white mb-3">Adatok</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Cégnév" value={form.company_name} onChange={(v) => set('company_name', v)} />
                <Field label="Kapcsolattartó" value={form.contact_name} onChange={(v) => set('contact_name', v)} />
                <Field label="E-mail" type="email" value={form.email} onChange={(v) => set('email', v)} />
                <Field label="Telefon" value={form.phone} onChange={(v) => set('phone', v)} />
                <Field label="Másodlagos telefon" value={form.phone_secondary} onChange={(v) => set('phone_secondary', v)} />
                <Field label="WhatsApp" value={form.phone_whatsapp} onChange={(v) => set('phone_whatsapp', v)} />
                <Field label="Niche" value={form.niche} onChange={(v) => set('niche', v)} />
                <Field label="Forrás" value={form.source} onChange={(v) => set('source', v)} />
              </div>

              <div className="mt-3">
                <label className={labelClass}>Következő lépés</label>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.next_action_at}
                  onChange={(e) => set('next_action_at', e.target.value)}
                />
              </div>

              <div className="mt-3">
                <Field label="Megjegyzés" value={form.notes} onChange={(v) => set('notes', v)} multiline />
              </div>

              <div className="mt-3">
                <label className={labelClass}>Űrlap válaszok — nyers beillesztés</label>
                <textarea
                  className={`${inputClass} min-h-[90px] resize-y font-mono text-[12px]`}
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
                  Adatok mentése
                </button>
                {saved && (
                  <span className="text-[13px] text-zinc-500 dark:text-zinc-400">Mentve</span>
                )}
              </div>
            </section>
          </div>

          {/* ── Right column ───────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Form answers, structured */}
            {lead.form_answers && lead.form_answers.answers.length > 0 && (
              <section className={`${cardClass} p-4`}>
                <h2 className="text-sm text-zinc-800 dark:text-white mb-1">Űrlap válaszok</h2>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                  {lead.form_answers.submittedAtText && (
                    <>Beküldve: {lead.form_answers.submittedAtText}</>
                  )}
                  {lead.form_answers.leadFormId && (
                    <span className="block font-mono">
                      Űrlap: {lead.form_answers.leadFormId}
                    </span>
                  )}
                </p>
                <dl className="space-y-2.5">
                  {lead.form_answers.answers.map((a, i) => (
                    <div key={`${a.question}-${i}`}>
                      <dt className="text-[12px] text-zinc-500 dark:text-zinc-400">{a.question}</dt>
                      <dd className="text-sm text-zinc-800 dark:text-zinc-100">{a.answer || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Meta import fields, shown only when the lead came from a CSV */}
            {(lead.meta_form || lead.meta_channel || lead.meta_stage || lead.meta_owner ||
              lead.labels.length > 0) && (
              <section className={`${cardClass} p-4`}>
                <h2 className="text-sm text-zinc-800 dark:text-white mb-3">Meta adatok</h2>
                <dl className="space-y-2 text-[13px]">
                  {lead.meta_form && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-400 w-24 shrink-0">Űrlap</dt>
                      <dd className="text-zinc-800 dark:text-zinc-100">{lead.meta_form}</dd>
                    </div>
                  )}
                  {lead.meta_channel && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-400 w-24 shrink-0">Csatorna</dt>
                      <dd className="text-zinc-800 dark:text-zinc-100">{lead.meta_channel}</dd>
                    </div>
                  )}
                  {lead.meta_stage && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-400 w-24 shrink-0">Meta szakasz</dt>
                      <dd className="text-zinc-800 dark:text-zinc-100">{lead.meta_stage}</dd>
                    </div>
                  )}
                  {lead.meta_owner && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-400 w-24 shrink-0">Felelős</dt>
                      <dd className="text-zinc-800 dark:text-zinc-100">{lead.meta_owner}</dd>
                    </div>
                  )}
                  {lead.labels.length > 0 && (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500 dark:text-zinc-400 w-24 shrink-0">Címkék</dt>
                      <dd className="flex flex-wrap gap-1">
                        {lead.labels.map((l) => (
                          <span
                            key={l}
                            className="rounded border border-zinc-300/60 dark:border-white/[0.10] px-1.5 py-0.5 text-[12px] text-zinc-600 dark:text-zinc-300"
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
              <h2 className="text-sm text-zinc-800 dark:text-white mb-3">Előzmények</h2>
              {events.length === 0 ? (
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                  Még nincs státuszváltás.
                </p>
              ) : (
                <ol className="space-y-3">
                  {events.map((e) => (
                    <li key={e.id} className="border-l border-zinc-200 dark:border-white/[0.10] pl-3">
                      <div className="text-[13px] text-zinc-800 dark:text-zinc-100">
                        {e.from_status ? LEAD_STATUS_LABELS[e.from_status] : 'Létrehozva'}
                        {' → '}
                        {LEAD_STATUS_LABELS[e.to_status]}
                      </div>
                      <div className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">
                        {formatDateTime(e.occurred_at)}
                      </div>
                      {e.note && (
                        <div className="mt-0.5 text-[13px] text-zinc-600 dark:text-zinc-300">
                          {e.note}
                        </div>
                      )}
                    </li>
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
