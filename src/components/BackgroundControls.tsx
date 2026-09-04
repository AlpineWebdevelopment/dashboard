'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, BACKGROUNDS_BUCKET, backgroundUrl } from '@/lib/supabase'
import { BLUR_MAX, DIM_MAX } from '@/lib/prefs'
import { useBackground } from './BackgroundProvider'
import { Loader2, Upload, Check, Trash2, Ban } from 'lucide-react'

const MAX_BYTES = 10 * 1024 * 1024

type StoredImage = { name: string; url: string }

/** Reads the bucket. Kept free of state so the effect below only has to attach
 *  a continuation — no setState runs synchronously when it mounts. */
async function listBackgrounds(): Promise<{ images: StoredImage[]; error?: string }> {
  if (!supabase) return { images: [] }
  const { data, error } = await supabase.storage
    .from(BACKGROUNDS_BUCKET)
    .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) return { images: [], error: `Could not read the bucket: ${error.message}` }
  return {
    images: (data ?? [])
      // Supabase seeds empty folders with a hidden placeholder row
      .filter((f) => f.name !== '.emptyFolderPlaceholder')
      .map((f) => ({ name: f.name, url: backgroundUrl(f.name) })),
  }
}

/**
 * Picking, uploading and tuning the wallpaper. Shared by the quick-access modal
 * on the overview page and the Background section of the settings page, so the
 * two can never drift apart.
 *
 * Images come from the Supabase storage bucket; *which* one is chosen, and how
 * it's dimmed and blurred, is a per-browser cookie written by BackgroundProvider.
 */
export default function BackgroundControls() {
  const { background, setBackground } = useBackground()
  const [images, setImages] = useState<StoredImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(() => {
    listBackgrounds().then(({ images, error }) => {
      setLoading(false)
      // Don't wipe an upload/delete message the refresh wasn't about
      if (error) setError(error)
      else setImages(images)
    })
  }, [])

  useEffect(refresh, [refresh])

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
      uploaded.push({ name, url: backgroundUrl(name) })
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (uploaded.length) {
      setImages((prev) => [...uploaded, ...prev])
      // Jump straight to the freshest upload
      setBackground({ ...background, url: uploaded[0].url })
    }
  }

  async function handleDelete(img: StoredImage) {
    if (!supabase) return
    setImages((prev) => prev.filter((i) => i.name !== img.name))
    if (background.url === img.url) setBackground({ ...background, url: null })
    const { error } = await supabase.storage.from(BACKGROUNDS_BUCKET).remove([img.name])
    if (error) {
      setError(`Delete failed: ${error.message}`)
      refresh()
    }
  }

  if (!supabase) {
    return (
      <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-200">
        Connect Supabase to upload backgrounds.
      </p>
    )
  }

  return (
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
        <div className="flex items-center justify-center py-10 text-zinc-500 dark:text-zinc-200">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* "None" tile — also the default before anything is picked */}
          <button
            onClick={() => setBackground({ ...background, url: null })}
            className={`relative aspect-video rounded-xl border flex items-center justify-center transition-all ${
              background.url === null
                ? 'border-indigo-500/60 ring-2 ring-indigo-500/30 bg-indigo-500/[0.06]'
                : 'border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] hover:border-zinc-300 dark:hover:border-white/[0.16]'
            }`}
          >
            <Ban size={14} className="text-zinc-500 dark:text-zinc-200" />
            <span className="absolute bottom-1 text-[12px] text-zinc-500 dark:text-zinc-200">None</span>
          </button>

          {images.map((img) => {
            const selected = background.url === img.url
            return (
              <div key={img.name} className="relative group">
                <button
                  onClick={() => setBackground({ ...background, url: img.url })}
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
          max={DIM_MAX}
          suffix="%"
          onChange={(v) => setBackground({ ...background, dim: v / 100 })}
        />
        <Slider
          label="Blur"
          value={background.blur}
          min={0}
          max={BLUR_MAX}
          suffix="px"
          onChange={(v) => setBackground({ ...background, blur: v })}
        />
      </div>
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
