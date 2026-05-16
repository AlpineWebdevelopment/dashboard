export const dynamic = 'force-dynamic'

import { getTasks } from '@/lib/actions'
import TasksView from '@/components/TasksView'
import SetupBanner from '@/components/SetupBanner'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function TasksPage() {
  const tasks = await getTasks()

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-8 pt-10 pb-16 max-w-2xl">
        <div className="mb-10">
          <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-3">
            Productivity
          </p>
          <h1 className="text-[28px] font-semibold text-zinc-100 tracking-tight leading-tight">
            Tasks
          </h1>
        </div>

        <TasksView initial={tasks} />
      </div>
    </div>
  )
}
