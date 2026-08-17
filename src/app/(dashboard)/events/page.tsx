export const dynamic = 'force-dynamic'

import EventsCalendar from '@/components/EventsCalendar'
import { getEventsRange } from '@/lib/personal-db'
import { getPeople, getProjects, getTasks } from '@/lib/actions'

/** Local `YYYY-MM-DD` — toISOString() would shift the day in any timezone east of UTC. */
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function EventsPage() {
  const today = new Date()
  // A week's padding either side of the month: the calendar opens on the week
  // view, and the current week can spill into the neighbouring month, which a
  // month-exact range would leave blank until you navigated.
  const from = dateKey(new Date(today.getFullYear(), today.getMonth(), 1 - 7))
  const to = dateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0 + 7))
  // Board tasks come over in full — they're bucketed by due date on the client
  // so paging through months never needs another round trip.
  const [events, tasks, projects, people] = await Promise.all([
    getEventsRange(from, to),
    getTasks(),
    getProjects(),
    getPeople(),
  ])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
          Personal
        </p>
        <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
          Cal
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        <EventsCalendar
          initialEvents={events}
          initialYear={today.getFullYear()}
          initialMonth={today.getMonth()}
          initialDay={today.getDate()}
          tasks={tasks}
          projects={projects}
          people={people}
        />
      </div>
    </div>
  )
}
