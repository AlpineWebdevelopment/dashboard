import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No audio file' }, { status: 400 })

  const groqForm = new FormData()
  groqForm.append('file', file, file.name || 'audio.webm')
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('response_format', 'json')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: groqForm,
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data.error?.message ?? 'Transcription failed' }, { status: res.status })
  return NextResponse.json({ text: data.text })
}
