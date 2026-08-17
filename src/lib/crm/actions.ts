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
  ACTIVITY_KINDS,
  backfillLeadStatus,
  convertLeadToClient,
  createLead,
  createLeads,
  logActivity,
  transitionLead,
  updateLeadEvent,
  updateLeadFields,
  type ActivityKind,
  type CrmError,
  type Lead,
  type LeadEvent,
} from './leads'
import { crmConfigured, crmDb } from './db'
import { buildImport } from './csv'

const CRM_PATH = '/atrium-crm'
const MRR_PATH = '/mrr'

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
    message: 'Invalid date',
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
  if (!parsed.success) return invalid('Some fields are not valid. Please check them.')

  const v = parsed.data
  // A lead with nothing to call and nothing to show is not worth a row.
  if (!v.company_name && !v.contact_name && !v.email && !v.phone) {
    return invalid('Add at least a name, an email or a phone number.')
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
  if (!z.string().uuid().safeParse(id).success) return invalid('Invalid id.')

  const parsed = editLeadSchema.safeParse(input)
  if (!parsed.success) return invalid('Some fields are not valid. Please check them.')

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
  if (!z.string().uuid().safeParse(id).success) return invalid('Invalid id.')

  const parsed = transitionSchema.safeParse(input)
  if (!parsed.success) return invalid('Missing or invalid data for the status change.')

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

// ─── Backfill ────────────────────────────────────────────────────────────────

const backfillSchema = z.object({
  toStatus: statusSchema,
  note: optionalText.optional(),
  occurredAt: isoDate.optional(),
  lostReason: optionalText.optional(),
})

/**
 * Move a lead to any status, for entering history that already happened.
 *
 * Deliberately a separate action from transitionLeadAction rather than a flag
 * on it: bypassing the pipeline should be something the caller asks for by
 * name, and it should be obvious in the code which one a screen is using.
 */
export async function backfillStatusAction(
  id: string,
  input: z.input<typeof backfillSchema>
): Promise<ActionResult<Lead>> {
  if (!z.string().uuid().safeParse(id).success) return invalid('Invalid id.')

  const parsed = backfillSchema.safeParse(input)
  if (!parsed.success) return invalid('Missing or invalid data for the correction.')

  const result = await backfillLeadStatus(id, parsed.data.toStatus, {
    note: parsed.data.note ?? null,
    occurredAt: parsed.data.occurredAt ?? null,
    lostReason: parsed.data.lostReason ?? null,
  })

  if (result.ok) {
    revalidatePath(CRM_PATH)
    revalidatePath(`${CRM_PATH}/${id}`)
  }
  return result
}

// ─── Activity log ────────────────────────────────────────────────────────────

const activitySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS as unknown as [ActivityKind, ...ActivityKind[]]),
  note: optionalText.optional(),
  occurredAt: isoDate.optional(),
})

/** Record a call, email, meeting or note without moving the lead. */
export async function logActivityAction(
  id: string,
  input: z.input<typeof activitySchema>
): Promise<ActionResult<LeadEvent>> {
  if (!z.string().uuid().safeParse(id).success) return invalid('Invalid id.')

  const parsed = activitySchema.safeParse(input)
  if (!parsed.success) return invalid('Choose what happened before saving.')

  const result = await logActivity(id, parsed.data.kind, {
    note: parsed.data.note ?? null,
    occurredAt: parsed.data.occurredAt ?? null,
  })

  if (result.ok) {
    revalidatePath(CRM_PATH)
    revalidatePath(`${CRM_PATH}/${id}`)
  }
  return result
}

const editEventSchema = z.object({
  occurredAt: z.string().trim().min(1).refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: 'Invalid date',
  }),
  note: optionalText.optional(),
})

/**
 * Correct the date or the note on a timeline entry.
 *
 * The database refuses any attempt to change which status move an entry
 * records, so this can fix a backfilled date without letting history be
 * rewritten.
 */
