// Public: take a booking from a landing page.
//
// The order of operations is the whole story. The slot is validated against
// freshly read data first, because the visitor's list of times was built when
// their page loaded and anything can have happened since. Only then is a lead
// created — at NEW, like every other lead — moved to MEETING_BOOKED through the
// same transition the CRM uses by hand, and the appointment written last.
//
// A booking that ends up in the CRM by some other path would be a lead nobody
// can explain, so this route creates nothing the CRM cannot.

import { NextRequest, NextResponse } from 'next/server'
import { validateSlot } from '@/lib/crm/availability'
import { createAppointment, loadPublicCalendar } from '@/lib/crm/calendar'
import { corsHeaders } from '@/lib/crm/cors'
import { createLead, transitionLead } from '@/lib/crm/leads'

export const dynamic = 'force-dynamic'

/** Five bookings a minute from one address is already generous for a form. */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5

// Per-instance, so a serverless deployment gets one bucket per warm instance
// rather than a shared one. That is enough to blunt a script without a table to
// maintain — the slot validation, not this, is what keeps the calendar honest.
const hits = new Map<string, { count: number; reset: number }>()

function rateOk(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS })
    // Cheap sweep so the map cannot grow without bound on a long-lived instance.
    if (hits.size > 5000) {
      for (const [key, value] of hits) if (now > value.reset) hits.delete(key)
    }
    return true
  }
  if (entry.count >= MAX_PER_WINDOW) return false
  entry.count++
  return true
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'))

  if (!rateOk(clientIp(req))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: cors })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: cors })
  }

  // Honeypot: a field no person can see and no person fills in. Answered with
  // success on purpose — a bot told it failed simply tries again.
  if (text(body._hp)) return NextResponse.json({ ok: true }, { headers: cors })

  const name = text(body.name)
  const email = text(body.email)?.toLowerCase() ?? null
  const phone = text(body.phone)
  const slotStart = text(body.slot_start)

  if (!name || !email || !phone || !slotStart) {
    return NextResponse.json(
      { error: 'name, email, phone and slot_start are required' },
      { status: 400, headers: cors }
    )
  }
  if (name.length < 3) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400, headers: cors })
  }
  if (!validEmail(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400, headers: cors })
  }

  const calendar = await loadPublicCalendar()
  if (!calendar.ok) {
    console.error('[atrium/book]', calendar.reason, calendar.message)
    return NextResponse.json({ error: 'Calendar unavailable' }, { status: 503, headers: cors })
  }

  const slot = validateSlot(
    calendar.settings,
    calendar.busy,
    slotStart,
    new Date(),
    calendar.freed,
    calendar.dayPins
  )
  if (!slot) {
    return NextResponse.json(
      { error: 'Slot no longer available' },
      { status: 409, headers: cors }
    )
  }

  // Where they came from, kept as a note rather than as columns. The leads
  // table has no consent or UTM fields, and inventing six would be a schema
  // change for something only ever read by a person looking at the lead.
  const provenance = [
    ['Website', text(body.website)],
    ['Role', text(body.role)],
    ['Landing page', text(body.source_url)],
    ['Referrer', text(body.referrer)],
    ['utm_source', text(body.utm_source)],
    ['utm_medium', text(body.utm_medium)],
    ['utm_campaign', text(body.utm_campaign)],
    ['utm_term', text(body.utm_term)],
    ['utm_content', text(body.utm_content)],
    ['Consent', text(body.consent_text_version)],
    ['Consent given', text(body.consent_given_at)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')

  const created = await createLead({
    contact_name: name,
    company_name: text(body.company_name),
    email,
    phone,
    niche: text(body.source_niche) ?? text(body.niche),
    source: text(body.source) ?? 'Booking',
    notes: provenance || null,
    next_action_at: slot.startsAt,
  })

  if (!created.ok) {
    console.error('[atrium/book] lead:', created.error.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: cors })
  }

  const lead = created.data

  // The appointment goes in before the status moves. If this fails the lead is
  // still there, at NEW with the time as its next step — a lead to chase rather
  // than a booking nobody knows about.
  const appointment = await createAppointment(lead.id, slot.startsAt, slot.endsAt)
  if (!appointment.ok) {
    console.error('[atrium/book] appointment:', appointment.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: cors })
  }

  // NEW → MEETING_BOOKED is a legal move in the transition table. If it ever
  // stops being one, the booking is already recorded and the lead is already
  // in the worklist, so this is logged and let go rather than failed.
  const moved = await transitionLead(lead.id, 'MEETING_BOOKED', {
    nextActionAt: slot.startsAt,
    note: `Booked online for ${slot.startsAt}`,
  })
  if (!moved.ok) console.error('[atrium/book] transition:', moved.error.message)

  return NextResponse.json(
    { ok: true, starts_at: slot.startsAt, ends_at: slot.endsAt },
    { headers: cors }
  )
}
