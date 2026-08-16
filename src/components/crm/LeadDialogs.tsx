'use client'

// Manual lead entry and CSV import.

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import {
  createLeadAction,
  importCsvAction,
  previewCsvAction,
  type CsvPreview,
  type ImportSummary,
} from '@/lib/crm/actions'

const inputClass =
  'w-full panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

const labelClass = 'block text-[12px] text-zinc-500 dark:text-zinc-400 mb-1'

/** The one green control on a dialog: the button that commits. */
const primaryClass =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-[#04210a] disabled:opacity-50 transition-opacity'

const ghostClass =
  'inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors'

function Shell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`panel w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.08] dark:bg-[#0e0e18] shadow-xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-base text-zinc-800 dark:text-white">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-colors"
            aria-label="Bezárás"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-700 dark:text-rose-300">
      {message}
    </p>
  )
}

// ─── New lead ────────────────────────────────────────────────────────────────

export function NewLeadDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    phone_secondary: '',
    phone_whatsapp: '',
    niche: '',
    source: '',
    next_action_at: '',
    notes: '',
    form_answers_raw: '',
  })

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit() {
    setError(null)
    start(async () => {
      const result = await createLeadAction({
        ...form,
        next_action_at: form.next_action_at ? new Date(form.next_action_at).toISOString() : '',
      })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.refresh()
      router.push(`/atrium-crm/${result.data.id}`)
    })
  }

  return (
    <Shell
      title="Új lead"
      subtitle="Minden lead új érdeklődőként indul."
      onClose={onClose}
      wide
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Cégnév</label>
            <input
              className={inputClass}
              value={form.company_name}
              onChange={(e) => set('company_name', e.target.value)}
              placeholder="Opcionális"
            />
          </div>
          <div>
            <label className={labelClass}>Kapcsolattartó</label>
            <input
              className={inputClass}
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>E-mail</label>
            <input
              className={inputClass}
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Telefon</label>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Másodlagos telefon</label>
            <input
              className={inputClass}
              value={form.phone_secondary}
              onChange={(e) => set('phone_secondary', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>WhatsApp</label>
            <input
              className={inputClass}
              value={form.phone_whatsapp}
              onChange={(e) => set('phone_whatsapp', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Niche</label>
            <input
              className={inputClass}
              value={form.niche}
              onChange={(e) => set('niche', e.target.value)}
              placeholder="kivitelezés, fogászat…"
            />
          </div>
          <div>
            <label className={labelClass}>Forrás</label>
            <input
              className={inputClass}
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Következő lépés</label>
          <input
            className={inputClass}
            type="datetime-local"
            value={form.next_action_at}
            onChange={(e) => set('next_action_at', e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Megjegyzés</label>
          <textarea
            className={`${inputClass} min-h-[70px] resize-y`}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>
            Űrlap válaszok — illessze be a Meta „Form answers” blokkot
          </label>
          <textarea
            className={`${inputClass} min-h-[110px] resize-y font-mono text-[12px]`}
            value={form.form_answers_raw}
            onChange={(e) => set('form_answers_raw', e.target.value)}
            placeholder={'Form answers\nLead form ID 1560776142415870\nSubmitted on…'}
          />
          <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
            A kérdések és válaszok szerkesztve jelennek meg a lead adatlapján.
          </p>
        </div>

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className={ghostClass}>Mégse</button>
          <button
            onClick={submit}
            disabled={pending}
            className={primaryClass}
            style={{ backgroundColor: '#6DBC61' }}
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Lead létrehozása
          </button>
        </div>
      </div>
    </Shell>
  )
}

// ─── CSV import ──────────────────────────────────────────────────────────────

export function CsvImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setPreview(null)
    setText(await file.text())
  }

  /** Step one: parse and show what will happen. Writes nothing. */
  function check() {
    setError(null)
    start(async () => {
      const result = await previewCsvAction(text)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setPreview(result.data)
    })
  }

  /** Step two: the confirmed write. */
  function submit() {
    setError(null)
    start(async () => {
      const result = await importCsvAction(text)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setSummary(result.data)
      router.refresh()
    })
  }

  if (summary) {
    return (
      <Shell title="Importálás kész" onClose={onClose}>
        <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-200">
          <p>
            <span className="font-mono text-base" style={{ color: '#6DBC61' }}>
              {summary.imported}
            </span>{' '}
            lead importálva {summary.totalRows} sorból.
          </p>
          {summary.skippedRows.length > 0 && (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              {summary.skippedRows.length} sor kimaradt, mert nem volt bennük név, e-mail és
              telefonszám sem. Sorok: {summary.skippedRows.slice(0, 20).join(', ')}
              {summary.skippedRows.length > 20 && '…'}
            </p>
          )}
          {summary.ignoredColumns.length > 0 && (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              Figyelmen kívül hagyott oszlopok: {summary.ignoredColumns.join(', ')}
            </p>
          )}
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            Minden importált lead új érdeklődőként indul. A Meta „Stage” oszlopa külön mezőbe
            került, nem befolyásolja a státuszt.
          </p>
          <div className="flex justify-end pt-1">
            <button
              onClick={onClose}
              className={primaryClass}
              style={{ backgroundColor: '#6DBC61' }}
            >
              Kész
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell
      title="CSV importálás"
      subtitle="Meta lead export: Created, Name, Email, Source, Form, Channel, Stage, Owner, Labels, Phone, Secondary phone number, WhatsApp number"
      onClose={onClose}
      wide
    >
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Fájl</label>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm text-zinc-600 dark:text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-200 dark:file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-sm file:text-zinc-800 dark:file:text-white"
          />
        </div>

        <div>
          <label className={labelClass}>vagy illessze be a tartalmát</label>
          <textarea
            className={`${inputClass} min-h-[160px] resize-y font-mono text-[12px]`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Created,Name,Email,Source,Form,Channel,Stage,Owner,Labels,Phone,…"
          />
        </div>

        {preview && (
          <div className="rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-zinc-500/5 dark:bg-white/[0.03] px-3 py-3 space-y-2">
            <p className="text-sm text-zinc-800 dark:text-zinc-100">
              <span className="font-mono" style={{ color: '#6DBC61' }}>{preview.willImport}</span>{' '}
              lead kerül be {preview.totalRows} sorból.
            </p>

            {preview.skippedRows.length > 0 && (
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                {preview.skippedRows.length} sor kimarad, mert nincs bennük név, e-mail és
                telefonszám sem.
              </p>
            )}
            {preview.ignoredColumns.length > 0 && (
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Nem felismert oszlopok: {preview.ignoredColumns.join(', ')}
              </p>
            )}

            <div className="pt-1">
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-1">Első sorok</p>
              <ul className="space-y-1">
                {preview.sample.map((r, i) => (
                  <li key={i} className="text-[13px] text-zinc-700 dark:text-zinc-200">
                    {r.title}
                    <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[12px]">
                      {r.email ? ` · ${r.email}` : ''}
                      {r.phone ? ` · ${r.phone}` : ''}
                    </span>
                    {r.stage && (
                      <span className="text-zinc-400 dark:text-zinc-500 text-[12px]">
                        {' '}· Meta szakasz: {r.stage}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 pt-1">
              Minden lead új érdeklődőként indul. A Meta „Stage” oszlopa külön mezőbe kerül, a
              státuszt nem befolyásolja.
            </p>
          </div>
        )}

        {error && <ErrorNote message={error} />}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className={ghostClass}>Mégse</button>
          {preview ? (
            <button
              onClick={submit}
              disabled={pending}
              className={primaryClass}
              style={{ backgroundColor: '#6DBC61' }}
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              {preview.willImport} lead importálása
            </button>
          ) : (
            <button
              onClick={check}
              disabled={pending || !text.trim()}
              className={primaryClass}
              style={{ backgroundColor: '#6DBC61' }}
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              Ellenőrzés
            </button>
          )}
        </div>
      </div>
    </Shell>
  )
}
