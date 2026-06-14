import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, deleteNote } from '@/lib/personal-db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  deleteNote(Number(id))
  return NextResponse.json({ ok: true })
}
