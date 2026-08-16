export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { allowedTransitions, getLead, getLeadEvents } from '@/lib/crm/leads'
import LeadDetail from '@/components/crm/LeadDetail'

// params is a Promise in this version of Next — it has to be awaited.
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const lead = await getLead(id)
  if (!lead) notFound()

  // The legal moves come from the database, so the dropdown cannot offer
  // something the trigger would refuse. A hard terminal returns an empty list
  // and the control is not rendered at all.
  const [events, allowed] = await Promise.all([
    getLeadEvents(lead.id),
    allowedTransitions(lead.status),
  ])

  return <LeadDetail lead={lead} events={events} allowed={allowed} />
}
