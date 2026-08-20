import { decodeBoardView, DEFAULT_BOARD_VIEW, type BoardView } from './task-views'

// UI preferences that have to be known *before* the first paint (theme, whether
// the Done column starts collapsed) live in cookies rather than localStorage:
// the server can read a cookie while rendering, so the HTML it sends already
// matches what the browser will show. localStorage can only be read after
// hydration, which means either a flash or a hydration mismatch.
//
// Everything here is per-browser on purpose. There are no accounts yet, so a
// server-side store would be one shared setting for everyone; cookies give each
// browser its own. When accounts land these move to a per-user row.

export const THEME_COOKIE = 'theme'
export const ARCHIVE_COOKIE = 'archive-collapsed'
/** Sidebar menu order and hidden items — see `encodeNavPref` in lib/nav. */
export const NAV_COOKIE = 'nav'
export const BACKGROUND_COOKIE = 'background'
/** Which half of the Login Hub is showing — see SECTIONS in lib/login-hub. */
export const LOGIN_SECTION_COOKIE = 'login-section'
/** Which shape the CRM lead list is in: 'table' or 'pipeline'. */
export const CRM_VIEW_COOKIE = 'crm-view'

/**
 * Which of the three shapes the tasks board is in, and whether finished cards
 * show in the two derived ones. See `TaskViewPref` at the foot of this file.
 */
export const TASK_VIEW_COOKIE = 'task-view'

/**
 * Which lists are laid out as a priority per column rather than one stack.
 * Per list, and only in the lists view. See `encodeListLayouts` below.
 */
export const LIST_LAYOUT_COOKIE = 'list-layout'

const ONE_YEAR = 60 * 60 * 24 * 365

/** Write a preference cookie from the browser. */
export function setPrefCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

// ─── Background ───────────────────────────────────────────────────────────────

/**
 * What the background cookie holds. Only the storage object's *name* is stored,
 * not its full public URL: the name is short, survives a change of Supabase
 * project, and contains no characters that percent-encoding would mangle.
 * `dim` is a whole percent rather than the 0–1 float used at render time, for
 * the same reason — it keeps the cookie free of `.` rounding noise.
 */
export type BackgroundPref = { name: string | null; dim: number; blur: number }

export const DEFAULT_BACKGROUND_PREF: BackgroundPref = { name: null, dim: 55, blur: 0 }

export const DIM_MAX = 95
export const BLUR_MAX = 24

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function encodeBackgroundPref(pref: BackgroundPref): string {
  const dim = clampInt(pref.dim, 0, DIM_MAX, DEFAULT_BACKGROUND_PREF.dim)
  const blur = clampInt(pref.blur, 0, BLUR_MAX, DEFAULT_BACKGROUND_PREF.blur)
  return `${pref.name ?? ''}~${dim}~${blur}`
}

export function decodeBackgroundPref(raw: string | undefined | null): BackgroundPref {
  if (!raw) return DEFAULT_BACKGROUND_PREF
  // Split from the right: dim and blur are always the last two fields, so a
  // file name containing `~` still round-trips.
  const parts = raw.split('~')
  const blur = parts.pop()
  const dim = parts.pop()
  const name = parts.join('~')
  return {
    name: name ? safeDecode(name) : null,
    dim: clampInt(dim, 0, DIM_MAX, DEFAULT_BACKGROUND_PREF.dim),
    blur: clampInt(blur, 0, BLUR_MAX, DEFAULT_BACKGROUND_PREF.blur),
  }
}

// Uploads are renamed to `<uuid>.<ext>`, which percent-encoding leaves alone —
// but a file put in the bucket by hand can have spaces. Decoding is a no-op for
// the former and a fix for the latter, whichever way the cookie came back.
function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// ─── Tasks board view ─────────────────────────────────────────────────────────

/**
 * Both fields have to be known before the first paint: a board that renders as
 * lists and then snaps to the matrix is the same flash ARCHIVE_COOKIE exists to
 * avoid.
 *
 * One cookie rather than two, `~`-separated like the background pref — the two
 * fields are always read and written together, and a whole cookie for one
 * boolean is sprawl. The right-to-left split the background pref needs is
 * unnecessary here: neither field can contain a `~`.
 *
 * ARCHIVE_COOKIE stays separate. It is the lists view's collapse state, a
 * different thing, and it carries a localStorage migration path that folding it
 * in here would break.
 */
export type TaskViewPref = { view: BoardView; showDone: boolean }

export const DEFAULT_TASK_VIEW_PREF: TaskViewPref = {
  view: DEFAULT_BOARD_VIEW,
  showDone: false,
}

export function encodeTaskViewPref(pref: TaskViewPref): string {
  return `${pref.view}~${pref.showDone ? 1 : 0}`
}

export function decodeTaskViewPref(raw: string | undefined | null): TaskViewPref {
  if (!raw) return DEFAULT_TASK_VIEW_PREF
  const [view, showDone] = raw.split('~')
  return { view: decodeBoardView(view), showDone: showDone === '1' }
}

// ─── List layout ──────────────────────────────────────────────────────────────
//
// Only the horizontal ones are stored. Vertical is the default, so a list that
// has never been switched costs nothing in the cookie, and a list that is
// deleted simply stops matching.

export function encodeListLayouts(horizontal: Iterable<string>): string {
  return [...horizontal].join('~')
}

export function decodeListLayouts(raw: string | undefined | null): Set<string> {
  return new Set((raw ?? '').split('~').filter(Boolean))
}
