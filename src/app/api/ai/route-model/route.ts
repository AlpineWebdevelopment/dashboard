import { NextRequest, NextResponse } from 'next/server'

const FREELLMAPI_URL = process.env.FREELLMAPI_URL || 'https://freellmapi-production-2f58.up.railway.app'
const FREELLMAPI_KEY = process.env.FREELLMAPI_KEY

const ROUTER_SYSTEM = `You are a routing agent. Based on the user's message, pick the best AI model.

Available models:
- "auto" — casual chat, greetings, simple questions, general conversation
- "deepseek/deepseek-v3.1:free" — code, debugging, scripts, APIs, JSON, technical writing, structured output
- "@cf/moonshotai/kimi-k2.6" — long documents pasted in, summarization, research synthesis, anything over ~500 words of content
- "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" — math, logic puzzles, step-by-step reasoning, planning, "think through this"

Reply ONLY with valid JSON, nothing else: {"model":"<id>","label":"<short name e.g. DeepSeek V3.1>"}`

export async function POST(req: NextRequest) {
  if (!FREELLMAPI_KEY) return NextResponse.json({ model: 'auto', label: null })

  const { message } = await req.json()

  try {
    const res = await fetch(`${FREELLMAPI_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FREELLMAPI_KEY}`,
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'system', content: ROUTER_SYSTEM },
          { role: 'user', content: String(message).slice(0, 600) },
        ],
        max_tokens: 60,
      }),
    })

    if (!res.ok) return NextResponse.json({ model: 'auto', label: null })

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(text.match(/\{.*\}/s)?.[0] ?? '{}')
    return NextResponse.json({ model: parsed.model || 'auto', label: parsed.label || null })
  } catch {
    return NextResponse.json({ model: 'auto', label: null })
  }
}
