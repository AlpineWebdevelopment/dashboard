// CORS for the two public booking endpoints under /api/atrium.
//
// These are the only routes in the dashboard a stranger's browser is meant to
// reach: a landing page fetches the free slots and posts a booking back. Every
// other route sits behind the gt_session check in src/proxy.ts, and these are
// listed there as exceptions.
//
// The allowlist is not decoration. An unknown origin is answered with the
// canonical one instead of its own, so the browser refuses to hand the response
// back — which is what stops any other site from reading your calendar or
// posting bookings through a visitor's session.

const DEFAULT_ORIGINS = ['https://atriumscaling.com', 'https://www.atriumscaling.com']

/** Extra origins, comma-separated, for landing pages on other domains. */
function allowedOrigins(): string[] {
  const fromEnv = (process.env.ATRIUM_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return [...DEFAULT_ORIGINS, ...fromEnv]
}

export function corsHeaders(origin: string | null): Record<string, string> {
  // localhost is allowed so a landing page can be developed against this API
  // without an env var per port.
  const isLocalhost = origin ? /^https?:\/\/localhost(:\d+)?$/.test(origin) : false
  const allow = !!origin && (allowedOrigins().includes(origin) || isLocalhost)

  return {
    'Access-Control-Allow-Origin': allow ? origin : DEFAULT_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    // Without this a CDN could hand one origin's response to another.
    Vary: 'Origin',
  }
}
