// Graph API over plain fetch. Server-only: every call carries a token.
//
// POST bodies go form-encoded, which every Graph endpoint accepts; nested
// values (attached_media, children) are JSON-encoded by the caller. Failures
// always come back as a MetaError so the engine can classify them in one place.

import { GRAPH_URL, RUPLOAD_URL } from './config'
import { MetaError } from './errors'

type Params = Record<string, string | number | boolean | null | undefined>

const TIMEOUT_MS = 15_000

function encode(params: Params): URLSearchParams {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue
    out.set(k, String(v))
  }
  return out
}

/** Longest back-off Meta asks for across X-Business-Use-Case-Usage entries, in ms. */
function retryAfterFrom(res: Response): number | null {
  const header = res.headers.get('x-business-use-case-usage')
  if (!header) return null
  try {
    const parsed = JSON.parse(header) as Record<string, { estimated_time_to_regain_access?: number }[]>
    let minutes = 0
    for (const entries of Object.values(parsed)) {
      for (const e of entries) minutes = Math.max(minutes, e.estimated_time_to_regain_access ?? 0)
    }
    return minutes > 0 ? minutes * 60_000 : null
  } catch {
    return null
  }
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (err) {
    throw new MetaError({ raw: err instanceof Error ? err.message : String(err), network: true })
  }

  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }

  const error = (body as { error?: { code?: number; error_subcode?: number; message?: string; error_user_msg?: string } } | null)
    ?.error
  if (!res.ok || error) {
    throw new MetaError({
      code: error?.code ?? null,
      subcode: error?.error_subcode ?? null,
      httpStatus: res.status,
      raw: error?.error_user_msg || error?.message || text.slice(0, 300) || `HTTP ${res.status}`,
      retryAfterMs: retryAfterFrom(res),
    })
  }
  return body as T
}

export function graphGet<T>(path: string, token: string | null, params: Params = {}): Promise<T> {
  const qs = encode({ ...params, access_token: token })
  return send<T>(`${GRAPH_URL}/${path.replace(/^\//, '')}?${qs}`, { method: 'GET' })
}

export function graphPost<T>(path: string, token: string, params: Params = {}): Promise<T> {
  return send<T>(`${GRAPH_URL}/${path.replace(/^\//, '')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encode({ ...params, access_token: token }),
  })
}

/**
 * Hands a hosted file to Meta's upload service for a Page reel: Meta fetches
 * `fileUrl` itself, so nothing streams through this server.
 */
export function ruploadHosted<T>(videoId: string, token: string, fileUrl: string): Promise<T> {
  return send<T>(`${RUPLOAD_URL}/${videoId}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, file_url: fileUrl },
  })
}
