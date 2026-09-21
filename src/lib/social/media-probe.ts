// Browser-side inspection of a dropped file, before anything is uploaded.
//
// Produces what validation needs (dimensions, duration, codecs, fast-start,
// fps), a small JPEG thumbnail, and — for images Instagram won't take as they
// are — a JPEG variant. All of it runs on <canvas>/<video> and a hand-rolled
// MP4 box reader, so there's no media library and no server round-trip.

import { LIMITS } from './config'

export type Probe = {
  kind: 'image' | 'video'
  mime: string
  bytes: number
  width: number | null
  height: number | null
  durationS: number | null
  videoCodec: string | null
  audioCodec: string | null
  faststart: boolean | null
  fps: number | null
  thumb: Blob | null
  /** JPEG version for Instagram (and Facebook when the original is WebP). */
  jpeg: Blob | null
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
}

/** file.type is empty for .mov on some Windows setups; fall back to the extension. */
export function mimeOf(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type === 'image/jpg' ? 'image/jpeg' : file.type
  return EXT_MIME[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? ''
}

const THUMB_MAX = 320

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/jpeg', quality)
  )
}

function drawScaled(source: CanvasImageSource, w: number, h: number, maxW: number, maxH = maxW): HTMLCanvasElement {
  const scale = Math.min(1, maxW / w, maxH / h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')!
  // JPEG has no alpha: paint white first so transparent PNGs don't go black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function probeImage(file: File, mime: string): Promise<Probe> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  try {
    const thumb = await toBlob(drawScaled(bitmap, width, height, THUMB_MAX), 0.8)
    let jpeg: Blob | null = null
    if (mime !== 'image/jpeg' || file.size > LIMITS.igImage.maxBytes) {
      const canvas = drawScaled(bitmap, width, height, LIMITS.igImage.maxWidth, Number.POSITIVE_INFINITY)
      for (const q of [0.92, 0.85, 0.75, 0.6]) {
        jpeg = await toBlob(canvas, q)
        if (jpeg.size <= LIMITS.igImage.maxBytes) break
      }
    }
    return {
      kind: 'image',
      mime,
      bytes: file.size,
      width,
      height,
      durationS: null,
      videoCodec: null,
      audioCodec: null,
      faststart: null,
      fps: null,
      thumb,
      jpeg,
    }
  } finally {
    bitmap.close()
  }
}

// ─── MP4 / MOV box reader ───────────────────────────────────────────────────
//
// Walks the top level for moov/mdat order (fast start), then reads moov and,
// per track, the handler (vide/soun), the sample entry fourcc (avc1, hvc1,
// mp4a…), duration + sample count (fps), and the display size.

type Box = { type: string; start: number; size: number; header: number }

async function readHeader(file: File, offset: number): Promise<Box | null> {
  const buf = new DataView(await file.slice(offset, offset + 16).arrayBuffer())
  if (buf.byteLength < 8) return null
  let size = buf.getUint32(0)
  const type = String.fromCharCode(buf.getUint8(4), buf.getUint8(5), buf.getUint8(6), buf.getUint8(7))
  let header = 8
  if (size === 1) {
    if (buf.byteLength < 16) return null
    size = Number(buf.getBigUint64(8))
    header = 16
  } else if (size === 0) {
    size = file.size - offset
  }
  if (size < header) return null
  return { type, start: offset, size, header }
}

function children(view: DataView, start: number, end: number): Box[] {
  const out: Box[] = []
  let o = start
  while (o + 8 <= end) {
    let size = view.getUint32(o)
    const type = String.fromCharCode(view.getUint8(o + 4), view.getUint8(o + 5), view.getUint8(o + 6), view.getUint8(o + 7))
    let header = 8
    if (size === 1 && o + 16 <= end) {
      size = Number(view.getBigUint64(o + 8))
      header = 16
    } else if (size === 0) size = end - o
    if (size < header || o + size > end) break
    out.push({ type, start: o, size, header })
    o += size
  }
  return out
}

const find = (view: DataView, box: Box, type: string) =>
  children(view, box.start + box.header, box.start + box.size).find((b) => b.type === type)

const fourcc = (view: DataView, at: number) =>
  String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3))

type TrackInfo = {
  handler: string
  codec: string | null
  durationS: number | null
  samples: number | null
  width: number | null
  height: number | null
}

