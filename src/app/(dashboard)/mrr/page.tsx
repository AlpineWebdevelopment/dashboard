export const dynamic = 'force-dynamic'

import { getMrrClients } from '@/lib/actions'
import { listAttachableLeads, listConvertibleLeads, listLinkedLeads } from '@/lib/crm/leads'
import SetupBanner from '@/components/SetupBanner'
import MrrBoard from '@/components/MrrBoard'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function MrrPage() {
  // The lead list has to be fetched here rather than in the board: the CRM
  // tables are service-role only, so the browser's anon key sees nothing.
  const [clients, convertibleLeads, attachableLeads, linkedLeads] = await Promise.all([
    getMrrClients(),
    listConvertibleLeads(),
    listAttachableLeads(),
    listLinkedLeads(),
  ])

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-5xl">
        <MrrBoard
          initialClients={clients}
          convertibleLeads={convertibleLeads.map((l) => ({
            id: l.id,
            title: leadLabel(l),
            status: l.status,
          }))}
          attachableLeads={attachableLeads.map((l) => ({
            id: l.id,
            title: leadLabel(l),
            status: l.status,
          }))}
          // The only list carrying clientCount, because it is the only one whose
          // entries have any jobs to count. The picker reads its presence as
          // "this is an existing customer" and labels the row with it.
          linkedLeads={linkedLeads.map((l) => ({
            id: l.id,
            title: leadLabel(l),
            status: l.status,
            clientCount: l.clientCount,
          }))}
          supabaseConfigured={supabaseConfigured}
        />
      </div>
    </div>
  )
}

/** Only what the picker needs — no phone numbers or form answers reach the client. */
function leadLabel(lead: { company_name: string | null; contact_name: string | null; email: string | null }) {
  return lead.company_name?.trim() || lead.contact_name?.trim() || lead.email?.trim() || 'Unnamed lead'
}
