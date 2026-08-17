// CSV import for Meta lead exports.
//
// The export Balint works from has these columns:
//   Created, Name, Email, Source, Form, Channel, Stage, Owner, Labels,
//   Phone, Secondary phone number, WhatsApp number
//
// Header matching is case- and accent-insensitive and tolerates the Hungarian
// column names, because the export language follows the Meta account. Unknown
// columns are ignored rather than rejected — Meta adds columns without notice
// and an import should not fail over one.

import type { NewLead } from './leads'

// ─── Delimited text ──────────────────────────────────────────────────────────

/** Meta exports comma-separated, but a Hungarian Excel round-trip yields ';'. */
export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? ''
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch in counts) counts[ch]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] ?? ','
}

/**
 * RFC 4180 parse: quoted fields may contain the delimiter, newlines, and ""
 * as an escaped quote. Hand-rolled because a split(',') mangles every address
 * and every answer containing a comma.
 */
export function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Strip a UTF-8 BOM, which Excel adds and which otherwise corrupts the first
  // header cell so 'Created' never matches.
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\r') {
      // handled by the \n branch
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// ─── Header mapping ──────────────────────────────────────────────────────────

/** Lowercase, strip accents and punctuation, so 'Cégnév' matches 'cegnev'. */
function normalise(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics, so 'é' folds to 'e'
    .replace(/[^a-z0-9]/g, '')
}

/** Every accepted spelling for each column we care about. */
const COLUMN_ALIASES: Record<string, string[]> = {
  created: ['created', 'createdtime', 'createdat', 'letrehozva', 'datum'],
  name: ['name', 'fullname', 'nev', 'teljesnev'],
  email: ['email', 'emailaddress', 'emailcim'],
  source: ['source', 'forras'],
  form: ['form', 'formname', 'urlap', 'urlapneve'],
  channel: ['channel', 'platform', 'csatorna'],
  stage: ['stage', 'szakasz', 'statusz'],
  owner: ['owner', 'assignedto', 'felelos', 'tulajdonos'],
  labels: ['labels', 'label', 'tags', 'cimkek', 'cimke'],
  phone: ['phone', 'phonenumber', 'telefon', 'telefonszam'],
  phoneSecondary: [
    'secondaryphonenumber', 'secondaryphone', 'phone2',
    'masodlagostelefonszam', 'masodiktelefonszam',
  ],
  whatsapp: ['whatsappnumber', 'whatsapp', 'whatsappphone', 'whatsappszam'],
  company: ['company', 'companyname', 'cegnev', 'cegneve'],
}

export type ColumnMap = Partial<Record<keyof typeof COLUMN_ALIASES, number>>

export function mapHeaders(header: string[]): ColumnMap {
  const map: ColumnMap = {}
  header.forEach((raw, index) => {
    const key = normalise(raw)
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (map[field as keyof ColumnMap] === undefined && aliases.includes(key)) {
        map[field as keyof ColumnMap] = index
      }
    }
  })
  return map
}

// ─── Values ──────────────────────────────────────────────────────────────────

function cell(row: string[], index: number | undefined): string | null {
  if (index === undefined) return null
  const v = row[index]?.trim()
  return v ? v : null
}

/**
 * Meta writes several shapes ('2026-08-13T14:53:00+0000', '2026-08-13 14:53:00',
 * '08/13/2026 14:53'). Anything Date cannot read returns null, which leaves
 * created_at on its database default rather than importing a wrong date.
 */
export function parseCreated(value: string | null): string | null {
  if (!value) return null
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct.toISOString()

  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const d = new Date(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      Number(m[4]), Number(m[5]), Number(m[6] ?? 0)
    )
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

export function parseLabels(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ─── Import ──────────────────────────────────────────────────────────────────

export type CsvImportPreview = {
  leads: NewLead[]
  /** Header cells that matched nothing we store. */
  ignoredColumns: string[]
  /** 1-based source row numbers dropped for having no usable identity. */
  skippedRows: number[]
  totalRows: number
}

/**
 * Turn raw CSV text into leads ready for insert.
 *
 * Two decisions worth knowing about:
 *
 *  - Meta's `Stage` lands in meta_stage as text and is never mapped onto our
 *    status. Their vocabulary is not ours, and coercing it would push leads
 *    into states the transition table never approved. Every imported lead
 *    starts at NEW.
 *  - A row with no name, no email and no phone is skipped. There is nothing to
 *    contact and nothing to show in the worklist.
 */
export function buildImport(text: string): CsvImportPreview {
  const delimiter = detectDelimiter(text)
  const rows = parseDelimited(text, delimiter)

  if (rows.length === 0) {
    return { leads: [], ignoredColumns: [], skippedRows: [], totalRows: 0 }
  }

  const header = rows[0]
  const map = mapHeaders(header)
  const claimed = new Set(Object.values(map))
  const ignoredColumns = header.filter((h, i) => !claimed.has(i) && h.trim() !== '')

  const leads: NewLead[] = []
  const skippedRows: number[] = []

  rows.slice(1).forEach((row, i) => {
    const name = cell(row, map.name)
    const email = cell(row, map.email)
    const phone = cell(row, map.phone)

    if (!name && !email && !phone) {
      skippedRows.push(i + 2) // +1 for the header, +1 for 1-based counting
      return
    }

    const lead: NewLead = {
      company_name: cell(row, map.company),
      contact_name: name,
      email,
      phone,
      source: cell(row, map.source),
      meta_form: cell(row, map.form),
      meta_channel: cell(row, map.channel),
      meta_stage: cell(row, map.stage),
      meta_owner: cell(row, map.owner),
      labels: parseLabels(cell(row, map.labels)),
      phone_secondary: cell(row, map.phoneSecondary),
      phone_whatsapp: cell(row, map.whatsapp),
    }

    const created = parseCreated(cell(row, map.created))
    if (created) lead.created_at = created

    leads.push(lead)
  })

  return { leads, ignoredColumns, skippedRows, totalRows: rows.length - 1 }
}
