// Mirrors ExcalidrawCanvas: a fixed full-bleed layer that clears the mobile
// top bar and the desktop sidebar, with the 44px header on top.
import { Bone } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="fixed inset-0 top-11 md:top-0 md:left-56 flex flex-col bg-white dark:bg-[#13131a]" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex items-center gap-3 px-4 h-11 border-b border-zinc-200 dark:border-white/[0.06] bg-white/95 dark:bg-[rgba(7,7,15,0.9)] backdrop-blur-xl shrink-0 z-10">
        <Bone className="h-3 w-24 shrink-0" />
        <span className="w-px h-4 bg-zinc-200 dark:bg-white/[0.07] shrink-0" />
        <Bone className="h-3.5 w-48 max-w-[40%]" />
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Bone className="h-[26px] w-[60px] rounded-md" />
          <Bone className="h-7 w-7 rounded-md" />
        </div>
      </div>
      <div className="flex-1 relative">
        <Bone className="absolute left-4 top-4 h-9 w-40 rounded-lg" />
        <Bone className="absolute left-1/2 -translate-x-1/2 top-4 h-10 w-[min(520px,80%)] rounded-lg" />
      </div>
    </div>
  )
}
