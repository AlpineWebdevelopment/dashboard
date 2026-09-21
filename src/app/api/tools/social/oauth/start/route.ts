import { NextRequest, NextResponse } from 'next/server'
import { currentAccount } from '@/lib/auth-server'
import { buildLoginUrl, metaAppConfig, socialRedirectUri } from '@/lib/social/tokens'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'social_oauth_state'
const BACK = '/tools/social/accounts'

/** Sends the browser to the Facebook Login dialog. Behind the session (src/proxy.ts). */
export async function GET(req: NextRequest) {
  const account = await currentAccount()
  if (account?.role !== 'admin') return NextResponse.redirect(new URL('/', req.url))

  const config = metaAppConfig()
  if (!config) return NextResponse.redirect(new URL(`${BACK}?meta_error=not_configured`, req.url))

  // Echoed back by Facebook and compared against this cookie, so nobody can
  // walk the callback through a login we did not start.
  const state = crypto.randomUUID()
  const res = NextResponse.redirect(buildLoginUrl(config, socialRedirectUri(req), state))
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
