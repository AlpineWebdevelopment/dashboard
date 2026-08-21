import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Saved chat templates for /tools/chat-recreator. Access is gated by src/proxy.ts,
// which covers everything outside its allowlist — no per-route auth check needed.
//
// `content` is the message array as stored: [{ sender, message, sources? }].
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** GET — list every saved template. */
export async function GET() {
  const { data, error } = await db()
    .from('chats')
    .select('id, label, content')
    .order('label', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/** POST — create a new template. */
export async function POST(req: NextRequest) {
  const { label, content } = await req.json()

  if (!label || !content) {
    return NextResponse.json({ error: 'label and content are required' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('chats')
    .insert({ label, content })
    .select('id, label, content')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** PUT — update an existing template. */
export async function PUT(req: NextRequest) {
  const { id, label, content } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (label !== undefined) updates.label = label
  if (content !== undefined) updates.content = content

  const { data, error } = await db()
    .from('chats')
    .update(updates)
    .eq('id', id)
    .select('id, label, content')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** DELETE — remove a template. */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await db().from('chats').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
