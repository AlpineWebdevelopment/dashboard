'use client'

// The manager behind the "Manage" button on /tools/emailsender: CRUD for the
// sender accounts and the email templates, with a live preview of the template
// being edited.

import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Pencil, X, ArrowLeft } from 'lucide-react'
import {
  renderTemplate,
  type EmailAccount,
  type EmailField,
  type EmailTemplate,
} from '@/lib/tools/email-render'
import { Modal, btnGhost, btnPrimary, inputCls } from '@/components/tools/ui'
import CustomSelect, { type SelectOption } from '@/components/CustomSelect'

const ACCENT = 'amber' as const
const INPUT = inputCls(ACCENT, true)

/** Fetch JSON and surface the API's own error message. */
async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || 'Request failed')
  return data as T
}

const LABEL_CLS =
  'block text-[12px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-200 mb-1.5'

const FIELD_TYPES: SelectOption[] = [
  { value: 'text', label: 'text' },
  { value: 'textarea', label: 'textarea' },
]

/* ═══════════════════════════════════════════════════════════════════════════
   SHELL
   ═══════════════════════════════════════════════════════════════════════════ */

export default function EmailManager({
  templates,
  accounts,
  onClose,
  onChanged,
}: {
  templates: EmailTemplate[]
  accounts: EmailAccount[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [tab, setTab] = useState<'templates' | 'accounts'>('templates')

  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] px-5 py-3">
        {/* Segmented control: the container is the panel, the active pill is not. */}
        <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-white/[0.07] p-0.5">
          {(['templates', 'accounts'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-100'
                  : 'text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button onClick={onClose} className={`${btnGhost()} p-1.5 rounded-lg`} title="Close">
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'templates' ? (
          <TemplateManager templates={templates} accounts={accounts} onChanged={onChanged} />
        ) : (
          <AccountManager accounts={accounts} onChanged={onChanged} />
        )}
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEMPLATES
   ═══════════════════════════════════════════════════════════════════════════ */

type TemplateDraft = Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'> & { id?: string }

const BLANK_TEMPLATE: TemplateDraft = {
  name: '',
  icon: '✉',
  subject: '',
  fields: [],
  body_html: '',
  position: 0,
}

function TemplateManager({
  templates,
  accounts,
  onChanged,
}: {
  templates: EmailTemplate[]
  accounts: EmailAccount[]
  onChanged: () => Promise<void>
}) {
  /** null = the list; 'new' = creating; a template = editing that one. */
  const [editing, setEditing] = useState<null | 'new' | EmailTemplate>(null)
  const [draft, setDraft] = useState<TemplateDraft>(BLANK_TEMPLATE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const startNew = () => {
    setDraft({ ...BLANK_TEMPLATE, position: templates.length })
    setEditing('new')
    setError('')
  }
  const startEdit = (t: EmailTemplate) => {
    setDraft({ ...BLANK_TEMPLATE, ...t, fields: Array.isArray(t.fields) ? t.fields : [] })
    setEditing(t)
    setError('')
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const payload = {
        name: draft.name,
        icon: draft.icon,
        subject: draft.subject,
        fields: draft.fields,
        body_html: draft.body_html,
        position: draft.position ?? 0,
      }
      const isNew = editing === 'new'
      await api('/api/tools/email/templates', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? payload : { id: (editing as EmailTemplate).id, ...payload }),
      })
      await onChanged()
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (t: EmailTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return
    setBusy(true)
    try {
      await api('/api/tools/email/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      })
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const updateField = (i: number, patch: Partial<EmailField>) =>
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    }))
  const addField = () =>
    setDraft((d) => ({ ...d, fields: [...d.fields, { key: '', label: '', type: 'text' }] }))
  const removeField = (i: number) =>
    setDraft((d) => ({ ...d, fields: d.fields.filter((_, idx) => idx !== i) }))

  /** Drop a {{token}} in at the caret rather than always at the end. */
  const insertToken = (key: string) => {
    const token = `{{${key}}}`
    const el = bodyRef.current
    const val = draft.body_html || ''
    if (!el) {
      setDraft((d) => ({ ...d, body_html: val + token }))
      return
    }
    const start = el.selectionStart ?? val.length
    const end = el.selectionEnd ?? val.length
    setDraft((d) => ({ ...d, body_html: val.slice(0, start) + token + val.slice(end) }))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.selectionStart = el.selectionEnd = pos
    })
  }

  const sampleValues = useMemo(
    () => Object.fromEntries((draft.fields || []).map((f) => [f.key, f.label || f.key])),
    [draft.fields]
  )
  const previewHtml = useMemo(
    () => renderTemplate(draft, sampleValues, accounts[0]),
    [draft, sampleValues, accounts]
  )

  /* ── List ──────────────────────────────────────────────────────────────── */

  if (editing === null) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Templates</h2>
          <button
            onClick={startNew}
            className={`${btnPrimary(ACCENT, true)} px-3 py-1.5 text-[13px]`}
          >
            <Plus size={13} /> New template
          </button>
        </div>
        {error && <p className="px-5 pb-2 text-[13px] text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex-1 overflow-auto px-5 pb-5">
          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg leading-none">{t.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-800 dark:text-white truncate">
                      {t.name}
                    </p>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
                      {(t.fields || []).length} field
                      {(t.fields || []).length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(t)}
                    className={`${btnGhost()} p-2 rounded-lg`}
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => remove(t)}
                    disabled={busy}
                    className="rounded-lg p-2 text-zinc-500 dark:text-zinc-200 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="py-10 text-center text-[13px] text-zinc-500 dark:text-zinc-200">
                No templates yet.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ── Editor ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/[0.06] px-5 py-2.5">
        <button onClick={() => setEditing(null)} className={`${btnGhost()} px-2 py-1 text-[13px]`}>
          <ArrowLeft size={12} />
          Back
        </button>
        <div className="flex items-center gap-2">
          {error && <span className="text-[13px] text-red-600 dark:text-red-400">{error}</span>}
          <button
            onClick={save}
            disabled={busy || !draft.name}
            className={`${btnPrimary(ACCENT, true)} px-4 py-1.5 text-[13px]`}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Form */}
        <div className="flex flex-col gap-4 overflow-auto p-5 border-zinc-200 dark:border-white/[0.06] lg:border-r">
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <div>
              <span className={LABEL_CLS}>Icon</span>
              <input
                value={draft.icon || ''}
                onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                className={`${INPUT} text-center`}
              />
            </div>
            <div>
              <span className={LABEL_CLS}>Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Template name"
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <span className={LABEL_CLS}>Subject</span>
            <input
              value={draft.subject || ''}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              placeholder="Supports {{placeholders}}"
              className={INPUT}
            />
          </div>

          {/* Fields editor */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={`${LABEL_CLS} mb-0`}>Custom fields</span>
              <button
                onClick={addField}
                className="flex items-center gap-1 text-[13px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {(draft.fields || []).map((f, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-white/[0.06] p-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={f.key}
                    onChange={(e) => updateField(i, { key: e.target.value })}
                    placeholder="key"
                    className={`${INPUT} min-w-0`}
                  />
                  <input
                    value={f.label ?? ''}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder="Label"
                    className={`${INPUT} min-w-0`}
                  />
                  <input
                    value={f.placeholder || ''}
                    onChange={(e) => updateField(i, { placeholder: e.target.value })}
                    placeholder="Hint text (optional)"
                    className={`${INPUT} min-w-0`}
                  />
                  <input
                    value={f.default || ''}
                    onChange={(e) => updateField(i, { default: e.target.value })}
                    placeholder="Default value (optional)"
                    className={`${INPUT} min-w-0`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <CustomSelect
                    value={f.type || 'text'}
                    onChange={(v) => updateField(i, { type: v as EmailField['type'] })}
                    options={FIELD_TYPES}
                    className="w-32 shrink-0"
                    triggerClassName={INPUT}
                    ariaLabel="Field type"
                  />
                  <div className="flex-1" />
                  <button
                    onClick={() => removeField(i)}
                    className="shrink-0 rounded-lg p-2 text-zinc-500 dark:text-zinc-200 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Remove field"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Body HTML */}
          <div>
            <span className={LABEL_CLS}>Body (HTML)</span>
            {(draft.fields || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {draft.fields.map(
                  (f) =>
                    f.key && (
                      <button
                        key={f.key}
                        onClick={() => insertToken(f.key)}
                        className="rounded-md border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/70 dark:bg-white/[0.04] px-2 py-0.5 text-[12px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      >
                        {`{{${f.key}}}`}
                      </button>
                    )
                )}
              </div>
            )}
            <textarea
              ref={bodyRef}
              value={draft.body_html || ''}
              onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))}
              rows={12}
              placeholder="<h1>Hi {{customerName}}</h1>"
              className={`${INPUT} resize-none font-mono leading-relaxed`}
            />
            <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-200">
              The brand wrapper (logo, colours, signature) is added automatically.
            </p>
          </div>
        </div>

        {/* Live preview */}
        <div className="hidden min-h-0 flex-col gap-2 p-5 lg:flex">
          <span className={`${LABEL_CLS} mb-0`}>
            Live preview {accounts[0] ? `· ${accounts[0].name}` : ''}
          </span>
          {/* `email-preview` kills the inherited wallpaper text-shadow — same
              reason as the compose screen's preview. */}
          <div className="email-preview flex-1 overflow-auto rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-100">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCOUNTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * `resend_api_key` is write-only: GET reports `has_resend_key` and never the key
 * itself, so the field always starts blank when editing an existing account and
 * a blank field means "leave the stored one alone".
 */
