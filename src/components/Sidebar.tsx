'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef, FormEvent } from 'react'
import { LayoutDashboard, FileText, Settings, Table2, CheckSquare, Search } from 'lucide-react'

const nav = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Pages', href: '/pages', icon: FileText },
  { label: 'Tables', href: '/tables', icon: Table2 },
  { label: 'Settings', href: '/settings', icon: Settings },
]

const mobileNav = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Pages', href: '/pages', icon: FileText },
  { label: 'Tables', href: '/tables', icon: Table2 },
  { label: 'Search', href: '/search', icon: Search },
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
        <Search size={11} className="absolute left-2.5 text-zinc-700 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-zinc-400 placeholder-zinc-700 outline-none focus:border-white/[0.12] focus:bg-white/[0.06] focus:text-zinc-200 transition-all"
        />
        <span className="absolute right-2 text-[9px] text-zinc-700 pointer-events-none hidden sm:block">
          ⌘K
        </span>
      </div>
    </form>
  )
}

function Clock() {
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

  if (!time) return null

  const hh = time.getHours().toString().padStart(2, '0')
  const mm = time.getMinutes().toString().padStart(2, '0')
  const ss = time.getSeconds().toString().padStart(2, '0')
  const date = time.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const progress = (time.getSeconds() / 60) * 100

  return (
    <div className="px-3 pb-4">
      <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3.5">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <p className="text-[10px] font-medium tracking-widest uppercase text-zinc-600 mb-2.5">
          {date}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[22px] font-light text-zinc-100 tabular-nums leading-none tracking-tight">
            {hh}
            <span
              className="mx-px text-zinc-500 transition-opacity duration-150"
              style={{ opacity: tick ? 1 : 0.2 }}
            >
              :
            </span>
            {mm}
          </span>
          <span className="font-mono text-sm font-light text-zinc-600 tabular-nums leading-none">
            {ss}
          </span>
        </div>
        <div className="mt-3 h-[2px] rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500/60 to-violet-500/40 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 shrink-0 h-screen flex-col border-r border-white/[0.05] bg-[rgba(7,7,15,0.75)] backdrop-blur-2xl">
        <div className="px-5 py-[18px] border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="relative w-6 h-6 rounded-lg border border-indigo-500/25 bg-indigo-500/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-sm bg-indigo-400/80" />
            </div>
            <span className="text-[13px] font-semibold text-zinc-200 tracking-tight">Dashboard</span>
          </div>
        </div>

        <div className="pt-3 pb-1">
          <SearchBar />
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {nav.map(({ label, href, icon: Icon }) => {
            const active =
              href === '/'
                ? pathname === '/'
                : pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? 'bg-white/[0.07] text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-indigo-400/70" />
                )}
                <Icon
                  size={14}
                  strokeWidth={active ? 2 : 1.75}
                  className={active ? 'text-indigo-400' : ''}
                />
                {label}
              </Link>
            )
          })}
        </nav>

        <Clock />
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[rgba(7,7,15,0.92)] backdrop-blur-xl">
        <div className="flex items-stretch h-16">
          {mobileNav.map(({ label, href, icon: Icon }) => {
            const active =
              href === '/'
                ? pathname === '/'
                : pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? 'text-indigo-400' : 'text-zinc-600 active:text-zinc-300'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.75} />
                <span className="text-[9px] font-medium tracking-wide">{label}</span>
              </Link>
            )
          })}
        </div>
        {/* Safe area spacer for iPhone home indicator */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  )
}
