// Mirrors ClientProjectDetail: back link, title row, then the four-column
// phase board that scrolls sideways at every width, the collapsed roadmap
// section and the attachments card.
import { Bone, Dot } from '@/components/skeleton'

const PHASES = [3, 4, 2, 3]

export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-6xl">
        <Bone className="h-3 w-28 mb-5" />
        <div className="mb-7 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Bone className="h-7 sm:h-8 w-64 max-w-full" />
              <Bone className="h-5 w-16 rounded-md" />
            </div>
            <div className="mt-2.5 flex items-center gap-3 flex-wrap">
              <Bone className="h-3 w-24" />
              <Bone className="h-3 w-20" />
              <Bone className="h-3 w-16" />
            </div>
          </div>
          <Bone className="shrink-0 h-9 w-[100px] rounded-xl" />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:-mx-8 sm:px-8">
          {PHASES.map((cards, c) => (
            <div
              key={c}
              className="w-[19rem] shrink-0 flex flex-col rounded-2xl border border-zinc-200 dark:border-white/[0.07] panel bg-zinc-50/60 dark:bg-white/[0.02] p-2.5"
            >
              <div className="flex items-center gap-2 px-1 mb-2.5">
                <Dot className="w-2 h-2 shrink-0" />
                <Bone className="h-3.5 w-20" />
                <Bone className="h-3 w-4 ml-auto" />
              </div>
              <Bone className="h-3 w-3/4 mx-1 mb-2.5" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: cards }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] shadow-sm px-3.5 py-3"
                  >
                    <div className="flex items-start gap-2">
                      <Bone className="mt-0.5 shrink-0 w-4 h-4 rounded-[5px]" />
                      <Bone className="h-3.5 flex-1" style={{ maxWidth: `${55 + ((c + i) % 3) * 15}%` }} />
                    </div>
                  </div>
                ))}
                <div className="h-9 rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.10]" />
              </div>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-white/60 dark:bg-white/[0.02] overflow-hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 px-5 sm:px-6 pt-5 pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <Bone className="shrink-0 w-8 h-8 rounded-xl" />
              <div>
                <Bone className="h-4 w-32" />
                <Bone className="h-3 w-48 mt-2" />
              </div>
            </div>
            <Bone className="shrink-0 h-[30px] w-20 rounded-lg" />
          </div>
        </section>

        <div className="mt-8 max-w-3xl">
          <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <Bone className="h-3.5 w-24" />
              <Bone className="h-3 w-6" />
            </div>
            <div className="h-11 rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.10]" />
          </div>
        </div>
      </div>
    </div>
  )
}
