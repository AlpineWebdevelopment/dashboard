// Public: the slots a visitor may book.
//
// Called by the Atrium landing pages from the browser, so it is deliberately
// dull — no session, no parameters, and nothing in the response that is not
// already public by the time someone is looking at a booking widget. Slots the
// scarcity dial is holding back are simply absent from `days`, marked busy
// rather than omitted only when they are genuinely taken.

import { NextRequest, NextResponse } from 'next/server'
import { computeAvailability } from '@/lib/crm/availability'
import { loadPublicCalendar } from '@/lib/crm/calendar'
import { corsHeaders } from '@/lib/crm/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))

  const calendar = await loadPublicCalendar()
  if (!calendar.ok) {
    // The caller is a landing page; it can do nothing with the distinction
    // between an unrun migration and a missing key, and neither is its business.
    console.error('[atrium/availability]', calendar.reason, calendar.message)
    return NextResponse.json({ error: 'Calendar unavailable' }, { status: 503, headers: cors })
  }

  const { settings, busy, freed, dayPins } = calendar
  const days = computeAvailability(settings, busy, new Date(), freed, dayPins)

  return NextResponse.json(
    {
      timezone: settings.timezone,
      slot_duration_minutes: settings.slot_duration_minutes,
      days,
    },
    { headers: cors }
  )
}
