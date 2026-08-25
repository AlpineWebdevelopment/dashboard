'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  decodeFile,
  renderTo,
  encodeWAV,
  estimateBytes,
  type BitDepth,
} from '@/lib/tools/audio-to-wav'
import { downloadBlob, fmtBytes, fmtDuration } from '@/lib/tools/download'
import { toolByKey } from '@/lib/tools/registry'
import {
  CARD_NESTED_CLS,
  SHELL_CLS,
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

const TOOL = toolByKey('yt-dwnld')!

const RATE_OPTS = [
  { value: 'source', label: 'Source' },
  { value: '48000', label: '48 kHz' },
  { value: '44100', label: '44.1 kHz' },
  { value: '22050', label: '22 kHz' },
] as const
const DEPTH_OPTS = [
  { value: '16', label: '16-bit' },
  { value: '24', label: '24-bit' },
  { value: '32', label: '32-bit float' },
] as const
const CH_OPTS = [
  { value: 'source', label: 'Source' },
  { value: '1', label: 'Mono' },
] as const

type Rate = (typeof RATE_OPTS)[number]['value']
type Depth = (typeof DEPTH_OPTS)[number]['value']
type Ch = (typeof CH_OPTS)[number]['value']

export default function VideoToWavPage() {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [baseName, setBaseName] = useState('audio')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)

  const [rate, setRate] = useState<Rate>('source')
  const [depth, setDepth] = useState<Depth>('16')
  const [ch, setCh] = useState<Ch>('source')

  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* ── Waveform ──────────────────────────────────────────────────────────── */

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !buffer) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const data = buffer.getChannelData(0)
    const mid = h / 2
    const buckets = Math.min(w, 900)
    const step = Math.floor(data.length / buckets) || 1
    const barW = w / buckets
    // violet-400 at 70% — the tool's accent, legible on both themes.
    ctx.fillStyle = 'rgba(167, 139, 250, 0.7)'
    for (let i = 0; i < buckets; i++) {
      let min = 1
      let max = -1
      const start = i * step
      for (let j = 0; j < step; j++) {
        const v = data[start + j]
        if (v < min) min = v
        if (v > max) max = v
      }
      const y1 = mid + min * mid * 0.92
      const y2 = mid + max * mid * 0.92
      ctx.fillRect(i * barW, y1, Math.max(barW * 0.7, 0.7), Math.max(y2 - y1, 1))
    }
  }, [buffer])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [draw])

  /* ── Load / convert ────────────────────────────────────────────────────── */

  const handleFiles = useCallback(async (list: FileList) => {
    const file = list[0]
    if (!file) return
    setBaseName(file.name.replace(/\.[^.]+$/, '') || 'audio')
    setFileName(file.name)
    setBusy(true)
    setStatus({ msg: 'Reading & decoding…', type: 'info' })
    setBuffer(null)
    try {
      setBuffer(await decodeFile(file))
      setStatus(null)
    } catch {
      setStatus({
        msg: "Couldn't decode this file's audio in your browser.",
        type: 'err',
      })
    } finally {
      setBusy(false)
    }
  }, [])

  const convert = useCallback(async () => {
    if (!buffer) return
    setBusy(true)
    setStatus({ msg: 'Converting…', type: 'info' })
    await new Promise((r) => setTimeout(r, 30)) // let the UI paint

    try {
      const targetRate = rate === 'source' ? buffer.sampleRate : parseInt(rate, 10)
      const targetCh = ch === 'source' ? buffer.numberOfChannels : parseInt(ch, 10)
      const targetDepth = parseInt(depth, 10) as BitDepth

      let out = buffer
      if (targetRate !== buffer.sampleRate || targetCh !== buffer.numberOfChannels) {
        out = await renderTo(buffer, targetRate, targetCh)
      }
      const blob = encodeWAV(out, targetDepth)
      downloadBlob(blob, `${baseName}.wav`)
      setStatus({ msg: `Done — saved ${fmtBytes(blob.size)}.`, type: 'ok' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus({ msg: `Conversion failed: ${msg}`, type: 'err' })
    } finally {
      setBusy(false)
    }
  }, [buffer, rate, ch, depth, baseName])

  const outSize = buffer
    ? estimateBytes(
        buffer.duration,
        rate === 'source' ? buffer.sampleRate : parseInt(rate, 10),
        ch === 'source' ? buffer.numberOfChannels : parseInt(ch, 10),
        parseInt(depth, 10) as BitDepth
      )
    : 0

  const channelLabel = !buffer
    ? ''
    : buffer.numberOfChannels === 1
      ? 'Mono'
      : buffer.numberOfChannels === 2
        ? 'Stereo'
        : String(buffer.numberOfChannels)

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-2xl">
        {/* One opaque ground for the whole tool. The header, the card and the
            footnote all put small text straight on the page, and none of it
            survives a wallpaper on its own. */}
        <div className={`${SHELL_CLS} p-4 sm:p-6`}>
          <ToolHeader tool={TOOL} />

          <div className={`${CARD_NESTED_CLS} overflow-hidden`}>
            <DropZone
              accept="video/*,audio/*"
              title="Drop a file here, or"
              hint="Video (MP4, MOV, WebM, MKV…) or audio (MP3, M4A, OGG, FLAC…)"
              inputRef={inputRef}
              onFiles={handleFiles}
            />

            {buffer && (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-t border-zinc-200 dark:border-white/[0.06]">
                  <span className="flex-1 truncate text-[13px] font-medium text-zinc-800 dark:text-white">
                    {fileName}
                  </span>
                  <button
                    onClick={() => inputRef.current?.click()}
                    className={`${btnSecondary(true)} px-2.5 py-1 text-[13px]`}
                  >
                    Change file
                  </button>
                </div>

                <canvas
                  ref={canvasRef}
                  className="block w-full h-32 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-100/60 dark:bg-white/[0.02]"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(127,127,127,0.25),rgba(127,127,127,0.25))',
                    backgroundSize: '100% 1px',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                />

                <Readout
                  cells={[
                    { label: 'Duration', value: fmtDuration(buffer.duration) },
                    { label: 'Channels', value: channelLabel },
                    {
                      label: 'Source rate',
                      value: `${(buffer.sampleRate / 1000).toFixed(1).replace(/\.0$/, '')} kHz`,
                    },
                    { label: 'Out size', value: fmtBytes(outSize) },
                  ]}
                />

                <div className="px-4 pt-5 space-y-4">
                  <div>
                    <FieldLabel>Sample rate</FieldLabel>
                    <Segmented
                      accent={TOOL.accent}
                      value={rate}
                      options={RATE_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                      onChange={setRate}
                      nested
                    />
                  </div>
                  <div>
                    <FieldLabel>Bit depth</FieldLabel>
                    <Segmented
                      accent={TOOL.accent}
                      value={depth}
                      options={DEPTH_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                      onChange={setDepth}
                      nested
                    />
                  </div>
                  <div>
                    <FieldLabel>Channels</FieldLabel>
                    <Segmented
                      accent={TOOL.accent}
                      value={ch}
                      options={CH_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                      onChange={setCh}
                      nested
                    />
                  </div>
                </div>

                <div className="px-4 pt-4 pb-5">
                  <button
                    onClick={convert}
                    disabled={busy}
                    className={`${btnPrimary(TOOL.accent, true)} w-full py-3 text-sm font-semibold`}
                  >
                    Convert &amp; download .wav
                  </button>
                  <StatusLine status={status} />
                </div>
              </>
            )}

            {!buffer && status && (
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
            Audio is decoded with your browser&apos;s built-in codecs, so a few unusual
            formats may not open (Chrome, Edge and Safari handle standard MP4/AAC well).
            WAV is uncompressed, so expect a large output file.
          </p>
        </div>
      </div>
    </div>
  )
}
