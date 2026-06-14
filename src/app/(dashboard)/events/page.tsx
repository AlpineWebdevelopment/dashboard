export const dynamic = 'force-dynamic'

import EventsCalendar from '@/components/EventsCalendar'
import { getEventsRange } from '@/lib/personal-db'

export default async function EventsPage() {
  const today = new Date()
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
  const events = await getEventsRange(from, to)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">
          Personal
        </p>
        <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
          Events
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        <EventsCalendar initialEvents={events} initialYear={today.getFullYear()} initialMonth={today.getMonth()} />
      </div>
    </div>
  )
}
