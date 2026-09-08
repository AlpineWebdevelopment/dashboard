export const dynamic = 'force-dynamic'

import {
  getFinanceAccounts,
  getFinanceContributions,
  getFinanceEntries,
  getFinanceSettings,
} from '@/lib/finance-actions'
import FinancesBoard from '@/components/finances/FinancesBoard'

// The finance tables are service-role only (RLS on, no policy), so everything
// has to be fetched here — the board's anon key would see nothing. The route
// itself is already admin-only: ROLE_PATHS confines the coworker role to
// /client-projects and /settings, and src/proxy.ts turns anything else away.
const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

export default async function FinancesPage() {
  const [accounts, entries, contributions, settings] = await Promise.all([
    getFinanceAccounts(),
    getFinanceEntries(),
    getFinanceContributions(),
    getFinanceSettings(),
  ])

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-6xl">
        {!configured && (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <p className="text-[13px] text-amber-800 dark:text-amber-200">
              Finances needs <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code>.
            </p>
          </div>
        )}
        <FinancesBoard
          initialAccounts={accounts}
          initialEntries={entries}
          initialContributions={contributions}
          initialSettings={settings}
        />
      </div>
    </div>
  )
}
