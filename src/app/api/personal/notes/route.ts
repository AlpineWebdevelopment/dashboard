import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, getNotes, createNote } from '@/lib/personal-db'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const query = req.nextUrl.searchParams.get('query') ?? undefined
  return NextResponse.json(getNotes(query))
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.content) return NextResponse.json({ error: 'content required' }, { status: 400 })
  return NextResponse.json(createNote(body), { status: 201 })
}
