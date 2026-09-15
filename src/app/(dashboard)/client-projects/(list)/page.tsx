export const dynamic = 'force-dynamic'

import { getClientProjects, getClientProjectTaskCounts } from '@/lib/actions'
import { currentAccount } from '@/lib/auth-server'
import SetupBanner from '@/components/SetupBanner'
import ClientProjectsBoard from '@/components/ClientProjectsBoard'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function ClientProjectsPage() {
  // The one dashboard page two different roles open, so the role is read here
  // rather than inferred in the board — and it decides only what is rendered.
  // The writes are guarded again inside the actions themselves.
  const [projects, taskCounts, account] = await Promise.all([
    getClientProjects(),
    getClientProjectTaskCounts(),
    currentAccount(),
  ])

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-4xl">
        <ClientProjectsBoard
          initialProjects={projects}
          taskCounts={taskCounts}
          canManage={account?.role === 'admin'}
          supabaseConfigured={supabaseConfigured}
        />
      </div>
    </div>
  )
}
