import { NextRequest, NextResponse } from 'next/server'

const FREELLMAPI_URL = process.env.FREELLMAPI_URL || 'https://freellmapi-production-2f58.up.railway.app'
const FREELLMAPI_KEY = process.env.FREELLMAPI_KEY

export async function POST(req: NextRequest) {
  if (!FREELLMAPI_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const { messages, model } = await req.json()

  const upstream = await fetch(`${FREELLMAPI_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FREELLMAPI_KEY}`,
    },
    body: JSON.stringify({ model: model || 'auto', messages }),
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    return NextResponse.json({ error: text }, { status: upstream.status })
  }

  const data = await upstream.json()
  return NextResponse.json(data)
}
