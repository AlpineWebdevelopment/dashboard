'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { NAV_COOKIE, setPrefCookie } from '@/lib/prefs'
import { encodeNavPref, resolveNav, type NavEntry } from '@/lib/nav'

const NavCtx = createContext<{
  entries: NavEntry[]
  setEntries: (next: NavEntry[]) => void
  reset: () => void
}>({ entries: resolveNav(null), setEntries: () => {}, reset: () => {} })

export const useNavPrefs = () => useContext(NavCtx)

export default function NavPrefsProvider({
  initial,
  children,
}: {
  initial: string | null
  children: React.ReactNode
}) {
  // Resolved from the cookie the server read, so the sidebar renders in the
  // saved order on the first paint instead of reshuffling after hydration.
  const [entries, setState] = useState(() => resolveNav(initial))

  const setEntries = useCallback((next: NavEntry[]) => {
    setState(next)
    setPrefCookie(NAV_COOKIE, encodeNavPref(next))
  }, [])

  const reset = useCallback(() => setEntries(resolveNav(null)), [setEntries])

  return <NavCtx.Provider value={{ entries, setEntries, reset }}>{children}</NavCtx.Provider>
}
