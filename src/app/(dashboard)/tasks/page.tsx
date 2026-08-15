export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { getLists, getPeople, getProjects, getTasks } from '@/lib/actions'
import KanbanBoard from '@/components/KanbanBoard'
import SetupBanner from '@/components/SetupBanner'
import { ARCHIVE_COOKIE } from '@/lib/prefs'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function TasksPage() {
  const [lists, tasks, projects, people, cookieStore] = await Promise.all([
    getLists(),
    getTasks(),
    getProjects(),
    getPeople(),
    cookies(),
  ])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      {!supabaseConfigured && <SetupBanner />}

      {/* Header (title + person filter) lives inside KanbanBoard so it can react to the selected person */}
      <KanbanBoard
        initialLists={lists}
        initialTasks={tasks}
        initialProjects={projects}
        initialPeople={people}
        initialArchiveCollapsed={cookieStore.get(ARCHIVE_COOKIE)?.value === '1'}
      />
    </div>
  )
}
