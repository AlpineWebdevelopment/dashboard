// Pure client-side audio helpers — no DOM, no React. Browser APIs only.
// Decode any file the browser has codecs for, optionally resample / remix,
// then encode to an uncompressed WAV Blob.

/** 32 means IEEE float; 16 and 24 are signed PCM. */
export type BitDepth = 16 | 24 | 32

// `Window` alone does not declare the constructors — they live on globalThis —
// so widen from the real type of `window` rather than the interface.
type WebAudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext
  webkitOfflineAudioContext?: typeof OfflineAudioContext
}

/** Decode the audio track from a video or audio file into an AudioBuffer. */
export async function decodeFile(file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer()
  const w = window as WebAudioWindow
  const Ctx = w.AudioContext || w.webkitAudioContext
  const ac = new Ctx()
  try {
    // decodeAudioData reads the audio stream out of MP4/MOV/WebM containers too.
    return await ac.decodeAudioData(data)
  } finally {
    ac.close()
  }
}

/** Resample and/or down/up-mix channels via an offline render pass. */
export async function renderTo(
  buffer: AudioBuffer,
  sampleRate: number,
  channels: number
): Promise<AudioBuffer> {
  const frames = Math.ceil(buffer.duration * sampleRate)
  const w = window as WebAudioWindow
  const OAC = w.OfflineAudioContext || w.webkitOfflineAudioContext
  const oac = new OAC(channels, frames, sampleRate)
  const src = oac.createBufferSource()
  src.buffer = buffer
  src.connect(oac.destination)
  src.start()
  return oac.startRendering()
}

/** Encode an AudioBuffer to a WAV Blob (PCM for 16/24-bit, IEEE float for 32-bit). */
export function encodeWAV(buffer: AudioBuffer, bitDepth: BitDepth): Blob {
  const numCh = buffer.numberOfChannels
  const rate = buffer.sampleRate
  const isFloat = bitDepth === 32
  const bytesPerSample = bitDepth / 8
  const blockAlign = numCh * bytesPerSample
  const frames = buffer.length
  const dataLen = frames * blockAlign

  const ab = new ArrayBuffer(44 + dataLen)
  const dv = new DataView(ab)
  let p = 0
  const str = (s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i))
  }
  const u32 = (v: number) => {
    dv.setUint32(p, v, true)
    p += 4
  }
  const u16 = (v: number) => {
    dv.setUint16(p, v, true)
    p += 2
  }

  // RIFF header
  str('RIFF')
  u32(36 + dataLen)
  str('WAVE')
  // fmt chunk
  str('fmt ')
  u32(16)
  u16(isFloat ? 3 : 1) // 1 = PCM, 3 = IEEE float
  u16(numCh)
  u32(rate)
  u32(rate * blockAlign)
  u16(blockAlign)
  u16(bitDepth)
  // data chunk
  str('data')
  u32(dataLen)

  const chans: Float32Array[] = []
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c))

  if (isFloat) {
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < numCh; c++) {
        dv.setFloat32(p, chans[c][i], true)
        p += 4
      }
  } else if (bitDepth === 16) {
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < numCh; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]))
        dv.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        p += 2
      }
  } else {
    // 24-bit, little-endian 3-byte samples
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < numCh; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]))
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
        dv.setUint8(p++, v & 0xff)
        dv.setUint8(p++, (v >> 8) & 0xff)
        dv.setUint8(p++, (v >> 16) & 0xff)
      }
  }

  return new Blob([ab], { type: 'audio/wav' })
}

/** Estimated WAV byte size for a given source duration and target settings. */
export function estimateBytes(
  durationSec: number,
  sampleRate: number,
  channels: number,
  bitDepth: BitDepth
): number {
  return 44 + Math.ceil(durationSec * sampleRate) * channels * (bitDepth / 8)
}
