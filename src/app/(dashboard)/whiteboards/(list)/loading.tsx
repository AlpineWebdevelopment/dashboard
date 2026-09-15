import { Bone, ButtonBone, CARD, Heading, Shell, textWidth } from '@/components/skeleton'

export default function Loading() {
  return (
    <Shell>
      <Heading eyebrow="Creative" title="Whiteboards" actions={<ButtonBone className="w-[140px]" />} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${CARD} flex flex-col gap-3 p-4`}>
            <div className="w-full h-24 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03]" />
            <div>
              <Bone className="h-3.5" style={{ width: textWidth(i, 40, 12, 4) }} />
              <Bone className="h-2.5 w-20 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}
