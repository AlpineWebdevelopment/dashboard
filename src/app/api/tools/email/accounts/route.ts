import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Sender "accounts" CRUD for /tools/emailsender. Access is gated by src/proxy.ts.
//
// Each account now carries its own Resend API key in `resend_api_key`, because
// the keys no longer live in the env of the old Vercel projects they came from.
// That makes this route the boundary that has to hold: the key is writable but
// never readable.
//
//   * GET strips `resend_api_key` and reports `has_resend_key` instead, so the
//     manager can show whether one is set without ever receiving it.
//   * POST/PUT accept it, but an absent or empty value means "leave alone" —
//     otherwise opening an account to fix a typo in its name and saving would
//     silently wipe the key. `resend_api_key: null` clears it deliberately.
//
// The stored key is the only source. There is no env fallback: the old
// RESEND_KEY_<REF> variables belonged to the Vercel projects these tools came
// from and do not exist here, so an account without a key simply cannot send.
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
  'position',
] as const

/** Keep only known columns from an arbitrary body. */
function pick(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const c of COLUMNS) if (c in body) out[c] = body[c]

  // The key is handled apart from the rest: '' and undefined both mean "no new
  // key was typed", which must not overwrite the stored one.
  const key = body.resend_api_key
  if (key === null) out.resend_api_key = null
  else if (typeof key === 'string' && key.trim()) out.resend_api_key = key.trim()

  return out
}

/** Swap the stored key for a boolean, on the way out to the browser. */
function redact(row: Record<string, unknown>) {
  const { resend_api_key, ...rest } = row
  return { ...rest, has_resend_key: !!resend_api_key }
}

export async function GET() {
  const { data, error } = await db()
    .from('email_accounts')
    .select('*')
    .order('position', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(redact))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db().from('email_accounts').insert(pick(body)).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(redact(data))
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
  return NextResponse.json(redact(data))
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await db().from('email_accounts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
