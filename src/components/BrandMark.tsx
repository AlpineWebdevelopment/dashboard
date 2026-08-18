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
    viewBox: '0 0 48 48',
    body: (
      <>
        <path fill="#00832D" d="M6 16a3 3 0 0 1 3-3h17v22H9a3 3 0 0 1-3-3V16Z" />
        <path fill="#0066DA" d="M26 13v10l8-5-8-5Z" />
        <path fill="#E94235" d="M26 35V25l8 5-8 5Z" />
        <path fill="#FFBA00" d="M34 18v12l6 4a2 2 0 0 0 3-1.7V15.7A2 2 0 0 0 40 14l-6 4Z" />
        <path fill="#00AC47" d="M26 13H9a3 3 0 0 0-3 3v3h20v-6Z" />
      </>
    ),
  },
  'google-drive': {
    viewBox: '0 0 48 48',
    body: (
      <>
        <path fill="#0066DA" d="M9.5 38 4 28.5l11-19 5.5 9.5L9.5 38Z" />
        <path fill="#00AC47" d="M38.5 38h-29L15 28.5h29L38.5 38Z" />
        <path fill="#FFBA00" d="M44 28.5H23L33.5 9.5h-11L33 28.5h11Z" />
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
