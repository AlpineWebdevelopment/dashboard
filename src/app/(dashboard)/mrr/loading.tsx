// Mirrors MrrBoard: stacked-on-mobile header with the month select, three
// stat tiles, the 240px income chart card, then the two client sections.
import { Bone } from '@/components/skeleton'

const TILE =
  'rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-zinc-50 dark:bg-white/[0.03]'

function ClientRow({ i }: { i: number }) {
  return (
    <div className={`rounded-xl border border-zinc-200 dark:border-white/[0.06] panel bg-zinc-50 dark:bg-white/[0.03] p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Bone className="h-3.5" style={{ width: `${30 + (i % 3) * 12}%` }} />
            <Bone className="h-4 w-14 rounded-md" />
          </div>
          <Bone className="h-3 w-3/4 mt-2.5" />
          <Bone className="h-3 w-1/2 mt-1.5" />
        </div>
        <div className="shrink-0 flex flex-col items-end">
          <Bone className="h-4 w-20" />
          <Bone className="h-3 w-14 mt-2" />
        </div>
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
              Revenue
            </p>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
              MRR
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Bone className="h-9 w-40 rounded-lg" />
            <Bone className="h-9 w-[112px] rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${TILE} p-5`}>
              <Bone className="h-3 w-24 mb-3" />
              <Bone className="h-7 w-24 mb-2" />
              <Bone className="h-3 w-28" />
            </div>
          ))}
        </div>

        <div className={`${TILE} p-5 mb-10`}>
          <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-4">
            Income over time
          </p>
          <div className="relative h-[240px]">
            <div className="absolute inset-x-0 bottom-6 flex items-end gap-[3%] h-[180px] px-2">
              {[35, 50, 45, 65, 60, 80, 70, 90, 85, 100, 95, 100].map((h, i) => (
                <Bone key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex justify-between px-2">
              {Array.from({ length: 6 }).map((_, i) => <Bone key={i} className="h-2.5 w-8" />)}
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {[3, 2].map((count, s) => (
            <section key={s}>
              <div className="flex items-center gap-2 mb-4">
                <Bone className="w-3.5 h-3.5" />
                <Bone className="h-3.5 w-32" />
                <Bone className="h-3 w-4" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: count }).map((_, i) => <ClientRow key={i} i={i + s} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
