import { NextResponse } from 'next/server'
import { freellmapiAdminFetch } from '@/lib/freellmapi'

export async function GET() {
  try {
    const res = await freellmapiAdminFetch('/api/models')
    if (!res.ok) return NextResponse.json([], { status: res.status })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([], { status: 503 })
  }
}
