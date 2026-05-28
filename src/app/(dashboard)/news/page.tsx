'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowUpRight, MessageSquare, RefreshCw, Zap } from 'lucide-react'
import type { NewsItem } from '@/app/api/news/route'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 min

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function CategoryPill({ category }: { category: NewsItem['category'] }) {
  return category === 'ai' ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wider uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20">
      <Zap size={7} className="shrink-0" />AI
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
      TECH
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 300 ? 'text-amber-400' :
    score >= 100 ? 'text-emerald-400' :
    'text-zinc-500'
  return (
    <span className={`font-mono text-[11px] font-medium tabular-nums ${color}`}>
      ▲ {score}
    </span>
  )
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [, setTick] = useState(0)

  // Tick every second so the "X ago" counter stays live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res = await fetch('/api/news', { cache: 'no-store' })
      const data: NewsItem[] = await res.json()
      setItems(data)
      setLastUpdated(new Date())
    } catch { /* ignore */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(), REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="min-h-screen px-4 sm:px-8 pt-8 sm:pt-10 pb-20 max-w-3xl">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-3">Feed</p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">News</h1>
        </div>
        <div className="flex items-center gap-3 pb-1">
          {lastUpdated && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-700 tabular-nums hidden sm:block">
              Updated {timeAgo(Math.floor(lastUpdated.getTime() / 1000))}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all disabled:opacity-40"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Category tabs summary */}
      {!loading && items.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">
            {items.filter(i => i.category === 'ai').length} AI stories
          </span>
          <span className="text-zinc-300 dark:text-zinc-800">·</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">
            {items.filter(i => i.category === 'tech').length} Tech stories
          </span>
          <span className="text-zinc-300 dark:text-zinc-800">·</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">Refreshes every 5 min</span>
        </div>
      )}

      {/* Stories */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-3.5 animate-pulse">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-3.5 bg-zinc-200 dark:bg-white/[0.05] rounded w-8" />
                <div className="h-3.5 bg-zinc-200 dark:bg-white/[0.05] rounded flex-1" style={{ maxWidth: `${55 + (i % 4) * 10}%` }} />
              </div>
              <div className="h-2.5 bg-zinc-100 dark:bg-white/[0.03] rounded w-32" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400 dark:text-zinc-700">
          <p className="text-sm">No stories right now. Try refreshing.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <article
              key={item.id}
              className="group relative rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.04] hover:border-zinc-300 dark:hover:border-white/[0.09] transition-all duration-150 px-4 py-3.5"
            >
              <div className="flex items-start gap-3">
                {/* Rank */}
                <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-700 tabular-nums pt-px shrink-0 w-5 text-right">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-start gap-2 mb-2">
                    <CategoryPill category={item.category} />
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 leading-snug transition-colors line-clamp-2 flex-1"
                    >
                      {item.title}
                      <ArrowUpRight size={11} className="inline ml-1 opacity-0 group-hover:opacity-40 transition-opacity" />
                    </a>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <ScoreBadge score={item.score} />
                    <a
                      href={item.hnUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                    >
                      <MessageSquare size={10} />
                      {item.comments}
                    </a>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-700">{item.by}</span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-700">{timeAgo(item.time)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
