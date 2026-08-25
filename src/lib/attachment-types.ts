// What an attachment is, and which file types are allowed.
//
// Split out of lib/attachments.ts for the same reason lib/lead-status.ts is
// split out of lib/crm/leads.ts: the card is a client component and needs the
// size cap, the accept list and the type check, while the data layer next door
// carries the service-role key and must never reach the browser bundle.

/** A file's metadata. Deliberately without the bytes — see listAttachments. */
export type Attachment = {
  id: string
  filename: string
  mime: string
  size_bytes: number
  /** Account username, from lib/users.ts. Not a foreign key; there is no user table. */
  uploaded_by: string
  created_at: string
}

/**
 * What a file hangs off. One table serves all three because the shape is
 * identical and a single download route can then answer for any of them; the
 * three columns behind this are real foreign keys, so cascade deletes work.
 */
export type AttachmentOwner =
  | { kind: 'lead'; id: string }
  | { kind: 'client'; id: string }
  | { kind: 'project'; id: string }

/** 512 KB. Also enforced by a CHECK on the table and by the upload action. */
export const MAX_ATTACHMENT_BYTES = 512 * 1024

/**
 * What may be uploaded, keyed by extension.
 *
 * The stored MIME is derived from the extension rather than taken from the
 * browser: the browser's value is attacker-controlled in a direct POST, and it
 * is what the download route later hands back as Content-Type. Deriving it
 * ourselves means a file called `notes.md` cannot come back as text/html.
 */
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** For the file picker's `accept`, so the dialog filters before we have to refuse. */
export const ACCEPT_ATTR = Object.keys(MIME_BY_EXT)
  .map((e) => `.${e}`)
  .join(',')

/** Shown on the card, so the rule is visible before it is enforced. */
export const ALLOWED_LABEL = 'PDF, MD, TXT, CSV, PNG, JPG, WEBP, DOCX, XLSX'

/**
 * The MIME we will store for this filename, or null if the type is not allowed.
 * Extension only — see MIME_BY_EXT.
 */
export function mimeForFilename(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? null
}

/**
 * Types safe to render in a browser tab. Everything else is forced to
 * `attachment` on download, because an HTML or SVG file served inline from our
 * own origin could read the session cookie.
 */
const INLINE_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
])

export function isInlineSafe(mime: string): boolean {
  return INLINE_MIME.has(mime)
}
