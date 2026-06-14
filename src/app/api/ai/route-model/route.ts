import { NextRequest, NextResponse } from 'next/server'

const FREELLMAPI_URL = process.env.FREELLMAPI_URL || 'https://freellmapi-production-2f58.up.railway.app'
const FREELLMAPI_KEY = process.env.FREELLMAPI_KEY

const ROUTER_SYSTEM = `You are a model routing agent. Pick the best AI model based on the user's message — including any explicit speed or quality hints they drop.

Available models:
- "auto" — casual chat, greetings, simple questions, general conversation
- "llama-3.1-8b-instant" — user wants SPEED: says "fast", "quick", "briefly", "tldr", "short answer", "be quick", "hurry", "asap", "instant reply", "just tell me", "one line", "keep it short"
- "deepseek/deepseek-v3.1:free" — code, debugging, scripts, APIs, JSON, CLI commands, technical writing, structured output
- "@cf/moonshotai/kimi-k2.6" — long text pasted in, summarization, research synthesis, reading documents, anything with a wall of text
- "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" — user wants DEEP THINKING: says "think carefully", "reason through", "step by step", "why", math, logic puzzles, planning, "best approach", "pros and cons"

Speed triggers (→ llama-3.1-8b-instant): fast, quick, briefly, tldr, short, hurry, asap, instant, one-liner, quick answer, be brief, keep it short, don't overthink
Reasoning triggers (→ deepseek-r1): think, reason, step by step, carefully, deeply, logic, math, plan, decide, compare, weigh, best option

Reply ONLY with valid JSON: {"model":"<id>","label":"<short display name>"}`

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
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    return NextResponse.json({ model: parsed.model || 'auto', label: parsed.label || null })
  } catch {
    return NextResponse.json({ model: 'auto', label: null })
  }
}
