export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import LoginHub from '@/components/LoginHub'
import { getLoginLinks } from '@/lib/actions'

export const metadata: Metadata = { title: 'Login Hub' }

export default async function LoginsPage() {
  const { links, error } = await getLoginLinks()

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
          Personal
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
            Login Hub
          </h1>
          <span className="text-[13px] text-zinc-500 dark:text-zinc-200">
            {links.length} link{links.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8">
        <LoginHub initialLinks={links} loadError={error} />
      </div>
    </div>
  )
}
