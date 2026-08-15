export const dynamic = 'force-dynamic'

import { getWhiteboards } from '@/lib/actions'
import NewWhiteboardButton from '@/components/NewWhiteboardButton'
import WhiteboardsList from '@/components/WhiteboardsList'

export default async function WhiteboardsPage() {
  const boards = await getWhiteboards()

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        <div className="flex items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
              Creative
            </p>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
              Whiteboards
            </h1>
          </div>
          <div className="shrink-0">
            <NewWhiteboardButton />
          </div>
        </div>
        <WhiteboardsList boards={boards} />
      </div>
    </div>
  )
}
