import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { renderTemplate, resolveSubject } from '@/lib/tools/email-render'
import type { EmailAccount, EmailTemplate } from '@/lib/tools/email-render'

// Send one templated email. Access is gated by src/proxy.ts.
//
// Templates and accounts live in Supabase, and so does each account's Resend API
// key, so every sender uses its own Resend account. Looking the account up by
// `from_email` doubles as the allowed-sender check — an address that is not a
// row here cannot be sent from.
//
// This is the only place the stored key is ever read; the accounts route strips
// it from everything it returns.
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const { customerEmail, from, subject, templateId, ...fields } = await req.json()

    if (!customerEmail || !from || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: customerEmail, from, subject' },
        { status: 400 }
      )
    }

    const { data: account } = await db()
      .from('email_accounts')
      .select('*')
      .eq('from_email', from)
      .single<EmailAccount>()

    if (!account) {
      return NextResponse.json({ error: 'Sender address not allowed' }, { status: 403 })
    }

    const { data: template } = await db()
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single<EmailTemplate>()

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 400 })
    }

    const apiKey = account.resend_api_key?.trim()

    if (!apiKey) {
      return NextResponse.json(
        {
          error: `No Resend API key for "${account.name}". Add one under Manage → Accounts.`,
        },
        { status: 500 }
      )
    }

    const html = renderTemplate(template, fields, account)
    // Re-resolve the subject server-side as a safety net (the client already did).
    const finalSubject = resolveSubject(subject || template.subject, fields)

    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: `${account.name} <${from}>`,
      to: customerEmail,
      replyTo: account.reply_to || from,
      subject: finalSubject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message || 'Failed to send' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Send email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
