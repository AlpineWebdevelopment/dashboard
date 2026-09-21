'use client'

// Browser → Supabase Storage, with the signed upload tokens prepareUpload hands
// out. Nothing large ever passes through the Next server.
//
// Videos go over tus (resumable, 6 MB chunks) to the signed-upload flavour of
// Supabase's resumable endpoint, with the token in `x-signature`. If Storage
// turns that down — there are reports of it rejecting some signed tokens — the
// same file is sent once more as a plain signed upload, which is not resumable
// but is otherwise identical. Small files (images, thumbnails) always take the
// plain path; resuming a 300 KB JPEG buys nothing.

import { createClient } from '@supabase/supabase-js'
import { STORAGE_BUCKET } from '@/lib/social/config'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const CHUNK = 6 * 1024 * 1024

let client: ReturnType<typeof createClient> | null = null
function storage() {
  if (!client) client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  return client.storage.from(STORAGE_BUCKET)
}

/** Supabase recommends the direct storage host for large uploads. */
function resumableEndpoint(): string {
  const u = new URL(URL_)
  const m = /^([a-z0-9]+)\.supabase\.co$/.exec(u.hostname)
  const host = m ? `https://${m[1]}.storage.supabase.co` : u.origin
  return `${host}/storage/v1/upload/resumable/sign`
}

async function plainUpload(path: string, token: string, body: Blob, contentType: string) {
  const { error } = await storage().uploadToSignedUrl(path, token, body, { contentType, upsert: true })
  if (error) throw new Error(error.message)
}

async function tusUpload(
  path: string,
  token: string,
  file: Blob,
  contentType: string,
  onProgress: (fraction: number) => void
): Promise<void> {
  const tus = await import('tus-js-client')
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: resumableEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { 'x-signature': token, 'x-upsert': 'true', apikey: ANON },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: STORAGE_BUCKET, objectName: path, contentType, cacheControl: '3600' },
      chunkSize: CHUNK,
      onProgress: (sent, total) => onProgress(total ? sent / total : 0),
      onSuccess: () => resolve(),
      onError: (err) => reject(err),
    })
    // Picks up where a previous attempt at the same file stopped.
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })
      .catch(() => upload.start())
  })
}

export async function uploadMain(
  path: string,
  token: string,
  file: Blob,
  contentType: string,
  onProgress: (fraction: number) => void
): Promise<'resumable' | 'plain'> {
  if (file.size <= CHUNK) {
    await plainUpload(path, token, file, contentType)
    onProgress(1)
    return 'plain'
  }
  try {
    await tusUpload(path, token, file, contentType, onProgress)
    return 'resumable'
  } catch (err) {
    console.warn('[social] resumable upload refused, falling back to a plain signed upload', err)
    onProgress(0)
    await plainUpload(path, token, file, contentType)
    onProgress(1)
    return 'plain'
  }
}

export async function uploadSmall(path: string, token: string, blob: Blob) {
  await plainUpload(path, token, blob, 'image/jpeg')
}
