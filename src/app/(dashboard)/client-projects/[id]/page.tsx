export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getClientProject, getClientProjectTasks } from '@/lib/actions'
import { currentAccount } from '@/lib/auth-server'
import ClientProjectDetail from '@/components/ClientProjectDetail'

export default async function ClientProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // The proxy already let this request through on the `/client-projects` prefix,
  // so both roles reach here. The role only decides whether the editing
  // controls render — the writes check the session for themselves.
  const [project, tasks, account] = await Promise.all([
    getClientProject(id),
    getClientProjectTasks(id),
    currentAccount(),
  ])

  if (!project) notFound()

  return (
    <ClientProjectDetail
      project={project}
      initialTasks={tasks}
      canManage={account?.role === 'admin'}
    />
  )
}
