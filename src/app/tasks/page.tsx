export const dynamic = 'force-dynamic'

import { getLists, getTasks } from '@/lib/actions'
import KanbanBoard from '@/components/KanbanBoard'
import SetupBanner from '@/components/SetupBanner'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function TasksPage() {
  const [lists, tasks] = await Promise.all([getLists(), getTasks()])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-2">
          Productivity
        </p>
        <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-100 tracking-tight leading-tight">
          Tasks
        </h1>
      </div>

      <KanbanBoard initialLists={lists} initialTasks={tasks} />
    </div>
  )
}
