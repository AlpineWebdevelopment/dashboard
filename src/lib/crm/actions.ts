'use server'

// Server actions for the CRM. Every mutation the UI can perform goes through
// here, validated with Zod before it reaches the data layer.
//
// These are reachable by direct POST, not only through our own forms, so each
// one validates its input rather than trusting the caller. Authentication is
// handled a layer up: middleware.ts refuses any request to /atrium-crm without
// a valid gt_session cookie, and these actions live under that same matcher.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { LEAD_STATUSES, type LeadStatus } from '@/lib/lead-status'
import {
  createLead,
  createLeads,
  logContactAttempt,
  transitionLead,
  updateLeadFields,
  type CrmError,
  type Lead,
} from './leads'
import { crmConfigured, crmDb } from './db'
import { buildImport } from './csv'

const CRM_PATH = '/atrium-crm'

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: CrmError }

function invalid(message: string): { ok: false; error: CrmError } {
  return { ok: false, error: { kind: 'unknown', message } }
}

/** Empty strings from a form mean "not provided", not "set to empty". */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()

const isoDate = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine((v) => v === null || !Number.isNaN(new Date(v).getTime()), {
    message: 'Érvénytelen dátum',
  })

const statusSchema = z.enum(LEAD_STATUSES as unknown as [LeadStatus, ...LeadStatus[]])

// ─── Create ──────────────────────────────────────────────────────────────────

const newLeadSchema = z.object({
  company_name: optionalText,
  contact_name: optionalText,
  email: optionalText,
  phone: optionalText,
  phone_secondary: optionalText,
  phone_whatsapp: optionalText,
  niche: optionalText,
  source: optionalText,
  notes: optionalText,
  next_action_at: isoDate,
  form_answers_raw: optionalText,
})

export async function createLeadAction(
  input: z.input<typeof newLeadSchema>
): Promise<ActionResult<Lead>> {
  const parsed = newLeadSchema.safeParse(input)
  if (!parsed.success) return invalid('Az űrlap hibás. Ellenőrizze a mezőket.')

  const v = parsed.data
  // A lead with nothing to call and nothing to show is not worth a row.
  if (!v.company_name && !v.contact_name && !v.email && !v.phone) {
    return invalid('Adjon meg legalább egy nevet, e-mailt vagy telefonszámot.')
  }

  const result = await createLead(v)
  if (result.ok) revalidatePath(CRM_PATH)
  return result
}

// ─── Edit ────────────────────────────────────────────────────────────────────

const editLeadSchema = newLeadSchema.extend({
  contact_attempts: z.coerce.number().int().min(0).max(999).optional(),
  last_attempt_at: isoDate.optional(),
})

export async function updateLeadAction(
  id: string,
  input: z.input<typeof editLeadSchema>
): Promise<ActionResult<Lead>> {
  if (!z.string().uuid().safeParse(id).success) return invalid('Érvénytelen azonosító.')

  const parsed = editLeadSchema.safeParse(input)
  if (!parsed.success) return invalid('Az űrlap hibás. Ellenőrizze a mezőket.')

  // Note the absence of `status` here: LeadFieldPatch types it as never, so
  // this call cannot move the lead even if a status arrived in the payload.
  const result = await updateLeadFields(id, parsed.data)
  if (result.ok) {
    revalidatePath(CRM_PATH)
    revalidatePath(`${CRM_PATH}/${id}`)
  }
  return result
}

// ─── Move ────────────────────────────────────────────────────────────────────

const transitionSchema = z.object({
  toStatus: statusSchema,
  nextActionAt: isoDate.optional(),
  lostReason: optionalText.optional(),
  note: optionalText.optional(),
})

/**
 * The only action that changes a lead's status.
 *
 * It does not pre-check whether the move is legal. The database decides, and
 * its refusal comes back as a typed CrmError — one source of truth, and no
 * window between the check and the write.
 */
export async function transitionLeadAction(
  id: string,
  input: z.input<typeof transitionSchema>
): Promise<ActionResult<Lead>> {
  if (!z.string().uuid().safeParse(id).success) return invalid('Érvénytelen azonosító.')

  const parsed = transitionSchema.safeParse(input)
  if (!parsed.success) return invalid('Hiányzó vagy hibás adat a státuszváltáshoz.')

  const result = await transitionLead(id, parsed.data.toStatus, {
    nextActionAt: parsed.data.nextActionAt ?? null,
    lostReason: parsed.data.lostReason ?? null,
    note: parsed.data.note ?? null,
  })

  if (result.ok) {
    revalidatePath(CRM_PATH)
    revalidatePath(`${CRM_PATH}/${id}`)
  }
  return result
}

