// Mirrors KanbanBoard in its default Lists view: the header with the view
// switcher, the project chip bar, then a horizontally scrolling row of
// fixed-width columns — same at every breakpoint.
import { Bone, Dot } from '@/components/skeleton'

const COLUMNS = [3, 2, 4, 1]

export default function Loading() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-end justify-between gap-3 flex-wrap px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
          <div className="min-w-0">
            <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
              Productivity
            </p>
            <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight truncate">
              Tasks
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 pb-0.5">
            <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-100/60 dark:bg-white/[0.04] p-0.5 gap-0.5">
              {/* Labels are hidden sm:inline in the real switcher, so the pills are
                  icon-squares on a phone and ~60px wide from sm up. Literal class
                  strings — Tailwind cannot see a template-built variant. */}
              <Bone className="h-[26px] rounded-md w-7 sm:w-[60px] bg-white dark:bg-white/[0.10]" />
              <Bone className="h-[26px] rounded-md w-7 sm:w-[68px] bg-transparent dark:bg-transparent" />
              <Bone className="h-[26px] rounded-md w-7 sm:w-[66px] bg-transparent dark:bg-transparent" />
            </div>
            <span className="w-px h-5 bg-zinc-200 dark:bg-white/[0.08] shrink-0" />
            <Bone className="w-8 h-8 rounded-xl" />
          </div>
        </div>

        <div className="shrink-0 px-3 sm:px-6 pt-4 sm:pt-5">
          <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2.5">
            Projects
          </p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="panel flex items-center gap-2.5 w-[190px] px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.02]"
              >
                <Dot className="w-2 h-2 shrink-0" />
                <Bone className="h-3.5 flex-1" style={{ width: `${50 + i * 15}%` }} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 sm:gap-4 h-full px-3 sm:px-6 py-4 sm:py-6 items-start min-w-max">
            {COLUMNS.map((cards, c) => (
              <div key={c} className="w-64 sm:w-72 shrink-0 flex flex-col max-h-full">
                <div className="flex items-center justify-between shrink-0 px-1 mb-2.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Dot className="w-2 h-2 shrink-0" />
                    <Bone className="h-3.5 w-24" />
                    <Bone className="h-3 w-4" />
                  </div>
                  <Bone className="h-5 w-12 rounded-lg" />
                </div>
                <div className="space-y-2 p-1">
                  {Array.from({ length: cards }).map((_, i) => (
                    <div
                      key={i}
                      className="panel-card rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-3.5 py-3 shadow-sm"
                    >
                      <Bone className="h-3.5" style={{ width: `${55 + ((c + i) % 3) * 15}%` }} />
                      {(c + i) % 2 === 0 && <Bone className="h-3 w-full mt-2" />}
                      <div className="flex items-center gap-2 mt-3">
                        <Bone className="h-4 w-12 rounded-md" />
                        <Bone className="h-4 w-16 rounded-md" />
                      </div>
                    </div>
                  ))}
                  <Bone className="h-8 w-full rounded-xl mt-1 bg-transparent dark:bg-transparent" />
                </div>
              </div>
            ))}
            <div className="panel w-64 sm:w-72 shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-zinc-200 dark:border-white/[0.08]">
              <Bone className="h-3.5 w-28" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
