'use client'

// The two halves of the CRM: the leads, and the calendar they get booked into.
//
// Both are rendered by the server and handed here as children, and the inactive
// one is hidden rather than unmounted. That is the point of doing it this way:
// switching to the calendar and back leaves the worklist exactly as it was —
// same search, same filters, same scroll — instead of resetting it, which a
// route change or a conditional render would both do.
//
// The cost is that the calendar's data is fetched even when you never open it.
// It is four small queries against a two-day window, which is cheaper than the
// leads already loaded beside it.

import { useState } from 'react'
import { CalendarDays, Users } from 'lucide-react'
import { CRM_SECTION_COOKIE, setPrefCookie, type CrmSection } from '@/lib/prefs'

const SECTIONS = [
  { key: 'leads', label: 'Leads', Icon: Users },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
] as const

export default function CrmSections({
  initialSection,
  leads,
  calendar,
}: {
  initialSection: CrmSection
  leads: React.ReactNode
  calendar: React.ReactNode
}) {
  const [section, setSection] = useState<CrmSection>(initialSection)

  return (
    <div>
      {/* The container is the panelled surface and the active pill is not —
          same segmented control as the table/pipeline switch inside the
          worklist, one level up. */}
      <nav
        aria-label="CRM sections"
        className="mb-5 inline-flex items-center rounded-lg border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-100/60 dark:bg-white/[0.04] p-0.5"
      >
        {SECTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSection(key)
              setPrefCookie(CRM_SECTION_COOKIE, key)
            }}
            aria-current={section === key ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              section === key
                ? 'bg-white dark:bg-white/[0.10] text-zinc-800 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      <div className={section === 'leads' ? undefined : 'hidden'}>{leads}</div>
      <div className={section === 'calendar' ? undefined : 'hidden'}>{calendar}</div>
    </div>
  )
}
