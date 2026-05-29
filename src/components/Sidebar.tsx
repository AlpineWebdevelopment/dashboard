'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef, FormEvent } from 'react'
import { LayoutDashboard, FileText, Settings, Table2, CheckSquare, Search, CalendarDays, Newspaper, Target, LogOut, ShoppingBag } from 'lucide-react'
import ThemeToggle from './ThemeToggle'

const nav = [
  {
    label: 'Overview',
    href: '/',
    icon: LayoutDashboard,
    iconActive: 'text-indigo-400',
    iconInactive: 'text-indigo-400/70',
    bar: 'bg-indigo-400/70',
    bg: 'bg-indigo-500/[0.08]',
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: CheckSquare,
    iconActive: 'text-violet-400',
    iconInactive: 'text-violet-400/70',
    bar: 'bg-violet-400/70',
    bg: 'bg-violet-500/[0.08]',
  },
  {
    label: 'Pages',
    href: '/pages',
    icon: FileText,
    iconActive: 'text-sky-400',
    iconInactive: 'text-sky-400/70',
    bar: 'bg-sky-400/70',
    bg: 'bg-sky-500/[0.08]',
  },
  {
    label: 'Tables',
    href: '/tables',
    icon: Table2,
    iconActive: 'text-emerald-400',
    iconInactive: 'text-emerald-400/70',
    bar: 'bg-emerald-400/70',
    bg: 'bg-emerald-500/[0.08]',
  },
  {
    label: 'Calendars',
    href: '/calendars',
    icon: CalendarDays,
    iconActive: 'text-rose-400',
    iconInactive: 'text-rose-400/70',
    bar: 'bg-rose-400/70',
    bg: 'bg-rose-500/[0.08]',
  },
  {
    label: 'News',
    href: '/news',
    icon: Newspaper,
    iconActive: 'text-amber-400',
    iconInactive: 'text-amber-400/70',
    bar: 'bg-amber-400/70',
    bg: 'bg-amber-500/[0.08]',
  },
  {
    label: 'Ads',
    href: '/ads',
    icon: Target,
    iconActive: 'text-blue-400',
    iconInactive: 'text-blue-400/70',
    bar: 'bg-blue-400/70',
    bg: 'bg-blue-500/[0.08]',
  },
  {
    label: 'Shopify',
    href: '/shopify-tracker',
    icon: ShoppingBag,
    iconActive: 'text-green-400',
    iconInactive: 'text-green-400/70',
    bar: 'bg-green-400/70',
    bg: 'bg-green-500/[0.08]',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    iconActive: 'text-zinc-400',
    iconInactive: 'text-zinc-300 dark:text-zinc-300',
    bar: 'bg-zinc-400/70',
    bg: 'bg-zinc-500/[0.08]',
  },
]

const mobileNav = [
  { label: 'Overview', href: '/', icon: LayoutDashboard, iconActive: 'text-indigo-400', iconInactive: 'text-zinc-500 dark:text-zinc-300' },
  { label: 'Tasks',    href: '/tasks',  icon: CheckSquare,    iconActive: 'text-violet-400',  iconInactive: 'text-zinc-500 dark:text-zinc-300' },
  { label: 'Pages',   href: '/pages',  icon: FileText,       iconActive: 'text-sky-400',     iconInactive: 'text-zinc-500 dark:text-zinc-300' },
  { label: 'Tables',    href: '/tables',    icon: Table2,      iconActive: 'text-emerald-400', iconInactive: 'text-zinc-500 dark:text-zinc-300' },
  { label: 'Calendars', href: '/calendars', icon: CalendarDays, iconActive: 'text-rose-400',    iconInactive: 'text-zinc-500 dark:text-zinc-300' },
  { label: 'News',      href: '/news',      icon: Newspaper,   iconActive: 'text-amber-400',   iconInactive: 'text-zinc-500 dark:text-zinc-300' },
  { label: 'Ads',       href: '/ads',       icon: Target,      iconActive: 'text-blue-400',    iconInactive: 'text-zinc-500 dark:text-zinc-300' },
]

function SearchBar() {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <form onSubmit={handleSubmit} className="px-3 pb-1">
      <div className="relative flex items-center">
        <Search size={11} className="absolute left-2.5 text-zinc-400 dark:text-zinc-700 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-zinc-500 dark:text-zinc-400 placeholder-zinc-400 dark:placeholder-zinc-700 outline-none focus:border-zinc-400 dark:focus:border-white/[0.12] focus:bg-zinc-100 dark:focus:bg-white/[0.06] focus:text-zinc-800 dark:focus:text-zinc-200 transition-all"
        />
        <span className="absolute right-2 text-[9px] text-zinc-400 dark:text-zinc-700 pointer-events-none hidden sm:block">
          ⌘K
        </span>
      </div>
    </form>
  )
}

