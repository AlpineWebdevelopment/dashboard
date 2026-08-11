export const dynamic = 'force-dynamic'

import EventsCalendar from '@/components/EventsCalendar'
import { getEventsRange } from '@/lib/personal-db'

/** Outcome of the Google OAuth round trip, handed back on the redirect. */
function connectNotice(params: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const connected = first(params.google)
  const failed = first(params.google_error)
  if (connected) return { kind: 'ok' as const, code: connected }
  if (failed) return { kind: 'error' as const, code: failed }
  return null
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const notice = connectNotice(await searchParams)
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
        <EventsCalendar
          initialEvents={events}
          initialYear={today.getFullYear()}
          initialMonth={today.getMonth()}
          connectNotice={notice}
        />
      </div>
    </div>
  )
}
