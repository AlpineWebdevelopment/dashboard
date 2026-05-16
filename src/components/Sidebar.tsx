'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, FileText, Settings, Table2 } from 'lucide-react'

const nav = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Pages', href: '/pages', icon: FileText },
  { label: 'Tables', href: '/tables', icon: Table2 },
  { label: 'Settings', href: '/settings', icon: Settings },
]

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
    <aside className="w-56 shrink-0 h-screen flex flex-col border-r border-white/[0.05] bg-[rgba(7,7,15,0.75)] backdrop-blur-2xl">
      <div className="px-5 py-[18px] border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="relative w-6 h-6 rounded-lg border border-indigo-500/25 bg-indigo-500/10 flex items-center justify-center">
            <div className="w-2 h-2 rounded-sm bg-indigo-400/80" />
          </div>
          <span className="text-[13px] font-semibold text-zinc-200 tracking-tight">Dashboard</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
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
  )
}
