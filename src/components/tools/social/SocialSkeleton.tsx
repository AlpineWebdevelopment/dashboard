// Loading skeletons for the three Social Scheduler routes. They render the
// real static chrome (the tools back-link, title, tagline, tab strip) so the
// swap to the loaded page moves nothing; bones stand in for the data.

import { ArrowLeft } from 'lucide-react'
import { Bone } from '@/components/skeleton'
import { TOOL_ACCENTS, toolByKey } from '@/lib/tools/registry'

const TOOL = toolByKey('social')!
const CARD = 'panel rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02]'

function Header() {
  const c = TOOL_ACCENTS[TOOL.accent]
  const Icon = TOOL.icon
  return (
    <div className="mb-6 sm:mb-8">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
        <ArrowLeft size={11} />
        Tools
      </span>
      <div className="flex items-start sm:items-end justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-xl border ${c.tile}`}>
            <Icon size={16} className={c.icon} />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
              {TOOL.name}
            </h1>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-1 leading-relaxed">{TOOL.tagline}</p>
          </div>
        </div>
        <Bone className="hidden md:block shrink-0 h-[42px] w-[241px] rounded-xl" />
      </div>
      <Bone className="md:hidden mt-4 -mb-2 h-[42px] w-[241px] rounded-xl" />
    </div>
  )
}

export function Frame({ wide, children }: { wide: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className={`px-4 sm:px-8 pt-8 sm:pt-10 pb-16 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <Header />
        {children}
      </div>
    </div>
  )
}

export function PostsSkeleton() {
  return (
    <Frame wide>
      <div className={`${CARD} mb-4 h-[241px]`} />
      <Bone className="h-[42px] w-[470px] max-w-full rounded-xl mb-3" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${CARD} p-3 flex gap-3`}>
            <Bone className="w-4 h-4 mt-1" />
            <Bone className="w-14 h-14 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Bone className="h-16 w-full rounded-lg" />
            </div>
            <Bone className="hidden md:block w-[120px] h-7 rounded-full" />
            <Bone className="hidden md:block w-[190px] h-8 rounded-lg" />
            <Bone className="hidden md:block w-[150px] h-6" />
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function AccountsSkeleton() {
  return (
    <Frame wide={false}>
      <Bone className="h-5 w-44 mb-3" />
      <div className={`${CARD} p-4 mb-6 h-[74px]`} />
      <Bone className="h-5 w-24 mb-3" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${CARD} p-4 flex items-center gap-3`}>
            <Bone className="w-[34px] h-[34px] rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Bone className="h-4 w-40" />
              <Bone className="h-3 w-28" />
            </div>
            <Bone className="w-9 h-5 rounded-full" />
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function CalendarSkeleton() {
  return (
    <Frame wide>
      <div className="flex flex-wrap justify-between gap-2 mb-3">
        <Bone className="h-9 w-56 rounded-xl" />
        <Bone className="h-9 w-40 rounded-xl" />
      </div>
      <div className={`${CARD} h-[640px]`} />
    </Frame>
  )
}
