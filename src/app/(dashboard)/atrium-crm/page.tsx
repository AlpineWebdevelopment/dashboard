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

      <LeadWorklist initialLeads={leads} niches={niches} />
    </div>
  )
}
