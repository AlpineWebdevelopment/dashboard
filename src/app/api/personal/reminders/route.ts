import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, getDueReminders, createReminder } from '@/lib/personal-db'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(getDueReminders())
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.message || !body.remind_at) return NextResponse.json({ error: 'message and remind_at required' }, { status: 400 })
  return NextResponse.json(createReminder(body), { status: 201 })
}