export async function updateEventAction(
  leadId: string,
  eventId: string,
  input: z.input<typeof editEventSchema>
): Promise<ActionResult<LeadEvent>> {
  if (!z.string().uuid().safeParse(eventId).success) return invalid('Invalid entry id.')

  const parsed = editEventSchema.safeParse(input)
  if (!parsed.success) return invalid('That date is not valid.')

  const result = await updateLeadEvent(eventId, {
    occurredAt: new Date(parsed.data.occurredAt).toISOString(),
    note: parsed.data.note ?? null,
  })

  if (result.ok) {
    revalidatePath(CRM_PATH)
    revalidatePath(`${CRM_PATH}/${leadId}`)
  }
  return result
}

// ─── Convert a lead into a paying client ─────────────────────────────────────

const newClientSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().default(''),
  kind: z.enum(['recurring', 'oneoff']),
  setup_fee: z.coerce.number().min(0).default(0),
  monthly_fee: z.coerce.number().min(0).default(0),
  monthly_description: z.string().trim().default(''),
  start_date: z.string().trim().min(1),
  golive_date: optionalText.optional(),
  first_billing_date: optionalText.optional(),
  end_date: optionalText.optional(),
})

/**
 * Creates the MRR client and marks the lead as a customer, in one transaction.
 *
 * Lives here rather than beside the other MRR actions in lib/actions.ts because
 * that module talks to Supabase with the anon key, which cannot see the CRM
 * tables at all. Anything touching leads has to go through crmDb().
 *
 * Whether the lead may legally become a customer is not checked here — the
 * database decides, and refuses with CR001 if the lead moved on in another tab
 * between the picker loading and this call.
 */
export async function createClientFromLeadAction(
  leadId: string,
  input: z.input<typeof newClientSchema>
): Promise<ActionResult<{ id: string }>> {
  if (!z.string().uuid().safeParse(leadId).success) return invalid('Invalid lead id.')

  const parsed = newClientSchema.safeParse(input)
  if (!parsed.success) return invalid('Some client fields are not valid. Please check them.')

  const v = parsed.data
  const result = await convertLeadToClient(
    leadId,
    {
      name: v.name,
      description: v.description,
      kind: v.kind,
      setup_fee: v.setup_fee,
      monthly_fee: v.kind === 'recurring' ? v.monthly_fee : 0,
      monthly_description: v.kind === 'recurring' ? v.monthly_description : '',
      start_date: v.start_date,
      golive_date: v.kind === 'recurring' ? v.golive_date ?? null : null,
      first_billing_date: v.kind === 'recurring' ? v.first_billing_date ?? null : null,
      end_date: v.kind === 'recurring' ? v.end_date ?? null : null,
    },
    `Signed as a client: ${v.name}`
  )

  if (result.ok) {
    revalidatePath(MRR_PATH)
    revalidatePath(CRM_PATH)
    revalidatePath(`${CRM_PATH}/${leadId}`)
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
  if (!z.string().uuid().safeParse(id).success) return invalid('Invalid id.')
  if (!crmConfigured()) return invalid('The CRM database is not configured.')

  const { error } = await crmDb().from('leads').delete().eq('id', id)
  if (error) {
    console.error('[crm] deleteLead', error.code, error.message)
    return invalid('Deleting the lead did not work.')
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
  if (typeof text !== 'string' || !text.trim()) return invalid('Paste the CSV contents first.')
  if (text.length > 5_000_000) return invalid('That file is too large (5 MB maximum).')

  const preview = buildImport(text)
  if (preview.leads.length === 0) {
    return invalid('No importable rows found. Check the header row.')
  }

  return {
    ok: true,
    data: {
      willImport: preview.leads.length,
      skippedRows: preview.skippedRows,
      ignoredColumns: preview.ignoredColumns,
      totalRows: preview.totalRows,
      sample: preview.leads.slice(0, 5).map((l) => ({
        title: l.company_name?.trim() || l.contact_name?.trim() || l.email?.trim() || 'Unnamed lead',
        email: l.email ?? null,
        phone: l.phone ?? null,
        stage: l.meta_stage ?? null,
      })),
    },
  }
}

export async function importCsvAction(text: string): Promise<ActionResult<ImportSummary>> {
  if (typeof text !== 'string' || !text.trim()) return invalid('Paste the CSV contents first.')
  if (text.length > 5_000_000) return invalid('That file is too large (5 MB maximum).')

  const preview = buildImport(text)
  if (preview.leads.length === 0) {
    return invalid('No importable rows found. Check the header row.')
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
              ? `${imported} leads imported, then it failed: ${result.error.message}`
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
