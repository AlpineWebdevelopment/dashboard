import { NextRequest, NextResponse } from 'next/server'
import { buildAuthUrl, getGoogleConfig, getRedirectUri } from '@/lib/google-calendar'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'g_oauth_state'

/** Kicks off the OAuth consent flow. */
export async function GET(req: NextRequest) {
  const config = getGoogleConfig()
  if (!config) {
    return NextResponse.redirect(new URL('/cal?google_error=not_configured', req.url))
  }

  // Random state, echoed back by Google and checked against this cookie, so a
  // third party can't walk us through a callback we didn't initiate.
  const state = crypto.randomUUID()
  const res = NextResponse.redirect(buildAuthUrl(config, getRedirectUri(req), state))
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
