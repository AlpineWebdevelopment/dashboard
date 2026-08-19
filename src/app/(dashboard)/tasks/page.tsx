export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { getLists, getPeople, getProjects, getTasks } from '@/lib/actions'
import KanbanBoard from '@/components/KanbanBoard'
import SetupBanner from '@/components/SetupBanner'
import { ARCHIVE_COOKIE, TASK_VIEW_COOKIE, decodeTaskViewPref } from '@/lib/prefs'

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

  // Read on the server so the board's first paint is already the right shape —
  // the same reason the archive's collapse state travels this way.
  const viewPref = decodeTaskViewPref(cookieStore.get(TASK_VIEW_COOKIE)?.value)

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
        initialView={viewPref.view}
        initialShowDone={viewPref.showDone}
      />
    </div>
  )
}
