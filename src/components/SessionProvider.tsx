'use client'

// Who is signed in, for the components that need to render differently for the
// two roles — the sidebar drops the search box for a client account, the
// projects board drops every edit control, and the settings roster marks the
// row that is you.
//
// Read from the session cookie by the dashboard layout and handed down, rather
// than fetched: the answer is already in the request, and a fetch would mean a
// paint where the UI does not yet know who it is talking to.
//
// This is a convenience, never a control. Every route is gated in `src/proxy.ts`
// against the same cookie, so nothing here is what actually keeps a page shut.

import { createContext, useContext } from 'react'
import type { Account, Role } from '@/lib/users'

const SessionCtx = createContext<Account | null>(null)

export const useSession = () => useContext(SessionCtx)

/** The signed-in role, defaulting to the most restrictive one. */
export function useRole(): Role {
  return useContext(SessionCtx)?.role ?? 'client'
}

export const useIsAdmin = () => useRole() === 'admin'

export default function SessionProvider({
  account,
  children,
}: {
  account: Account | null
  children: React.ReactNode
}) {
  return <SessionCtx.Provider value={account}>{children}</SessionCtx.Provider>
}
