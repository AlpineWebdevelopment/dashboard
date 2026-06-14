import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, getTasks, createTask } from '@/lib/personal-db'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const status = (req.nextUrl.searchParams.get('status') ?? 'pending') as 'pending' | 'done' | 'all'
  return NextResponse.json(await getTasks(status))
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  return NextResponse.json(await createTask(body), { status: 201 })
}
