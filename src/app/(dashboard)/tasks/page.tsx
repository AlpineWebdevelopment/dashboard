export const dynamic = 'force-dynamic'

import { getLists, getPeople, getProjects, getTasks } from '@/lib/actions'
import KanbanBoard from '@/components/KanbanBoard'
import SetupBanner from '@/components/SetupBanner'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function TasksPage() {
  const [lists, tasks, projects, people] = await Promise.all([
    getLists(),
    getTasks(),
    getProjects(),
    getPeople(),
  ])

  return (
    <div className="surface flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      {!supabaseConfigured && <SetupBanner />}

      {/* Header (title + person filter) lives inside KanbanBoard so it can react to the selected person */}
      <KanbanBoard
        initialLists={lists}
        initialTasks={tasks}
        initialProjects={projects}
        initialPeople={people}
      />
    </div>
  )
}
