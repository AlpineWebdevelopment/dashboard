'use client'

// What a drop asks for when the drop alone is not enough to say what happened.
//
// A pipe is several statuses, so dragging a card onto Qualified says "somewhere
// in there" and no more. This asks which — but only ever among the moves the
// transition table allows from where the card actually is, so nothing offered
// here can be refused by the trigger for being an illegal edge.
//
// It also collects the reason that Lost, Not qualified and Unreachable cannot
// be entered without (guard CR004), and offers a next-step date for the states
// a lead can quietly rot in.

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  LEAD_STATUS_LABELS,
  NEEDS_REASON,
  SUGGESTS_DATE,
  type LeadStatus,
} from '@/lib/lead-status'
import { fromLocalInput, leadTitle } from '@/lib/crm/format'
import type { Lead } from '@/lib/crm/leads'
import CustomSelect from '../CustomSelect'

export type DropRequest = {
  lead: Lead
  /** Already filtered to the legal moves into the dropped-on pipe. Never empty. */
  targets: LeadStatus[]
  /** The card was dropped back on the column it came from. Changes the wording:
   *  that gesture reads as a cancel, so the dialog has to say plainly that it
   *  is about to change something. */
  samePipe: boolean
}

const inputClass =
  'w-full panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

const labelClass = 'block text-[13px] text-zinc-500 dark:text-zinc-200 mb-1'

export default function DropStatusDialog({
  request,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  request: DropRequest
  pending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (input: {
    toStatus: LeadStatus
    nextActionAt: string | null
    lostReason: string | null
    note: string | null
  }) => void
}) {
  const { lead, targets, samePipe } = request
  const [target, setTarget] = useState<LeadStatus>(targets[0])
  const [nextActionAt, setNextActionAt] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const needsReason = NEEDS_REASON.has(target)
  const suggestsDate = SUGGESTS_DATE.has(target)
  const blocked = pending || (needsReason && reason.trim() === '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm panel bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.10] rounded-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-sm text-zinc-800 dark:text-white truncate">{leadTitle(lead)}</h2>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
              {targets.length > 1
                ? 'Which one?'
                : `${LEAD_STATUS_LABELS[lead.status]} → ${LEAD_STATUS_LABELS[targets[0]]}`}
            </p>
            {/* Says out loud that a drop which looked like a no-op is a change,
                and that cancelling leaves the lead exactly as it is. */}
            {samePipe && (
              <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-200">
                Same column — nothing changes unless you confirm.
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:text-zinc-800 dark:text-zinc-200 dark:hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          {/* One legal target needs no choosing — the dialog is open for the
              reason, not for the status. */}
          {targets.length > 1 && (
            <div>
              <label className={labelClass}>New status</label>
              <CustomSelect
                value={target}
                onChange={(v) => setTarget(v as LeadStatus)}
                ariaLabel="New status"
                options={targets.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))}
              />
            </div>
          )}

          {needsReason && (
            <div>
              <label className={labelClass}>Reason (required)</label>
              <input
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why?"
                autoFocus
              />
            </div>
          )}

          {suggestsDate && (
            <div>
              <label className={labelClass}>Next step (optional)</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Note (optional)</label>
            <input
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened?"
            />
          </div>

          {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onConfirm({
                  toStatus: target,
                  // Converted here rather than sent as the raw datetime-local
                  // string, matching what the lead page does — the input is in
                  // the browser's timezone and the column is an instant.
                  nextActionAt: fromLocalInput(nextActionAt),
                  lostReason: reason.trim() === '' ? null : reason.trim(),
                  note: note.trim() === '' ? null : note.trim(),
                })
              }
              disabled={blocked}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] panel bg-zinc-100/60 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.10] text-zinc-800 dark:text-white hover:bg-zinc-200/60 dark:hover:bg-white/[0.10] disabled:opacity-50 transition-colors"
            >
              {pending && <Loader2 size={13} className="animate-spin" />}
              Move
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
