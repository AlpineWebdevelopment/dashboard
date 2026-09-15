// Mirrors SettingsView: heading with blurb, then the stacked section cards.
import { Bone, Shell } from '@/components/skeleton'

const SECTION =
  'rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-white/60 dark:bg-white/[0.02] overflow-hidden'

function Section({ rows, action }: { rows: number; action?: boolean }) {
  return (
    <section className={SECTION}>
      <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4">
        <div className="flex items-start gap-3 min-w-0">
          <Bone className="shrink-0 w-8 h-8 rounded-xl" />
          <div className="min-w-0">
            <Bone className="h-4 w-28" />
            <Bone className="h-3 w-56 max-w-full mt-2" />
          </div>
        </div>
        {action && <Bone className="h-[30px] w-16 rounded-lg shrink-0" />}
      </div>
      <div className="px-5 sm:px-6 pb-5 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Bone key={i} className="h-[34px] w-full rounded-xl" />
        ))}
      </div>
    </section>
  )
}

export default function Loading() {
  return (
    <Shell>
      <div className="mb-8 sm:mb-10">
        <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
          Preferences
        </p>
        <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
          Settings
        </h1>
        <Bone className="h-3 w-72 max-w-full mt-3" />
      </div>
      <div className="space-y-4">
        <Section rows={2} />
        <Section rows={1} />
        <Section rows={2} />
        <Section rows={8} action />
      </div>
    </Shell>
  )
}
