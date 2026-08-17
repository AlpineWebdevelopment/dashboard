// The one status badge. Both the worklist and the lead page render it, so a
// status cannot end up coloured one way in a list and another way on the page
// you reach by clicking that list.

import { LEAD_STATUS_LABELS, LEAD_STATUS_PIPE, type LeadPipe, type LeadStatus } from '@/lib/lead-status'

/**
 * A colour per pipe.
 *
 * These are tints rather than fills — a list of fifteen saturated pills is a
 * fruit salad, and the badge still has to be read. Converted is the exception
 * and is filled solid: it is the outcome you are looking for when you scan the
 * column, and it should not need finding twice.
 *
 * Two notes on the dark variants, since they are not just the light ones again:
 *
 * Not-qualified is asked to be black, which in dark mode would be invisible.
 * The honest translation is neutral — a dead lead should read as an absence of
 * colour rather than a colour, and grey does that at both ends.
 *
 * Qualified and converted are both green, which is a real risk of collapsing
 * into one colour on a dark background. Filling converted rather than tinting
 * it keeps them apart by weight, not just by hue.
 *
 * Written as whole class strings, not built up from a template, so Tailwind's
 * scanner can actually see them.
 */
const PIPE_CLASS: Record<LeadPipe, string> = {
  new:
    'border-sky-500/30 bg-sky-500/10 text-sky-700 ' +
    'dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300',
  contacted:
    'border-blue-600/30 bg-blue-600/10 text-blue-700 ' +
    'dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300',
  qualified:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 ' +
    'dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300',
  converted:
    'border-green-700 bg-green-700 text-white ' +
    'dark:border-green-600 dark:bg-green-600 dark:text-white',
  nurture:
    'border-purple-500/30 bg-purple-500/10 text-purple-700 ' +
    'dark:border-purple-400/25 dark:bg-purple-400/10 dark:text-purple-300',
  lost:
    'border-red-800/30 bg-red-800/10 text-red-800 ' +
    'dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300',
  disqualified:
    'border-zinc-900/25 bg-zinc-900/10 text-zinc-900 ' +
    'dark:border-white/[0.14] dark:bg-white/[0.07] dark:text-zinc-400',
}

/** The pipe colour on its own, for places too small for a badge. */
export function pipeClass(status: LeadStatus): string {
  return PIPE_CLASS[LEAD_STATUS_PIPE[status]]
}

export default function StatusBadge({
  status,
  className = '',
}: {
  status: LeadStatus
  className?: string
}) {
  return (
    <span
      // Truncates rather than wrapping or pushing. `max-w-full` is what makes
      // it give way: the badge can never grow past the cell it sits in, so a
      // long label loses its tail instead of taking space off the name beside
      // it. Where the badge is not in a constrained cell — the lead page, the
      // timeline — there is nothing to truncate against and it shows in full.
      // The title carries the whole label either way.
      className={`inline-block max-w-full truncate rounded-md border px-2 py-0.5 text-[12px] ${pipeClass(status)} ${className}`}
      title={LEAD_STATUS_LABELS[status]}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  )
}
