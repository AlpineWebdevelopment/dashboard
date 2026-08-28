'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Send, Settings2 } from 'lucide-react'
import {
  renderTemplate,
  resolveSubject,
  type EmailAccount,
  type EmailTemplate,
  type FieldValues,
} from '@/lib/tools/email-render'
import { toolByKey } from '@/lib/tools/registry'
import EmailManager from '@/components/tools/EmailManager'
import CustomSelect, { type SelectOption } from '@/components/CustomSelect'
import {
  SHELL_CLS,
  ToolHeader,
  btnPrimary,
  btnSecondary,
  inputSunkenCls,
} from '@/components/tools/ui'

const TOOL = toolByKey('emailsender')!
const ACCENT = TOOL.accent
// The compose column sits on an opaque shell, so its fields are wells cut into
// it rather than frosted lifts off the page — see inputSunkenCls.
const INPUT = inputSunkenCls(ACCENT)

const LABEL_CLS =
  'block text-[12px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-200 mb-1.5'

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || 'Request failed')
  return data as T
}

/**
 * Initial form values for a template: every field carrying a `default`. Module
 * scope so `loadData`'s empty dep list can't close over a stale copy.
 */
function seedDefaults(template?: EmailTemplate): FieldValues {
  return Object.fromEntries(
    (template?.fields || []).filter((f) => f.default).map((f) => [f.key, f.default as string])
  )
}

/* ── Small form primitives ────────────────────────────────────────────────── */

