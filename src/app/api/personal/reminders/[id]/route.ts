import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, markReminderFired } from '@/lib/personal-db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await markReminderFired(Number(id))
  return NextResponse.json({ ok: true })
}
