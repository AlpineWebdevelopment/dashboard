'use client'

import { createContext, useContext, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { BackgroundSettings } from '@/lib/supabase'
import { DEFAULT_BACKGROUND } from '@/lib/supabase'

const BackgroundCtx = createContext<{
  background: BackgroundSettings
  setBackground: (next: BackgroundSettings) => void
}>({ background: DEFAULT_BACKGROUND, setBackground: () => {} })

export const useBackground = () => useContext(BackgroundCtx)

// The landing page paints its own background, and share links are public —
// neither should inherit the personal wallpaper.
const EXCLUDED = ['/landing', '/share']

export default function BackgroundProvider({
  initial,
  children,
}: {
  initial: BackgroundSettings
  children: React.ReactNode
}) {
  // Server value seeds the first paint (no flash); picking a new one updates
  // this state immediately so the change is visible before the save lands.
  const [background, setBackground] = useState(initial)
  const pathname = usePathname()

  const hidden = EXCLUDED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const show = !!background.url && !hidden

  return (
    <BackgroundCtx.Provider value={{ background, setBackground }}>
      {show && (
        // Dark mode only — `hidden dark:block` keys off the .dark class that the
        // inline script in the root layout sets before first paint, so light mode
        // never flashes the wallpaper the way a useTheme() gate would.
        <div aria-hidden className="hidden dark:block fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300"
            style={{
              backgroundImage: `url("${background.url}")`,
              ...(background.blur > 0
                ? {
                    filter: `blur(${background.blur}px)`,
                    // Scale up so the blur doesn't feather in from the edges
                    transform: `scale(${1 + background.blur / 100})`,
                  }
                : null),
            }}
          />
          <div
            className="absolute inset-0 bg-black transition-opacity duration-200"
            style={{ opacity: background.dim }}
          />
        </div>
      )}
      {children}
    </BackgroundCtx.Provider>
  )
}