function readTrack(view: DataView, trak: Box): TrackInfo | null {
  const mdia = find(view, trak, 'mdia')
  if (!mdia) return null
  const hdlr = find(view, mdia, 'hdlr')
  const handler = hdlr ? fourcc(view, hdlr.start + hdlr.header + 8) : ''

  let durationS: number | null = null
  const mdhd = find(view, mdia, 'mdhd')
  if (mdhd) {
    const p = mdhd.start + mdhd.header
    const v = view.getUint8(p)
    const timescale = v === 1 ? view.getUint32(p + 20) : view.getUint32(p + 12)
    const duration = v === 1 ? Number(view.getBigUint64(p + 24)) : view.getUint32(p + 16)
    if (timescale) durationS = duration / timescale
  }

  let codec: string | null = null
  let samples: number | null = null
  const stbl = (() => {
    const minf = find(view, mdia, 'minf')
    return minf ? find(view, minf, 'stbl') : undefined
  })()
  if (stbl) {
    const stsd = find(view, stbl, 'stsd')
    if (stsd) codec = fourcc(view, stsd.start + stsd.header + 12)
    const stts = find(view, stbl, 'stts')
    if (stts) {
      const p = stts.start + stts.header
      const n = view.getUint32(p + 4)
      let total = 0
      for (let i = 0; i < n && p + 8 + i * 8 + 8 <= stts.start + stts.size; i++) total += view.getUint32(p + 8 + i * 8)
      samples = total
    }
  }

  let width: number | null = null
  let height: number | null = null
  const tkhd = find(view, trak, 'tkhd')
  if (tkhd) {
    const p = tkhd.start + tkhd.header
    const v = view.getUint8(p)
    const m = p + (v === 1 ? 52 : 40) // transformation matrix
    const wAt = m + 36
    if (wAt + 8 <= tkhd.start + tkhd.size) {
      width = view.getUint32(wAt) / 65536
      height = view.getUint32(wAt + 4) / 65536
      // A 90°/270° rotation (a = 0, b ≠ 0) displays the frame the other way up.
      const a = view.getInt32(m)
      const b = view.getInt32(m + 4)
      if (a === 0 && b !== 0) [width, height] = [height, width]
    }
  }

  return { handler, codec, durationS, samples, width: width || null, height: height || null }
}

type Container = {
  faststart: boolean | null
  videoCodec: string | null
  audioCodec: string | null
  fps: number | null
  durationS: number | null
  width: number | null
  height: number | null
}

export async function readContainer(file: File): Promise<Container | null> {
  const top: Box[] = []
  let offset = 0
  for (let i = 0; i < 64 && offset < file.size; i++) {
    const box = await readHeader(file, offset)
    if (!box) break
    top.push(box)
    offset += box.size
  }
  const moov = top.find((b) => b.type === 'moov')
  if (!moov || moov.size > 32 * 1024 * 1024) return null
  const mdat = top.find((b) => b.type === 'mdat')
  const view = new DataView(await file.slice(moov.start, moov.start + moov.size).arrayBuffer())
  const local: Box = { ...moov, start: 0 }
  const tracks = children(view, local.header, local.size)
    .filter((b) => b.type === 'trak')
    .map((t) => readTrack(view, t))
    .filter(Boolean) as TrackInfo[]
  const video = tracks.find((t) => t.handler === 'vide')
  const audio = tracks.find((t) => t.handler === 'soun')
  return {
    faststart: mdat ? moov.start < mdat.start : true,
    videoCodec: video?.codec ?? null,
    audioCodec: audio?.codec ?? null,
    fps: video?.samples && video.durationS ? Math.round((video.samples / video.durationS) * 100) / 100 : null,
    durationS: video?.durationS ?? null,
    width: video?.width ?? null,
    height: video?.height ?? null,
  }
}

type VideoFrame = { width: number; height: number; durationS: number; thumb: Blob | null }

/** Metadata and a frame via <video>. Resolves null if the browser can't decode it (e.g. HEVC without support). */
function readVideoElement(file: File): Promise<VideoFrame | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    let done = false
    const finish = (v: VideoFrame | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), 20_000)
    video.onerror = () => finish(null)
    video.onloadedmetadata = () => {
      if (!video.videoWidth) return finish(null)
      video.currentTime = Math.min(1, (video.duration || 0) / 4)
    }
    video.onseeked = async () => {
      const width = video.videoWidth
      const height = video.videoHeight
      let thumb: Blob | null = null
      try {
        thumb = await toBlob(drawScaled(video, width, height, THUMB_MAX), 0.8)
      } catch {
        thumb = null
      }
      finish({ width, height, durationS: video.duration, thumb })
    }
    video.src = url
  })
}

async function probeVideo(file: File, mime: string): Promise<Probe> {
  const [container, frame] = await Promise.all([readContainer(file).catch(() => null), readVideoElement(file)])
  return {
    kind: 'video',
    mime,
    bytes: file.size,
    width: frame?.width ?? container?.width ?? null,
    height: frame?.height ?? container?.height ?? null,
    durationS: frame?.durationS && Number.isFinite(frame.durationS) ? frame.durationS : container?.durationS ?? null,
    videoCodec: container?.videoCodec ?? null,
    audioCodec: container?.audioCodec ?? null,
    faststart: container?.faststart ?? null,
    fps: container?.fps ?? null,
    thumb: frame?.thumb ?? null,
    jpeg: null,
  }
}

export async function probeFile(file: File): Promise<Probe> {
  const mime = mimeOf(file)
  if (mime.startsWith('image/')) return probeImage(file, mime)
  if (mime.startsWith('video/')) return probeVideo(file, mime)
  throw new Error('Only images and videos can be scheduled.')
}
