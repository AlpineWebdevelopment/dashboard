export const dynamic = 'force-dynamic'

import { currentAccount } from '@/lib/auth-server'
import SettingsView from '@/components/SettingsView'

// A thin server shell over the client screen, so the Users section knows which
// row is you on the first paint rather than after a fetch.
export default async function SettingsPage() {
  const account = await currentAccount()
  return <SettingsView account={account} />
}
