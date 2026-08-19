'use client'

// The same leads as the worklist, laid out by pipe.
//
// The worklist answers "who do I call now". This answers "what does the
// business look like" — where the leads are bunched, which stretch is empty,
// how much is dead. It is the same filtered set in both views, so a search or
// a status filter narrows this exactly as it narrows the table.
//
// Cards carry a handful of things and no more: who it is, what state they are
// in, how long it has been sitting, and two markers for what you would
// otherwise have to open the lead to see. A card you have to read is a card you
// may as well have clicked.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, StickyNote } from 'lucide-react'
import type { Lead, TransitionMap } from '@/lib/crm/leads'
import {
  LEAD_PIPES,
  LEAD_PIPE_LABELS,
  LEAD_STATUS_PIPE,
  NEEDS_REASON,
  type LeadPipe,
  type LeadStatus,
} from '@/lib/lead-status'
import { due, formatDateTime, leadTitle, sinceShort } from '@/lib/crm/format'
import { transitionLeadAction } from '@/lib/crm/actions'
import StatusBadge, { pipeClassFor } from './StatusBadge'
import DropStatusDialog, { type DropRequest } from './DropStatusDialog'
import { SIGNAL } from './signal'

/**
 * The moves a lead can make that land in a given pipe.
 *
 * Read from the transition map the server sent, which is the transition table
 * itself — so a target this returns is one the trigger will accept, and a
 * target it does not return is one no amount of dragging can reach.
 */
function targetsInPipe(
  status: LeadStatus,
  pipe: LeadPipe,
  transitions: TransitionMap
): LeadStatus[] {
  return (transitions[status] ?? []).filter((s) => LEAD_STATUS_PIPE[s] === pipe)
}

/**
 * A marker that gives up what it knows on hover, or on tap.
 *
 * Hover alone would make both card markers dead weight on a phone, which is
 * where a compact card matters most. So the trigger is a real button: hover
 * opens it on a desktop, a tap opens it on a touch screen, and a second tap
 * closes it. Being a button also means it is reachable from the keyboard,
 * which a hover-only tooltip never is.
 *
 * The popover opens upwards. Cards sit in a scrolling column, and the last
 * card in a column is the one most likely to be near the bottom of the screen.
 */
function Marker({
  label,
  detail,
  children,
}: {
  label: string
  detail: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <span className="group/marker pointer-events-auto relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          // The whole card is a link. Neither of these markers is a way of
          // opening it.
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="flex items-center rounded p-0.5 text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-white transition-colors"
      >
        {children}
      </button>
      <span
        role="tooltip"
        className={`absolute bottom-full right-0 z-30 mb-1.5 w-56 max-w-[70vw] whitespace-pre-wrap wrap-break-word rounded-lg border border-zinc-200 dark:border-white/[0.10] bg-white dark:bg-zinc-900 px-3 py-2 text-left text-[13px] leading-relaxed text-zinc-700 dark:text-white shadow-lg ${
          open ? 'block' : 'hidden group-hover/marker:block'
        }`}
      >
        {detail}
      </span>
    </span>
  )
}

