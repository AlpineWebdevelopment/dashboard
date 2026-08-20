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
 * 45° hatching for the slots nobody can book.
 *
 * This is what a strikethrough was doing before. One horizontal rule through
 * four characters of a monospaced time is a small mark on a large cell;
 * diagonals cross the whole surface, so a slot reads as unavailable from the
 * shape of the block rather than from a detail inside it.
 *
 * currentColor, so the stripes follow whatever colour that slot's text is in
 * and need no second value for the other theme.
 */
const HATCH =
  'repeating-linear-gradient(45deg, color-mix(in srgb, currentColor 18%, transparent) 0 1.5px, transparent 1.5px 7px)'

/**
 * The same, over the tint `.panel` paints when a wallpaper is set.
 *
 * An inline background-image replaces the one the class sets, so the panel
 * layer has to be restated here or a blocked slot loses its frost over a
 * photo. Earlier layers paint above later ones (STYLING.md §1), which is why
 * the stripes are listed first.
 */
const HATCH_ON_PANEL = `${HATCH}, linear-gradient(var(--panel-bg), var(--panel-bg))`

/** Tighter, for the 12px legend swatches — at the wide period they read as one line. */
const HATCH_FINE =
  'repeating-linear-gradient(45deg, color-mix(in srgb, currentColor 36%, transparent) 0 1px, transparent 1px 3.5px)'

/**
 * How each kind reads.
 *
 * The first version separated these by a few percent of fill and nothing else,
 * which in practice meant a free slot and a held-back one looked identical in
 * both themes. So the split is carried by three things at once now, and the
 * first of them survives on its own:
 *
 *   fill   = bright and raised for the two a visitor can book, flat for the
 *            rest. Booked is the inverse of both — solid dark, because it is
 *            the only slot here that is somebody else's.
 *   hatch  = crossed with diagonals means unbookable. Booked is the exception:
 *            it carries a lead's name, and striping over a name costs
 *            legibility for a distinction its dark fill already makes.
 *   border = dashed for the ones scarcity is holding back.
 *
 * No green anywhere: this CRM spends its one accent on a next step that is due
 * (see signal.ts), and a calendar full of green would take that meaning away.
 */
const KINDS: Record<
  SlotKind,
  { label: string; hint: string; className: string; swatch: string; hatch?: string }
> = {
  available: {
    label: 'Free',
    hint: 'Click to block this out',
    className:
      'panel bg-white dark:bg-white/[0.13] border-zinc-300 dark:border-white/[0.22] text-zinc-800 dark:text-white shadow-sm hover:border-zinc-500 dark:hover:border-white/[0.34]',
    swatch: 'bg-white dark:bg-white/[0.13] border-zinc-300 dark:border-white/[0.22]',
  },
  booked: {
    label: 'Booked',
    hint: 'A real booking — open the lead to change it',
    className:
      'bg-zinc-800 dark:bg-white/[0.28] border-zinc-800 dark:border-white/[0.34] text-white dark:text-white',
    swatch: 'bg-zinc-800 dark:bg-white/[0.28] border-zinc-800 dark:border-white/[0.34]',
  },
  blocked: {
    label: 'Blocked',
    hint: 'Blocked by hand — click to free it',
    className:
      'panel bg-zinc-200/55 dark:bg-white/[0.03] border-zinc-300/70 dark:border-white/[0.07] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white',
    swatch: 'bg-zinc-200 dark:bg-white/[0.04] border-zinc-300 dark:border-white/[0.07]',
    hatch: HATCH_ON_PANEL,
  },
  hidden: {
    label: 'Hidden',
    hint: 'Held back from visitors — click to open it up',
    className:
      'bg-transparent border-dashed border-zinc-300/70 dark:border-white/[0.09] text-zinc-500 dark:text-zinc-200 hover:border-zinc-500 dark:hover:border-white/[0.2] hover:text-zinc-800 dark:hover:text-white',
    swatch: 'bg-transparent border-dashed border-zinc-400 dark:border-white/[0.2]',
    hatch: HATCH,
  },
  unlocked: {
    label: 'Reopened',
    hint: 'Was hidden, forced open — click to hide it again',
    className:
      'panel bg-white dark:bg-white/[0.13] border-zinc-500 dark:border-white/[0.45] text-zinc-800 dark:text-white shadow-sm hover:border-zinc-600 dark:hover:border-white/[0.6]',
    swatch: 'bg-white dark:bg-white/[0.13] border-zinc-500 dark:border-white/[0.45]',
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
            <span
              className={`inline-block h-3 w-3 rounded-sm border ${KINDS[kind].swatch}`}
              style={KINDS[kind].hatch ? { backgroundImage: HATCH_FINE } : undefined}
            />
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
                      style={kind.hatch ? { backgroundImage: kind.hatch } : undefined}
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
