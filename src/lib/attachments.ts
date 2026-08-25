// Files attached to a lead, an MRR customer or a client project.
//
// The bytes live in Postgres, base64 in `attachments.data`, rather than in a
// storage bucket. These files top out around 100 KB, and every argument for a
// bucket is an argument about size — CDN delivery, resumable uploads, keeping
// blobs out of the row store. What a bucket would add here is a second system
// to keep consistent with the first, with failure modes nothing in this
// codebase would notice: a deleted lead leaving objects behind, or a row
// pointing at an object that is gone. A foreign key with ON DELETE CASCADE has
// neither problem.
//
// Server-only — every call carries the service-role key. The table has RLS on
// with no policies, so the anon key the browser holds sees nothing, which is
// what keeps files on `client_projects` private even though that table itself
// is anon-readable.

import { crmConfigured, crmDb } from './crm/db'
import type { CrmError, Result } from './crm/leads'
import type { Attachment, AttachmentOwner } from './attachment-types'

const OWNER_COLUMN: Record<AttachmentOwner['kind'], 'lead_id' | 'client_id' | 'project_id'> = {
  lead: 'lead_id',
  client: 'client_id',
  project: 'project_id',
}

// ─── Errors ──────────────────────────────────────────────────────────────────

const NOT_CONFIGURED: CrmError = {
  kind: 'not_configured',
  message:
    'File storage is not configured — SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.',
}

function fail(message: string): { ok: false; error: CrmError } {
  return { ok: false, error: { kind: 'unknown', message } }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * The files on one record, newest first.
 *
 * The column list is explicit and `data` is not in it. This is the one line in
 * the module that must not be relaxed into `select('*')`: doing so would pull
 * every attachment's bytes into the page payload on every render.
 */
export async function listAttachments(owner: AttachmentOwner): Promise<Attachment[]> {
  if (!crmConfigured()) return []

  const { data, error } = await crmDb()
    .from('attachments')
    .select('id, filename, mime, size_bytes, uploaded_by, created_at')
    .eq(OWNER_COLUMN[owner.kind], owner.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[attachments] list failed', error.message)
    return []
  }
  return (data ?? []) as Attachment[]
}

/** What the download route needs: the bytes, plus the owner it must authorise against. */
export type AttachmentBlob = {
  filename: string
  mime: string
  data: string
  lead_id: string | null
  client_id: string | null
  project_id: string | null
}

/** The only reader of `data`. */
export async function getAttachmentForDownload(id: string): Promise<AttachmentBlob | null> {
  if (!crmConfigured()) return null

  const { data, error } = await crmDb()
    .from('attachments')
    .select('filename, mime, data, lead_id, client_id, project_id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[attachments] download read failed', error.message)
    return null
  }
  return (data as AttachmentBlob | null) ?? null
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export type NewAttachment = {
  filename: string
  mime: string
  sizeBytes: number
  /** base64 of the original bytes. */
  data: string
  uploadedBy: string
}

export async function createAttachment(
  owner: AttachmentOwner,
  input: NewAttachment
): Promise<Result<Attachment>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  const { data, error } = await crmDb()
    .from('attachments')
    .insert({
      [OWNER_COLUMN[owner.kind]]: owner.id,
      filename: input.filename,
      mime: input.mime,
      size_bytes: input.sizeBytes,
      data: input.data,
      uploaded_by: input.uploadedBy,
    })
    .select('id, filename, mime, size_bytes, uploaded_by, created_at')
    .single()

  if (error) {
    console.error('[attachments] insert failed', error.code, error.message)
    // 23503 is a foreign key violation — the record went away underneath us.
    if (error.code === '23503') return fail('That record no longer exists.')
    // 42P01 is "relation does not exist": the migration has not been run yet.
    // Worth naming, because the generic message would send you looking at the
    // file instead of at the database.
    if (error.code === '42P01') {
      return fail('The attachments table is missing — the migration has not been run yet.')
    }
    return fail('The file could not be saved. Please try again.')
  }

  if (owner.kind === 'lead') await logFileEvent(owner.id, 'file', input.filename)

  return { ok: true, data: data as Attachment }
}

/**
 * Note the attachment on the lead's timeline, so History stays a complete
 * record of what happened rather than a record of everything except files.
 *
 * Written directly rather than through crm_log_activity, which validates its
 * kind against the activities a person can log by hand — this is not one of
 * those. Deliberately not fatal: if the timeline write fails the file is still
 * saved, and losing the entry is much cheaper than losing the upload.
 *
 * Only leads have a timeline; customers and projects get nothing here.
 */
async function logFileEvent(
  leadId: string,
  kind: 'file' | 'file_removed',
  filename: string
): Promise<void> {
  const { error } = await crmDb().from('lead_events').insert({
    lead_id: leadId,
    kind,
    note: filename,
    occurred_at: new Date().toISOString(),
  })
  if (error) console.error('[attachments] timeline entry failed', error.code, error.message)
}

/**
 * Remove one file.
 *
 * Scoped by owner as well as by id, so a guessed id belonging to a record you
 * cannot see deletes nothing — the caller has already been checked against the
 * owner, and this binds that check to the row.
 */
export async function deleteAttachment(
  owner: AttachmentOwner,
  id: string
): Promise<Result<null>> {
  if (!crmConfigured()) return { ok: false, error: NOT_CONFIGURED }

  // Returns the row it removed, which is both the check that something was
  // actually deleted — a mismatched owner deletes nothing and comes back null —
  // and where the filename for the timeline entry comes from.
  const { data, error } = await crmDb()
    .from('attachments')
    .delete()
    .eq('id', id)
    .eq(OWNER_COLUMN[owner.kind], owner.id)
    .select('filename')
    .maybeSingle()

  if (error) {
    console.error('[attachments] delete failed', error.message)
    return fail('The file could not be deleted. Please try again.')
  }
  if (!data) return fail('That file no longer exists.')

  // The attachment is gone, but the record of it having been here is not: the
  // timeline keeps both entries, the same way a corrected status keeps the move
  // it corrected. History is what happened, not what is currently true.
  if (owner.kind === 'lead') await logFileEvent(owner.id, 'file_removed', data.filename)

  return { ok: true, data: null }
}
