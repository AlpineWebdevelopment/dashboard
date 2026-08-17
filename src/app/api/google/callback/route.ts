import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, fetchUserEmail, getGoogleConfig, getRedirectUri, listCalendars } from '@/lib/google-calendar'
import { saveConnection, syncAll } from '@/lib/google-sync'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'g_oauth_state'

function back(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/cal', req.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = NextResponse.redirect(url)
  res.cookies.set(STATE_COOKIE, '', { maxAge: 0, path: '/' })
  return res
}

export async function GET(req: NextRequest) {
  const config = getGoogleConfig()
  if (!config) return back(req, { google_error: 'not_configured' })

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const denied = req.nextUrl.searchParams.get('error')
  if (denied) return back(req, { google_error: denied })
  if (!code) return back(req, { google_error: 'missing_code' })

  const expected = req.cookies.get(STATE_COOKIE)?.value
  if (!expected || !state || state !== expected) return back(req, { google_error: 'bad_state' })

  try {
    const tokens = await exchangeCode(config, code, getRedirectUri(req))
    if (!tokens.refresh_token) {
      // Google only re-issues a refresh token with prompt=consent. If one is
      // missing the grant already exists — revoking it in the Google account
      // settings and reconnecting is the fix.
      return back(req, { google_error: 'no_refresh_token' })
    }

    const [email, calendars] = await Promise.all([
      fetchUserEmail(tokens.access_token),
      listCalendars(tokens.access_token),
    ])

    await saveConnection({
      email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope ?? '',
      timeZone: calendars.find(c => c.primary)?.timeZone ?? 'UTC',
    })

    const result = await syncAll('connect', true)
    if (!result.ok && result.error) return back(req, { google_error: 'sync_failed' })

    return back(req, { google: 'connected' })
  } catch (err) {
    console.error('Google Calendar connect failed', err)
    return back(req, { google_error: 'connect_failed' })
  }
}
