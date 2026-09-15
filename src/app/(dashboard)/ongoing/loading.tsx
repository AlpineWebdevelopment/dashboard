// Mirrors OngoingBoard: stacked-on-mobile header, three stat tiles, filter
// chips, then person sections in one column that splits at lg.
import { Bone, Dot } from '@/components/skeleton'

const TILE =
  'rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-zinc-50 dark:bg-white/[0.03]'

function ActivityCard({ i }: { i: number }) {
  return (
    <div className={`${TILE} p-4`}>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <Bone className="h-5 w-20 rounded-md" />
      </div>
      <Bone className="h-4 mb-2" style={{ width: `${55 + (i % 3) * 15}%` }} />
      <div className="flex items-center gap-2 mb-4">
        <Bone className="h-5 w-24 rounded-md" />
      </div>
      <div className="flex items-center gap-3">
        <Bone className="flex-1 h-1.5 rounded-full" />
        <Bone className="h-3 w-8" />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-5xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
              Right now
            </p>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
              Ongoing
            </h1>
          </div>
          <Bone className="h-9 w-[120px] rounded-lg shrink-0" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${TILE} p-5`}>
              <Bone className="h-3 w-24 mb-3" />
              <Bone className="h-7 w-16 mb-2" />
              <Bone className="h-3 w-28" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-6">
          {[0, 1, 2, 3].map((i) => <Bone key={i} className="h-8 w-20 rounded-lg" />)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-8 items-start">
          {[2, 3].map((count, s) => (
            <section key={s}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-200 dark:border-white/[0.07]">
                <Dot className="w-2 h-2" />
                <Bone className="h-3.5 w-24" />
                <Bone className="h-3 w-4" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: count }).map((_, i) => <ActivityCard key={i} i={i + s} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
