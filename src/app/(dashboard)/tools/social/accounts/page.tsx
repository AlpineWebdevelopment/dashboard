export const dynamic = 'force-dynamic'
// "Run publisher now" runs a whole tick inside a server action on this page.
export const maxDuration = 60

import { getSocialOverview } from '@/lib/social/actions'
import AccountsPanel, { type ConnectFlash } from '@/components/tools/social/AccountsPanel'

export const metadata = { title: 'Social Scheduler · Accounts' }

const FLASH_KEYS = ['meta', 'pages', 'ig', 'missing', 'meta_error', 'detail'] as const

export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [overview, params] = await Promise.all([getSocialOverview(), searchParams])
  const flash: ConnectFlash = {}
  for (const k of FLASH_KEYS) {
    const v = params[k]
    if (typeof v === 'string') flash[k] = v.slice(0, 300)
  }
  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        <AccountsPanel initial={overview} flash={flash} />
      </div>
    </div>
  )
}
