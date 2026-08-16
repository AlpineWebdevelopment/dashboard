export const dynamic = 'force-dynamic'

import { listLeads, listNiches } from '@/lib/crm/leads'
import { crmConfigured } from '@/lib/crm/db'
import LeadWorklist from '@/components/crm/LeadWorklist'

// This route replaced an iframe of the standalone atrium-crm deployment. The
// nav key stays 'atrium-crm' (lib/nav.ts warns never to rename one — saved menu
// preferences store keys), so anyone's existing sidebar order survives.

export default async function AtriumCrmPage() {
  const configured = crmConfigured()
  const [leads, niches] = configured
    ? await Promise.all([listLeads(), listNiches()])
    : [[], []]

  return (
    <div className="min-h-screen px-4 sm:px-8 pt-8 sm:pt-10 pb-16">
      {!configured && (
        <div className="mb-6 max-w-3xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          A CRM adatbázis nincs beállítva. Hiányzik a{' '}
          <code className="font-mono text-[13px]">SUPABASE_SERVICE_ROLE_KEY</code> a{' '}
          <code className="font-mono text-[13px]">.env.local</code> fájlból.
        </div>
      )}

      {/* Server time seeds the client's "is this overdue" clock, so the first
          client render agrees with the HTML instead of hydrating differently.
          react-hooks/purity guards against a *client* component re-rendering
          with a moving value; this is a force-dynamic server component rendered
          once per request, where reading the clock is the intended behaviour. */}
      {/* eslint-disable-next-line react-hooks/purity */}
      <LeadWorklist initialLeads={leads} niches={niches} serverNow={Date.now()} />
    </div>
  )
}
