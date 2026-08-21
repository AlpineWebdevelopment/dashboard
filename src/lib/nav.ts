// The sidebar menu, and the per-browser preference that reorders and hides it.
//
// The list lives here rather than in Sidebar.tsx so the settings page can edit
// the same items the sidebar renders. Each item carries a stable `key` — the
// preference cookie stores keys, not hrefs, so a route can be moved without
// resetting everyone's menu.

import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, FileText, Settings, Table2, CheckSquare, Newspaper,
  Target, ShoppingBag, PenTool, Sparkles, Building2, Bot, CalendarDays, Zap, TrendingUp,
  Activity, KeyRound, Wrench,
} from 'lucide-react'

export type NavItem = {
  /** Stable id used in the preference cookie. Never reuse or rename. */
  key: string
  label: string
  href: string
  icon: LucideIcon
  iconActive: string
  iconInactive: string
  bar: string
  bg: string
}

/** The key of the one item that can be reordered but never hidden — losing it
 *  would strand you with no way back into these settings. */
export const PINNED_KEY = 'settings'

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    href: '/',
    icon: LayoutDashboard,
    iconActive: 'text-indigo-400',
    iconInactive: 'text-indigo-400/70',
    bar: 'bg-indigo-400/70',
    bg: 'bg-indigo-500/[0.08]',
  },
  {
    key: 'tasks',
    label: 'Tasks',
    href: '/tasks',
    icon: CheckSquare,
    iconActive: 'text-violet-400',
    iconInactive: 'text-violet-400/70',
    bar: 'bg-violet-400/70',
    bg: 'bg-violet-500/[0.08]',
  },
  {
    key: 'pages',
    label: 'Pages',
    href: '/pages',
    icon: FileText,
    iconActive: 'text-sky-400',
    iconInactive: 'text-sky-400/70',
    bar: 'bg-sky-400/70',
    bg: 'bg-sky-500/[0.08]',
  },
  {
    key: 'tables',
    label: 'Tables',
    href: '/tables',
    icon: Table2,
    iconActive: 'text-emerald-400',
    iconInactive: 'text-emerald-400/70',
    bar: 'bg-emerald-400/70',
    bg: 'bg-emerald-500/[0.08]',
  },
  {
    key: 'news',
    label: 'News',
    href: '/news',
    icon: Newspaper,
    iconActive: 'text-amber-400',
    iconInactive: 'text-amber-400/70',
    bar: 'bg-amber-400/70',
    bg: 'bg-amber-500/[0.08]',
  },
  {
    key: 'ads',
    label: 'Ads',
    href: '/ads',
    icon: Target,
    iconActive: 'text-blue-400',
    iconInactive: 'text-blue-400/70',
    bar: 'bg-blue-400/70',
    bg: 'bg-blue-500/[0.08]',
  },
  {
    key: 'shopify',
    label: 'Shopify',
    href: '/shopify-tracker',
    icon: ShoppingBag,
    iconActive: 'text-green-400',
    iconInactive: 'text-green-400/70',
    bar: 'bg-green-400/70',
    bg: 'bg-green-500/[0.08]',
  },
  {
    key: 'atrium-crm',
    label: 'Atrium CRM',
    href: '/atrium-crm',
    icon: Building2,
    // Atrium's own green (#6DBC61 ≈ lime-400/green-400) rather than the cyan
    // this had while the page was an iframe — the CRM is the one section of the
    // dashboard that carries a second brand.
    iconActive: 'text-[#6DBC61]',
    iconInactive: 'text-[#6DBC61]/70',
    bar: 'bg-[#6DBC61]/70',
    bg: 'bg-[#6DBC61]/[0.10]',
  },
  {
    key: 'whiteboards',
    label: 'Whiteboard',
    href: '/whiteboards',
    icon: PenTool,
    iconActive: 'text-fuchsia-400',
    iconInactive: 'text-fuchsia-400/70',
    bar: 'bg-fuchsia-400/70',
    bg: 'bg-fuchsia-500/[0.08]',
  },
  {
    key: 'prompts',
    label: 'Prompts',
    href: '/prompts',
    icon: Sparkles,
    iconActive: 'text-orange-400',
    iconInactive: 'text-orange-400/70',
    bar: 'bg-orange-400/70',
    bg: 'bg-orange-500/[0.08]',
  },
  {
    key: 'stream',
    label: 'Stream',
    href: '/stream',
    icon: Zap,
    iconActive: 'text-yellow-400',
    iconInactive: 'text-yellow-400/70',
    bar: 'bg-yellow-400/70',
    bg: 'bg-yellow-500/[0.08]',
  },
  {
    // `key` stays 'events' — it's the id in the saved-menu cookie, so renaming
    // it would reset everyone's menu. Only the label and route became "Cal".
    key: 'events',
    label: 'Cal',
    href: '/cal',
    icon: CalendarDays,
    iconActive: 'text-orange-400',
    iconInactive: 'text-orange-400/70',
    bar: 'bg-orange-400/70',
    bg: 'bg-orange-500/[0.08]',
  },
  {
    key: 'logins',
    label: 'Logins',
    href: '/loginhub',
    icon: KeyRound,
    iconActive: 'text-rose-400',
    iconInactive: 'text-rose-400/70',
    bar: 'bg-rose-400/70',
    bg: 'bg-rose-500/[0.08]',
  },
  {
    key: 'ai',
    label: 'AI Agent',
    href: '/ai',
    icon: Bot,
    iconActive: 'text-cyan-400',
    iconInactive: 'text-cyan-400/70',
    bar: 'bg-cyan-400/70',
    bg: 'bg-cyan-500/[0.08]',
  },
  {
    key: 'mrr',
    label: 'MRR',
    href: '/mrr',
    icon: TrendingUp,
    iconActive: 'text-teal-400',
    iconInactive: 'text-teal-400/70',
    bar: 'bg-teal-400/70',
    bg: 'bg-teal-500/[0.08]',
  },
  {
    key: 'ongoing',
    label: 'Ongoing',
    href: '/ongoing',
    icon: Activity,
    iconActive: 'text-lime-400',
    iconInactive: 'text-lime-400/70',
    bar: 'bg-lime-400/70',
    bg: 'bg-lime-500/[0.08]',
  },
  {
    // The utilities ported over from the standalone tools project. Ads kept its
    // own top-level entry — it is a section in its own right, not a one-off
    // converter — so it is linked from the hub rather than nested under it.
    key: 'tools',
    label: 'Tools',
    href: '/tools',
    icon: Wrench,
    iconActive: 'text-purple-400',
    iconInactive: 'text-purple-400/70',
    bar: 'bg-purple-400/70',
    bg: 'bg-purple-500/[0.08]',
  },
  {
    key: PINNED_KEY,
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    iconActive: 'text-zinc-500 dark:text-zinc-200',
    iconInactive: 'text-zinc-500 dark:text-zinc-100',
    bar: 'bg-zinc-400/70',
    bg: 'bg-zinc-500/[0.08]',
  },
]

