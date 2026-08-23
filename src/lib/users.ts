// Who can sign in, and what each of them is allowed to reach.
//
// There is no user table. Two people share this dashboard from two computers,
// so the roster is a constant and the passwords come from the environment —
// a database round-trip in the proxy would cost every request for a list that
// changes about once a year.
//
// Imported by `src/proxy.ts`, which runs on the edge, and — through `lib/nav`
// — by client components, so this module reaches the browser bundle. Keep it
// free of Node built-ins, `next/headers`, and of anything secret: the passwords
// live in `lib/passwords`, which is server-side only for exactly that reason.

export type Role = 'admin' | 'client'

export type Account = {
  /** What you type in the login box. Lowercase; comparison is case-insensitive. */
  username: string
  /** Display name in the settings roster. */
  label: string
  role: Role
}

export const ACCOUNTS: Account[] = [
  { username: 'granturismo', label: 'Granturismo', role: 'admin' },
  { username: 'splexz', label: 'Splexz', role: 'client' },
]

/** What a role means, for the roster on the settings page. */
export const ROLE_INFO: Record<Role, { label: string; summary: string; badge: string }> = {
  admin: {
    label: 'Admin',
    summary: 'Full control — every page, and every create, edit and delete on them.',
    badge:
      'border-indigo-500/25 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
  client: {
    label: 'Client',
    summary: 'Client Projects and Settings only. Reads the projects; cannot change them.',
    badge:
      'border-sky-500/25 bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
}

export function findAccount(username: string | null | undefined): Account | null {
  if (!username) return null
  const wanted = username.trim().toLowerCase()
  return ACCOUNTS.find((a) => a.username === wanted) ?? null
}

// ─── Access ───────────────────────────────────────────────────────────────────

/**
 * Nav keys a role may see, or null for "all of them". Keys, not hrefs — the
 * same ids the sidebar preference cookie stores (see lib/nav).
 */
const ROLE_NAV_KEYS: Record<Role, string[] | null> = {
  admin: null,
  client: ['client-projects', 'settings'],
}

export function canSeeNavKey(role: Role, key: string): boolean {
  const allowed = ROLE_NAV_KEYS[role]
  return allowed === null || allowed.includes(key)
}

/**
 * Path prefixes a non-admin may request. The two pages they can see, plus the
 * sidebar's daily-fact endpoint — blocking that would leave a loading skeleton
 * pinned to the sidebar on every page they can open.
 *
 * Server actions POST to the pathname of the page they were called from, so
 * this list covers them without an entry of its own.
 */
const ROLE_PATHS: Record<Role, string[] | null> = {
  admin: null,
  client: ['/client-projects', '/settings', '/api/daily-fact'],
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const allowed = ROLE_PATHS[role]
  if (allowed === null) return true
  return allowed.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/** Where a role lands after signing in, and where it is sent when it strays. */
export function homePathFor(role: Role): string {
  return role === 'client' ? '/client-projects' : '/'
}
