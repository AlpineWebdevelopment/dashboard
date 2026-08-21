// Shared, pure email renderer.
//
// Templates are DATA (a `body_html` string with {{placeholder}} tokens) rather
// than per-template render functions. The account-dependent chrome (logo, brand
// colours, signature bar) lives here in code because it is not user-editable
// content. Imported by BOTH the compose preview (client) and the send API
// (server). Contains NO secrets — safe to run on the client.

export type EmailField = {
  key: string
  label?: string
  type?: 'text' | 'textarea'
  placeholder?: string
  default?: string
}

export type EmailTemplate = {
  id: string
  name: string
  icon: string | null
  subject: string
  fields: EmailField[]
  body_html: string
  position: number
  created_at?: string
  updated_at?: string
}

export type EmailAccount = {
  id: string
  name: string
  from_email: string
  reply_to: string | null
  color: string | null
  accent: string | null
  accent2: string | null
  logo_html: string | null
  /** Slug only — the real key is env RESEND_KEY_<REF>. Never the key itself. */
  resend_key_ref: string | null
  position: number
  created_at?: string
}

export type FieldValues = Record<string, string>

/**
 * Replace every {{key}} in `str` with values[key] (missing → ""). Plain string
 * substitution, never eval.
 */
export function substitute(str: string | null | undefined, values: FieldValues = {}): string {
  if (!str) return ''
  return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = values[key]
    return v == null ? '' : String(v)
  })
}

/** Resolve {{placeholders}} in a subject line. */
export function resolveSubject(subject: string | null | undefined, values: FieldValues = {}): string {
  return substitute(subject || '', values)
}

/**
 * Brand chrome wrapped around every email. `account` supplies logo_html /
 * accent / accent2 (all non-secret). The signature bar shows `agent`.
 */
export function wrapper(
  account: Partial<EmailAccount> | null | undefined,
  content: string,
  agent?: string
): string {
  const a = account || {}
  const accent = a.accent || 'linear-gradient(90deg,#0b2c6d,#0ea5e9)'
  const accent2 = a.accent2 || 'linear-gradient(90deg,#0ea5e9,#0b2c6d)'
  const logo = a.logo_html || ''
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f5;padding:40px 0">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <div style="height:4px;background:${accent2}"></div>
      <div style="text-align:center;">
        ${logo}
      </div>
      <div style="padding:36px 40px">${content}</div>
      <div style="background:${accent};color: #fff;padding:16px 40px">
        <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-style:italic;font-size:15px;font-weight:400;line-height:1.5;margin:0 0 4px 0;">
          Üdvözlettel:
        </p>
        <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-style:italic;font-size:17px;font-weight:600;line-height:1.5;;margin:0;">
          ${agent || 'Signature here...'}
        </p>
      </div>
    </div>
  </div>`
}

/** Render a full email: substitute the template body, then wrap in brand chrome. */
export function renderTemplate(
  template: Pick<EmailTemplate, 'body_html'> | null | undefined,
  values: FieldValues = {},
  account?: Partial<EmailAccount> | null
): string {
  const inner = substitute(template?.body_html || '', values)
  return wrapper(account, inner, values.agent)
}
