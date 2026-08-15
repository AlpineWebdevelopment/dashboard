'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { THEME_COOKIE, setPrefCookie } from '@/lib/prefs'

type Theme = 'dark' | 'light'
const ThemeCtx = createContext<{
  theme: Theme
  setTheme: (next: Theme) => void
  toggle: () => void
}>({ theme: 'dark', setTheme: () => {}, toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

export default function ThemeProvider({ initial, children }: { initial: Theme; children: React.ReactNode }) {
  // Seeded from the cookie the server already read, so the first client render
  // agrees with the HTML.
  const [theme, setThemeState] = useState<Theme>(initial)

  // Browsers that picked a theme before it moved to a cookie still have it in
  // localStorage — hand it over once, after mount, then drop the old key.
  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (!stored) return
    localStorage.removeItem('theme')
    setPrefCookie(THEME_COOKIE, stored)
    if (stored !== initial) {
      setThemeState(stored)
      document.documentElement.classList.toggle('dark', stored === 'dark')
    }
  }, [initial])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    setPrefCookie(THEME_COOKIE, next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, [])

  const toggle = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      setPrefCookie(THEME_COOKIE, next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return next
    })
  }, [])

  return <ThemeCtx.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeCtx.Provider>
}