const MOTIVATIONS = [
  "Let's make some $$",
  "Let's buy a Granturismo",
  "Time to close some deals",
  "Outwork yesterday",
  "Big moves only",
  "Stack the wins",
  "Make the numbers move",
  "Zero excuses, all results",
  "Build something great today",
  "One step closer to the top",
  "Keep the momentum going",
  "Turn up the heat",
  "The grind never stops",
  "Make it count",
  "Stay focused, stay winning",
]

function getGreeting(hour: number): { label: string; emoji: string } {
  if (hour >= 5 && hour < 12) return { label: 'Good morning', emoji: '☀️' }
  if (hour >= 12 && hour < 18) return { label: 'Good afternoon', emoji: '🌤️' }
  if (hour >= 18 && hour < 22) return { label: 'Good evening', emoji: '🌆' }
  return { label: 'Good night', emoji: '🌙' }
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000)
}

function Clock() {
  const { time, tick } = useClock()

  if (!time) return null

  const hh = time.getHours().toString().padStart(2, '0')
  const mm = time.getMinutes().toString().padStart(2, '0')
  const ss = time.getSeconds().toString().padStart(2, '0')
  const date = time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const progress = (time.getSeconds() / 60) * 100

  return (
    <div className="px-3 pb-4">
      <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50/50 dark:bg-white/[0.04] px-4 py-3.5">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-zinc-300 dark:via-white/20 to-transparent" />
        <p className="text-[10px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2.5">{date}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[22px] font-light text-zinc-900 dark:text-zinc-100 tabular-nums leading-none tracking-tight">
            {hh}
            <span className="mx-px text-zinc-500 transition-opacity duration-150" style={{ opacity: tick ? 1 : 0.2 }}>:</span>
            {mm}
          </span>
          <span className="font-mono text-sm font-light text-zinc-400 dark:text-zinc-600 tabular-nums leading-none">{ss}</span>
        </div>
        <div className="mt-3 h-[2px] rounded-full bg-zinc-100 dark:bg-white/[0.05] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500/60 to-violet-500/40 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Notable day detection (holiday cards shown alongside live news) ───────────

function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  // n=1 first, n=-1 last. weekday: 0=Sun…6=Sat
  if (n > 0) {
    const first = new Date(year, month, 1).getDay()
    const offset = (weekday - first + 7) % 7
    return 1 + offset + (n - 1) * 7
  } else {
    const last = new Date(year, month + 1, 0)
    const lastDay = last.getDate()
    const lastDow = last.getDay()
    const offset = (lastDow - weekday + 7) % 7
    return lastDay - offset
  }
}

interface NotableDay { emoji: string; name: string; color: string }

function getNotableDay(date: Date): NotableDay | null {
  const m = date.getMonth() // 0-based
  const d = date.getDate()
  const y = date.getFullYear()
  const dow = date.getDay() // 0=Sun

  // ── Fixed-date holidays ──
  const fixed: Record<string, NotableDay> = {
    '1-1':  { emoji: '🎆', name: "New Year's Day",       color: 'text-yellow-400' },
    '2-2':  { emoji: '🦔', name: "Groundhog Day",        color: 'text-amber-400'  },
    '2-14': { emoji: '💝', name: "Valentine's Day",      color: 'text-rose-400'   },
    '3-8':  { emoji: '♀️', name: "International Women's Day", color: 'text-pink-400' },
    '3-14': { emoji: '🥧', name: "Pi Day",               color: 'text-indigo-400' },
    '3-17': { emoji: '🍀', name: "St. Patrick's Day",    color: 'text-emerald-400'},
    '4-1':  { emoji: '🃏', name: "April Fools' Day",     color: 'text-amber-400'  },
    '4-22': { emoji: '🌍', name: "Earth Day",            color: 'text-green-400'  },
    '5-4':  { emoji: '⚔️', name: "Star Wars Day",        color: 'text-yellow-400' },
    '6-1':  { emoji: '🏳️‍🌈', name: "Pride Month starts", color: 'text-pink-400'   },
    '6-5':  { emoji: '🌿', name: "World Environment Day", color: 'text-green-400' },
    '6-21': { emoji: '☀️', name: "Summer Solstice",      color: 'text-amber-400'  },
    '7-4':  { emoji: '🇺🇸', name: "Independence Day",   color: 'text-red-400'    },
    '8-12': { emoji: '🌍', name: "World Elephant Day",   color: 'text-zinc-400'   },
    '9-21': { emoji: '☮️', name: "International Peace Day", color: 'text-sky-400' },
    '10-10':{ emoji: '🧠', name: "World Mental Health Day", color: 'text-violet-400'},
    '10-16':{ emoji: '🍞', name: "World Food Day",       color: 'text-amber-400'  },
    '10-31':{ emoji: '🎃', name: "Halloween",            color: 'text-orange-400' },
    '11-1': { emoji: '🕯️', name: "All Saints' Day",     color: 'text-zinc-400'   },
    '11-11':{ emoji: '🎖️', name: "Veterans Day",        color: 'text-red-400'    },
    '12-21':{ emoji: '❄️', name: "Winter Solstice",      color: 'text-sky-400'    },
    '12-24':{ emoji: '🎄', name: "Christmas Eve",        color: 'text-green-400'  },
    '12-25':{ emoji: '🎅', name: "Christmas Day",        color: 'text-red-400'    },
    '12-26':{ emoji: '🕎', name: "Boxing Day / Kwanzaa", color: 'text-amber-400'  },
    '12-31':{ emoji: '🥂', name: "New Year's Eve",       color: 'text-yellow-400' },
  }
  const fixedKey = `${m + 1}-${d}`
  if (fixed[fixedKey]) return fixed[fixedKey]

  // ── Floating holidays ──
  // Mother's Day: 2nd Sunday in May
  if (m === 4 && dow === 0 && d === nthWeekday(y, 4, 0, 2))
    return { emoji: '💐', name: "Mother's Day", color: 'text-pink-400' }
  // Father's Day: 3rd Sunday in June
  if (m === 5 && dow === 0 && d === nthWeekday(y, 5, 0, 3))
    return { emoji: '👔', name: "Father's Day", color: 'text-blue-400' }
  // MLK Day: 3rd Monday in January
  if (m === 0 && dow === 1 && d === nthWeekday(y, 0, 1, 3))
    return { emoji: '✊', name: "MLK Day", color: 'text-amber-400' }
  // Presidents' Day: 3rd Monday in February
  if (m === 1 && dow === 1 && d === nthWeekday(y, 1, 1, 3))
    return { emoji: '🏛️', name: "Presidents' Day", color: 'text-sky-400' }
  // Memorial Day: last Monday in May
  if (m === 4 && dow === 1 && d === nthWeekday(y, 4, 1, -1))
    return { emoji: '🎗️', name: "Memorial Day", color: 'text-red-400' }
  // Labor Day: 1st Monday in September
  if (m === 8 && dow === 1 && d === nthWeekday(y, 8, 1, 1))
    return { emoji: '🔨', name: "Labor Day", color: 'text-amber-400' }
  // Columbus / Indigenous Peoples Day: 2nd Monday in October
  if (m === 9 && dow === 1 && d === nthWeekday(y, 9, 1, 2))
    return { emoji: '🌎', name: "Indigenous Peoples Day", color: 'text-green-400' }
  // Thanksgiving: 4th Thursday in November
  if (m === 10 && dow === 4 && d === nthWeekday(y, 10, 4, 4))
    return { emoji: '🦃', name: "Thanksgiving", color: 'text-amber-400' }

  // ── Season markers (approximate) ──
  if (m === 2 && d >= 19 && d <= 21) return { emoji: '🌸', name: "Spring Equinox", color: 'text-pink-400' }
  if (m === 8 && d >= 21 && d <= 23) return { emoji: '🍂', name: "Autumn Equinox", color: 'text-orange-400' }

  return null
}

// ── Live daily fact (fetched from /api/daily-fact) ───────────────────────────

interface DailyFact {
  type: 'ai-news' | 'tech-news' | 'history'
  emoji: string
  title: string
  url: string | null
  source: string
}

function useDailyFact() {
  const [date, setDate] = useState<Date | null>(null)
  const [fact, setFact] = useState<DailyFact | null>(null)

  useEffect(() => {
    const now = new Date()
    setDate(now)
    const load = () => {
      setDate(new Date())
      fetch('/api/daily-fact', { cache: 'no-store' }).then((r) => r.json()).then(setFact).catch(() => {})
    }
    load()

    // Poll every 30 minutes
    const interval = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return { date, fact }
}

function useClock() {
  const [time, setTime] = useState<Date | null>(null)
  const [tick, setTick] = useState(true)
  useEffect(() => {
    setTime(new Date())
    const id = setInterval(() => {
      setTime(new Date())
      setTick((t) => !t)
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return { time, tick }
}

function useLogout() {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const logout = async () => {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }
  return { logout, loggingOut }
}

export default function Sidebar() {
  const pathname = usePathname()
  const { date, fact } = useDailyFact()
  const notable = date ? getNotableDay(date) : null
  const { time: mobileTime, tick: mobileTick } = useClock()
  const { logout, loggingOut } = useLogout()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 h-screen flex-col border-r border-zinc-200 dark:border-white/[0.05] bg-white/90 dark:bg-[rgba(7,7,15,0.75)] backdrop-blur-2xl">
        <div className="px-5 py-[18px] border-b border-zinc-200 dark:border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="relative w-6 h-6 rounded-lg border border-indigo-500/25 bg-indigo-500/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-sm bg-indigo-400/80" />
            </div>
            <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight">Dashboard</span>
          </div>
        </div>

        <div className="pt-3 pb-1">
          <SearchBar />
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {nav.map(({ label, href, icon: Icon, iconActive, iconInactive, bar, bg }) => {
            const active =
              href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  active ? `${bg} text-zinc-900 dark:text-zinc-100` : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                {active && (
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full ${bar}`} />
                )}
                <Icon
                  size={14}
                  strokeWidth={active ? 2 : 1.75}
                  className={active ? iconActive : iconInactive}
                />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Theme toggle */}
        <div className="px-3 pb-1">
          <ThemeToggle />
        </div>

        {/* Logout */}
        <div className="px-3 pb-1">
          <button
            onClick={logout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium text-zinc-400 dark:text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-150 disabled:opacity-40"
          >
            <LogOut size={14} strokeWidth={1.75} className="shrink-0" />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>

        <Clock />

        {/* Desktop daily fact panel */}
        <div className="px-3 pb-4 space-y-2">
          {notable && (
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-3 py-2.5 flex items-center gap-2.5">
              <span className="text-base leading-none shrink-0">{notable.emoji}</span>
              <div className="min-w-0">
                <p className={`text-[11px] font-semibold truncate ${notable.color}`}>{notable.name}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600">Today</p>
              </div>
            </div>
          )}
          {fact ? (
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs leading-none">{fact.emoji}</span>
                {fact.source && (
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-700 font-medium tracking-wide uppercase">{fact.source}</span>
                )}
              </div>
              {fact.url ? (
                <a href={fact.url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors line-clamp-3 block">
                  {fact.title}
                </a>
              ) : (
                <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3">{fact.title}</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-3 py-2.5 animate-pulse">
              <div className="h-2 bg-zinc-200/70 dark:bg-white/[0.05] rounded w-3/4 mb-2" />
              <div className="h-2 bg-zinc-200/70 dark:bg-white/[0.05] rounded w-full mb-1" />
              <div className="h-2 bg-zinc-200/70 dark:bg-white/[0.05] rounded w-2/3" />
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile top bar (news strip + clock) ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 border-b border-zinc-200 dark:border-white/[0.06] bg-white/95 dark:bg-[rgba(7,7,15,0.92)] backdrop-blur-xl">
        <div className="flex items-center gap-2.5 px-4 h-11">
          {notable && (
            <span className="text-sm shrink-0">{notable.emoji}</span>
          )}
          {fact ? (
            fact.url ? (
              <a href={fact.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 min-w-0 flex items-center gap-2 group">
                <span className="text-sm shrink-0 leading-none">{fact.emoji}</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors truncate">
                  {fact.title}
                </span>
                {fact.source && (
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-700 font-medium shrink-0">{fact.source}</span>
                )}
              </a>
            ) : (
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-sm shrink-0 leading-none">{fact.emoji}</span>
                <span className="text-[11px] text-zinc-500 truncate">{fact.title}</span>
              </div>
            )
          ) : (
            <div className="flex-1 h-2 bg-zinc-200/70 dark:bg-white/[0.05] rounded animate-pulse" />
          )}
          {/* Clock — right side */}
          {mobileTime && (
            <div className="shrink-0 flex items-baseline gap-0.5 pl-2 border-l border-zinc-200 dark:border-white/[0.06]">
              <span className="font-mono text-[13px] font-light text-zinc-700 dark:text-zinc-300 tabular-nums leading-none">
                {mobileTime.getHours().toString().padStart(2, '0')}
                <span
                  className="mx-px text-zinc-400 dark:text-zinc-600 transition-opacity duration-150"
                  style={{ opacity: mobileTick ? 1 : 0.2 }}
                >:</span>
                {mobileTime.getMinutes().toString().padStart(2, '0')}
              </span>
              <span className="font-mono text-[10px] font-light text-zinc-400 dark:text-zinc-600 tabular-nums leading-none">
                {mobileTime.getSeconds().toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 dark:border-white/[0.06] bg-white/95 dark:bg-[rgba(7,7,15,0.92)] backdrop-blur-xl">
        <div className="flex items-stretch h-16">
          {mobileNav.map(({ label, href, icon: Icon, iconActive, iconInactive }) => {
            const active =
              href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.75} className={active ? iconActive : iconInactive} />
                <span className={`text-[9px] font-medium tracking-wide ${active ? iconActive : iconInactive}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  )
}
