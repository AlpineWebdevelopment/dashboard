// Mirrors ClientProjectsBoard: heading with blurb, four stat tiles (two per
// row on a phone), then the single-column project cards.
import { Bone } from '@/components/skeleton'

const CARD =
  'rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-white/60 dark:bg-white/[0.02]'

export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-4xl">
        <div className="mb-8 sm:mb-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
              Delivery
            </p>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
              Client Projects
            </h1>
            <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-200 leading-relaxed">
              Every project being delivered, and where each one stands.
            </p>
          </div>
          <Bone className="shrink-0 h-9 w-[130px] rounded-xl" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${CARD} px-4 py-3.5`}>
              <Bone className="h-3 w-16" />
              <Bone className="h-5 w-10 mt-2.5" />
            </div>
          ))}
        </div>

        <ul className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className={`${CARD} px-4 sm:px-5 py-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Bone className="h-4" style={{ width: `${35 + (i % 3) * 12}%` }} />
                    <Bone className="h-5 w-16 rounded-md shrink-0" />
                  </div>
                  <Bone className="h-3 w-28 mt-2" />
                </div>
                <Bone className="shrink-0 w-7 h-7 rounded-lg" />
              </div>
              {i % 2 === 0 && <Bone className="h-3 w-4/5 mt-3" />}
              <div className="mt-3.5 flex items-center gap-3">
                <Bone className="flex-1 h-1.5 rounded-full" />
                <Bone className="h-3 w-8" />
              </div>
              <div className="mt-3 flex items-center gap-4">
                <Bone className="h-3 w-24" />
                <Bone className="h-3 w-20" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
