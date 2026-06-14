import { NextRequest, NextResponse } from 'next/server'
import { getEventsRange, createEvent, deleteEvent } from '@/lib/personal-db'

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? new Date().toISOString().slice(0, 10)
  const to = req.nextUrl.searchParams.get('to') ?? from
  return NextResponse.json(await getEventsRange(from, to))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.title || !body.date) return NextResponse.json({ error: 'title and date required' }, { status: 400 })
  const event = await createEvent({ title: body.title, date: body.date, time: body.time ?? null, description: body.description ?? null, color: body.color ?? 'indigo' })
  return NextResponse.json(event, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteEvent(Number(id))
  return NextResponse.json({ ok: true })
}
