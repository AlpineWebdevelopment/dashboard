// The Pages / Tables collection skeleton. Both routes render the same shell:
// eyebrow "Collection", the title, two header buttons, then two-line rows.
// The folder view (`?folder=`) has a different header, but the skeleton has
// no way to know which one is coming — the root view is what the sidebar
// link lands on, so that is what it draws.

import { Bone, ButtonBone, CARD, Heading, Shell, textWidth } from './index'

export default function CollectionSkeleton({ title }: { title: string }) {
  return (
    <Shell>
      <Heading
        eyebrow="Collection"
        title={title}
        actions={
          <>
            <ButtonBone className="w-[110px]" />
            <ButtonBone className="w-[100px]" />
          </>
        }
      />
      <div className="space-y-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`${CARD} flex items-center justify-between px-5 py-4`}>
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <Bone className="h-3 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <Bone className="h-3.5" style={{ width: textWidth(i, 30, 10) }} />
                <Bone className="h-3 mt-2" style={{ width: textWidth(i + 2, 45, 9) }} />
              </div>
            </div>
            <div className="shrink-0 ml-6 flex flex-col items-end">
              <Bone className="h-3 w-14" />
              <Bone className="h-2.5 w-10 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  )
}
