'use server'

// Server actions for attachments — the only way the browser writes one.
//
// Same shape as lib/crm/actions.ts: validate the input, do the work, revalidate
// the page that shows it. These are reachable by direct POST rather than only
// through our own forms, so nothing here trusts the caller.
//
// Uploads arrive as FormData carrying the real File, so the bytes cross the
// wire once and are base64-encoded on this side. A 512 KB file sits well under
// the 1 MB default body limit for server actions, so next.config.ts needs no
// serverActions.bodySizeLimit entry.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { currentAccount } from './auth-server'
import type { ActionResult } from './crm/actions'
import { createAttachment, deleteAttachment } from './attachments'
import {
  mimeForFilename,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type AttachmentOwner,
} from './attachment-types'

const ownerSchema = z.object({
  kind: z.enum(['lead', 'client', 'project']),
  id: z.string().uuid(),
})

function invalid(message: string): { ok: false; error: { kind: 'unknown'; message: string } } {
  return { ok: false, error: { kind: 'unknown', message } }
}

/**
 * Both roles may *read* a client project's files — the co-worker account opens
 * that board — but only an admin attaches or removes one, which matches
 * `canManage` on the pages themselves. Leads and customers are admin-only
 * throughout, and the proxy already keeps the co-worker off those routes.
 */
async function requireAdmin(): Promise<{ username: string } | null> {
  const account = await currentAccount()
  if (!account || account.role !== 'admin') return null
  return { username: account.username }
}

/** The pages that render this owner's file list, so both refresh after a write. */
function pathsFor(owner: AttachmentOwner): string[] {
  switch (owner.kind) {
    case 'lead':
      return ['/atrium-crm', `/atrium-crm/${owner.id}`]
    case 'client':
      return ['/mrr']
    case 'project':
      return ['/client-projects', `/client-projects/${owner.id}`]
  }
}

/**
 * Strip anything that would let a filename escape being a filename: a path
 * from a browser that sends one, and control characters — a newline here would
 * end up in the download route's Content-Disposition header.
 */
function cleanFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 300)
}

export async function uploadAttachmentAction(
  formData: FormData
): Promise<ActionResult<Attachment>> {
  const admin = await requireAdmin()
  if (!admin) return invalid('You are not allowed to attach files.')

  const parsed = ownerSchema.safeParse({
    kind: formData.get('ownerKind'),
    id: formData.get('ownerId'),
  })
  if (!parsed.success) return invalid('Invalid record.')
  const owner = parsed.data as AttachmentOwner

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return invalid('No file was received.')

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return invalid(
      `${file.name} is ${Math.round(file.size / 1024)} KB — the limit is ${MAX_ATTACHMENT_BYTES / 1024} KB.`
    )
  }

  const filename = cleanFilename(file.name)
  if (!filename) return invalid('That file has no usable name.')

  // From the extension, never from the browser's Content-Type — this value is
  // what the download route hands back, so it decides how a browser treats it.
  const mime = mimeForFilename(filename)
  if (!mime) return invalid(`${filename} is not a type you can attach.`)

  const data = Buffer.from(await file.arrayBuffer()).toString('base64')

  const result = await createAttachment(owner, {
    filename,
    mime,
    sizeBytes: file.size,
    data,
    uploadedBy: admin.username,
  })

  if (result.ok) for (const path of pathsFor(owner)) revalidatePath(path)
  return result
}

export async function deleteAttachmentAction(
  ownerKind: string,
  ownerId: string,
  id: string
): Promise<ActionResult<null>> {
  const admin = await requireAdmin()
  if (!admin) return invalid('You are not allowed to remove files.')

  const parsed = ownerSchema.safeParse({ kind: ownerKind, id: ownerId })
  if (!parsed.success) return invalid('Invalid record.')
  if (!z.string().uuid().safeParse(id).success) return invalid('Invalid file.')

  const owner = parsed.data as AttachmentOwner
  const result = await deleteAttachment(owner, id)

  if (result.ok) for (const path of pathsFor(owner)) revalidatePath(path)
  return result
}
