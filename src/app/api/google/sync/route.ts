import { NextResponse } from 'next/server'
import { syncAll } from '@/lib/google-sync'

export const dynamic = 'force-dynamic'

/** Manual "Sync now" from the UI. Sits behind the session cookie check. */
export async function POST() {
  const result = await syncAll('manual', true)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
