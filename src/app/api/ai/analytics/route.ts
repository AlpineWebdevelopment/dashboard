import { NextRequest, NextResponse } from 'next/server'

const FREELLMAPI_URL = process.env.FREELLMAPI_URL || 'https://freellmapi-production-2f58.up.railway.app'
const FREELLMAPI_KEY = process.env.FREELLMAPI_KEY

export async function GET(req: NextRequest) {
  if (!FREELLMAPI_KEY) return NextResponse.json({}, { status: 503 })

  const range = req.nextUrl.searchParams.get('range') || '7d'

  const [summary, byModel] = await Promise.all([
    fetch(`${FREELLMAPI_URL}/api/analytics/summary?range=${range}`, {
      headers: { 'Authorization': `Bearer ${FREELLMAPI_KEY}` },
      next: { revalidate: 30 },
    }).then(r => r.json()),
    fetch(`${FREELLMAPI_URL}/api/analytics/by-model?range=${range}`, {
      headers: { 'Authorization': `Bearer ${FREELLMAPI_KEY}` },
      next: { revalidate: 30 },
    }).then(r => r.json()),
  ])

  return NextResponse.json({ summary, byModel })
}
