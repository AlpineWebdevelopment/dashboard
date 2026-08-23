// The session cookie: an HMAC-signed payload naming who is signed in.
//
// Signing and verifying live together because both halves have to agree on the
// payload shape, and they run in different places — the login route (Node) and
// the proxy (edge). Everything here is Web Crypto plus btoa/atob, which exist
// in both, so neither side needs a runtime-specific build.

import { findAccount, type Account } from './users'

export const SESSION_COOKIE = 'gt_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 10 // 10 years, in seconds

/**
 * Version 2 added `u`, the username. A v1 token proves only that someone knew
 * the one password there used to be — it names nobody, so there is no role to
 * resolve from it and it is rejected. The two of us sign in once more.
 */
const TOKEN_VERSION = 2

type Payload = { v: number; u: string; exp: number }

// ─── base64url ────────────────────────────────────────────────────────────────

function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Returns Uint8Array<ArrayBuffer> rather than a bare Uint8Array: the default is
// typed over ArrayBufferLike, which crypto.subtle will not accept as a
// BufferSource. Allocating the buffer first is what pins the type.
function b64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ─── Signing ──────────────────────────────────────────────────────────────────

async function hmacKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  )
}

export async function signSession(username: string, secret: string): Promise<string> {
  const payload: Payload = {
    v: TOKEN_VERSION,
    u: username,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  }
  const encoded = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await hmacKey(secret, 'sign')
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded))
  return `${encoded}.${b64urlEncode(new Uint8Array(signature))}`
}

/**
 * The account a token names, or null if it is missing, forged, expired, or
 * names someone who is no longer on the roster. Removing an account from
 * ACCOUNTS therefore signs them out on their next request.
 */
export async function readSession(
  token: string | undefined | null,
  secret: string | undefined | null
): Promise<Account | null> {
  if (!token || !secret) return null
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 1) return null

    const encoded = token.slice(0, dot)
    const key = await hmacKey(secret, 'verify')
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlDecode(token.slice(dot + 1)),
      new TextEncoder().encode(encoded)
    )
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(encoded))) as Payload
    if (payload.v !== TOKEN_VERSION) return null
    if (!(typeof payload.exp === 'number' && payload.exp > Date.now())) return null

    return findAccount(payload.u)
  } catch {
    return null
  }
}
