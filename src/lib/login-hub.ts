// The Login Hub: one click to the right account, instead of the account
// switcher dance.
//
// The links themselves live in the `login_links` table and are added from the page, because account URLs are personal — your
// /u/5 is not anyone else's. What lives here is the catalogue the "add link"
// form offers: the two sections, and the services whose logos are drawn.
//
// LINKS ONLY. Never store a password or token — the table is read with the
// anon key, so anything in it is readable by anyone who can open the dashboard.

export type LoginLink = {
  id: string
  section: string
  service: string
  brand: string
  label: string
  url: string
  hint: string | null
  position: number
  created_at: string
}

/** The two halves of the hub. Rename freely — `key` is what rows store, so
 *  changing a key means updating existing rows; changing `name` is free. */
export const SECTIONS = [
  { key: 'S', name: 'S' },
  { key: 'B', name: 'B' },
] as const

/** A stored section preference, falling back to the first when it's missing or
 *  names a section that no longer exists. */
export function resolveSection(raw: string | undefined | null): string {
  return SECTIONS.some((s) => s.key === raw) ? raw! : SECTIONS[0].key
}

/**
 * Services the form offers, and the logo each one uses. `brand` matches a key
 * in BRAND_MARKS (components/BrandMark.tsx); anything without a mark falls back
 * to a lettered tile, so a service can be added here before its logo is drawn —
 * or typed straight into the form as a custom name.
 */
export const SERVICE_PRESETS: { name: string; brand: string; color: string }[] = [
  { name: 'Gmail', brand: 'gmail', color: 'bg-rose-500/15 text-rose-500 dark:text-rose-400' },
  { name: 'Supabase', brand: 'supabase', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { name: 'Google Calendar', brand: 'google-calendar', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  { name: 'Google Meet', brand: 'google-meet', color: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  { name: 'Google Drive', brand: 'google-drive', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { name: 'GitHub', brand: 'github', color: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-200' },
  { name: 'Vercel', brand: 'vercel', color: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-200' },
]

const FALLBACK_COLOR = 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'

export function presetFor(service: string) {
  return SERVICE_PRESETS.find((p) => p.name.toLowerCase() === service.trim().toLowerCase())
}

/** The tile colour for a service, whether or not it's a known preset. */
export function colorFor(service: string) {
  return presetFor(service)?.color ?? FALLBACK_COLOR
}

/** Groups a section's links by service, preserving each service's first-seen order. */
export function groupByService(links: LoginLink[]) {
  const groups = new Map<string, LoginLink[]>()
  for (const link of links) {
    const key = link.service || 'Other'
    const bucket = groups.get(key)
    if (bucket) bucket.push(link)
    else groups.set(key, [link])
  }
  return [...groups.entries()].map(([service, items]) => ({ service, items }))
}
