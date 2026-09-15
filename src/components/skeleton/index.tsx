// Building blocks for the route-level `loading.tsx` files.
//
// Every dashboard route is force-dynamic and fetches from Supabase on the
// server, so without a loading boundary a click sat on the old page until the
// new one had fully rendered. A `loading.tsx` beside each page gives Next a
// Suspense boundary to prefetch: the sidebar link now swaps in the skeleton
// on click and the real content streams in behind it.
//
// The skeletons render the page's *static* chrome for real (eyebrow, title,
// paddings, max-width) and only stand in for the data with bones, so the
// swap to the loaded page moves nothing. Keep the geometry in step with the
// page it covers — a skeleton that is the wrong shape is worse than none.
//
// Styling: bones are plain tints, never `.panel` — under a wallpaper the
// frosted layer belongs on the card/row that contains them (STYLING.md §2).
// A skeleton row that *is* the card gets the same `panel border …` string as
// the real row.

import type { CSSProperties, ReactNode } from 'react'

/** A pulsing placeholder bar. Size it with width and height classes. */
export function Bone({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={style}
      className={`animate-pulse rounded-md bg-zinc-200/80 dark:bg-white/[0.06] ${className}`}
    />
  )
}

/** Round variant — avatars, icon tiles, dots. */
export function Dot({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-full bg-zinc-200/80 dark:bg-white/[0.06] ${className}`}
    />
  )
}

/**
 * The frosted surface most rows and cards sit on. Same string as the real
 * rows so the border and fill line up before and after the swap.
 */
export const CARD =
  'rounded-xl border border-zinc-200 dark:border-white/[0.05] panel bg-zinc-50/50 dark:bg-white/[0.02]'

/** The larger radius the stat tiles and tool cards use. */
export const CARD_LG =
  'rounded-2xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03]'

/**
 * A button-shaped placeholder. The default height matches the `px-4 py-2
 * text-[13px]` header buttons (36px); pass `h-[34px]` for the `py-1.5 text-sm`
 * ones and `h-[30px]` for the editor's `py-1.5 text-[13px]` pills.
 */
export function ButtonBone({ className = 'w-24' }: { className?: string }) {
  return <Bone className={`h-9 rounded-lg ${className}`} />
}

/**
 * The route shell every list page shares: `min-h-screen`, the padded column
 * and its max-width. Marks the region busy for assistive tech and carries the
 * one visually-hidden label for the whole skeleton.
 */
export function Shell({
  maxWidth = 'max-w-3xl',
  className = '',
  children,
}: {
  maxWidth?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className={`px-4 sm:px-8 pt-8 sm:pt-10 pb-16 ${maxWidth} ${className}`}>{children}</div>
    </div>
  )
}

/**
 * The eyebrow + title block the collection pages open with. Text is rendered
 * for real — it never depends on data — so only the action buttons on the
 * right are bones.
 */
export function Heading({
  eyebrow,
  title,
  actions,
  sub,
}: {
  eyebrow: string
  title: string
  actions?: ReactNode
  /** A bone below the title where the page prints a count or blurb. */
  sub?: ReactNode
}) {
  return (
    <div className="flex items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
      <div>
        <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
          {eyebrow}
        </p>
        <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
          {title}
        </h1>
        {sub}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

/** A stack of `count` list rows of the given height. */
export function Rows({
  count,
  height = 'h-[46px]',
  gap = 'space-y-1',
  children,
}: {
  count: number
  height?: string
  gap?: string
  /** Row contents; defaults to a title bar and a right-aligned caption. */
  children?: (i: number) => ReactNode
}) {
  return (
    <div className={gap}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${CARD} flex items-center justify-between px-4 ${height}`}>
          {children ? (
            children(i)
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Dot className="w-1 h-1 shrink-0" />
                <Bone className="h-3.5" style={{ width: textWidth(i) }} />
              </div>
              <Bone className="h-3 w-12 shrink-0 ml-4" />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Widths that vary row to row so a list of bones reads as text, not a grid.
 * Deterministic on the index so server and client agree.
 */
export function textWidth(i: number, base = 40, step = 12, mod = 5) {
  return `${base + (i % mod) * step}%`
}
