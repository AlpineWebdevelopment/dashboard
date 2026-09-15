import { Bone, ButtonBone, CARD, Heading, Shell, textWidth } from '@/components/skeleton'

export default function Loading() {
  return (
    <Shell>
      <Heading eyebrow="AI" title="Prompts" actions={<ButtonBone className="w-[120px]" />} />
      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${CARD} flex items-start justify-between px-5 py-4`}>
            <div className="flex items-start gap-4 min-w-0 flex-1 pr-28">
              <Bone className="h-3 w-5 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <Bone className="h-3.5" style={{ width: textWidth(i, 30, 10) }} />
                <Bone className="h-3 mt-2.5 w-full" />
                <Bone className="h-3 mt-2" style={{ width: textWidth(i + 1, 50, 10) }} />
              </div>
            </div>
            <Bone className="h-3 w-14 shrink-0 mt-0.5" />
          </div>
        ))}
      </div>
    </Shell>
  )
}
