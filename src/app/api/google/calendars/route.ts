import { NextRequest, NextResponse } from 'next/server'
import { getStatus, setCalendarEnabled, syncAll } from '@/lib/google-sync'

export const dynamic = 'force-dynamic'

/** Toggles whether a single Google calendar is mirrored. */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.id !== 'string' || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'id and enabled required' }, { status: 400 })
  }

  try {
    await setCalendarEnabled(body.id, body.enabled)
    // Enabling pulls the calendar in immediately; disabling already dropped its
    // rows, so this just refreshes the status payload.
    if (body.enabled) await syncAll('manual', true)
    return NextResponse.json(await getStatus())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
