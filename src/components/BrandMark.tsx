'use client'

import { useSyncExternalStore } from 'react'

// Brand logos for the Login Hub.
//
// Drawn inline rather than fetched, so there are no external requests and
// nothing breaks when a CDN or favicon service changes. Anything without a mark
// here falls back to a lettered tile, which is why adding a service to
// login-hub.ts never needs a logo to work.
//
// To add a real logo: drop a <path> set in BRAND_MARKS under the service's
// `brand` key. Keep the viewBox square so the sizing below holds.

// The real Calendar icon carries today's date, so this one does too. Reading
// the clock during render is impure, and the server — on UTC — would answer
// with its own day, so it arrives through useSyncExternalStore: nothing on the
// server, the real day once mounted. Deliberately local rather than reusing
// useToday from TaskCardView, which would drag the whole task card and the
// project palette into the Login Hub's bundle for one number.
const NEVER_CHANGES = () => () => {}
const clientDay = () => String(new Date().getDate())
const serverDay = () => null

function GoogleCalendarMark() {
  const day = useSyncExternalStore(NEVER_CHANGES, clientDay, serverDay)
  return (
    <>
      <rect x="3" y="3" width="42" height="42" rx="10" fill="#4C8DF6" />
      {day && (
        <text
          x="24"
          y="33.5"
          textAnchor="middle"
          fontSize="21"
          fontWeight="500"
          fill="#fff"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {day}
        </text>
      )}
    </>
  )
}

const BRAND_MARKS: Record<string, { viewBox: string; body: React.ReactNode }> = {
  gmail: {
    viewBox: '0 0 52 40',
    body: (
      <>
        <path fill="#4285F4" d="M3.5 40h7V21.8L0 13.3v23.2C0 38.4 1.6 40 3.5 40Z" />
        <path fill="#34A853" d="M41.5 40h7c1.9 0 3.5-1.6 3.5-3.5V13.3L41.5 21.8V40Z" />
        <path fill="#FBBC04" d="M41.5 3.5v18.3L52 13.3V5.2c0-4.1-4.7-6.4-8-4l-2.5 2.3Z" />
        <path fill="#EA4335" d="M10.5 21.8V3.5L26 15.1 41.5 3.5v18.3L26 33.4 10.5 21.8Z" />
        <path fill="#C5221F" d="M0 5.2v8.1l10.5 8.5V3.5L8 1.2c-3.3-2.4-8-.1-8 4Z" />
      </>
    ),
  },
  supabase: {
    viewBox: '0 0 109 113',
    body: (
      <>
        <path
          fill="#3ECF8E"
          d="M63.7 110.3c-2.8 3.6-8.6 1.6-8.6-2.9l-.9-66.5h44.7c8.1 0 12.6 9.3 7.6 15.7l-42.8 53.7Z"
        />
        <path
          fill="#3ECF8E"
          fillOpacity=".55"
          d="M45.3 2.4c2.8-3.6 8.6-1.6 8.6 2.9l.4 66.5H10.2c-8.1 0-12.6-9.3-7.6-15.7L45.3 2.4Z"
        />
      </>
    ),
  },
  // The 2025 mark: a solid blue tile carrying the day, not the white sheet with
  // coloured corners.
  'google-calendar': {
    viewBox: '0 0 48 48',
    body: <GoogleCalendarMark />,
  },
  // The 2025 mark: one yellow camera with a white lens dot, not the old
  // four-colour arrangement.
  'google-meet': {
    viewBox: '0 0 48 36',
    body: (
      <>
        <rect x="2" y="6" width="29" height="24" rx="7" fill="#FFBA00" />
        <path
          fill="#FFBA00"
          d="M31 14.6 44.1 7.5A1.7 1.7 0 0 1 46.6 9v18a1.7 1.7 0 0 1-2.5 1.5L31 21.4z"
        />
        <circle cx="9.6" cy="23.4" r="3.3" fill="#fff" />
      </>
    ),
  },
  'google-drive': {
    viewBox: '0 0 87.3 78',
    body: (
      <>
        <path fill="#0066da" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" />
        <path fill="#00ac47" d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 0 0 0 53h27.5z" />
        <path fill="#ea4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.798l5.852 11.5z" />
        <path fill="#00832d" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" />
        <path fill="#2684fc" d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" />
        <path fill="#ffba00" d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" />
      </>
    ),
  },
  github: {
    viewBox: '0 0 24 24',
    body: (
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z"
      />
    ),
  },
  vercel: {
    viewBox: '0 0 24 24',
    body: <path fill="currentColor" d="M12 2 23 21H1L12 2Z" />,
  },
}

export function hasBrandMark(brand: string) {
  return brand in BRAND_MARKS
}

export default function BrandMark({
  brand,
  name,
  className = '',
  size = 24,
}: {
  brand: string
  /** Used for the fallback letter and the accessible label. */
  name: string
  className?: string
  size?: number
}) {
  const mark = BRAND_MARKS[brand]

  if (!mark) {
    // No logo drawn for this one yet — a lettered tile keeps the grid even.
    return (
      <span
        aria-hidden
        className={`flex items-center justify-center font-semibold rounded-lg ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    )
  }

  return (
    <svg
      viewBox={mark.viewBox}
      width={size}
      height={size}
      role="img"
      aria-label={name}
      className={`shrink-0 ${className}`}
    >
      {mark.body}
    </svg>
  )
}
