import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, getAllMemory, getMemory, setMemory } from '@/lib/personal-db'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const key = req.nextUrl.searchParams.get('key')
  if (key) return NextResponse.json({ key, value: await getMemory(key) })
  return NextResponse.json(await getAllMemory())
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.key || body.value === undefined) return NextResponse.json({ error: 'key and value required' }, { status: 400 })
  await setMemory(body.key, String(body.value))
  return NextResponse.json({ ok: true })
}
