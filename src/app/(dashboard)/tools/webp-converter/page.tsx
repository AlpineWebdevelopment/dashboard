'use client'

import { useCallback, useRef, useState } from 'react'
import JSZip from 'jszip'
import { downloadBlob, fmtBytes } from '@/lib/tools/download'
import { toolByKey } from '@/lib/tools/registry'
import {
  CARD_CLS,
  DropZone,
  FieldLabel,
  Readout,
  Segmented,
  StatusLine,
  ToolHeader,
  btnPrimary,
  btnSecondary,
  type Status,
} from '@/components/tools/ui'

const TOOL = toolByKey('webp-converter')!

const QUALITY_OPTS = [
  { value: '0.6', label: 'Small' },
  { value: '0.85', label: 'Balanced' },
  { value: '0.95', label: 'High' },
] as const

type Quality = (typeof QUALITY_OPTS)[number]['value']

const MAX_BYTES = 5 * 1024 * 1024

/** Decode one image and re-encode it as WebP through a canvas. */
async function convertToWebP(file: File, quality: number): Promise<Blob> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is too large (max 5MB)`)

  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const reader = new FileReader()

    reader.onload = (e) => {
      img.src = String(e.target?.result ?? '')
    }
    reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`))
    img.onerror = () => reject(new Error(`Couldn't decode ${file.name}`))
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas is unavailable in this browser'))
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error(`Failed to convert ${file.name}`))
        },
        'image/webp',
        quality
      )
    }

    reader.readAsDataURL(file)
  })
}

export default function WebPConverterPage() {
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [quality, setQuality] = useState<Quality>('0.85')

  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((fileList: FileList) => {
    const picked = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (!picked.length) {
      setStatus({ msg: 'No images in that selection.', type: 'err' })
      return
    }
    setFiles(picked)
    setCompleted(0)
    setStatus(null)
  }, [])

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  const convert = useCallback(async () => {
    if (!files.length) return
    setBusy(true)
    setCompleted(0)
    setStatus({ msg: 'Converting…', type: 'info' })
    await new Promise((r) => setTimeout(r, 30)) // let the UI paint

    try {
      const q = parseFloat(quality)

      // One file goes straight to disk; several are bundled into a zip.
      if (files.length === 1) {
        const blob = await convertToWebP(files[0], q)
        const stamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
        downloadBlob(blob, `${stamp}.webp`)
        setCompleted(1)
        setStatus({ msg: `Done — saved ${fmtBytes(blob.size)}.`, type: 'ok' })
        return
      }

      const zip = new JSZip()
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const blob = await convertToWebP(file, q)
        zip.file(file.name.replace(/\.[^.]+$/, '') + '.webp', blob)
        setCompleted(i + 1)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(zipBlob, `${files.length}-converted-webp-images.zip`)
      setStatus({
        msg: `Done — saved ${fmtBytes(zipBlob.size)} (${files.length} images).`,
        type: 'ok',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus({ msg: `Conversion failed: ${msg}`, type: 'err' })
    } finally {
      setBusy(false)
    }
  }, [files, quality])

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-2xl">
        <ToolHeader tool={TOOL} />

        <div className={`${CARD_CLS} overflow-hidden`}>
          <DropZone
            accept="image/*"
            multiple
            title="Drop images here, or"
            hint="PNG, JPG, GIF, BMP… (max 5MB each) — pick one or many"
            inputRef={inputRef}
            onFiles={handleFiles}
          />

          {files.length > 0 && (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-t border-zinc-200 dark:border-white/[0.06]">
                <span className="flex-1 truncate text-[13px] font-medium text-zinc-800 dark:text-white">
                  {files.length === 1 ? files[0].name : `${files.length} images selected`}
                </span>
                <button
                  onClick={() => inputRef.current?.click()}
                  className={`${btnSecondary(true)} px-2.5 py-1 text-[13px]`}
                >
                  Change files
                </button>
              </div>

              <Readout
                cells={[
                  { label: 'Images', value: String(files.length) },
                  { label: 'Total size', value: fmtBytes(totalSize) },
                  { label: 'Quality', value: `${Math.round(parseFloat(quality) * 100)}%` },
                  { label: 'Converted', value: `${completed} / ${files.length}` },
                ]}
              />

              <div className="px-4 pt-5">
                <FieldLabel>Quality</FieldLabel>
                <Segmented
                  accent={TOOL.accent}
                  value={quality}
                  options={QUALITY_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={setQuality}
                  nested
                />
              </div>

              <div className="px-4 pt-4 pb-5">
                <button
                  onClick={convert}
                  disabled={busy}
                  className={`${btnPrimary(TOOL.accent, true)} w-full py-3 text-sm font-semibold`}
                >
                  {files.length > 1 ? 'Convert & download .zip' : 'Convert & download .webp'}
                </button>
                <StatusLine status={status} />
              </div>
            </>
          )}

          {!files.length && status && (
            <div className="px-4 pt-2 pb-5">
              <StatusLine status={status} />
            </div>
          )}
        </div>

        <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-5 px-1 leading-relaxed">
          <span className="font-medium text-zinc-700 dark:text-zinc-100">
            Private by design:
          </span>{' '}
          nothing is uploaded — decoding and conversion happen entirely on your device.
          Multiple images are bundled into a single .zip. WebP is encoded with your
          browser&apos;s built-in encoder, so results may vary slightly between browsers.
        </p>
      </div>
    </div>
  )
}
