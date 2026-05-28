'use client'

import { useEffect, useState } from 'react'

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

// ── Custom SVG icons ────────────────────────────────────────────────────────

function SunriseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden>
      {/* horizon line */}
      <line x1="3" y1="19" x2="25" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* sun arc */}
      <path d="M7 19 A7 7 0 0 1 21 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* rays */}
      <line x1="14" y1="4"  x2="14" y2="7"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="7"  x2="20" y2="9"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6"  y1="7"  x2="8"  y2="9"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="14" x2="21" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4"  y1="14" x2="7"  y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* up arrow beneath */}
      <polyline points="11,23 14,20 17,23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden>
      <circle cx="14" cy="14" r="5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="3"  x2="14" y2="6"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="22" x2="14" y2="25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3"  y1="14" x2="6"  y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="14" x2="25" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6"  y1="6"  x2="8"  y2="8"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="20" x2="22" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="6"  x2="20" y2="8"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6"  y1="22" x2="8"  y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SunsetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden>
      {/* horizon line */}
      <line x1="3" y1="19" x2="25" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* sun arc */}
      <path d="M7 19 A7 7 0 0 1 21 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* rays */}
      <line x1="14" y1="4"  x2="14" y2="7"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="7"  x2="20" y2="9"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6"  y1="7"  x2="8"  y2="9"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="14" x2="21" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4"  y1="14" x2="7"  y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* down arrow beneath — distinguishes from sunrise */}
      <polyline points="11,21 14,24 17,21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden>
      {/* crescent */}
      <path
        d="M20 14.5A8 8 0 1 1 13 6a6 6 0 0 0 7 8.5z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* small stars */}
      <circle cx="21" cy="7"  r="0.8" fill="currentColor" />
      <circle cx="24" cy="11" r="0.6" fill="currentColor" />
      <circle cx="22" cy="4"  r="0.5" fill="currentColor" />
    </svg>
  )
}

// ── Greeting config ─────────────────────────────────────────────────────────

interface GreetingConfig {
  label: string
  Icon: React.FC<{ className?: string }>
  iconClass: string
  glowClass: string
}

function getGreeting(hour: number): GreetingConfig {
  if (hour >= 5 && hour < 12) return {
    label: 'Good morning',
    Icon: SunriseIcon,
    iconClass: 'text-amber-400',
    glowClass: 'shadow-amber-500/30',
  }
  if (hour >= 12 && hour < 18) return {
    label: 'Good afternoon',
    Icon: SunIcon,
    iconClass: 'text-yellow-300',
    glowClass: 'shadow-yellow-400/30',
  }
  if (hour >= 18 && hour < 22) return {
    label: 'Good evening',
    Icon: SunsetIcon,
    iconClass: 'text-orange-400',
    glowClass: 'shadow-orange-500/30',
  }
  return {
    label: 'Good night',
    Icon: MoonIcon,
    iconClass: 'text-indigo-400',
    glowClass: 'shadow-indigo-500/30',
  }
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000)
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PageGreeting() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className="h-[58px]" />

  const { label, Icon, iconClass, glowClass } = getGreeting(now.getHours())
  const motivation = MOTIVATIONS[getDayOfYear(now) % MOTIVATIONS.length]

  return (
    <div className="flex items-center gap-4">
      <div className={`shrink-0 w-10 h-10 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.04] flex items-center justify-center shadow-lg ${glowClass}`}>
        <Icon className={`w-5 h-5 ${iconClass}`} />
      </div>
      <div>
        <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
          Good <span className="italic">{label.split(' ')[1]}</span>, G
        </h1>
        <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-0.5">{motivation}</p>
      </div>
    </div>
  )
}
