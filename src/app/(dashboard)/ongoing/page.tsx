export const dynamic = 'force-dynamic'

import { getOngoingActivities, getPeople, getTasks } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import OngoingBoard from '@/components/OngoingBoard'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function OngoingPage() {
  const [activities, tasks, people] = await Promise.all([
    getOngoingActivities(),
    getTasks(),
    getPeople(),
  ])

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-5xl">
        <OngoingBoard
          initialActivities={activities}
          tasks={tasks}
          people={people}
          supabaseConfigured={supabaseConfigured}
        />
      </div>
    </div>
  )
}
