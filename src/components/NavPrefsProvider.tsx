'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { NAV_COOKIE, NEWS_COOKIE, setPrefCookie } from '@/lib/prefs'
import { encodeNavPref, resolveNav, type NavEntry } from '@/lib/nav'
import { useRole } from './SessionProvider'

const NavCtx = createContext<{
  entries: NavEntry[]
  setEntries: (next: NavEntry[]) => void
  reset: () => void
  showNews: boolean
  setShowNews: (show: boolean) => void
}>({
  entries: resolveNav(null), setEntries: () => {}, reset: () => {},
  showNews: true, setShowNews: () => {},
})

export const useNavPrefs = () => useContext(NavCtx)

export default function NavPrefsProvider({
  initial,
  initialShowNews,
  children,
}: {
  initial: string | null
  initialShowNews: boolean
  children: React.ReactNode
}) {
  // The cookie is per-browser and shared by whoever signs in on it, so the menu
  // is filtered by the role that is signed in now rather than by the one that
  // saved it — see `resolveNav`.
  const role = useRole()

  // Resolved from the cookie the server read, so the sidebar renders in the
  // saved order on the first paint instead of reshuffling after hydration.
  const [entries, setState] = useState(() => resolveNav(initial, role))

  const setEntries = useCallback((next: NavEntry[]) => {
    setState(next)
    setPrefCookie(NAV_COOKIE, encodeNavPref(next))
  }, [])

  const reset = useCallback(() => setEntries(resolveNav(null, role)), [setEntries, role])

  const [showNews, setNewsState] = useState(initialShowNews)
  const setShowNews = useCallback((show: boolean) => {
    setNewsState(show)
    setPrefCookie(NEWS_COOKIE, show ? '1' : '0')
  }, [])

  return (
    <NavCtx.Provider value={{ entries, setEntries, reset, showNews, setShowNews }}>
      {children}
    </NavCtx.Provider>
  )
}
