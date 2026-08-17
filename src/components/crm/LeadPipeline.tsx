'use client'

// The same leads as the worklist, laid out by pipe.
//
// The worklist answers "who do I call now". This answers "what does the
// business look like" — where the leads are bunched, which stretch is empty,
// how much is dead. It is the same filtered set in both views, so a search or
// a status filter narrows this exactly as it narrows the table.
//
// Cards carry four things and no more: who it is, what state they are in, and
// two markers for the things you would otherwise have to open the lead to see.
// A card you have to read is a card you may as well have clicked.

import { useState } from 'react'
import Link from 'next/link'
import { StickyNote } from 'lucide-react'
import type { Lead } from '@/lib/crm/leads'
import {
  LEAD_PIPES,
  LEAD_PIPE_LABELS,
  LEAD_STATUS_PIPE,
  type LeadPipe,
} from '@/lib/lead-status'
import { due, formatDateTime, leadTitle } from '@/lib/crm/format'
import StatusBadge, { pipeClassFor } from './StatusBadge'
import { SIGNAL } from './signal'

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

function LeadCard({ lead, now }: { lead: Lead; now: number }) {
  const title = leadTitle(lead)
  const subtitle = lead.company_name && lead.contact_name ? lead.contact_name : null
  const notes = lead.notes?.trim() ?? ''
  const d = due(lead.next_action_at, new Date(now))

  return (
    <div className="group/card relative rounded-lg border border-zinc-200 dark:border-white/[0.07] panel bg-white dark:bg-white/[0.03] p-2.5 hover:border-zinc-300 dark:hover:border-white/[0.14] transition-colors">
      {/* The link sits under the whole card rather than around it: a button
          inside an anchor is invalid, and the markers have to be buttons. */}
      <Link
        href={`/atrium-crm/${lead.id}`}
        aria-label={title}
        className="absolute inset-0 rounded-lg"
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
          </div>
        </div>
      </div>
    </div>
  )
}

function PipeColumn({ pipe, leads, now }: { pipe: LeadPipe; leads: Lead[]; now: number }) {
  return (
    <div className="flex w-64 shrink-0 flex-col">
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

      {leads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 dark:border-white/[0.07] px-3 py-4 text-center text-[13px] text-zinc-500 dark:text-zinc-200">
          Empty
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LeadPipeline({ leads, now }: { leads: Lead[]; now: number }) {
  // Order within a column is the order the server sent, which is by next step
  // soonest-first. So the top of every column is the lead in it you should
  // deal with next, and the worklist's answer survives the change of shape.
  const byPipe = LEAD_PIPES.map((pipe) => ({
    pipe,
    leads: leads.filter((l) => LEAD_STATUS_PIPE[l.status] === pipe),
  }))

  return (
    // Seven columns will not fit on any screen, so this scrolls sideways in its
    // own box rather than making the page scroll.
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex gap-4">
        {byPipe.map(({ pipe, leads: inPipe }) => (
          <PipeColumn key={pipe} pipe={pipe} leads={inPipe} now={now} />
        ))}
      </div>
    </div>
  )
}
