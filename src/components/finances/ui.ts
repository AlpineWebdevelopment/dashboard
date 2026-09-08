// Shared class strings for the /finances components.
//
// Lifted verbatim from the equivalents in MrrBoard.tsx, which are module-local
// there. Kept in one place here rather than repeated across the board, the
// table, the panel and the modal.

export const inputClass =
  'w-full panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

export const labelClass =
  'block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5'

export const hintClass = 'text-[12px] text-zinc-500 dark:text-zinc-200 mt-1'

export const emptyNoteClass =
  'text-[13px] text-zinc-500 dark:text-zinc-200 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5'

export const cardClass =
  'rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-zinc-50 dark:bg-white/[0.03]'

/** Per-account tint. Keys must stay in step with FINANCE_ACCENTS. */
export const ACCENT_DOT: Record<string, string> = {
  teal: 'bg-teal-500 dark:bg-teal-400',
  orange: 'bg-orange-500 dark:bg-orange-400',
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
  indigo: 'bg-indigo-500 dark:bg-indigo-400',
  rose: 'bg-rose-500 dark:bg-rose-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  sky: 'bg-sky-500 dark:bg-sky-400',
  violet: 'bg-violet-500 dark:bg-violet-400',
}

export const ACCENT_TEXT: Record<string, string> = {
  teal: 'text-teal-600 dark:text-teal-400',
  orange: 'text-orange-600 dark:text-orange-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  indigo: 'text-indigo-600 dark:text-indigo-400',
  rose: 'text-rose-600 dark:text-rose-400',
  amber: 'text-amber-600 dark:text-amber-400',
  sky: 'text-sky-600 dark:text-sky-400',
  violet: 'text-violet-600 dark:text-violet-400',
}
