import { NextResponse } from 'next/server'
import { disconnect, getStatus } from '@/lib/google-sync'

export const dynamic = 'force-dynamic'

/**
 * Connection state plus a `revision` counter the calendar polls to know when
 * a sync has actually changed something. Sits behind the session cookie check.
 */
export async function GET() {
  try {
    return NextResponse.json(await getStatus())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ configured: false, connected: false, error: message }, { status: 500 })
  }
}

/** Disconnects the account and removes every mirrored event. */
export async function DELETE() {
  try {
    await disconnect()
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