type AccountDraft = Omit<EmailAccount, 'id' | 'created_at'> & { id?: string }

const BLANK_ACCOUNT: AccountDraft = {
  name: '',
  from_email: '',
  reply_to: '',
  color: '#0ea5e9',
  accent: 'linear-gradient(90deg,#0b2c6d,#0ea5e9)',
  accent2: 'linear-gradient(90deg,#0ea5e9,#0b2c6d)',
  logo_html: '',
  resend_api_key: '',
  position: 0,
}

const ACCOUNT_FIELDS: { key: keyof AccountDraft; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'from_email', label: 'From email' },
  { key: 'reply_to', label: 'Reply-to' },
  { key: 'color', label: 'Dot colour' },
  { key: 'accent', label: 'Footer gradient (accent)' },
  { key: 'accent2', label: 'Top bar gradient (accent2)' },
]

function AccountManager({
  accounts,
  onChanged,
}: {
  accounts: EmailAccount[]
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState<null | 'new' | EmailAccount>(null)
  const [draft, setDraft] = useState<AccountDraft>(BLANK_ACCOUNT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const startNew = () => {
    setDraft({ ...BLANK_ACCOUNT, position: accounts.length })
    setEditing('new')
    setError('')
  }
  const startEdit = (a: EmailAccount) => {
    // `...a` cannot contain a key — the API strips it — but spell the blank out
    // so that stays true if the response shape ever changes.
    setDraft({ ...BLANK_ACCOUNT, ...a, resend_api_key: '' })
    setEditing(a)
    setError('')
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const typedKey = (draft.resend_api_key || '').trim()
      const payload = {
        name: draft.name,
        from_email: draft.from_email,
        reply_to: draft.reply_to || null,
        color: draft.color,
        accent: draft.accent,
        accent2: draft.accent2,
        logo_html: draft.logo_html,
        position: draft.position ?? 0,
        // Omitted when the field was left blank, which the route reads as
        // "keep the stored key".
        ...(typedKey ? { resend_api_key: typedKey } : {}),
      }
      const isNew = editing === 'new'
      await api('/api/tools/email/accounts', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? payload : { id: (editing as EmailAccount).id, ...payload }),
      })
      await onChanged()
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a: EmailAccount) => {
    if (!window.confirm(`Delete account "${a.name}"?`)) return
    setBusy(true)
    try {
      await api('/api/tools/email/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id }),
      })
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  if (editing === null) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Accounts</h2>
          <button
            onClick={startNew}
            className={`${btnPrimary(ACCENT, true)} px-3 py-1.5 text-[13px]`}
          >
            <Plus size={13} /> New account
          </button>
        </div>
        {error && <p className="px-5 pb-2 text-[13px] text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex-1 overflow-auto px-5 pb-5">
          <div className="flex flex-col gap-2">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: a.color ?? '#71717a' }}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-800 dark:text-white truncate">
                      {a.name}
                    </p>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-200 truncate">
                      {a.from_email}
                    </p>
                  </div>
                  {!a.has_resend_key && (
                    <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                      No key
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(a)}
                    className={`${btnGhost()} p-2 rounded-lg`}
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => remove(a)}
                    disabled={busy}
                    className="rounded-lg p-2 text-zinc-500 dark:text-zinc-200 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="py-10 text-center text-[13px] text-zinc-500 dark:text-zinc-200">
                No accounts yet.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Whether the row already has a key — the API sends this flag in place of the
  // key. A brand-new account has neither.
  const keyStored = editing !== 'new' && !!(editing as EmailAccount).has_resend_key

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/[0.06] px-5 py-2.5">
        <button onClick={() => setEditing(null)} className={`${btnGhost()} px-2 py-1 text-[13px]`}>
          <ArrowLeft size={12} />
          Back
        </button>
        <div className="flex items-center gap-2">
          {error && <span className="text-[13px] text-red-600 dark:text-red-400">{error}</span>}
          <button
            onClick={save}
            disabled={busy || !draft.name || !draft.from_email}
            className={`${btnPrimary(ACCENT, true)} px-4 py-1.5 text-[13px]`}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="mx-auto flex max-w-lg flex-col gap-4">
          {ACCOUNT_FIELDS.map((f) => (
            <div key={String(f.key)}>
              <span className={LABEL_CLS}>{f.label}</span>
              <input
                value={(draft[f.key] as string) || ''}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                className={INPUT}
              />
            </div>
          ))}
          <div>
            <span className={LABEL_CLS}>Logo HTML</span>
            <textarea
              value={draft.logo_html || ''}
              onChange={(e) => setDraft((d) => ({ ...d, logo_html: e.target.value }))}
              rows={4}
              placeholder='<img src="…" width="128" />'
              className={`${INPUT} resize-none font-mono`}
            />
          </div>

          <div>
            <span className={LABEL_CLS}>Resend API key</span>
            <input
              type="password"
              autoComplete="off"
              value={draft.resend_api_key || ''}
              onChange={(e) => setDraft((d) => ({ ...d, resend_api_key: e.target.value }))}
              placeholder={keyStored ? '•••••••••••••• — stored, type to replace' : 're_…'}
              className={`${INPUT} font-mono`}
            />
            <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-zinc-200 leading-relaxed">
              {keyStored
                ? 'A key is stored for this account. Leave this blank to keep it.'
                : 'No key stored yet — this account cannot send until one is set.'}{' '}
              Kept in the database and only ever read by the send route; it is never
              sent back to the browser. There is no environment-variable fallback.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
