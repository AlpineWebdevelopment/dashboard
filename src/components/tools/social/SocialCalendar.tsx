'use client'

// /tools/social/calendar: posts on a Monday-first month or week grid, in
// Budapest time. Drag a post to another day (month keeps its time of day) or
// another hour (week keeps its minutes); drag an undated draft in from the
// tray. Posts already publishing or published don't move.
//
// Moves go through setTimes, the same action as the bulk editor, so a
// scheduled post's jobs follow it and an invalid move is refused with a reason.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { setTimes, type SocialOverview } from '@/lib/social/actions'
import { budapestAt, budapestParts, formatTime, formatWhen, isoWeekday, shiftDate, todayStr } from '@/lib/social/time'
import type { JobStatus, SocialPost } from '@/lib/social/types'
import { toolByKey } from '@/lib/tools/registry'
import { Segmented, btnSecondary } from '@/components/tools/ui'
import { SetupNotices } from './AccountsPanel'
import { MediaThumb, PlatformGlyph, SocialHeader } from './shared'

const TOOL = toolByKey('social')!
const HOUR_HEIGHT = 44
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const IN_FLIGHT: JobStatus[] = ['creating', 'processing', 'publishing']

const MONTHS = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dateObj = (d: string) => new Date(`${d}T12:00:00Z`)

/** Module scope: only ever called from a drop handler, never while rendering. */
const isPast = (iso: string) => new Date(iso).getTime() < Date.now()

const movable = (p: SocialPost) => p.status !== 'published' && !p.jobs.some((j) => IN_FLIGHT.includes(j.status) || j.status === 'published')

const CHIP_TONE: Record<SocialPost['status'], string> = {
  draft: 'border-dashed border-zinc-300 dark:border-white/20',
  scheduled: 'border-sky-500/40',
  publishing: 'border-amber-500/50',
  published: 'border-emerald-500/50',
  partial: 'border-orange-500/50',
  failed: 'border-red-500/50',
}

function Chip({
  post,
  platforms,
  compact,
  onDragStart,
}: {
  post: SocialPost
  platforms: ('facebook' | 'instagram')[]
  compact?: boolean
  onDragStart: (id: string) => void
}) {
  const canMove = movable(post)
  const first = post.media[0]
  return (
    <div
      draggable={canMove}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(post.id)
      }}
      title={`${post.scheduled_at ? formatWhen(post.scheduled_at) : 'No time'} · ${post.status}\n${post.caption.slice(0, 200) || '(no caption)'}`}
      className={`flex items-center gap-1.5 rounded-lg border bg-white/85 dark:bg-zinc-900/85 p-0.5 pr-1.5 min-w-0 ${CHIP_TONE[post.status]} ${
        canMove ? 'cursor-grab active:cursor-grabbing' : 'opacity-80'
      }`}
    >
      <MediaThumb url={first?.thumb_url ?? null} kind={first?.kind ?? 'image'} count={post.media.length} className="w-6 h-6 rounded-md" />
      {/* A phone's month cell is ~35px wide: room for the thumbnail and nothing
          else. The time is in the tooltip, and the week view places by hour. */}
      {!compact && post.scheduled_at && (
        <span className="hidden sm:inline text-[12px] tabular-nums text-zinc-800 dark:text-white">{formatTime(post.scheduled_at)}</span>
      )}
      <span className="hidden sm:flex items-center gap-0.5 ml-auto">
        {[...new Set(platforms)].map((pl) => (
          <PlatformGlyph key={pl} platform={pl} size={11} />
        ))}
      </span>
    </div>
  )
}

