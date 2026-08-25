// Serving one attachment back.
//
// A route handler rather than a base64 payload plus downloadBlob, because this
// gives every file a real URL — so a PDF opens in a browser tab instead of
// having to be saved first.
//
// src/proxy.ts has already refused anyone without a session by the time this
// runs, but it only decides whether the *path* is reachable. Which files a
// signed-in account may have is decided here, per row.

import { NextResponse, type NextRequest } from 'next/server'
import { currentAccount } from '@/lib/auth-server'
import { getAttachmentForDownload } from '@/lib/attachments'
import { isInlineSafe } from '@/lib/attachment-types'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * RFC 5987. The plain `filename` is an ASCII fallback for old clients, and
 * `filename*` carries the real one — quotes and non-ASCII are stripped from the
 * fallback rather than escaped, since it is only ever a fallback.
 */
function contentDisposition(filename: string, inline: boolean): string {
  const ascii = filename.replace(/[^\u0020-\u007e]/g, '_').replace(/["\\]/g, '_')
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const file = await getAttachmentForDownload(id)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Client-project files are readable by both roles — that board is the one
  // page the co-worker account opens. Lead and customer files are admin-only,
  // and saying 404 rather than 403 keeps a probe from confirming an id exists.
  const allowed = file.project_id !== null || account.role === 'admin'
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const bytes = new Uint8Array(Buffer.from(file.data, 'base64'))
  const inline = isInlineSafe(file.mime)

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': contentDisposition(file.filename, inline),
      // The MIME was derived from the extension on upload, not taken from the
      // browser, and these two stop anything mislabelled from being treated as
      // markup in our own origin — where it could read the session cookie.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
      // Private data behind a session: never let a shared cache hold it.
      'Cache-Control': 'private, no-store',
    },
  })
}
