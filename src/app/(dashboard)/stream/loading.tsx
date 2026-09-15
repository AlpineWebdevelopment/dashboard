// Mirrors ThoughtsFeed: no page heading — the capture box, then the feed.
import { Bone } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="flex-1 min-h-0 flex flex-col" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pb-12">
        <div className="py-8 sm:py-10">
          <div className="w-full panel bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] rounded-2xl px-5 py-4 h-[110px]" />
          <div className="flex items-center justify-between mt-2.5 px-1">
            <Bone className="h-3 w-40" />
            <Bone className="h-8 w-[100px] rounded-lg" />
          </div>
        </div>
        <div className="space-y-2">
          {[2, 1, 3, 1, 2, 1].map((lines, i) => (
            <div
              key={i}
              className="rounded-2xl border px-4 py-3.5 bg-white dark:bg-white/[0.02] border-zinc-100 dark:border-white/[0.06]"
            >
              <div className="space-y-2">
                {Array.from({ length: lines }).map((_, l) => (
                  <Bone key={l} className="h-3.5" style={{ width: l === lines - 1 ? `${40 + (i % 3) * 15}%` : '100%' }} />
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <Bone className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
