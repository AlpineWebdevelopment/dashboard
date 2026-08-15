'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, BACKGROUNDS_BUCKET } from '@/lib/supabase'
import type { BackgroundSettings } from '@/lib/supabase'
import { saveBackgroundSettings } from '@/lib/actions'
import { useBackground } from './BackgroundProvider'
import { Image as ImageIcon, Loader2, Upload, X, Check, Trash2, Ban } from 'lucide-react'

const MAX_BYTES = 10 * 1024 * 1024

type StoredImage = { name: string; url: string }

function publicUrl(name: string) {
  return supabase!.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(name).data.publicUrl
}

export default function BackgroundPicker() {
  const { background, setBackground } = useBackground()
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<StoredImage[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const loadImages = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase.storage
      .from(BACKGROUNDS_BUCKET)
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    setLoading(false)
    if (error) {
      setError(`Could not read the bucket: ${error.message}`)
      return
    }
    setImages(
      (data ?? [])
        // Supabase seeds empty folders with a hidden placeholder row
        .filter((f) => f.name !== '.emptyFolderPlaceholder')
        .map((f) => ({ name: f.name, url: publicUrl(f.name) }))
    )
  }, [])

  function openPicker() {
    setOpen(true)
    setError('')
    loadImages()
  }

  // Persist to Supabase; sliders debounce so dragging doesn't spam the DB.
  const apply = useCallback((next: BackgroundSettings, debounceMs = 0) => {
    setBackground(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const run = () => {
      saveBackgroundSettings(next).catch((e: Error) => setError(`Could not save: ${e.message}`))
    }
    if (debounceMs) saveTimer.current = setTimeout(run, debounceMs)
    else run()
  }, [setBackground])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !supabase) return
    setError('')
    setUploading(true)
    const uploaded: StoredImage[] = []

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image`)
        continue
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 10 MB`)
        continue
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const name = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from(BACKGROUNDS_BUCKET)
        .upload(name, file, { cacheControl: '31536000', contentType: file.type })
      if (error) {
        setError(`Upload failed: ${error.message}`)
        continue
      }
      uploaded.push({ name, url: publicUrl(name) })
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (uploaded.length) {
      setImages((prev) => [...uploaded, ...prev])
      // Jump straight to the freshest upload
      apply({ ...background, url: uploaded[0].url })
    }
  }

  async function handleDelete(img: StoredImage) {
    if (!supabase) return
    setImages((prev) => prev.filter((i) => i.name !== img.name))
    if (background.url === img.url) apply({ ...background, url: null })
    const { error } = await supabase.storage.from(BACKGROUNDS_BUCKET).remove([img.name])
    if (error) {
      setError(`Delete failed: ${error.message}`)
      loadImages()
    }
  }

  return (
    <>
      <button
        onClick={openPicker}
        title="Change background"
        className="hidden dark:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] panel bg-white/[0.04] hover:bg-white/[0.08] text-[13px] font-medium text-zinc-500 hover:text-zinc-200 transition-all duration-150"
      >
        <ImageIcon size={11} />
        Background
      </button>

      {open && (
        <div className="hidden dark:flex fixed inset-0 z-50 items-center justify-center p-4">
          {/* Light backdrop so the background stays visible while you tune it */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />

          <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1 w-full shrink-0 bg-gradient-to-r from-indigo-500/60 via-sky-500/60 to-emerald-500/60" />

            <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center">
                  <ImageIcon size={15} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-tight">Background</h2>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-200">Applies across the whole dashboard</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
              {!supabase ? (
                <p className="py-10 text-center text-sm text-zinc-500">
                  Connect Supabase to upload backgrounds.
                </p>
              ) : (
                <>
                  {/* Upload */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl border border-dashed border-zinc-200 dark:border-white/[0.1] panel bg-zinc-50/60 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-indigo-500/30 text-[13px] font-medium text-zinc-500 dark:text-zinc-200 disabled:opacity-50 transition-all"
                  >
                    {uploading
                      ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
                      : <><Upload size={12} /> Upload image</>}
                  </button>

                  {error && (
                    <p className="mb-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[13px] text-rose-400">
                      {error}
                    </p>
                  )}

                  {/* Image grid */}
                  <label className="block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
                    Images
                  </label>
                  {loading ? (
                    <div className="flex items-center justify-center py-10 text-zinc-500">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {/* "None" tile */}
                      <button
                        onClick={() => apply({ ...background, url: null })}
                        className={`relative aspect-video rounded-xl border flex items-center justify-center transition-all ${
                          background.url === null
                            ? 'border-indigo-500/60 ring-2 ring-indigo-500/30 bg-indigo-500/[0.06]'
                            : 'border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] hover:border-zinc-300 dark:hover:border-white/[0.16]'
                        }`}
                      >
                        <Ban size={14} className="text-zinc-500 dark:text-zinc-200" />
                        <span className="absolute bottom-1 text-[11px] text-zinc-500 dark:text-zinc-200">None</span>
                      </button>

                      {images.map((img) => {
                        const selected = background.url === img.url
                        return (
                          <div key={img.name} className="relative group">
                            <button
                              onClick={() => apply({ ...background, url: img.url })}
                              style={{ backgroundImage: `url("${img.url}")` }}
                              className={`w-full aspect-video rounded-xl border bg-cover bg-center transition-all ${
                                selected
                                  ? 'border-indigo-500/60 ring-2 ring-indigo-500/40'
                                  : 'border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.2]'
                              }`}
                            />
                            {selected && (
                              <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shadow">
                                <Check size={10} className="text-white" strokeWidth={3} />
                              </div>
                            )}
                            <button
                              onClick={() => handleDelete(img)}
                              title="Delete image"
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/60 backdrop-blur-sm text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity dark:text-zinc-200"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!loading && images.length === 0 && (
                    <p className="mt-3 text-[13px] text-zinc-500 dark:text-zinc-200">
                      Nothing uploaded yet.
                    </p>
                  )}

                  {/* Sliders */}
                  <div className="mt-5 space-y-4">
                    <Slider
                      label="Dim"
                      value={Math.round(background.dim * 100)}
                      min={0}
                      max={95}
                      suffix="%"
                      onChange={(v) => apply({ ...background, dim: v / 100 }, 400)}
                    />
                    <Slider
                      label="Blur"
                      value={background.blur}
                      min={0}
                      max={24}
                      suffix="px"
                      onChange={(v) => apply({ ...background, blur: v }, 400)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end px-6 py-4 shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
          {label}
        </label>
        <span className="text-[13px] text-zinc-500 dark:text-zinc-200 tabular-nums">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-indigo-500 cursor-pointer"
      />
    </div>
  )
}
