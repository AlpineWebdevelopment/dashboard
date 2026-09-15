// Mirrors LeadDetail: back link, title block, then cards in one column that
// splits 1.5fr / 1fr at lg.
import { Bone } from '@/components/skeleton'

const CRM_CARD =
  'panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl'

function Field() {
  return (
    <div>
      <Bone className="h-3 w-20 mb-1.5" />
      <Bone className="h-[38px] w-full rounded-lg" />
    </div>
  )
}

export default function Loading() {
  return (
    <div className="min-h-screen px-4 sm:px-8 pt-8 sm:pt-10 pb-16" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="max-w-5xl">
        <Bone className="h-3 w-28 mb-4" />
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <Bone className="h-6 w-56" />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Bone className="h-3 w-24" />
              <Bone className="h-3 w-36" />
              <Bone className="h-3 w-28" />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Bone className="h-5 w-20 rounded-md" />
              <Bone className="h-5 w-24 rounded-md" />
              <Bone className="h-5 w-16 rounded-md" />
            </div>
          </div>
          <Bone className="h-[34px] w-9 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5">
          <div className="space-y-5">
            <section className={`${CRM_CARD} p-4`}>
              <Bone className="h-3.5 w-28 mb-3" />
              <div className="flex flex-wrap gap-2">
                <Bone className="h-[38px] w-40 rounded-lg" />
                <Bone className="h-[38px] w-24 rounded-lg" />
              </div>
            </section>
            <section className={`${CRM_CARD} p-4`}>
              <Bone className="h-3.5 w-28 mb-3" />
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3">
                <Bone className="h-[38px] w-full rounded-lg" />
                <Bone className="h-[38px] w-full rounded-lg" />
              </div>
            </section>
            <section className={`${CRM_CARD} p-4`}>
              <Bone className="h-3.5 w-20 mb-3" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 8 }).map((_, i) => <Field key={i} />)}
              </div>
            </section>
          </div>
          <div className="space-y-5">
            <section className={`${CRM_CARD} p-4`}>
              <Bone className="h-3.5 w-28 mb-3" />
              <Bone className="h-11 w-full rounded-xl" />
            </section>
            <section className={`${CRM_CARD} p-4`}>
              <Bone className="h-3.5 w-20 mb-3" />
              <ol className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i}>
                    <Bone className="h-3.5" style={{ width: `${55 + (i % 3) * 15}%` }} />
                    <Bone className="h-3 w-24 mt-1.5" />
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
