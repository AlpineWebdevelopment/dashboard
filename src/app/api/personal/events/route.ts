import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, getEventsRange, createEvent } from '@/lib/personal-db'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const from = req.nextUrl.searchParams.get('from') ?? new Date().toISOString().slice(0, 10)
  const to = req.nextUrl.searchParams.get('to') ?? from
  return NextResponse.json(getEventsRange(from, to))
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.title || !body.date) return NextResponse.json({ error: 'title and date required' }, { status: 400 })
  const event = createEvent({ title: body.title, date: body.date, time: body.time ?? null, description: body.description ?? null, color: body.color ?? 'indigo' })
  return NextResponse.json(event, { status: 201 })
}