export default function SocialCalendar({ overview, initialPosts }: { overview: SocialOverview; initialPosts: SocialPost[] }) {
  const [posts, setPosts] = useState(initialPosts)
  const [view, setView] = useState<'month' | 'week'>('month')
  const [today] = useState(() => todayStr())
  const [cursor, setCursor] = useState(today)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; err?: boolean } | null>(null)
  const weekScroll = useRef<HTMLDivElement>(null)

  const platformOf = useMemo(() => new Map(overview.accounts.map((a) => [a.id, a.platform])), [overview.accounts])
  const platformsFor = useCallback(
    (p: SocialPost) => p.target_ids.map((id) => platformOf.get(id)).filter(Boolean) as ('facebook' | 'instagram')[],
    [platformOf]
  )

  const byDay = useMemo(() => {
    const m = new Map<string, SocialPost[]>()
    for (const p of posts) {
      if (!p.scheduled_at) continue
      const d = budapestParts(p.scheduled_at).dateStr
      if (!m.has(d)) m.set(d, [])
      m.get(d)!.push(p)
    }
    for (const list of m.values()) list.sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
    return m
  }, [posts])
  const undated = posts.filter((p) => !p.scheduled_at && p.status === 'draft')

  // Grid days: month → 6 Monday-first weeks around the 1st; week → the 7 days of the cursor's week.
  const days = useMemo(() => {
    if (view === 'week') {
      const monday = shiftDate(cursor, 1 - isoWeekday(cursor))
      return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i))
    }
    const first = `${cursor.slice(0, 7)}-01`
    const start = shiftDate(first, 1 - isoWeekday(first))
    return Array.from({ length: 42 }, (_, i) => shiftDate(start, i))
  }, [view, cursor])

  useEffect(() => {
    // Open the week view at 07:00 instead of midnight.
    if (view === 'week' && weekScroll.current) weekScroll.current.scrollTop = HOUR_HEIGHT * 7
  }, [view])

  const move = async (id: string, iso: string) => {
    const post = posts.find((p) => p.id === id)
    if (!post || !movable(post)) return
    if (isPast(iso)) {
      setMessage({ text: 'That time has already passed.', err: true })
      return
    }
    const before = posts
    setPosts((list) => list.map((p) => (p.id === id ? { ...p, scheduled_at: iso } : p)))
    const res = await setTimes([{ id, scheduled_at: iso }])
    if (!res.ok) {
      setPosts(before)
      return setMessage({ text: res.error.message, err: true })
    }
    const problem = res.data.problems.find((pr) => pr.id === id)
    if (problem) {
      setPosts(before)
      return setMessage({ text: problem.message, err: true })
    }
    setPosts((list) => list.map((p) => res.data.posts.find((u) => u.id === p.id) ?? p))
    setMessage({ text: `Moved to ${formatWhen(iso)}.` })
  }

  const dropProps = (key: string, target: (post: SocialPost) => string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return
      e.preventDefault()
      setOverKey(key)
    },
    onDragLeave: () => setOverKey((k) => (k === key ? null : k)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/plain') || dragId
      setOverKey(null)
      setDragId(null)
      const post = posts.find((p) => p.id === id)
      if (post) move(post.id, target(post))
    },
  })

  const step = (dir: -1 | 1) => {
    if (view === 'week') return setCursor((c) => shiftDate(c, dir * 7))
    const [y, m] = cursor.split('-').map(Number)
    const t = new Date(Date.UTC(y, m - 1 + dir, 1))
    setCursor(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-01`)
  }

  const title =
    view === 'month'
      ? MONTHS.format(dateObj(`${cursor.slice(0, 7)}-01`))
      : `${SHORT.format(dateObj(days[0]))} – ${SHORT.format(dateObj(days[6]))}`

  return (
    <div onDragEnd={() => { setDragId(null); setOverKey(null) }}>
      <SocialHeader />
      <SetupNotices overview={overview} />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => step(-1)} aria-label="Previous" className={`${btnSecondary()} p-2`}>
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setCursor(today)} className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}>
            Today
          </button>
          <button onClick={() => step(1)} aria-label="Next" className={`${btnSecondary()} p-2`}>
            <ChevronRight size={15} />
          </button>
          <h2 className="ml-2 text-[15px] font-semibold text-zinc-900 dark:text-white">{title}</h2>
        </div>
        <Segmented
          accent={TOOL.accent}
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
          ]}
        />
      </div>

      {message && (
        <p className={`mb-3 text-[13px] ${message.err ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {message.text}
        </p>
      )}

      {undated.length > 0 && (
        <div className="panel mb-3 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02] p-3">
          <div className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
            Drafts without a time <span className="normal-case tracking-normal font-normal">· drag onto a day</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((p) => (
              <Chip key={p.id} post={p} platforms={platformsFor(p)} compact onDragStart={setDragId} />
            ))}
          </div>
        </div>
      )}

      {view === 'month' ? (
        <div className="panel rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-white/[0.06]">
            {DAY_NAMES.map((d) => (
              <div key={d} className="px-1 sm:px-2 py-1.5 text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const inMonth = d.slice(0, 7) === cursor.slice(0, 7)
              const list = byDay.get(d) ?? []
              const key = `m:${d}`
              return (
                <div
                  key={d}
                  {...dropProps(key, (post) => {
                    const p = post.scheduled_at ? budapestParts(post.scheduled_at) : null
                    return budapestAt(d, p?.hour ?? 12, p?.minute ?? 0)
                  })}
                  className={`min-h-[96px] sm:min-h-[112px] p-1 sm:p-1.5 border-zinc-200 dark:border-white/[0.06] ${i % 7 ? 'border-l' : ''} ${
                    i >= 7 ? 'border-t' : ''
                  } ${overKey === key ? 'bg-rose-500/10' : inMonth ? '' : 'bg-zinc-100/70 dark:bg-black/25'}`}
                >
                  <div
                    className={`mb-1 text-[12px] tabular-nums ${
                      d === today
                        ? 'inline-flex w-5 h-5 items-center justify-center rounded-full bg-rose-500 text-white font-semibold'
                        : inMonth
                          ? 'text-zinc-800 dark:text-white'
                          : 'text-zinc-500 dark:text-zinc-200'
                    }`}
                  >
                    {Number(d.slice(8))}
                  </div>
                  <div className="space-y-1">
                    {list.slice(0, 4).map((p) => (
                      <Chip key={p.id} post={p} platforms={platformsFor(p)} onDragStart={setDragId} />
                    ))}
                    {list.length > 4 && (
                      <div className="text-[12px] text-zinc-500 dark:text-zinc-200 pl-1">+{list.length - 4} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="panel rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02] overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-zinc-200 dark:border-white/[0.06]">
              <div />
              {days.map((d, i) => (
                <div key={d} className="px-2 py-1.5 text-[12px] font-semibold text-zinc-500 dark:text-zinc-200 border-l border-zinc-200 dark:border-white/[0.06]">
                  <span className="tracking-widest uppercase">{DAY_NAMES[i]}</span>{' '}
                  <span className={d === today ? 'text-rose-600 dark:text-rose-300' : 'text-zinc-800 dark:text-white'}>{Number(d.slice(8))}</span>
                </div>
              ))}
            </div>
            <div ref={weekScroll} className="max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-[48px_repeat(7,1fr)] relative" style={{ height: HOUR_HEIGHT * 24 }}>
                <div>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ height: HOUR_HEIGHT }} className="pr-1.5 text-right text-[12px] tabular-nums text-zinc-500 dark:text-zinc-200 -translate-y-2">
                      {h ? `${String(h).padStart(2, '0')}:00` : ''}
                    </div>
                  ))}
                </div>
                {days.map((d) => (
                  <div key={d} className="relative border-l border-zinc-200 dark:border-white/[0.06]">
                    {Array.from({ length: 24 }, (_, h) => {
                      const key = `w:${d}:${h}`
                      return (
                        <div
                          key={h}
                          {...dropProps(key, (post) => {
                            const minute = post.scheduled_at ? budapestParts(post.scheduled_at).minute : 0
                            return budapestAt(d, h, minute)
                          })}
                          style={{ height: HOUR_HEIGHT }}
                          className={`border-t border-zinc-200/70 dark:border-white/[0.04] ${overKey === key ? 'bg-rose-500/10' : ''}`}
                        />
                      )
                    })}
                    {(byDay.get(d) ?? []).map((p) => {
                      const t = budapestParts(p.scheduled_at!)
                      return (
                        <div
                          key={p.id}
                          className="absolute left-0.5 right-0.5 z-10"
                          style={{ top: (t.hour + t.minute / 60) * HOUR_HEIGHT + 1 }}
                        >
                          <Chip post={p} platforms={platformsFor(p)} onDragStart={setDragId} />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-200">
        Budapest time. Dashed = draft, blue = scheduled, green = published. Scheduled posts keep their schedule when moved.
      </p>
    </div>
  )
}
