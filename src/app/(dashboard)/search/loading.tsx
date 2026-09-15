// The query is in the URL, but a loading file gets no props — so the title
// is a bone, and the results are the row shape the real page draws.
import { Bone } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-2xl">
        <div className="mb-8 sm:mb-10">
          <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-600 mb-3 dark:text-zinc-200">
            Search
          </p>
          <Bone className="h-7 sm:h-8 w-64 max-w-full" />
          <Bone className="h-3 w-16 mt-3" />
        </div>
        <div className="md:hidden mb-6">
          <Bone className="h-11 w-full rounded-xl" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
              <Bone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <Bone className="h-3.5" style={{ width: `${40 + (i % 3) * 15}%` }} />
                <Bone className="h-3 w-full mt-2" />
                <Bone className="h-3 w-2/3 mt-1.5" />
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <Bone className="h-5 w-12 rounded-md" />
                <Bone className="h-3 w-10 hidden sm:block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
