import { NextRequest, NextResponse } from 'next/server'
import { currentAccount } from '@/lib/auth-server'
import { MetaError } from '@/lib/social/errors'
import {
  exchangeCode,
  exchangeLongLived,
  metaAppConfig,
  saveConnection,
  socialRedirectUri,
} from '@/lib/social/tokens'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'social_oauth_state'

function back(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/tools/social/accounts', req.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = NextResponse.redirect(url)
  res.cookies.set(STATE_COOKIE, '', { maxAge: 0, path: '/' })
  return res
}

export async function GET(req: NextRequest) {
  const account = await currentAccount()
  if (account?.role !== 'admin') return NextResponse.redirect(new URL('/', req.url))

  const config = metaAppConfig()
  if (!config) return back(req, { meta_error: 'not_configured' })

  const q = req.nextUrl.searchParams
  if (q.get('error')) return back(req, { meta_error: q.get('error_reason') || q.get('error')! })
  const code = q.get('code')
  if (!code) return back(req, { meta_error: 'missing_code' })

  const expected = req.cookies.get(STATE_COOKIE)?.value
  const state = q.get('state')
  if (!expected || !state || state !== expected) return back(req, { meta_error: 'bad_state' })

  try {
    const short = await exchangeCode(config, code, socialRedirectUri(req))
    const long = await exchangeLongLived(config, short.access_token)
    const result = await saveConnection(config, long)
    const params: Record<string, string> = {
      meta: 'connected',
      pages: String(result.pages),
      ig: String(result.instagram),
    }
    if (result.missingScopes.length) params.missing = result.missingScopes.join(',')
    return back(req, params)
  } catch (err) {
    console.error('[social] connect failed', err instanceof MetaError ? `${err.code}/${err.subcode} ${err.raw}` : err)
    return back(req, {
      meta_error: 'connect_failed',
      detail: err instanceof MetaError ? err.message : 'Could not save the connection.',
    })
  }
}
