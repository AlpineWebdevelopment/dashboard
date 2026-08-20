'use client'

// The available hours, and the rules that turn them into bookable slots.
//
// Everything here is one database row, and it writes itself a beat after you
// stop typing — there is no Save button. The weekly hours are the part that
// gets edited; the numbers below them are set once and then left alone, which
// is why they sit in a quieter block underneath.

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { saveCalendarSettingsAction } from '@/lib/crm/calendar-actions'
import type { CalendarSettingsRow } from '@/lib/crm/calendar'
import { SIGNAL } from './signal'

/**
 * Monday first, Sunday last — the week as a person plans it.
 *
 * The keys stay 0–6 with Sunday at 0, because that is what Date.getDay() and
 * the `availability` column both use. Only the reading order differs.
 */
const DAYS: [string, string][] = [
  ['1', 'Monday'],
  ['2', 'Tuesday'],
  ['3', 'Wednesday'],
  ['4', 'Thursday'],
  ['5', 'Friday'],
  ['6', 'Saturday'],
  ['0', 'Sunday'],
]

const inputClass =
  'panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors dark:[color-scheme:dark]'

const labelClass = 'block text-[13px] text-zinc-500 dark:text-zinc-200 mb-1'

const NUMBERS: {
  key: NumberField
  label: string
  hint: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'slot_duration_minutes', label: 'Slot length (min)', hint: 'How long one booking runs.', min: 5, max: 480, step: 5 },
  { key: 'buffer_before_minutes', label: 'Buffer before (min)', hint: 'Kept clear ahead of a booking.', min: 0, max: 480, step: 5 },
  { key: 'buffer_after_minutes', label: 'Buffer after (min)', hint: 'Kept clear behind a booking.', min: 0, max: 480, step: 5 },
  { key: 'min_notice_minutes', label: 'Minimum notice (min)', hint: 'Nothing sooner than this is offered.', min: 0, max: 43200, step: 15 },
  { key: 'booking_window_days', label: 'Booking window (days)', hint: 'How far ahead people may book.', min: 1, max: 365, step: 1 },
  { key: 'fake_busy_percent', label: 'Shown as busy (%)', hint: 'Share of free slots hidden from visitors.', min: 0, max: 100, step: 5 },
]

type NumberField =
  | 'slot_duration_minutes'
  | 'buffer_before_minutes'
  | 'buffer_after_minutes'
  | 'min_notice_minutes'
  | 'booking_window_days'
  | 'fake_busy_percent'

type DayState = { open: boolean; from: string; to: string }

