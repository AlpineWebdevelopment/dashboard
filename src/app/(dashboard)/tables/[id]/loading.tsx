// Mirrors TableEditor: full-width column, header card, then the grid panel
// with a 40px gutter column and 120/150px data columns.
import { Bone, ButtonBone } from '@/components/skeleton'

const COLS = 5
const ROWS = 8

export default function Loading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="min-h-screen flex flex-col px-4 sm:px-8 py-6 sm:py-10">
        <div className="panel rounded-2xl border border-zinc-200 dark:border-white/[0.07] px-4 py-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <ButtonBone className="h-[30px] w-[80px]" />
            <Bone className="h-3 w-24" />
            <span className="flex-1" />
            <ButtonBone className="h-[30px] w-[30px] sm:w-[85px]" />
            <ButtonBone className="h-[30px] w-[30px] sm:w-[115px]" />
            <ButtonBone className="h-[30px] w-[30px] sm:w-[76px]" />
            <ButtonBone className="h-[30px] w-[30px] sm:w-[84px]" />
          </div>
          <Bone className="h-7 sm:h-8 w-1/3" />
        </div>

        <div className="panel flex-1 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/[0.07]">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-zinc-100/60 dark:bg-white/[0.04]">
                <th className="w-10 border-b border-r border-zinc-200 dark:border-white/[0.06] px-2 py-2" />
                {Array.from({ length: COLS }).map((_, i) => (
                  <th key={i} className="border-b border-r border-zinc-200 dark:border-white/[0.06] px-3 py-2 min-w-[120px] sm:min-w-[150px] h-9">
                    <Bone className="h-3 w-16" />
                  </th>
                ))}
                <th className="border-b border-zinc-200 dark:border-white/[0.06] w-10" />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROWS }).map((_, r) => (
                <tr key={r}>
                  <td className="border-b border-r border-zinc-200/60 dark:border-white/[0.04] px-2 h-[37px]">
                    <Bone className="h-2.5 w-3 mx-auto" />
                  </td>
                  {Array.from({ length: COLS }).map((_, c) => (
                    <td key={c} className="border-b border-r border-zinc-200/60 dark:border-white/[0.04] px-3 h-[37px]">
                      <Bone className="h-3" style={{ width: `${40 + ((r * 3 + c * 7) % 5) * 12}%` }} />
                    </td>
                  ))}
                  <td className="border-b border-zinc-200/60 dark:border-white/[0.04]" />
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-200/60 dark:border-white/[0.04]">
            <Bone className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}
