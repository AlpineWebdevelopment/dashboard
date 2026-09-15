// Mirrors PageEditor: centred max-w-2xl column, header card, sticky toolbar,
// then the editor body.
import { Bone, ButtonBone } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="panel rounded-2xl border border-zinc-200 dark:border-white/[0.07] px-4 py-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <ButtonBone className="h-[30px] w-[72px]" />
            <Bone className="h-3 w-14" />
            <span className="flex-1" />
            <ButtonBone className="h-[30px] w-[30px] sm:w-[76px]" />
            <ButtonBone className="h-[30px] w-[30px] sm:w-[84px]" />
          </div>
          <Bone className="h-7 sm:h-8 w-2/3" />
        </div>

        <div className="sticky top-11 md:top-0 z-10 flex items-center gap-0.5 flex-wrap px-3 py-2 mb-4 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-white/95 dark:bg-[rgba(10,10,18,0.9)] backdrop-blur-md">
          <Bone className="h-6 w-28 mr-1" />
          <span className="w-px h-4 bg-zinc-200 dark:bg-white/[0.07] mx-1" />
          {[0, 1, 2].map((i) => <Bone key={i} className="h-6 w-6" />)}
          <span className="w-px h-4 bg-zinc-200 dark:bg-white/[0.07] mx-1" />
          {[0, 1].map((i) => <Bone key={i} className="h-6 w-6" />)}
          <span className="w-px h-4 bg-zinc-200 dark:bg-white/[0.07] mx-1" />
          <Bone className="h-6 w-6" />
        </div>

        <div className="panel flex-1 rounded-2xl border border-zinc-200 dark:border-white/[0.07] px-4 sm:px-6 py-4 space-y-3">
          {[90, 75, 85, 60, 0, 80, 70, 45].map((w, i) =>
            w === 0 ? <div key={i} className="h-2" /> : <Bone key={i} className="h-3.5" style={{ width: `${w}%` }} />
          )}
        </div>
      </div>
    </div>
  )
}
