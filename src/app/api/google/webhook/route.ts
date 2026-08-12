import { NextRequest, NextResponse } from 'next/server'
import { findCalendarByChannel, getAccount, syncAll } from '@/lib/google-sync'

export const dynamic = 'force-dynamic'

/**
 * Google's push notification endpoint. Reached without a session cookie, so it
 * is exempted in src/proxy.ts and authenticated by the per-account token that
 * was handed to Google when the channel was created.
 *
 * The notification carries no event data — it only says "something changed" —
 * so the response to it is a normal sync pass.
 */
export async function POST(req: NextRequest) {
  const channelId = req.headers.get('x-goog-channel-id')
  const token = req.headers.get('x-goog-channel-token')
  const state = req.headers.get('x-goog-resource-state')

  // 'sync' is the handshake Google sends when a channel is created.
  if (state === 'sync') return new NextResponse(null, { status: 200 })
  if (!channelId || !token) return new NextResponse(null, { status: 400 })

  try {
    const account = await getAccount()
    if (!account || !account.webhook_token || token !== account.webhook_token) {
      return new NextResponse(null, { status: 401 })
    }

    // An unknown channel is a stale one from a previous connection; 200 stops
    // Google retrying it, and it will expire on its own.
    const calendar = await findCalendarByChannel(channelId)
    if (!calendar) return new NextResponse(null, { status: 200 })

    await syncAll('webhook')
    return new NextResponse(null, { status: 200 })
  } catch (err) {
    console.error('Google Calendar webhook failed', err)
    // Non-2xx tells Google to retry with backoff, which is what we want for a
    // transient failure.
    return new NextResponse(null, { status: 500 })
  }
}
