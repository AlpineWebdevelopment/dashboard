// Home. The page lives in its own route group so this boundary wraps only
// `/` — a loading.tsx directly under (dashboard) would sit *outside* every
// sibling's boundary, and both the prefetch payload and the initial stream
// showed this skeleton before the route's own one.
import { Bone, CARD, CARD_LG, Dot } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        {/* Header — PageGreeting reserves 58px before it knows the hour */}
        <div className="mb-8 sm:mb-12">
          <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-3">
            Overview
          </p>
          <div className="flex items-center gap-4 h-[58px]">
            <Bone className="shrink-0 w-10 h-10 rounded-xl" />
            <div>
              <Bone className="h-7 w-56" />
              <Bone className="h-3 w-40 mt-2" />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-8 sm:mb-12">
          {[0, 1, 2].map((i) => (
            <div key={i} className={i === 2 ? 'col-span-2 sm:col-span-1' : ''}>
              <div className={`${CARD_LG} p-4 sm:p-5 h-full`}>
                <Bone className="h-3 w-20 mb-3 sm:mb-4" />
                <Bone className="h-7 w-16" />
                <Bone className="h-3 w-24 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Scratch pad */}
        <div className="mb-8 sm:mb-12">
          <div className={`${CARD_LG} relative overflow-hidden`}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-[13px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
                Scratch pad
              </p>
            </div>
            <div className="px-5 pb-5 pt-1 space-y-2.5">
              <Bone className="h-3.5 w-3/4" />
              <Bone className="h-3.5 w-1/2" />
              <Bone className="h-3.5 w-2/3" />
            </div>
          </div>
        </div>

        {/* Recent pages */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
              Recent pages
            </p>
            <Bone className="h-3 w-16" />
          </div>
          <div className="space-y-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`${CARD} flex items-center justify-between px-4 py-3`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Dot className="w-1 h-1 shrink-0" />
                  <Bone className="h-3.5" style={{ width: `${35 + (i % 4) * 12}%` }} />
                </div>
                <Bone className="h-3 w-12 shrink-0 ml-4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
