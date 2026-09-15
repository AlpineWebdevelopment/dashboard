// Mirrors PromptEditor: 44px sticky bar, then a centred mono body.
import { Bone } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="sticky top-11 md:top-0 z-10 flex items-center gap-3 px-4 sm:px-8 h-11 border-b border-zinc-200 dark:border-white/[0.06] bg-white/95 dark:bg-[rgba(7,7,15,0.9)] backdrop-blur-xl shrink-0">
        <Bone className="h-3 w-16 shrink-0" />
        <span className="w-px h-4 bg-zinc-200 dark:bg-white/[0.07] shrink-0" />
        <Bone className="h-3.5 w-48 max-w-[40%]" />
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Bone className="h-[26px] w-[68px] rounded-md" />
          <Bone className="h-7 w-7 rounded-md" />
        </div>
      </div>
      <div className="flex-1 px-4 sm:px-8 py-6 max-w-3xl w-full mx-auto space-y-3">
        {[70, 90, 55, 80, 0, 65, 85, 40, 75].map((w, i) =>
          w === 0 ? <div key={i} className="h-2" /> : <Bone key={i} className="h-3.5" style={{ width: `${w}%` }} />
        )}
      </div>
    </div>
  )
}
