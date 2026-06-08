'use client'

import '@excalidraw/excalidraw/index.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ChevronLeft, Check, Loader2, Trash2, Download } from 'lucide-react'
import { renameWhiteboard, saveWhiteboardData, deleteWhiteboard } from '@/lib/actions'
import type { Whiteboard } from '@/lib/supabase'

// Excalidraw must be loaded client-side only (uses canvas + browser APIs)
const Excalidraw = dynamic(
  async () => {
    const { Excalidraw } = await import('@excalidraw/excalidraw')
    return Excalidraw
  },
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#13131a]">
      <Loader2 size={24} className="animate-spin text-fuchsia-400" />
    </div>
  )}
)

type Props = { whiteboard: Whiteboard }

export default function ExcalidrawCanvas({ whiteboard }: Props) {
  const [name, setName] = useState(whiteboard.name)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isDark, setIsDark] = useState(false)
  const [exporting, setExporting] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstChange = useRef(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawAPI = useRef<any>(null)

  // Detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Debounced auto-save on canvas change
  const handleChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files: unknown) => {
      // Skip the very first onChange which fires on mount
      if (isFirstChange.current) { isFirstChange.current = false; return }

      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(async () => {
        await saveWhiteboardData(whiteboard.id, {
          elements: Array.from(elements),
          files: files ?? {},
        })
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2000)
      }, 1500)
    },
    [whiteboard.id]
  )

  // Rename on blur
  async function handleNameBlur() {
    if (name === whiteboard.name) return
    await renameWhiteboard(whiteboard.id, name || 'Untitled Whiteboard')
  }

  // Delete
  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteWhiteboard(whiteboard.id)
  }

  // Export to PNG — draws original images at native resolution, overlays drawings as SVG
  async function handleExportPNG() {
    if (!excalidrawAPI.current) return
    setExporting(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements = excalidrawAPI.current.getSceneElements() as any[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appState  = excalidrawAPI.current.getAppState() as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const files     = excalidrawAPI.current.getFiles() as any

      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

      const triggerDownload = (blob: Blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${name || 'whiteboard'}.png`; a.click()
        URL.revokeObjectURL(url)
      }

      const imageEls = elements.filter((el: any) => el.type === 'image' && el.fileId && files[el.fileId]?.dataURL)

      // ── No images: just do a high-res vector export ────────────────────────
      if (imageEls.length === 0) {
        const { exportToBlob } = await import('@excalidraw/excalidraw')
        const blob = await exportToBlob({
          elements, files, mimeType: 'image/png',
          appState: { ...appState, exportWithDarkMode: isDark, exportBackground: true },
          getDimensions: (w: number, h: number) => ({ width: w * 4, height: h * 4, scale: 4 }),
        })
        triggerDownload(blob); return
      }

      // ── Compute full scene bounding box ────────────────────────────────────
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const el of elements) {
        minX = Math.min(minX, el.x);         minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x + (el.width  ?? 0))
        maxY = Math.max(maxY, el.y + (el.height ?? 0))
      }

      // Scale so the first image renders at its native pixel dimensions
      const ref    = imageEls[0]
      const refImg = await loadImg(files[ref.fileId].dataURL)
      const scale  = Math.max(refImg.naturalWidth / (ref.width || 1), refImg.naturalHeight / (ref.height || 1), 2)
      const outW   = Math.round((maxX - minX) * scale)
      const outH   = Math.round((maxY - minY) * scale)

      // ── Create output canvas ───────────────────────────────────────────────
      const canvas = document.createElement('canvas')
      canvas.width = outW; canvas.height = outH
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = isDark ? '#13131a' : 'white'
      ctx.fillRect(0, 0, outW, outH)

      // Draw every uploaded image at its ORIGINAL quality (bypasses Excalidraw's renderer)
      for (const el of imageEls) {
        const img = await loadImg(files[el.fileId].dataURL)
        const dx = (el.x - minX) * scale, dy = (el.y - minY) * scale
        const dw = el.width * scale,       dh = el.height * scale
        ctx.save()
        if (el.angle) {
          ctx.translate(dx + dw / 2, dy + dh / 2)
          ctx.rotate(el.angle)
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
        } else {
          ctx.drawImage(img, dx, dy, dw, dh)
        }
        ctx.restore()
      }

      // ── Overlay drawings as perfect vectors via SVG export ─────────────────
      const { exportToSvg } = await import('@excalidraw/excalidraw')
      const svg = await exportToSvg({
        elements,
        appState: { ...appState, exportBackground: false, exportWithDarkMode: isDark },
        files,
      })
      // Remove the (potentially lower-quality) embedded images from the SVG —
      // we already drew the originals directly above
      svg.querySelectorAll('image').forEach((n: Element) => n.remove())

      const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
      const svgImg  = await loadImg(URL.createObjectURL(svgBlob))
      ctx.drawImage(svgImg, 0, 0, outW, outH)
      URL.revokeObjectURL(svgImg.src)

      canvas.toBlob(blob => { if (blob) triggerDownload(blob) }, 'image/png')
    } finally {
      setExporting(false)
    }
  }

  const initialData = whiteboard.data
    ? {
        elements: whiteboard.data.elements as never,
        appState: { theme: isDark ? 'dark' : 'light' } as never,
        files: whiteboard.data.files as never,
      }
    : undefined

  return (
    <div className="fixed inset-0 md:left-56 flex flex-col bg-white dark:bg-[#13131a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-11 border-b border-zinc-200 dark:border-white/[0.06] bg-white/95 dark:bg-[rgba(7,7,15,0.9)] backdrop-blur-xl shrink-0 z-10">
        <Link
          href="/whiteboards"
          className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors shrink-0"
        >
          <ChevronLeft size={13} />
          Whiteboards
        </Link>

        <div className="w-px h-4 bg-zinc-200 dark:bg-white/[0.07] shrink-0" />

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-zinc-800 dark:text-zinc-200 outline-none placeholder-zinc-400 dark:placeholder-zinc-700 truncate"
        />

        <div className="flex items-center gap-2 shrink-0">
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-600">
              <Loader2 size={10} className="animate-spin" /> Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Check size={10} /> Saved
            </span>
          )}
          <button
            onClick={handleExportPNG}
            disabled={exporting}
            title="Download as PNG"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-500/10 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-500/20 border border-fuchsia-200 dark:border-fuchsia-500/20 disabled:opacity-50 transition-all"
          >
            {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            PNG
          </button>
          <button
            onClick={handleDelete}
            title="Delete whiteboard"
            className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawAPI.current = api }}
          initialData={initialData}
          onChange={handleChange as never}
          theme={isDark ? 'dark' : 'light'}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: { saveFileToDisk: true },
            },
          }}
        />
      </div>
    </div>
  )
}
