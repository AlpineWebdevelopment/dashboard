'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, FileText, Settings, Layers } from 'lucide-react'

const nav = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Pages', href: '/pages', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
]

function Clock() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  const hh = time.getHours().toString().padStart(2, '0')
  const mm = time.getMinutes().toString().padStart(2, '0')
  const ss = time.getSeconds().toString().padStart(2, '0')
  const date = time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="px-4 py-4 border-t border-white/[0.06]">
      <p className="text-[11px] text-zinc-600 mb-1">{date}</p>
      <p className="font-mono text-sm text-zinc-300 tracking-widest">
        {hh}
        <span className="animate-pulse text-zinc-500">:</span>
        {mm}
        <span className="animate-pulse text-zinc-500">:</span>
        {ss}
      </p>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 h-screen bg-zinc-900/60 border-r border-white/[0.06] flex flex-col backdrop-blur-xl">
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Layers size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">Dashboard</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-white/[0.08] text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={15} className={active ? 'text-violet-400' : ''} />
              {label}
            </Link>
          )
        })}
      </nav>

      <Clock />
    </aside>
  )
}
