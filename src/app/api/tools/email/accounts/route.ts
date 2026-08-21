import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Sender "accounts" CRUD for /tools/emailsender. Access is gated by src/proxy.ts.
//
// `resend_key_ref` is only a slug — the real Resend key lives in the env var
// RESEND_KEY_<REF>, and is read server-side at send time. No secret is ever
// stored in this table or returned to the browser.
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const COLUMNS = [
  'name',
  'from_email',
  'reply_to',
  'color',
  'accent',
  'accent2',
  'logo_html',
  'resend_key_ref',
  'position',
] as const

/** Keep only known columns from an arbitrary body. */
function pick(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const c of COLUMNS) if (c in body) out[c] = body[c]
  return out
}

export async function GET() {
  const { data, error } = await db()
    .from('email_accounts')
    .select('*')
    .order('position', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db().from('email_accounts').insert(pick(body)).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { data, error } = await db()
    .from('email_accounts')
    .update(pick(rest))
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await db().from('email_accounts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
