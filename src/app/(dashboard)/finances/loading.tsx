// Mirrors FinancesBoard: compact header, four stat tiles (1/2/4 columns), the
// profit + 260px chart card, then the ledger / right-rail split at lg. The
// ledger body is hidden below lg on the real page too.
import { Bone } from '@/components/skeleton'

const CARD =
  'rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-zinc-50 dark:bg-white/[0.03]'

export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-6xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[22px] font-semibold text-zinc-900 dark:text-white">Finances</h1>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-0.5">
              Közös főkönyv és a privát pénzmozgások.
            </p>
          </div>
          <Bone className="shrink-0 h-9 w-[108px] rounded-xl" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${CARD} p-4 sm:p-5`}>
              <Bone className="h-3 w-24 mb-2.5" />
              <Bone className={`${i === 0 ? 'h-7' : 'h-5'} w-28 mb-2`} />
              <Bone className="h-3 w-20" />
            </div>
          ))}
        </div>

        <div className={`${CARD} p-4 sm:p-5 mb-4`}>
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 sm:gap-4 mb-4">
            <div>
              <Bone className="h-3 w-12 mb-2" />
              <Bone className="h-7 w-32" />
            </div>
            <div className="flex items-center gap-3">
              <Bone className="h-3 w-20" />
              <Bone className="h-3 w-16" />
            </div>
          </div>
          <div className="relative w-full h-[260px]">
            <div className="absolute inset-x-0 bottom-6 top-2 flex items-end gap-[2%] px-8">
              {[40, 55, 45, 70, 60, 85, 75, 95, 80, 100, 90, 100, 85, 95].map((h, i) => (
                <Bone key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex justify-between px-8">
              {Array.from({ length: 7 }).map((_, i) => <Bone key={i} className="h-2.5 w-8" />)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
          <div className={`${CARD} p-4 sm:p-5 min-w-0`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Közös főkönyv</h2>
              <Bone className="h-3 w-16" />
            </div>
            <div className="mt-3 hidden lg:block">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                <Bone className="h-9 flex-1 rounded-lg" />
                <Bone className="h-9 sm:w-52 rounded-lg" />
              </div>
              <Bone className="h-3 w-20 mb-3" />
              <div className="space-y-px">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 h-[33px] border-b border-zinc-100 dark:border-white/[0.03]">
                    <Bone className="h-3 w-24 shrink-0" />
                    <Bone className="h-3 flex-1" style={{ maxWidth: `${35 + (i % 4) * 12}%` }} />
                    <Bone className="h-3 w-20 ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4 min-w-0">
            <div className={`${CARD} p-4 sm:p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Privát pénzmozgások</h2>
                <Bone className="h-3 w-16" />
              </div>
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className={`${CARD} flex items-center gap-3 p-4`}>
                    <Bone className="w-2 h-2 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Bone className="h-3.5 w-28" />
                      <Bone className="h-3 w-20 mt-1.5" />
                    </div>
                    <Bone className="h-4 w-20 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
            <div className={`${CARD} p-4 sm:p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Emlékeztetők</h2>
                <Bone className="h-6 w-6 rounded-md" />
              </div>
              <div className="space-y-2.5">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3">
                    <Bone className="h-3 w-24" />
                    <Bone className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
