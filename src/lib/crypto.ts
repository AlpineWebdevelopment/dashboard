// Encryption at rest for third-party credentials (Google refresh tokens, Meta
// Page tokens). AES-256-GCM with a per-value salt and IV; the key is derived
// from AUTH_SECRET with PBKDF2, so rotating AUTH_SECRET means reconnecting
// every integration — the same moment it signs everyone out.
//
// Server-only in practice: AUTH_SECRET has no NEXT_PUBLIC_ prefix, so in the
// browser deriveKey throws before anything is encrypted.

const ENC_PREFIX = 'v1'

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET must be set to store credentials')
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return [
    ENC_PREFIX,
    Buffer.from(salt).toString('base64url'),
    Buffer.from(iv).toString('base64url'),
    Buffer.from(ct).toString('base64url'),
  ].join('.')
}

export async function decryptSecret(payload: string): Promise<string> {
  const [version, saltB64, ivB64, ctB64] = payload.split('.')
  if (version !== ENC_PREFIX || !saltB64 || !ivB64 || !ctB64) {
    throw new Error('Stored credential is malformed — reconnect the account')
  }
  const salt = new Uint8Array(Buffer.from(saltB64, 'base64url'))
  const iv = new Uint8Array(Buffer.from(ivB64, 'base64url'))
  const key = await deriveKey(salt)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, Buffer.from(ctB64, 'base64url'))
  return new TextDecoder().decode(pt)
}
