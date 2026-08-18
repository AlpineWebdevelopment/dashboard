'use client'

import { useMemo, useState, useTransition } from 'react'
import { ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react'
import BrandMark, { hasBrandMark } from './BrandMark'
import CustomSelect from './CustomSelect'
import {
  colorFor,
  groupByService,
  presetFor,
  SECTIONS,
  SERVICE_PRESETS,
  type LoginLink,
} from '@/lib/login-hub'
import { createLoginLink, deleteLoginLink, updateLoginLink } from '@/lib/actions'

const INPUT_CLS =
  'w-full panel bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.07] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-rose-500/50 transition-colors'

const CUSTOM = '__custom__'

type Draft = {
  section: string
  service: string
  customService: string
  label: string
  url: string
  hint: string
}

const emptyDraft = (section: string): Draft => ({
  section,
  service: SERVICE_PRESETS[0].name,
  customService: '',
  label: '',
  url: '',
  hint: '',
})

function draftFrom(link: LoginLink): Draft {
  const known = presetFor(link.service)
  return {
    section: link.section,
    service: known ? known.name : CUSTOM,
    customService: known ? '' : link.service,
    label: link.label,
    url: link.url,
    hint: link.hint ?? '',
  }
}

export default function LoginHub({
  initialLinks,
  loadError,
}: {
  initialLinks: LoginLink[]
  loadError?: string
}) {
  const [links, setLinks] = useState(initialLinks)
  const [draft, setDraft] = useState<Draft | null>(null)
  /** id of the link being edited; null while adding a new one. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const bySection = useMemo(
    () => SECTIONS.map((s) => ({ ...s, groups: groupByService(links.filter((l) => l.section === s.key)) })),
    [links]
  )

  function openAdd(section: string) {
    setEditingId(null)
    setError(null)
    setDraft(emptyDraft(section))
  }

  function openEdit(link: LoginLink) {
    setEditingId(link.id)
    setError(null)
    setDraft(draftFrom(link))
  }

  function close() {
    setDraft(null)
    setEditingId(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return

    const service = (draft.service === CUSTOM ? draft.customService : draft.service).trim()
    const label = draft.label.trim()
    let url = draft.url.trim()
    if (!label || !url || !service) return
    // A link typed without a scheme would resolve against this app's own origin.
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`

    const payload = {
      section: draft.section,
      service,
      brand: presetFor(service)?.brand ?? '',
      label,
      url,
      hint: draft.hint.trim() || null,
    }

    const id = editingId
    if (id) {
      const before = links
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...payload } : l)))
      close()
      startTransition(async () => {
        const res = await updateLoginLink(id, payload)
        if (res?.error) {
          setLinks(before)
          setError(res.error)
        }
      })
      return
    }

    close()
    startTransition(async () => {
      const res = await createLoginLink(payload)
      if (res?.error) setError(res.error)
      else if (res?.link) setLinks((prev) => [...prev, res.link!])
    })
  }

  function remove(link: LoginLink) {
    if (!confirm(`Remove "${link.label}" from the hub?`)) return
    const before = links
    setLinks((prev) => prev.filter((l) => l.id !== link.id))
    startTransition(async () => {
      const res = await deleteLoginLink(link.id)
      if (res?.error) {
        setLinks(before)
        setError(res.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {loadError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Links couldn&apos;t be loaded</p>
          <p className="text-[13px] text-amber-700/80 dark:text-amber-200/80 mt-1">{loadError}</p>
          <p className="text-[13px] text-amber-700/80 dark:text-amber-200/80 mt-1">
            If the table is missing, run <code className="font-mono">supabase-login-links.sql</code> in this
            project&apos;s Supabase SQL editor — and check it&apos;s the dashboard&apos;s project, not another one.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <p className="flex-1 text-[13px] text-rose-700 dark:text-rose-300">{error}</p>
          <button onClick={() => setError(null)} className="text-rose-600 dark:text-rose-300 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {bySection.map((section) => (
        <section key={section.key}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-500/15 text-rose-500 dark:text-rose-400 text-sm font-semibold">
              {section.name}
            </span>
            <span className="text-[12px] text-zinc-400 dark:text-zinc-400">
              {section.groups.reduce((n, g) => n + g.items.length, 0)}
            </span>
            <button
              onClick={() => openAdd(section.key)}
              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13px] font-medium border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all"
            >
              <Plus size={13} /> Add link
            </button>
          </div>

          {section.groups.length === 0 ? (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-300 px-1">
              Nothing here yet — add your first link.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {section.groups.map((group) => {
                const brand = presetFor(group.service)?.brand ?? ''
                return (
                  <div key={group.service}>
                    <div className="flex items-center gap-2 mb-2">
                      <BrandMark
                        brand={brand}
                        name={group.service}
                        size={16}
                        className={hasBrandMark(brand) ? '' : colorFor(group.service)}
                      />
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{group.service}</h2>
                    </div>

                    <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
                      {group.items.map((link) => (
                        <div
                          key={link.id}
                          className="group relative flex items-center gap-3 panel bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.07] rounded-xl px-3.5 py-3 hover:border-zinc-300 dark:hover:border-white/[0.14] transition-all"
                        >
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 flex-1 min-w-0"
                          >
                            <BrandMark
                              brand={link.brand}
                              name={link.service || link.label}
                              size={26}
                              className={hasBrandMark(link.brand) ? '' : colorFor(link.service)}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm text-zinc-800 dark:text-zinc-100 truncate">
                                {link.label}
                              </span>
                              {link.hint && (
                                <span className="block text-[12px] text-zinc-500 dark:text-zinc-300 truncate">
                                  {link.hint}
                                </span>
                              )}
                            </span>
                            <ExternalLink
                              size={13}
                              className="shrink-0 text-zinc-300 dark:text-zinc-500 group-hover:opacity-0 transition-opacity"
                            />
                          </a>

                          {/* Sits over the arrow so the card stays one big target */}
                          <div className="absolute right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-[#15151d] rounded-lg">
                            <button
                              onClick={() => openEdit(link)}
                              title="Edit"
                              className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => remove(link)}
                              title="Remove"
                              className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ))}

      {/* Add / edit dialog */}
      {draft && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#17171f] shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {editingId ? 'Edit link' : 'Add link'}
              </h3>
              <button onClick={close} className="text-zinc-400 dark:text-zinc-300 hover:text-zinc-700 dark:hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5">
                    Section
                  </label>
                  <CustomSelect
                    value={draft.section}
                    onChange={(v) => setDraft((d) => d && { ...d, section: v })}
                    options={SECTIONS.map((s) => ({ value: s.key, label: s.name }))}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5">
                    Service
                  </label>
                  <CustomSelect
                    value={draft.service}
                    onChange={(v) => setDraft((d) => d && { ...d, service: v })}
                    options={[
                      ...SERVICE_PRESETS.map((p) => ({ value: p.name, label: p.name })),
                      { value: CUSTOM, label: 'Other…' },
                    ]}
                  />
                </div>
              </div>

              {draft.service === CUSTOM && (
                <input
                  autoFocus
                  value={draft.customService}
                  onChange={(e) => setDraft((d) => d && { ...d, customService: e.target.value })}
                  placeholder="Service name (e.g. Notion)"
                  className={INPUT_CLS}
                />
              )}

              <div>
                <label className="block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5">
                  Name
                </label>
                <input
                  required
                  autoFocus={draft.service !== CUSTOM}
                  value={draft.label}
                  onChange={(e) => setDraft((d) => d && { ...d, label: e.target.value })}
                  placeholder="Work account"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5">
                  Link
                </label>
                <input
                  required
                  value={draft.url}
                  onChange={(e) => setDraft((d) => d && { ...d, url: e.target.value })}
                  placeholder="https://mail.google.com/mail/u/1/"
                  className={`${INPUT_CLS} font-mono text-[13px]`}
                />
                <p className="text-[12px] text-zinc-400 dark:text-zinc-400 mt-1">
                  Paste the URL while signed into that account — Google numbers them <code className="font-mono">/u/0</code>,{' '}
                  <code className="font-mono">/u/1</code>, and so on.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5">
                  Note <span className="normal-case tracking-normal font-normal text-zinc-400">optional</span>
                </label>
                <input
                  value={draft.hint}
                  onChange={(e) => setDraft((d) => d && { ...d, hint: e.target.value })}
                  placeholder="you@company.com"
                  className={INPUT_CLS}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-rose-500 hover:bg-rose-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  {editingId ? 'Save' : 'Add link'}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="px-4 rounded-lg text-sm text-zinc-600 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