function LeadCard({
  lead,
  now,
  moving,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead
  now: number
  moving: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const title = leadTitle(lead)
  const subtitle = lead.company_name && lead.contact_name ? lead.contact_name : null
  const notes = lead.notes?.trim() ?? ''
  const d = due(lead.next_action_at, new Date(now))
  const touched = lead.last_event_at ?? lead.created_at

  return (
    <div
      draggable={!moving}
      onDragStart={(e) => {
        // The payload is set so the browser treats this as a real drag. The
        // component state is what the columns actually read — dataTransfer
        // cannot be inspected during dragover, only on drop, and the columns
        // need to know what is in the air before then.
        e.dataTransfer.setData('text/plain', lead.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={`group/card relative rounded-lg border border-zinc-200 dark:border-white/[0.07] panel bg-white dark:bg-white/[0.03] p-2.5 transition-colors ${
        moving
          ? 'opacity-50'
          : 'cursor-grab active:cursor-grabbing hover:border-zinc-300 dark:hover:border-white/[0.14]'
      }`}
    >
      {/* The link sits under the whole card rather than around it: a button
          inside an anchor is invalid, and the markers have to be buttons. */}
      <Link
        href={`/atrium-crm/${lead.id}`}
        aria-label={title}
        className="absolute inset-0 rounded-lg"
        // Dragging a link is a gesture the browser already has, and it would
        // fight the one this card is trying to offer.
        draggable={false}
      />

      <div className="pointer-events-none relative">
        <div className="truncate text-sm text-zinc-800 dark:text-white" title={title}>
          {title}
        </div>
        {subtitle && (
          <div className="truncate text-[13px] text-zinc-500 dark:text-zinc-200">{subtitle}</div>
        )}

        <div className="mt-2 flex items-end justify-between gap-2">
          <StatusBadge status={lead.status} className="min-w-0" />

          <div className="flex shrink-0 items-center gap-1">
            {moving ? (
              <Loader2 size={13} className="animate-spin text-zinc-500 dark:text-zinc-200" />
            ) : (
              <>
                {/* How long since anything happened. Always shown rather than
                    only once a lead is already stale: a figure that appears out
                    of nowhere is one you never learn to look for. */}
                <span
                  className="font-mono text-[13px] tabular-nums text-zinc-500 dark:text-zinc-200"
                  title={`Last activity: ${formatDateTime(touched)}`}
                >
                  {sinceShort(touched, new Date(now))}
                </span>

                {!d.none && (
                  <Marker
                    label={d.overdue ? 'Next step, overdue' : 'Next step'}
                    detail={
                      <>
                        <span className="block" style={d.overdue ? { color: SIGNAL } : undefined}>
                          {d.text}
                        </span>
                        <span className="block text-zinc-500 dark:text-zinc-200">
                          {formatDateTime(lead.next_action_at)}
                        </span>
                      </>
                    }
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        d.overdue ? '' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                      style={d.overdue ? { backgroundColor: SIGNAL } : undefined}
                    />
                  </Marker>
                )}

                {notes && (
                  <Marker label="Note" detail={notes}>
                    <StickyNote size={13} />
                  </Marker>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PipeColumn({
  pipe,
  leads,
  now,
  dragging,
  movingId,
  transitions,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  pipe: LeadPipe
  leads: Lead[]
  now: number
  dragging: Lead | null
  movingId: string | null
  transitions: TransitionMap
  onDragStart: (lead: Lead) => void
  onDragEnd: () => void
  onDrop: (pipe: LeadPipe, targets: LeadStatus[]) => void
}) {
  const [over, setOver] = useState(false)

  // Worked out for whichever card is currently in the air. A card can legally
  // be dropped on its own column: a pipe holds several statuses, so Demo booked
  // landing on Qualified still means one of five different things.
  const targets = dragging ? targetsInPipe(dragging.status, pipe, transitions) : []
  const canDrop = targets.length > 0

  return (
    <div
      className="flex w-64 shrink-0 flex-col"
      onDragOver={(e) => {
        // Not calling preventDefault is what tells the browser this is not a
        // drop target, so an illegal move gets a "no drop" cursor and is
        // refused while the mouse is still down — rather than after a round
        // trip that ends in an error message.
        if (!canDrop) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(e) => {
        // Crossing from the column into one of its own cards fires dragleave.
        // Ignore those, or the highlight flickers off every card boundary.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setOver(false)
      }}
      onDrop={(e) => {
        setOver(false)
        if (!canDrop) return
        e.preventDefault()
        onDrop(pipe, targets)
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-block rounded-md border px-2 py-0.5 text-[13px] ${pipeClassFor(pipe)}`}
        >
          {LEAD_PIPE_LABELS[pipe]}
        </span>
        <span className="font-mono text-[13px] text-zinc-500 dark:text-zinc-200">
          {leads.length}
        </span>
      </div>

      {/* Three states: the column being hovered with a legal move, a column no
          legal move can reach while something is being dragged, and the resting
          case. The refused one fades rather than reddens — there is nothing
          wrong, it is simply not somewhere this lead can go. */}
      <div
        className={`flex flex-1 flex-col gap-2 rounded-lg border-2 border-dashed p-1 transition-colors ${
          over && canDrop
            ? 'border-zinc-400 bg-zinc-500/5 dark:border-white/[0.25] dark:bg-white/[0.04]'
            : dragging && !canDrop
              ? 'border-transparent opacity-40'
              : 'border-transparent'
        }`}
      >
        {leads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 dark:border-white/[0.07] px-3 py-4 text-center text-[13px] text-zinc-500 dark:text-zinc-200">
            Empty
          </p>
        ) : (
          leads.map((l) => (
            <LeadCard
              key={l.id}
              lead={l}
              now={now}
              moving={movingId === l.id}
              onDragStart={() => onDragStart(l)}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function LeadPipeline({
  leads,
  transitions,
  now,
}: {
  leads: Lead[]
  transitions: TransitionMap
  now: number
}) {
  const router = useRouter()
  const [dragging, setDragging] = useState<Lead | null>(null)
  const [request, setRequest] = useState<DropRequest | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // Order within a column is the order the server sent, which is by next step
  // soonest-first. So the top of every column is the lead in it you should
  // deal with next, and the worklist's answer survives the change of shape.
  const byPipe = LEAD_PIPES.map((pipe) => ({
    pipe,
    leads: leads.filter((l) => LEAD_STATUS_PIPE[l.status] === pipe),
  }))

  /**
   * The move itself.
   *
   * Deliberately not optimistic. The card dims until the server answers, rather
   * than jumping columns and jumping back if the database refuses — undoing an
   * optimistic move correctly is more machinery than the half-second is worth,
   * and a card that moves and then un-moves is worse than one that waits.
   */
  function move(
    lead: Lead,
    input: {
      toStatus: LeadStatus
      nextActionAt: string | null
      lostReason: string | null
      note: string | null
    }
  ) {
    setError(null)
    setMovingId(lead.id)
    start(async () => {
      const result = await transitionLeadAction(lead.id, {
        toStatus: input.toStatus,
        nextActionAt: input.nextActionAt ?? '',
        lostReason: input.lostReason ?? '',
        note: input.note ?? '',
      })
      if (!result.ok) {
        setMovingId(null)
        setError(result.error.message)
        return
      }
      setRequest(null)
      setMovingId(null)
      router.refresh()
    })
  }

  function handleDrop(lead: Lead, pipe: LeadPipe, targets: LeadStatus[]) {
    // A drop back onto the column the card came from always asks, even when
    // only one status is possible.
    //
    // Dropping something where it already was is how every drag interface in
    // the world spells "never mind", so firing a status change off it is a
    // change you did not ask for and might not notice. Seven of those exist —
    // Extra meeting – to schedule onto Qualified silently becoming Extra
    // meeting booked is the one that caught it.
    //
    // The move stays available, because moving inside a pipe is real work: a
    // pipe holds several statuses and Demo booked → Contract meeting never
    // leaves Qualified. It just has to be asked for out loud.
    const samePipe = LEAD_STATUS_PIPE[lead.status] === pipe

    // Across columns the gesture already said what you meant, so a single
    // target that asks for nothing simply happens.
    if (!samePipe && targets.length === 1 && !NEEDS_REASON.has(targets[0])) {
      move(lead, { toStatus: targets[0], nextActionAt: null, lostReason: null, note: null })
      return
    }
    setError(null)
    setRequest({ lead, targets, samePipe })
  }

  return (
    <>
      {/* Errors from a straight-through move have nowhere else to appear; the
          ones raised inside the dialog are shown there instead. */}
      {error && !request && (
        <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      {/* Seven columns will not fit on any screen, so this scrolls sideways in
          its own box rather than making the page scroll. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex items-stretch gap-4">
          {byPipe.map(({ pipe, leads: inPipe }) => (
            <PipeColumn
              key={pipe}
              pipe={pipe}
              leads={inPipe}
              now={now}
              dragging={dragging}
              movingId={movingId}
              transitions={transitions}
              onDragStart={setDragging}
              onDragEnd={() => setDragging(null)}
              onDrop={(droppedOn, targets) => {
                if (dragging) handleDrop(dragging, droppedOn, targets)
                setDragging(null)
              }}
            />
          ))}
        </div>
      </div>

      {request && (
        <DropStatusDialog
          request={request}
          pending={pending}
          error={error}
          onCancel={() => {
            setRequest(null)
            setError(null)
          }}
          onConfirm={(input) => move(request.lead, input)}
        />
      )}
    </>
  )
}