export type NavEntry = { item: NavItem; hidden: boolean }

// ─── Cookie format ────────────────────────────────────────────────────────────
// Keys joined by `~`, hidden ones prefixed with `-`:
//   overview~tasks~-news~pages
// Every character used here survives encodeURIComponent untouched, so the value
// reads back the same whether or not the cookie layer decoded it.

export function encodeNavPref(entries: NavEntry[]): string {
  return entries.map(({ item, hidden }) => (hidden ? '-' : '') + item.key).join('~')
}

/**
 * Turn a stored preference into the menu to render.
 *
 * Unknown keys are dropped and items missing from the cookie are appended in
 * their original order, so adding a route to NAV_ITEMS makes it show up for
 * people who already have a saved menu instead of silently disappearing.
 */
export function resolveNav(raw: string | undefined | null): NavEntry[] {
  const byKey = new Map(NAV_ITEMS.map((item) => [item.key, item]))
  const entries: NavEntry[] = []
  const seen = new Set<string>()

  for (const token of (raw ?? '').split('~')) {
    if (!token) continue
    const hidden = token.startsWith('-')
    const key = hidden ? token.slice(1) : token
    const item = byKey.get(key)
    if (!item || seen.has(key)) continue
    seen.add(key)
    entries.push({ item, hidden: hidden && key !== PINNED_KEY })
  }

  for (const item of NAV_ITEMS) {
    if (!seen.has(item.key)) entries.push({ item, hidden: false })
  }

  return entries
}
