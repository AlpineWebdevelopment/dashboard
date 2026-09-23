// Mirrors the Cal page in its default week view: page heading, toolbar, the
// day strip, then the 64rem-wide week grid (40rem and a horizontal scroll on
// a phone, like the real one).
import { Bone } from '@/components/skeleton'

const GRID = 'panel rounded-xl border border-zinc-200 bg-white dark:border-white/[0.07] dark:bg-[#101018]'
const LINE = 'border-zinc-200 dark:border-white/[0.06]'
const HOURS = 24
const HOUR_HEIGHT = 48

export default function Loading() {
  return (
    <div className="flex flex-col h-[calc(100dvh-2.75rem)] md:h-screen overflow-hidden" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
          Personal
        </p>
        <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
          Cal
        </h1>
      </div>
      <div className="flex-1 overflow-hidden px-4 sm:px-8 pb-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-1">
              <Bone className="w-[30px] h-[30px] rounded-lg" />
              <Bone className="w-[30px] h-[30px] rounded-lg" />
              <Bone className="ml-2 h-4 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Bone className="h-8 w-[60px] rounded-lg" />
              <Bone className="h-[34px] w-[125px] rounded-lg" />
            </div>
          </div>

          <div className="panel bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.07] rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <Bone className="h-3.5 w-36" />
              <Bone className="h-3 w-12" />
            </div>
            <Bone className="h-3 w-48" />
          </div>

          <div className={GRID}>
            <div className="overflow-x-auto overscroll-x-contain">
              <div className="min-w-[40rem] sm:min-w-[64rem]">
                <div className="flex">
                  <div className="w-14 shrink-0" />
                  <div className="grid flex-1 grid-cols-7">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className={`flex flex-col items-center gap-1 border-l py-2 ${LINE}`}>
                        <Bone className="h-2.5 w-8" />
                        <Bone className="h-7 w-7 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`flex border-t ${LINE}`}>
                  <div className="w-14 shrink-0 py-1.5 pr-2 flex justify-end">
                    <Bone className="h-2.5 w-9" />
                  </div>
                  <div className="grid flex-1 grid-cols-7">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className={`min-h-[2.25rem] border-l p-1 ${LINE}`} />
                    ))}
                  </div>
                </div>
                <div className={`max-h-[34rem] overflow-hidden border-t ${LINE}`}>
                  <div className="relative flex" style={{ height: HOURS * HOUR_HEIGHT }}>
                    <div className="relative w-14 shrink-0">
                      {Array.from({ length: HOURS }).map((_, h) => (
                        <Bone
                          key={h}
                          className="absolute right-2 -translate-y-1/2 h-2.5 w-8"
                          style={{ top: h * HOUR_HEIGHT }}
                        />
                      ))}
                    </div>
                    <div className="relative flex-1">
                      {Array.from({ length: HOURS }).map((_, h) => (
                        <div
                          key={h}
                          className={`pointer-events-none absolute inset-x-0 border-t ${LINE}`}
                          style={{ top: h * HOUR_HEIGHT }}
                        />
                      ))}
                      <div className="absolute inset-0 grid grid-cols-7">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <div key={i} className={`relative border-l ${LINE}`}>
                            {i % 2 === 1 && (
                              <Bone
                                className="absolute inset-x-1 rounded-md"
                                style={{ top: (7 + i) * HOUR_HEIGHT, height: HOUR_HEIGHT * 1.5 }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
