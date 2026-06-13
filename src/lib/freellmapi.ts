const FREELLMAPI_URL = process.env.FREELLMAPI_URL || 'https://freellmapi-production-2f58.up.railway.app'
const FREELLMAPI_EMAIL = process.env.FREELLMAPI_ADMIN_EMAIL
const FREELLMAPI_PASSWORD = process.env.FREELLMAPI_ADMIN_PASSWORD

let cachedToken: string | null = null

async function getSessionToken(): Promise<string | null> {
  if (!FREELLMAPI_EMAIL || !FREELLMAPI_PASSWORD) return null
  if (cachedToken) return cachedToken

  const res = await fetch(`${FREELLMAPI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: FREELLMAPI_EMAIL, password: FREELLMAPI_PASSWORD }),
  })

  if (!res.ok) return null
  const { token } = await res.json()
  cachedToken = token
  return token
}

export async function freellmapiAdminFetch(path: string): Promise<Response> {
  const token = await getSessionToken()
  if (!token) throw new Error('FreeLLMAPI admin credentials not configured')

  const res = await fetch(`${FREELLMAPI_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    next: { revalidate: 30 },
  })

  // Token expired — clear cache and retry once
  if (res.status === 401) {
    cachedToken = null
    const freshToken = await getSessionToken()
    if (!freshToken) throw new Error('Re-authentication failed')
    return fetch(`${FREELLMAPI_URL}${path}`, {
      headers: { 'Authorization': `Bearer ${freshToken}` },
      next: { revalidate: 30 },
    })
  }

  return res
}
