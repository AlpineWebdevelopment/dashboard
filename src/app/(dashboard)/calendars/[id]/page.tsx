export const dynamic = 'force-dynamic'

import { getCalendar, getCalendarEntries } from '@/lib/actions'
import CalendarView from '@/components/CalendarView'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function CalendarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [calendar, entries] = await Promise.all([
    getCalendar(id),
    getCalendarEntries(id),
  ])
  if (!calendar) notFound()

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-6 sm:pt-8">
        <Link
          href="/calendars"
          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <ChevronLeft size={13} />
          Calendars
        </Link>
      </div>
      <CalendarView calendar={calendar} initialEntries={entries} />
    </div>
  )
}
