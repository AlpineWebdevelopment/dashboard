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

export default function PageGreeting() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    // update on the hour
    const tick = () => setNow(new Date())
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className="h-[52px]" /> // prevent layout shift

  const { label, emoji } = getGreeting(now.getHours())
  const motivation = MOTIVATIONS[getDayOfYear(now) % MOTIVATIONS.length]

  return (
    <div>
      <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-100 tracking-tight leading-tight">
        {emoji} {label}
      </h1>
      <p className="text-sm text-zinc-600 mt-1">{motivation}</p>
    </div>
  )
}
