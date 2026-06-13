import { NextRequest, NextResponse } from 'next/server'
import { freellmapiAdminFetch } from '@/lib/freellmapi'

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') || '7d'

  try {
    const [summaryRes, byModelRes] = await Promise.all([
      freellmapiAdminFetch(`/api/analytics/summary?range=${range}`),
      freellmapiAdminFetch(`/api/analytics/by-model?range=${range}`),
    ])

    const summary = summaryRes.ok ? await summaryRes.json() : {}
    const byModel = byModelRes.ok ? await byModelRes.json() : []

    return NextResponse.json({ summary, byModel })
  } catch {
    return NextResponse.json({ summary: {}, byModel: [] }, { status: 503 })
  }
}
