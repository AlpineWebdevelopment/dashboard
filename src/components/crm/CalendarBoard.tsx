'use client'

// The booking calendar, a column per day.
//
// Every slot your available hours produce is drawn, including the ones the
// scarcity dial is hiding from visitors. A calendar that silently left a third
// of its rows out would be no use for the question you actually open it to
// answer — how full am I on Thursday.
//
// Clicking a slot does the one obvious thing to it: a free slot becomes
// blocked, a blocked one becomes free, a hidden one is forced back into the
// visitor's list, and an unlocked one goes back to being hidden. A real booking
// is the exception — it belongs to a lead, and it is undone on the lead, not
// here.

import { useTransition, useState } from 'react'
import Link from 'next/link'
import type { AdminDay, AdminSlot, SlotKind } from '@/lib/crm/availability'
import type { BookedSlot } from '@/lib/crm/calendar'
import {
  blockSlotAction,
  relockSlotAction,
  unblockSlotAction,
  unlockSlotAction,
} from '@/lib/crm/calendar-actions'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * How each kind reads.
 *
 * No green anywhere: this CRM spends its one accent on a next step that is due
 * (see signal.ts), and a calendar full of green would take that meaning away.
 * The kinds are told apart by weight instead — a booking is the solid one,
 * because it is the only row here that is somebody else's.
 */
const KINDS: Record<SlotKind, { label: string; hint: string; className: string; swatch: string }> = {
  available: {
    label: 'Free',
    hint: 'Click to block this out',
    className:
      'panel bg-white/70 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-white hover:border-zinc-400 dark:hover:border-white/[0.2]',
    swatch: 'bg-white dark:bg-white/[0.06] border-zinc-300 dark:border-white/[0.14]',
  },
  booked: {
    label: 'Booked',
    hint: 'A real booking — open the lead to change it',
    className:
      'bg-zinc-800 dark:bg-white/[0.16] border-zinc-800 dark:border-white/[0.22] text-white dark:text-white',
    swatch: 'bg-zinc-800 dark:bg-white/[0.22] border-zinc-800 dark:border-white/[0.28]',
  },
  blocked: {
    label: 'Blocked',
    hint: 'Blocked by hand — click to free it',
    className:
      'panel bg-zinc-200/70 dark:bg-white/[0.09] border-zinc-300 dark:border-white/[0.14] text-zinc-600 dark:text-zinc-200 line-through hover:text-zinc-800 dark:hover:text-white',
    swatch: 'bg-zinc-200 dark:bg-white/[0.12] border-zinc-300 dark:border-white/[0.16]',
  },
  hidden: {
    label: 'Hidden',
    hint: 'Held back from visitors — click to open it up',
    className:
      'panel bg-zinc-100/50 dark:bg-white/[0.02] border-dashed border-zinc-200 dark:border-white/[0.10] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white',
    swatch: 'bg-zinc-100 dark:bg-white/[0.03] border-dashed border-zinc-300 dark:border-white/[0.16]',
  },
  unlocked: {
    label: 'Reopened',
    hint: 'Was hidden, forced open — click to hide it again',
    className:
      'panel bg-white/70 dark:bg-white/[0.05] border-zinc-400 dark:border-white/[0.24] text-zinc-700 dark:text-white hover:border-zinc-500 dark:hover:border-white/[0.32]',
    swatch: 'bg-white dark:bg-white/[0.08] border-zinc-400 dark:border-white/[0.28]',
  },
}

/** 'YYYY-MM-DD' → 'Mon 12 Aug', without going through Date and a timezone. */
function dayHeading(date: string, weekday: number) {
  const [, month, day] = date.split('-').map(Number)
  return { dow: WEEKDAYS[weekday] ?? '', day, month: MONTHS[month - 1] ?? '' }
}

export default function CalendarBoard({
  days,
  booked,
  timezone,
}: {
  days: AdminDay[]
  booked: BookedSlot[]
  timezone: string
}) {
  const [pending, startTransition] = useTransition()
  // Which slot is mid-flight, so only the one you clicked dims rather than the
  // whole board.
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** The meeting covering a slot, if the slot is the meeting itself and not
   *  the buffer either side of it. */
  function meetingAt(start: string): BookedSlot | undefined {
    const t = new Date(start).getTime()
    return booked.find(
      (b) => t >= new Date(b.start).getTime() && t < new Date(b.end).getTime()
    )
  }

  function act(slot: AdminSlot) {
    if (slot.kind === 'booked') return

    setBusySlot(slot.start)
    setError(null)
    startTransition(async () => {
      const result =
        slot.kind === 'available'
          ? await blockSlotAction(slot.start)
          : slot.kind === 'blocked'
            ? slot.blockId
              ? await unblockSlotAction(slot.blockId)
              : { ok: false as const, message: 'That block has already gone.' }
            : slot.kind === 'hidden'
              ? await unlockSlotAction(slot.start)
              : await relockSlotAction(slot.start)

      setBusySlot(null)
      if (!result.ok) setError(result.message)
    })
  }

  if (days.length === 0) {
    return (
      <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl">
        <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-200">
          No bookable slots in the window. Tick a day below and give it hours.
        </p>
      </div>
    )
  }

  return (
    <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(Object.keys(KINDS) as SlotKind[]).map((kind) => (
          <span
            key={kind}
            className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-200"
          >
            <span className={`inline-block h-3 w-3 rounded-sm border ${KINDS[kind].swatch}`} />
            {KINDS[kind].label}
          </span>
        ))}
        <span className="ml-auto text-[12px] text-zinc-500 dark:text-zinc-200">{timezone}</span>
      </div>

      {error && (
        <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-300">{error}</p>
      )}

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {days.map((day) => {
          const heading = dayHeading(day.date, day.weekday)
          return (
            <div key={day.date} className="w-[132px] shrink-0">
              <div className="mb-2 text-center">
                <div className="text-[12px] uppercase tracking-widest text-zinc-500 dark:text-zinc-200">
                  {heading.dow}
                </div>
                <div className="text-sm text-zinc-800 dark:text-white">
                  {heading.day} {heading.month}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                {day.slots.map((slot) => {
                  const kind = KINDS[slot.kind]
                  const meeting = slot.kind === 'booked' ? meetingAt(slot.start) : undefined
                  const dimmed = busySlot === slot.start && pending

                  const body = (
                    <>
                      <span className="font-mono text-[13px]">{slot.label}</span>
                      {meeting && (
                        <span className="mt-0.5 block truncate text-[12px] opacity-80">
                          {meeting.leadName}
                        </span>
                      )}
                    </>
                  )

                  const shared = `w-full rounded-lg border px-2.5 py-1.5 text-left transition-colors ${kind.className} ${
                    dimmed ? 'opacity-50' : ''
                  }`

                  // A booking is the one slot that leads somewhere: to the lead
                  // it belongs to. The buffer minutes around it are not a lead,
                  // so they stay inert.
                  if (meeting) {
                    return (
                      <Link
                        key={slot.start}
                        href={`/atrium-crm/${meeting.leadId}`}
                        title={`${meeting.leadName} — open the lead`}
                        className={`${shared} block`}
                      >
                        {body}
                      </Link>
                    )
                  }

                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => act(slot)}
                      disabled={slot.kind === 'booked' || dimmed}
                      title={slot.kind === 'booked' ? 'Buffer around a booking' : kind.hint}
                      className={`${shared} ${
                        slot.kind === 'booked' ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      {body}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