/**
 * The app-wide dropdown, wearing the compose column's sunken field as its
 * trigger so it sits level with the text fields beside it instead of lifting
 * off the shell the way the default trigger would.
 */
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
}) {
  return (
    <div>
      <span className={LABEL_CLS}>{label}</span>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        triggerClassName={INPUT}
        ariaLabel={label}
        // Both of these sit in a half-width column, and a template label is a
        // user-typed icon plus a user-typed name. Left to size itself, the open
        // list ran far wider than the field it came from.
        menuMaxWidth={280}
      />
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  rows,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  rows?: number
}) {
  return (
    <div>
      {label && <span className={LABEL_CLS}>{label}</span>}
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`${INPUT} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={INPUT}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function EmailSenderPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [fieldValues, setFieldValues] = useState<FieldValues>({})
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showManager, setShowManager] = useState(false)
  /** Reloading from the manager must not stomp the template you had selected. */
  const firstLoad = useRef(true)

  // A promise chain rather than async/await on purpose: every setState then sits
  // in a callback, which is what keeps the mount effect below off the
  // cascading-render path.
  const loadData = useCallback(
    () =>
      Promise.all([
        api<EmailAccount[]>('/api/tools/email/accounts'),
        api<EmailTemplate[]>('/api/tools/email/templates'),
      ])
        .then(([acc, tpl]) => {
          setAccounts(acc || [])
          setTemplates(tpl || [])
          setSelectedAccount((cur) => cur ?? acc?.[0]?.id ?? null)
          setSelectedTemplate((cur) => cur ?? tpl?.[0]?.id ?? null)
          // The first load auto-picks a template without going through
          // handleTemplateChange, so seed that template's defaults here too.
          if (firstLoad.current) {
            firstLoad.current = false
            setFieldValues(seedDefaults(tpl?.[0]))
          }
          setLoadError('')
        })
        .catch((e: unknown) =>
          setLoadError(e instanceof Error ? e.message : 'Failed to load')
        )
        .finally(() => setLoading(false)),
    []
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  const account = accounts.find((a) => a.id === selectedAccount) || null
  const template = templates.find((t) => t.id === selectedTemplate) || null

  const setField = useCallback((key: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: val }))
  }, [])

  const resolvedSubject = useMemo(
    () => resolveSubject(subject || template?.subject || '', fieldValues),
    [subject, template, fieldValues]
  )

  const previewHtml = useMemo(
    () => (template ? renderTemplate(template, fieldValues, account) : ''),
    [template, fieldValues, account]
  )

  const handleSend = async () => {
    if (!recipientEmail || !template || !account) return
    setSendState('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/tools/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: recipientEmail,
          from: account.from_email,
          subject: resolvedSubject,
          templateId: template.id,
          ...fieldValues,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setSendState('sent')
      setTimeout(() => setSendState('idle'), 10_000)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Send failed')
      setSendState('idle')
    }
  }

  // Switching templates clears the form, then seeds any field defaults so values
  // that are constant across a campaign (sender name, prices) aren't retyped.
  const handleTemplateChange = (id: string) => {
    setSelectedTemplate(id)
    setFieldValues(seedDefaults(templates.find((x) => x.id === id)))
    setSubject('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      <div className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-8">
        <ToolHeader
          tool={TOOL}
          compact
          actions={
            <button
              onClick={() => setShowManager(true)}
              className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}
            >
              <Settings2 size={13} />
              Manage
            </button>
          }
        />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-zinc-500 dark:text-zinc-200">
          Loading…
        </div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-[13px] text-red-600 dark:text-red-400">{loadError}</p>
          <button onClick={loadData} className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}>
            Retry
          </button>
        </div>
      ) : accounts.length === 0 || templates.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
            No {accounts.length === 0 ? 'sender accounts' : 'templates'} yet.
          </p>
          <button
            onClick={() => setShowManager(true)}
            className={`${btnPrimary(ACCENT)} px-4 py-2 text-[13px]`}
          >
            Open manager
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 sm:px-8 pb-6 lg:flex-row">
          {/* ── Compose ── */}
          {/* One ground for the whole column. The field labels are 12px
              uppercase and do not survive a wallpaper on their own. */}
          <div
            className={`${SHELL_CLS} flex w-full flex-col gap-4 overflow-y-auto p-4 lg:w-[26rem] lg:shrink-0`}
          >
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Send from"
                value={selectedAccount || ''}
                onChange={(v) => setSelectedAccount(v)}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              />
              <Select
                label="Template"
                value={selectedTemplate || ''}
                onChange={(v) => handleTemplateChange(v)}
                options={templates.map((t) => ({
                  value: t.id,
                  label: t.icon ? `${t.icon} ${t.name}` : t.name,
                }))}
              />
            </div>

            {account && (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-white/[0.09] bg-white dark:bg-black/35 px-3 py-2">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: account.color ?? '#71717a' }}
                />
                <span className="text-[13px] font-medium text-zinc-800 dark:text-white truncate">
                  {account.from_email}
                </span>
              </div>
            )}

            <Field
              label="Recipient"
              value={recipientEmail}
              onChange={setRecipientEmail}
              placeholder="customer@example.com"
              type="email"
            />
            <Field
              label="Subject"
              value={subject || template?.subject || ''}
              onChange={setSubject}
              placeholder="Email subject…"
            />

            {(template?.fields || []).map((f) => (
              <Field
                key={`${template!.id}-${f.key}`}
                label={f.label || f.key}
                value={fieldValues[f.key] || ''}
                onChange={(v) => setField(f.key, v)}
                placeholder={f.placeholder || f.label || f.key}
                rows={f.type === 'textarea' ? 4 : undefined}
              />
            ))}

            <div className="mt-auto flex flex-col gap-3 pt-2">
              {errorMsg && (
                <p className="text-center text-[13px] text-red-600 dark:text-red-400">
                  {errorMsg}
                </p>
              )}
              <button
                onClick={handleSend}
                disabled={!recipientEmail || sendState === 'sending'}
                className={`${
                  sendState === 'sent'
                    ? `${btnSecondary(true)} !text-emerald-600 dark:!text-emerald-400`
                    : btnPrimary(ACCENT, true)
                } py-3 text-sm font-semibold ${sendState === 'sending' ? 'cursor-wait' : ''}`}
              >
                {sendState === 'sent' ? (
                  <>
                    Sent <Check size={15} />
                  </>
                ) : sendState === 'sending' ? (
                  'Sending…'
                ) : (
                  <>
                    Send email <Send size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Preview ── */}
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <span className={`${LABEL_CLS} mb-0`}>Live preview</span>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden panel rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-white/[0.06] px-4 py-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-white/25" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-300/70 dark:bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-300/50 dark:bg-white/10" />
                <span className="ml-3 flex-1 truncate text-center text-[13px] text-zinc-500 dark:text-zinc-200">
                  {resolvedSubject || 'Email preview'} — to: {recipientEmail || '…'}
                </span>
              </div>
              {/* The email itself is light-mode HTML by construction, so the
                  scroller keeps a light ground in both themes — and opts out of
                  the wallpaper text-shadow, which would otherwise inherit in and
                  make the preview lie about how the mail will look. */}
              <div className="email-preview flex-1 overflow-auto bg-zinc-100">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {showManager && (
        <EmailManager
          templates={templates}
          accounts={accounts}
          onClose={() => setShowManager(false)}
          onChanged={loadData}
        />
      )}
    </div>
  )
}
