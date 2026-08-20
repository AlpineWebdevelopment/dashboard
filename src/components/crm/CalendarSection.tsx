// The calendar half of the CRM: the grid you work in, and the hours it is
// built from. A server component — it only arranges what the page already
// loaded, and hands the interactive parts their data.

import { CalendarClock } from 'lucide-react'
import type { CalendarLoad } from '@/lib/crm/calendar'
import CalendarBoard from './CalendarBoard'
import AvailabilityForm from './AvailabilityForm'

export default function CalendarSection({ calendar }: { calendar: CalendarLoad }) {
  if (!calendar.ok) {
    return (
      <div className="panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl">
        <div className="px-4 py-10 text-center">
          <CalendarClock
            size={22}
            aria-hidden
            className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600"
          />
          <p className="text-sm text-zinc-700 dark:text-white">
            {calendar.reason === 'missing_tables'
              ? 'The calendar is not set up yet.'
              : 'The calendar database is not configured.'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-zinc-500 dark:text-zinc-200">
            {calendar.message}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CalendarBoard
        days={calendar.days}
        booked={calendar.booked}
        timezone={calendar.settings.timezone}
      />
      <AvailabilityForm settings={calendar.settings} />
    </div>
  )
}
