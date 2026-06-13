import { NextResponse } from 'next/server'

const FREELLMAPI_URL = process.env.FREELLMAPI_URL || 'https://freellmapi-production-2f58.up.railway.app'
const FREELLMAPI_KEY = process.env.FREELLMAPI_KEY

export async function GET() {
  if (!FREELLMAPI_KEY) return NextResponse.json([], { status: 503 })

  const res = await fetch(`${FREELLMAPI_URL}/api/models`, {
    headers: { 'Authorization': `Bearer ${FREELLMAPI_KEY}` },
    next: { revalidate: 60 },
  })

  if (!res.ok) return NextResponse.json([], { status: res.status })
  const data = await res.json()
  return NextResponse.json(data)
}
