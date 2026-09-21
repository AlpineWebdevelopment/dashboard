// Facebook Login + token lifecycle. Server-only.
//
// The chain, per developers.facebook.com/docs/facebook-login/guides/access-tokens:
//   code → short-lived user token (~1–2 h)
//        → long-lived user token (~60 days, fb_exchange_token)
//        → /me/accounts with that token → Page tokens with no expiry date.
// IG publishing runs on the linked Page's token, so a Page token is the only
// credential the engine ever needs. The user token is kept to re-list Pages
// and to report its own expiry; losing it does not stop publishing.

import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { GRAPH_VERSION, SOCIAL_SCOPES } from './config'
import { graphGet } from './graph'
import { MetaError } from './errors'
import { db } from './db'

export type MetaAppConfig = { appId: string; appSecret: string; configId: string | null }

export function metaAppConfig(): MetaAppConfig | null {
  const appId = process.env.SOCIAL_META_APP_ID
  const appSecret = process.env.SOCIAL_META_APP_SECRET
  if (!appId || !appSecret) return null
  return { appId, appSecret, configId: process.env.SOCIAL_META_LOGIN_CONFIG_ID || null }
}

function appOrigin(req: Request): string {
  const raw = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (raw) {
    try {
      return new URL(raw).origin
    } catch {
      // fall through to the request's own origin
    }
  }
  return new URL(req.url).origin
}

export function socialRedirectUri(req: Request): string {
  return `${appOrigin(req)}/api/tools/social/oauth/callback`
}

/**
 * The login dialog. With a Facebook Login for Business configuration the
 * permissions live in the config (config_id); without one, `scope` asks for
 * them directly. auth_type=rerequest brings back any permission that was
 * unticked last time, which is also how a reconnect re-grants.
 */
