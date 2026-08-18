// Brand logos for the Login Hub.
//
// Drawn inline rather than fetched, so there are no external requests and
// nothing breaks when a CDN or favicon service changes. Anything without a mark
// here falls back to a lettered tile, which is why adding a service to
// login-hub.ts never needs a logo to work.
//
// To add a real logo: drop a <path> set in BRAND_MARKS under the service's
// `brand` key. Keep the viewBox square so the sizing below holds.

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
  'google-calendar': {
    viewBox: '0 0 48 48',
    body: (
      <>
        <rect x="8" y="8" width="32" height="32" rx="3" fill="#fff" />
        <path fill="#4285F4" d="M8 11a3 3 0 0 1 3-3h5v8H8v-5Z" />
        <path fill="#EA4335" d="M32 8h5a3 3 0 0 1 3 3v5h-8V8Z" />
        <path fill="#34A853" d="M40 32v5a3 3 0 0 1-3 3h-5v-8h8Z" />
        <path fill="#FBBC04" d="M8 32h8v8h-5a3 3 0 0 1-3-3v-5Z" />
        <path fill="#4285F4" d="M16 8h16v8H16zM8 16h8v16H8z" opacity=".85" />
        <text
          x="24"
          y="30"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="#4285F4"
          fontFamily="system-ui, sans-serif"
        >
          31
        </text>
      </>
    ),
  },
  'google-meet': {
    viewBox: '0 0 87.5 72',
    body: (
      <>
        <path fill="#00832d" d="M49.5 36l8.9 10.1 11.9 7.6 2.1-17.7-2.1-17.4-12.2 6.7z" />
        <path fill="#0066da" d="M0 51.5V66c0 3.3 2.7 6 6 6h14.5l3-11-3-9.5-9.9-3z" />
        <path fill="#e94235" d="M20.5 0L0 20.5l10.6 3 9.9-3 3-9.4z" />
        <path fill="#2684fc" d="M20.5 20.5H0v31h20.5z" />
        <path fill="#00ac47" d="M82.6 8.2l-12.3 10v35.5l12.4 10.2c1.8 1.5 4.6.2 4.6-2.2V10.4c0-2.4-2.7-3.7-4.7-2.2z" />
        <path fill="#00ac47" d="M49.5 36v15.5h-29V72h43c3.3 0 6-2.7 6-6V59.7z" />
        <path fill="#ffba00" d="M43.5 0h-23v20.5h29V36l20-16.3V6c0-3.3-2.7-6-6-6z" />
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
