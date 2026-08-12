import { NextRequest, NextResponse } from 'next/server'
import { syncAll } from '@/lib/google-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Constant-time compare so the secret can't be recovered by timing the route. */
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

/**
 * Scheduled sync. Two jobs: catch anything push notifications missed (or cover
 * the case where push isn't available at all), and renew watch channels before
 * they expire — Google's channels are short-lived, so something has to run on a
 * timer regardless of whether push is in use.
 *
 * Exempted from the session cookie check in src/proxy.ts and authenticated
 * with CRON_SECRET instead. Vercel Cron sends that header automatically.
 */
async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not set — refusing to run an unauthenticated sync' },
      { status: 503 }
    )
  }

  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncAll('cron', true)
  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 500 })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
