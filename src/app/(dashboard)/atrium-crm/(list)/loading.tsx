// Mirrors CrmSections + LeadWorklist in its default table view: the section
// pills, the "Leads" heading with two buttons, the filter row, then the table
// panel — two columns below md, five from md up.
import { Bone, ButtonBone } from '@/components/skeleton'

const CRM_CARD =
  'panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl'
const ROW_COLS =
  'grid-cols-[minmax(0,1fr)_minmax(4.5rem,0.6fr)] ' +
  'md:grid-cols-[minmax(0,1.5fr)_minmax(6rem,1.4fr)_minmax(0,2.6fr)_minmax(0,1.1fr)_auto]'

export default function Loading() {
  return (
    <div className="min-h-screen px-4 sm:px-8 pt-8 sm:pt-10 pb-16" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="mb-5 inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-100/60 dark:bg-white/[0.04] p-0.5">
        <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-white/[0.10] text-zinc-800 dark:text-white shadow-sm">
          Leads
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-200">
          Calendar
        </span>
      </div>

      <div className="max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl text-zinc-800 dark:text-white">Leads</h1>
            <Bone className="h-3 w-36 mt-1.5" />
          </div>
          <div className="flex items-center gap-2">
            <ButtonBone className="h-[34px] w-[120px]" />
            <ButtonBone className="h-[34px] w-[110px]" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Bone className="h-[34px] w-44 rounded-lg" />
          <Bone className="h-[34px] w-40 rounded-lg" />
          <Bone className="h-[34px] w-24 rounded-lg" />
          <Bone className="h-[34px] w-32 rounded-lg hidden sm:block" />
          <Bone className="ml-auto h-[34px] w-[150px] rounded-lg" />
        </div>

        <div className={CRM_CARD}>
          <div className={`grid ${ROW_COLS} gap-3 px-3 py-2 border-b border-zinc-200 dark:border-white/[0.06]`}>
            <Bone className="h-3 w-20" />
            <Bone className="h-3 w-12" />
            <Bone className="h-3 w-12 hidden md:block" />
            <Bone className="h-3 w-16 hidden md:block" />
            <Bone className="h-3 w-10 hidden md:block" />
          </div>
          <div className="p-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`grid ${ROW_COLS} items-center gap-3 px-3 py-2.5 rounded-lg`}>
                <div className="min-w-0">
                  <Bone className="h-3.5" style={{ width: `${45 + (i % 4) * 12}%` }} />
                  <Bone className="h-3 w-24 mt-1.5" />
                </div>
                <Bone className="h-5 w-16 rounded-md" />
                <Bone className="h-3 hidden md:block" style={{ width: `${30 + (i % 5) * 14}%` }} />
                <Bone className="h-3 w-3/4 hidden md:block" />
                <Bone className="h-3 w-6 hidden md:block justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
