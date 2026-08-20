export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { listLeads, listTransitions } from '@/lib/crm/leads'
import { crmConfigured } from '@/lib/crm/db'
import { loadAdminCalendar } from '@/lib/crm/calendar'
import { CRM_SECTION_COOKIE, CRM_VIEW_COOKIE, decodeCrmSection } from '@/lib/prefs'
import LeadWorklist from '@/components/crm/LeadWorklist'
import CalendarSection from '@/components/crm/CalendarSection'
import CrmSections from '@/components/crm/CrmSections'

// This route replaced an iframe of the standalone atrium-crm deployment. The
// nav key stays 'atrium-crm' (lib/nav.ts warns never to rename one — saved menu
// preferences store keys), so anyone's existing sidebar order survives.

export default async function AtriumCrmPage() {
  const configured = crmConfigured()

  // The transition table comes down with the leads because the pipeline board
  // has to judge a drag while it is happening. Sixty-odd rows.
  //
  // The calendar is loaded here too, not behind the section switch, because
  // both halves are handed to the switch as rendered children — see
  // CrmSections for why the inactive one is kept alive rather than unmounted.
  const [leads, transitions, calendar, cookieStore] = await Promise.all([
    configured ? listLeads() : [],
    configured ? listTransitions() : {},
    loadAdminCalendar(),
    cookies(),
  ])

  // Read here rather than in the browser so the first paint is already the
  // right view — see lib/prefs.ts. Anything unrecognised falls back to the
  // table, which is also what a browser that has never chosen gets.
  const initialView = cookieStore.get(CRM_VIEW_COOKIE)?.value === 'pipeline' ? 'pipeline' : 'table'
  const initialSection = decodeCrmSection(cookieStore.get(CRM_SECTION_COOKIE)?.value)

  // Server time seeds the client's "is this overdue" clock, so the first client
  // render agrees with the HTML instead of hydrating differently.
  // react-hooks/purity guards against a *client* component re-rendering with a
  // moving value; this is a force-dynamic server component rendered once per
  // request, where reading the clock is the intended behaviour.
  // eslint-disable-next-line react-hooks/purity
  const serverNow = Date.now()

  return (
    <div className="min-h-screen px-4 sm:px-8 pt-8 sm:pt-10 pb-16">
      {!configured && (
        <div className="mb-6 max-w-3xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          The CRM database is not configured — missing{' '}
          <code className="font-mono text-[13px]">SUPABASE_SERVICE_ROLE_KEY</code> in{' '}
          <code className="font-mono text-[13px]">.env.local</code>.
        </div>
      )}

      <CrmSections
        initialSection={initialSection}
        leads={
          <LeadWorklist
            initialLeads={leads}
            transitions={transitions}
            initialView={initialView}
            serverNow={serverNow}
          />
        }
        calendar={<CalendarSection calendar={calendar} />}
      />
    </div>
  )
}
