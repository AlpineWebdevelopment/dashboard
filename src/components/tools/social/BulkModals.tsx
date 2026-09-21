'use client'

// The bulk bar's dialogs: apply a caption, apply targets, spread times, and
// auto-fill from slots. Each gathers input and hands it back; the editor runs
// the action and reports per-post problems.

import { useState } from 'react'
import { X } from 'lucide-react'
import { fromLocalInput, toLocalInput } from '@/lib/social/time'
import type { SocialAccount, SocialSlot } from '@/lib/social/types'
import { Modal, Segmented, btnPrimary, btnSecondary, inputCls, FieldLabel } from '@/components/tools/ui'
import { AccountAvatar, accountLabel } from './shared'
import { describeDays } from './SlotsEditor'

function Shell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="px-5 py-4 overflow-y-auto space-y-4">{children}</div>
      <div className="px-5 py-3 border-t border-zinc-200 dark:border-white/[0.08] flex justify-end gap-2">{footer}</div>
    </Modal>
  )
}

export function CaptionModal({
  count,
  onClose,
  onApply,
}: {
  count: number
  onClose: () => void
  onApply: (text: string, mode: 'replace' | 'prepend' | 'append') => void
}) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'replace' | 'prepend' | 'append'>('replace')
  return (
    <Shell
      title={`Caption for ${count} post${count === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={`${btnSecondary(true)} px-4 py-2 text-[13px]`}>Cancel</button>
          <button onClick={() => onApply(text, mode)} className={`${btnPrimary('rose', true)} px-4 py-2 text-[13px]`}>Apply</button>
        </>
      }
    >
      <Segmented
        accent="rose"
        nested
        value={mode}
        onChange={setMode}
        options={[
          { value: 'replace', label: 'Replace' },
          { value: 'prepend', label: 'Add before' },
          { value: 'append', label: 'Add after' },
        ]}
      />
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={mode === 'replace' ? 'New caption for every selected post' : 'Text to add, e.g. your hashtag block'}
        className={`${inputCls('rose', true)} resize-y leading-relaxed`}
      />
    </Shell>
  )
}

export function TargetsModal({
  count,
  accounts,
  onClose,
  onApply,
}: {
  count: number
  accounts: SocialAccount[]
  onClose: () => void
  onApply: (ids: string[], mode: 'set' | 'add' | 'remove') => void
}) {
  const [ids, setIds] = useState<string[]>([])
  const [mode, setMode] = useState<'set' | 'add' | 'remove'>('set')
  return (
    <Shell
      title={`Targets for ${count} post${count === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={`${btnSecondary(true)} px-4 py-2 text-[13px]`}>Cancel</button>
          <button
            onClick={() => onApply(ids, mode)}
            disabled={mode !== 'set' && !ids.length}
            className={`${btnPrimary('rose', true)} px-4 py-2 text-[13px]`}
          >
            Apply
          </button>
        </>
      }
    >
      <Segmented
        accent="rose"
        nested
        value={mode}
        onChange={setMode}
        options={[
          { value: 'set', label: 'Set exactly' },
          { value: 'add', label: 'Add' },
          { value: 'remove', label: 'Remove' },
        ]}
      />
      <div className="space-y-1">
        {accounts.map((a) => (
          <label key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.05] cursor-pointer">
            <input
              type="checkbox"
              checked={ids.includes(a.id)}
              onChange={(e) => setIds((v) => (e.target.checked ? [...v, a.id] : v.filter((x) => x !== a.id)))}
              className="w-4 h-4 accent-rose-500"
            />
            <AccountAvatar account={a} size={24} />
            <span className="text-[13px] text-zinc-800 dark:text-white">{accountLabel(a)}</span>
          </label>
        ))}
        {!accounts.length && <p className="text-[13px] text-zinc-500 dark:text-zinc-200">Switch accounts on in Accounts first.</p>}
      </div>
    </Shell>
  )
}

export function TimeModal({
  count,
  onClose,
  onApply,
}: {
  count: number
  onClose: () => void
  onApply: (startIso: string, stepMinutes: number) => void
}) {
  // Defaults to the top of the next hour; read once, when the dialog opens.
  const [start, setStart] = useState(() => toLocalInput(new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000).toISOString()))
  const [step, setStep] = useState(24)
  const [unit, setUnit] = useState<'hours' | 'minutes'>('hours')
  const startIso = fromLocalInput(start)
  return (
    <Shell
      title={`Times for ${count} post${count === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={`${btnSecondary(true)} px-4 py-2 text-[13px]`}>Cancel</button>
          <button
            onClick={() => startIso && onApply(startIso, unit === 'hours' ? step * 60 : step)}
            disabled={!startIso || step < 0}
            className={`${btnPrimary('rose', true)} px-4 py-2 text-[13px]`}
          >
            Apply
          </button>
        </>
      }
    >
      <div>
        <FieldLabel>First post (Budapest time)</FieldLabel>
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className={`${inputCls('rose', true)} [color-scheme:light] dark:[color-scheme:dark]`}
        />
      </div>
      <div>
        <FieldLabel>Then one every</FieldLabel>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={step}
            onChange={(e) => setStep(Math.max(0, Number(e.target.value)))}
            className={`${inputCls('rose', true)} w-24`}
          />
          <Segmented
            accent="rose"
            nested
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'hours', label: 'hours' },
              { value: 'minutes', label: 'minutes' },
            ]}
          />
        </div>
        <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-200">
          In the table’s current order. 0 gives every post the same time.
        </p>
      </div>
    </Shell>
  )
}

export function FillModal({
  count,
  accounts,
  slots,
  onClose,
  onApply,
}: {
  count: number
  accounts: SocialAccount[]
  slots: SocialSlot[]
  onClose: () => void
  onApply: (schedule: boolean) => void
}) {
  const [schedule, setSchedule] = useState(false)
  const withSlots = accounts.filter((a) => slots.some((s) => s.account_id === a.id && s.active))
  return (
    <Shell
      title={`Auto-fill ${count} post${count === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={`${btnSecondary(true)} px-4 py-2 text-[13px]`}>Cancel</button>
          <button onClick={() => onApply(schedule)} disabled={!withSlots.length} className={`${btnPrimary('rose', true)} px-4 py-2 text-[13px]`}>
            Fill slots
          </button>
        </>
      }
    >
      <p className="text-[13px] text-zinc-600 dark:text-zinc-200 leading-relaxed">
        Each post, in table order, gets the next slot that is free on every account it targets. Slots already given to
        another post are skipped.
      </p>
      {withSlots.length ? (
        <div className="space-y-1.5">
          {withSlots.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-[13px]">
              <AccountAvatar account={a} size={22} />
              <span className="text-zinc-800 dark:text-white">{accountLabel(a)}</span>
              <span className="text-zinc-500 dark:text-zinc-200">
                {slots
                  .filter((s) => s.account_id === a.id && s.active)
                  .map((s) => `${s.time_local} ${describeDays(s.weekdays).toLowerCase()}`)
                  .join(' · ')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-amber-700 dark:text-amber-300">No account has time slots yet. Add them under Accounts.</p>
      )}
      <label className="flex items-center gap-2 text-[13px] text-zinc-800 dark:text-white cursor-pointer">
        <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="w-4 h-4 accent-rose-500" />
        Schedule them straight away
      </label>
    </Shell>
  )
}