export async function logAttemptAction(id: string): Promise<ActionResult<Lead>> {
  if (!z.string().uuid().safeParse(id).success) return invalid('Érvénytelen azonosító.')
  const result = await logContactAttempt(id)
  if (result.ok) {
    revalidatePath(CRM_PATH)
    revalidatePath(`${CRM_PATH}/${id}`)
  }
  return result
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Removes the lead and, by cascade, its events. Allowed since
 * 004_allow_lead_delete.sql: deleting the whole record is a deliberate act,
 * while editing one event of a lead that lives on is still refused.
 */
export async function deleteLeadAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return invalid('Érvénytelen azonosító.')
  if (!crmConfigured()) return invalid('A CRM adatbázis nincs beállítva.')

  const { error } = await crmDb().from('leads').delete().eq('id', id)
  if (error) {
    console.error('[crm] deleteLead', error.code, error.message)
    return invalid('A lead törlése nem sikerült.')
  }
  revalidatePath(CRM_PATH)
  return { ok: true, data: null }
}

// ─── CSV import ──────────────────────────────────────────────────────────────

export type ImportSummary = {
  imported: number
  skippedRows: number[]
  ignoredColumns: string[]
  totalRows: number
}

/** A row as the preview shows it, before anything is written. */
export type PreviewRow = {
  title: string
  email: string | null
  phone: string | null
  stage: string | null
}

export type CsvPreview = Omit<ImportSummary, 'imported'> & {
  willImport: number
  sample: PreviewRow[]
}

/**
 * Parse only — nothing is written.
 *
 * An import can add hundreds of rows in one click, so the dialog runs this
 * first and shows what is about to happen: how many rows land, which are
 * skipped, which columns went unrecognised, and the first few leads as they
 * will actually be stored.
 */
export async function previewCsvAction(text: string): Promise<ActionResult<CsvPreview>> {
  if (typeof text !== 'string' || !text.trim()) return invalid('Illessze be a CSV tartalmát.')
  if (text.length > 5_000_000) return invalid('A fájl túl nagy (legfeljebb 5 MB).')

  const preview = buildImport(text)
  if (preview.leads.length === 0) {
    return invalid('Nem található importálható sor. Ellenőrizze a fejlécet.')
  }

  return {
    ok: true,
    data: {
      willImport: preview.leads.length,
      skippedRows: preview.skippedRows,
      ignoredColumns: preview.ignoredColumns,
      totalRows: preview.totalRows,
      sample: preview.leads.slice(0, 5).map((l) => ({
        title: l.company_name?.trim() || l.contact_name?.trim() || l.email?.trim() || 'Névtelen lead',
        email: l.email ?? null,
        phone: l.phone ?? null,
        stage: l.meta_stage ?? null,
      })),
    },
  }
}

export async function importCsvAction(text: string): Promise<ActionResult<ImportSummary>> {
  if (typeof text !== 'string' || !text.trim()) return invalid('Illessze be a CSV tartalmát.')
  if (text.length > 5_000_000) return invalid('A fájl túl nagy (legfeljebb 5 MB).')

  const preview = buildImport(text)
  if (preview.leads.length === 0) {
    return invalid('Nem található importálható sor. Ellenőrizze a fejlécet.')
  }

  // Chunked so one oversized paste does not become a single enormous statement.
  let imported = 0
  for (let i = 0; i < preview.leads.length; i += 200) {
    const result = await createLeads(preview.leads.slice(i, i + 200))
    if (!result.ok) {
      // Partial success is reported rather than hidden: the rows already
      // written are real, and pretending otherwise would cause a double import.
      return {
        ok: false,
        error: {
          kind: result.error.kind,
          message:
            imported > 0
              ? `${imported} lead importálva, majd hiba történt: ${result.error.message}`
              : result.error.message,
        },
      }
    }
    imported += result.data
  }

  revalidatePath(CRM_PATH)
  return {
    ok: true,
    data: {
      imported,
      skippedRows: preview.skippedRows,
      ignoredColumns: preview.ignoredColumns,
      totalRows: preview.totalRows,
    },
  }
}