export default function AvailabilityForm({ settings }: { settings: CalendarSettingsRow }) {
  const [numbers, setNumbers] = useState<Record<NumberField, number>>({
    slot_duration_minutes: settings.slot_duration_minutes,
    buffer_before_minutes: settings.buffer_before_minutes,
    buffer_after_minutes: settings.buffer_after_minutes,
    min_notice_minutes: settings.min_notice_minutes,
    booking_window_days: settings.booking_window_days,
    fake_busy_percent: settings.fake_busy_percent ?? 0,
  })
  const [timezone, setTimezone] = useState(settings.timezone)

  // Only the first range of each day is shown. The column and the engine both
  // take several — a lunch break splits a day in two — but a second row per day
  // buys little for a calendar that is one person's, and the note under the
  // grid says plainly that saving here would flatten one set by hand.
  const [days, setDays] = useState<Record<string, DayState>>(() => {
    const state: Record<string, DayState> = {}
    for (const [key] of DAYS) {
      const range = settings.availability?.[key]?.[0]
      state[key] = {
        open: !!range,
        from: range?.[0] ?? '09:00',
        to: range?.[1] ?? '17:00',
      }
    }
    return state
  })

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const multiRangeDays = DAYS.filter(([key]) => (settings.availability?.[key]?.length ?? 0) > 1)

  /**
   * A day whose end is not after its start, derived rather than stored.
   *
   * Kept out of state on purpose: it is a fact about `days`, and a second copy
   * would need an effect to keep in step — which is both the bug this file
   * would most likely grow and something the lint rules here refuse.
   */
  const invalidDay = DAYS.find(([key]) => days[key].open && days[key].from >= days[key].to)

  // Nothing is saved until something is actually edited. Without this the
  // effect below would write the row back on every page load, unchanged.
  const touched = useRef(false)
  // Only the newest save may report its result. Two in flight can land out of
  // order, and the older one finishing last would leave a stale 'Saved' under
  // an edit that had not been written yet.
  const latestSave = useRef(0)

  function setDay(key: string, patch: Partial<DayState>) {
    touched.current = true
    setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  function setNumber(key: NumberField, raw: string) {
    touched.current = true
    const n = Number(raw)
    setNumbers((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : prev[key] }))
  }

  /**
   * Autosave, a beat after you stop.
   *
   * There is no Save button: this is one row of settings, every field is small,
   * and a button is a step you can forget on the way out of the screen. The
   * delay is what makes it bearable — typing 45 into a number field passes
   * through 4, and saving both would be two writes and two revalidations for
   * one edit.
   *
   * A day with its hours the wrong way round is not sent at all. The action
   * would refuse it, but a message beside the row is more use than a rejection
   * under the panel, and not writing means the last good value stays live.
   */
  useEffect(() => {
    if (!touched.current || invalidDay) return

    const timer = setTimeout(async () => {
      const id = ++latestSave.current
      setStatus('saving')

      const availability: Record<string, [string, string][]> = {}
      for (const [key] of DAYS) {
        const day = days[key]
        if (day.open) availability[key] = [[day.from, day.to]]
      }

      const result = await saveCalendarSettingsAction({ ...numbers, timezone, availability })
      if (id !== latestSave.current) return

      setStatus(result.ok ? 'saved' : 'idle')
      setError(result.ok ? null : result.message)
    }, 700)

    return () => clearTimeout(timer)
  }, [numbers, timezone, days, invalidDay])

  return (
    <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-medium text-zinc-800 dark:text-white">Available hours</h2>
      <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-200">
        What the booking widget offers. A day with no tick has no bookable slots at all.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {DAYS.map(([key, name]) => {
          const day = days[key]
          return (
            <div key={key} className="flex flex-wrap items-center gap-3">
              <label className="inline-flex w-32 shrink-0 cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-white">
                <input
                  type="checkbox"
                  checked={day.open}
                  onChange={(e) => setDay(key, { open: e.target.checked })}
                  className="accent-current"
                  style={{ accentColor: SIGNAL }}
                />
                {name}
              </label>
              <input
                type="time"
                value={day.from}
                disabled={!day.open}
                onChange={(e) => setDay(key, { from: e.target.value })}
                aria-label={`${name} from`}
                className={`${inputClass} w-32 font-mono disabled:opacity-40`}
              />
              <span className="text-[13px] text-zinc-400 dark:text-zinc-400">–</span>
              <input
                type="time"
                value={day.to}
                disabled={!day.open}
                onChange={(e) => setDay(key, { to: e.target.value })}
                aria-label={`${name} to`}
                className={`${inputClass} w-32 font-mono disabled:opacity-40`}
              />
            </div>
          )
        })}
      </div>

      {multiRangeDays.length > 0 && (
        <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">
          {multiRangeDays.map(([, name]) => name).join(', ')}{' '}
          {multiRangeDays.length === 1 ? 'has' : 'have'} more than one range set in the database.
          Only the first is shown, and saving here would drop the rest.
        </p>
      )}

      <div className="mt-6 border-t border-zinc-200 dark:border-white/[0.06] pt-5">
        <h3 className="text-[13px] uppercase tracking-widest text-zinc-500 dark:text-zinc-200">
          Booking rules
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBERS.map(({ key, label, hint, min, max, step }) => (
            <div key={key}>
              <label className={labelClass} htmlFor={`cal-${key}`}>
                {label}
              </label>
              <input
                id={`cal-${key}`}
                type="number"
                value={numbers[key]}
                min={min}
                max={max}
                step={step}
                onChange={(e) => setNumber(key, e.target.value)}
                className={`${inputClass} w-full`}
              />
              <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-200">{hint}</p>
            </div>
          ))}
          <div>
            <label className={labelClass} htmlFor="cal-timezone">
              Timezone
            </label>
            <input
              id="cal-timezone"
              type="text"
              value={timezone}
              onChange={(e) => {
                touched.current = true
                setTimezone(e.target.value)
              }}
              placeholder="Europe/Budapest"
              className={`${inputClass} w-full`}
            />
            <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-200">
              The hours above are read in this zone.
            </p>
          </div>
        </div>
      </div>

      {/* Where the Save button was. The row keeps its height whatever it says,
          so nothing below it moves as the state changes. */}
      <div className="mt-5 flex h-5 items-center gap-1.5 text-[13px]">
        {invalidDay ? (
          <span className="text-amber-700 dark:text-amber-300">
            {invalidDay[1]} ends before it starts — not saved.
          </span>
        ) : error ? (
          <span className="text-amber-700 dark:text-amber-300">{error}</span>
        ) : status === 'saving' ? (
          <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-200">
            <Loader2 size={14} className="animate-spin" />
            Saving…
          </span>
        ) : status === 'saved' ? (
          <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-200">
            <Check size={14} style={{ color: SIGNAL }} />
            Saved
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-200">Changes save themselves.</span>
        )}
      </div>
    </div>
  )
}
