import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Email template CRUD for /tools/emailsender. Access is gated by src/proxy.ts.
//
// `fields` is a jsonb array of { key, label, type, placeholder?, default? };
// `body_html` is the inner content with {{key}} tokens. The brand wrapper is
// added at render time by lib/tools/email-render.
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const COLUMNS = ['name', 'icon', 'subject', 'fields', 'body_html', 'position'] as const

function pick(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const c of COLUMNS) if (c in body) out[c] = body[c]
  return out
}

export async function GET() {
  const { data, error } = await db()
    .from('email_templates')
    .select('*')
    .order('position', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db().from('email_templates').insert(pick(body)).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const payload = { ...pick(rest), updated_at: new Date().toISOString() }
  const { data, error } = await db()
    .from('email_templates')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await db().from('email_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
