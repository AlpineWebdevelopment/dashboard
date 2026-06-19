export const dynamic = 'force-dynamic'

import { getPrompts } from '@/lib/actions'
import NewPromptButton from '@/components/NewPromptButton'
import PromptsList from '@/components/PromptsList'

export default async function PromptsPage() {
  const prompts = await getPrompts()

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        <div className="flex items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2 sm:mb-3">
              AI
            </p>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
              Prompts
            </h1>
          </div>
          <div className="shrink-0">
            <NewPromptButton />
          </div>
        </div>
        <PromptsList prompts={prompts} />
      </div>
    </div>
  )
}
