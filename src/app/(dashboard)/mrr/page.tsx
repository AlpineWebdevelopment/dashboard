export const dynamic = 'force-dynamic'

import { getMrrClients } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import MrrBoard from '@/components/MrrBoard'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function MrrPage() {
  const clients = await getMrrClients()

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-5xl">
        <MrrBoard initialClients={clients} supabaseConfigured={supabaseConfigured} />
      </div>
    </div>
  )
}
