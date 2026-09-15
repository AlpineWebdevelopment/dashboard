// Mirrors the Login Hub: fixed-height shell, heading, the S/B switcher, then
// grouped auto-fill tile grids.
import { Bone } from '@/components/skeleton'

const TILE =
  'panel bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.07] rounded-xl px-3.5 py-3'

function Group({ tiles }: { tiles: number }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Bone className="w-4 h-4 rounded" />
        <Bone className="h-3.5 w-24" />
      </div>
      <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className={`${TILE} flex items-center gap-3`}>
            <Bone className="w-6 h-6 rounded-md shrink-0" />
            <div className="flex-1 min-w-0">
              <Bone className="h-3.5" style={{ width: `${40 + (i % 3) * 15}%` }} />
              <Bone className="h-2.5 w-20 mt-1.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
          Personal
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
            Login Hub
          </h1>
          <Bone className="h-3 w-12" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-4 sm:px-8 pb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bone className="h-[30px] w-[90px] rounded-lg" />
          <Bone className="ml-auto h-8 w-[88px] rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          <Group tiles={4} />
          <Group tiles={3} />
          <Group tiles={5} />
        </div>
      </div>
    </div>
  )
}
