'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { BackgroundSettings } from '@/lib/supabase'
import { DEFAULT_BACKGROUND, backgroundName } from '@/lib/supabase'
import { BACKGROUND_COOKIE, encodeBackgroundPref, setPrefCookie } from '@/lib/prefs'

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
  // The cookie the server already read seeds the first paint (no flash); the
  // state below keeps the UI in sync for the rest of the session.
  const [background, setState] = useState(initial)
  const pathname = usePathname()

  // Persisting is a synchronous cookie write, so there's nothing to debounce
  // and nothing that can fail halfway — dragging a slider stays smooth.
  const setBackground = useCallback((next: BackgroundSettings) => {
    setState(next)
    setPrefCookie(
      BACKGROUND_COOKIE,
      encodeBackgroundPref({
        name: backgroundName(next.url),
        dim: Math.round(next.dim * 100),
        blur: next.blur,
      })
    )
  }, [])

  const hidden = EXCLUDED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const show = !!background.url && !hidden

  return (
    <BackgroundCtx.Provider value={{ background, setBackground }}>
      {show && (
        // Scoped to .dark for the same reason as the layer below, and only
        // emitted when an image is set so text is unshadowed otherwise.
        // Tight layer sharpens the glyph edge, soft halo separates it from
        // busy areas of the photo — enough for dimmed zinc text, still subtle
        // on solid surfaces like the sidebar.
        <style
          dangerouslySetInnerHTML={{
            __html:
              ':root:where(.dark){--bg-text-shadow:' +
              '0 1px 2px rgba(0,0,0,.85),0 0 12px rgba(0,0,0,.5);' +
              '--panel-bg:rgba(0,0,0,.45);' +
              '--panel-blur:blur(16px) saturate(1.15);' +
              '--card-prio-alpha:.3}' +
              // Cards carry an opaque bg-color for `none` priority, which would
              // sit in front of the blur. Drop it and let .panel-card's layers
              // supply both the dark and the colour.
              ':root:where(.dark) .panel-card{background-color:transparent}',
          }}
        />
      )}
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
