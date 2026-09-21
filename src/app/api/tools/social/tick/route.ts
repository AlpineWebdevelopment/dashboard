import { NextRequest, NextResponse } from 'next/server'
import { socialConfigured } from '@/lib/social/db'
import { runTick } from '@/lib/social/engine'

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
 * One publisher tick. Called by Supabase — pg_cron runs public.social_tick()
 * every minute, and that only POSTs here (via pg_net) when a job is due — so
 * no Vercel Cron is involved.
 *
 * Exempted from the session cookie check in src/proxy.ts and authenticated
 * with SOCIAL_TICK_SECRET instead, which Supabase reads from Vault.
 */
async function handle(req: NextRequest) {
  const expected = process.env.SOCIAL_TICK_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'SOCIAL_TICK_SECRET is not set — refusing to run' }, { status: 503 })
  }
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!socialConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' }, { status: 503 })
  }

  try {
    return NextResponse.json(await runTick())
  } catch (err) {
    console.error('[social] tick failed', err)
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