export function buildLoginUrl(config: MetaAppConfig, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    auth_type: 'rerequest',
  })
  if (config.configId) params.set('config_id', config.configId)
  else params.set('scope', SOCIAL_SCOPES.join(','))
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`
}

type TokenResponse = { access_token: string; token_type?: string; expires_in?: number }

export async function exchangeCode(config: MetaAppConfig, code: string, redirectUri: string) {
  return graphGet<TokenResponse>('oauth/access_token', null, {
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: redirectUri,
    code,
  })
}

export async function exchangeLongLived(config: MetaAppConfig, shortToken: string) {
  return graphGet<TokenResponse>('oauth/access_token', null, {
    grant_type: 'fb_exchange_token',
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortToken,
  })
}

type DebugData = {
  is_valid: boolean
  expires_at?: number
  data_access_expires_at?: number
  scopes?: string[]
  user_id?: string
  error?: { code?: number; subcode?: number; message?: string }
}

export async function debugToken(config: MetaAppConfig, token: string): Promise<DebugData> {
  const res = await graphGet<{ data: DebugData }>('debug_token', `${config.appId}|${config.appSecret}`, {
    input_token: token,
  })
  return res.data
}

const fromUnix = (s: number | undefined): string | null => (s ? new Date(s * 1000).toISOString() : null)

type PageRow = {
  id: string
  name: string
  access_token?: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: {
    id: string
    username?: string
    name?: string
    profile_picture_url?: string
  }
}

async function listPages(userToken: string): Promise<PageRow[]> {
  const fields =
    'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}'
  const pages: PageRow[] = []
  let res = await graphGet<{ data: PageRow[]; paging?: { next?: string } }>('me/accounts', userToken, {
    fields,
    limit: 100,
  })
  pages.push(...res.data)
  // Rarely more than one page of Pages; follow `next` a bounded number of times.
  for (let i = 0; i < 10 && res.paging?.next; i++) {
    const next = await fetch(res.paging.next, { cache: 'no-store' })
    if (!next.ok) break
    res = (await next.json()) as typeof res
    pages.push(...(res.data ?? []))
  }
  return pages
}

/**
 * Stores (or refreshes) a connection and every Page + IG account it reaches.
 * Existing rows keep their `enabled` flag, so a reconnect never silently
 * switches an account on or off.
 */
export async function saveConnection(config: MetaAppConfig, longToken: TokenResponse) {
  const token = longToken.access_token
  const [me, debug, pages] = await Promise.all([
    graphGet<{ id: string; name?: string }>('me', token, { fields: 'id,name' }),
    debugToken(config, token),
    listPages(token),
  ])

  const expiresAt =
    fromUnix(debug.expires_at) ??
    (longToken.expires_in ? new Date(Date.now() + longToken.expires_in * 1000).toISOString() : null)

  const now = new Date().toISOString()
  const { data: conn, error } = await db()
    .from('social_connections')
    .upsert(
      {
        fb_user_id: me.id,
        fb_name: me.name ?? null,
        user_token_enc: await encryptSecret(token),
        user_token_expires_at: expiresAt,
        data_access_expires_at: fromUnix(debug.data_access_expires_at),
        scopes: debug.scopes ?? [],
        status: 'ok',
        last_checked_at: now,
        updated_at: now,
      },
      { onConflict: 'fb_user_id' }
    )
    .select('id')
    .single()
  if (error || !conn) throw error ?? new Error('Connection was not saved')

  const rows: Record<string, unknown>[] = []
  for (const page of pages) {
    if (!page.access_token) continue
    const tokenEnc = await encryptSecret(page.access_token)
    rows.push({
      connection_id: conn.id,
      platform: 'facebook',
      external_id: page.id,
      page_id: page.id,
      name: page.name,
      username: null,
      picture_url: page.picture?.data?.url ?? null,
      token_enc: tokenEnc,
      token_status: 'ok',
      last_error: null,
      updated_at: now,
    })
    const ig = page.instagram_business_account
    if (ig) {
      rows.push({
        connection_id: conn.id,
        platform: 'instagram',
        external_id: ig.id,
        page_id: page.id,
        name: ig.name ?? ig.username ?? page.name,
        username: ig.username ?? null,
        picture_url: ig.profile_picture_url ?? null,
        token_enc: tokenEnc,
        token_status: 'ok',
        last_error: null,
        updated_at: now,
      })
    }
  }

  if (rows.length) {
    // `enabled` is left out of the payload, so an upsert keeps whatever it was.
    const { error: accErr } = await db()
      .from('social_accounts')
      .upsert(rows, { onConflict: 'platform,external_id' })
    if (accErr) throw accErr
  }

  return {
    pages: pages.length,
    instagram: pages.filter((p) => p.instagram_business_account).length,
    missingScopes: SOCIAL_SCOPES.filter((s) => !(debug.scopes ?? []).includes(s)),
  }
}

/** Decrypted Page token for an account row. */
export async function accountToken(tokenEnc: string): Promise<string> {
  return decryptSecret(tokenEnc)
}

/**
 * Re-checks every connection and account token with /debug_token and writes
 * the verdict back. Meta calls only — no publishing side effects.
 */
export async function checkHealth(config: MetaAppConfig): Promise<void> {
  const client = db()
  const now = new Date()
  const { data: conns } = await client.from('social_connections').select('id,user_token_enc')
  for (const c of conns ?? []) {
    let status: 'ok' | 'expiring' | 'invalid' = 'ok'
    let patch: Record<string, unknown> = {}
    try {
      const d = await debugToken(config, await decryptSecret(String(c.user_token_enc)))
      const expires = fromUnix(d.expires_at)
      if (!d.is_valid) status = 'invalid'
      else if (expires && new Date(expires).getTime() - now.getTime() < 7 * 86_400_000) status = 'expiring'
      patch = {
        user_token_expires_at: expires,
        data_access_expires_at: fromUnix(d.data_access_expires_at),
        scopes: d.scopes ?? [],
      }
    } catch (err) {
      // Only a token error is a verdict; a network blip leaves the last one standing.
      if (!(err instanceof MetaError && err.kind === 'token')) continue
      status = 'invalid'
    }
    await client
      .from('social_connections')
      .update({ ...patch, status, last_checked_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', c.id)
  }

  const { data: accounts } = await client.from('social_accounts').select('id,token_enc,page_id')
  // IG rows share their Page's token; check each distinct token once.
  const verdicts = new Map<string, { ok: boolean; error: string | null }>()
  for (const a of accounts ?? []) {
    const key = String(a.page_id)
    if (verdicts.has(key)) continue
    try {
      const d = await debugToken(config, await decryptSecret(String(a.token_enc)))
      verdicts.set(key, { ok: d.is_valid, error: d.is_valid ? null : d.error?.message ?? 'Token is not valid' })
    } catch (err) {
      const invalid = err instanceof MetaError && err.kind === 'token'
      verdicts.set(key, { ok: !invalid, error: invalid ? (err as MetaError).message : null })
    }
  }
  for (const a of accounts ?? []) {
    const v = verdicts.get(String(a.page_id))
    if (!v) continue
    await client
      .from('social_accounts')
      .update({ token_status: v.ok ? 'ok' : 'invalid', last_error: v.error, updated_at: now.toISOString() })
      .eq('id', a.id)
  }
}
