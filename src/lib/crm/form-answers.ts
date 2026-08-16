// Parser for the "Form answers" block pasted out of Meta.
//
// The input looks like this, and Meta owns the format — it will drift:
//
//   Form answers
//   View form
//   Lead form ID 1560776142415870
//   Submitted on Thu Aug 13, 2026 2:53pm.
//   Futtattatsz jelenleg fizetett hirdetést?
//   Igen, rendszeresen
//   Hány érdeklődő keres meg hetente?
//   15-30 lead/hét
//   …
//   Full name
//   Skordai István
//   Phone number
//   +36303972975
//
// Everything after the header lines is strictly alternating question / answer.
// Pairing on position rather than on a trailing "?" matters: several real
// questions are bare labels (Email, Full name, Phone number) and several
// answers contain question marks.
//
// The raw paste is stored alongside the parsed result in leads.form_answers_raw,
// so a format change costs a re-parse rather than a lost lead.

export type FormAnswer = {
  question: string
  answer: string
}

export type FormAnswers = {
  leadFormId: string | null
  /**
   * Naive local time as 'YYYY-MM-DDTHH:mm', with no timezone offset.
   * The paste carries no zone, so pinning one here would be inventing data.
   * Display only — never used for scheduling.
   */
  submittedAt: string | null
  /** Exactly as pasted, e.g. 'Thu Aug 13, 2026 2:53pm'. */
  submittedAtText: string | null
  answers: FormAnswer[]
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** 'Thu Aug 13, 2026 2:53pm' → '2026-08-13T14:53'. Null if unrecognised. */
export function parseSubmittedAt(text: string): string | null {
  const m = text
    .trim()
    .replace(/\.$/, '')
    .match(/^(?:\w{3,9},?\s+)?(\w{3})\w*\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(am|pm)?)?$/i)
  if (!m) return null

  const month = MONTHS[m[1].toLowerCase()]
  if (!month) return null

  const day = Number(m[2])
  const year = Number(m[3])
  let hour = m[4] ? Number(m[4]) : 0
  const minute = m[5] ? Number(m[5]) : 0
  const ampm = m[6]?.toLowerCase()

  // 12am is 00:00 and 12pm is 12:00 — the modulo has to come before the +12.
  if (ampm === 'pm') hour = (hour % 12) + 12
  if (ampm === 'am') hour = hour % 12

  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${year}-${p2(month)}-${p2(day)}T${p2(hour)}:${p2(minute)}`
}

/** Lines Meta prints as chrome rather than content. */
const CHROME = [
  /^form answers$/i,
  /^view form$/i,
  /^válaszok$/i,
  /^űrlap megtekintése$/i,
]

export function parseFormAnswers(raw: string): FormAnswers {
  const result: FormAnswers = {
    leadFormId: null,
    submittedAt: null,
    submittedAtText: null,
    answers: [],
  }
  if (!raw?.trim()) return result

  const rest: string[] = []

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    if (CHROME.some((re) => re.test(t))) continue

    const id = t.match(/^lead\s*form\s*id[:\s]+(\S+)/i)
    if (id) {
      result.leadFormId = id[1]
      continue
    }

    const sub = t.match(/^submitted\s+on[:\s]+(.+?)\.?$/i) ?? t.match(/^beküldve[:\s]+(.+?)\.?$/i)
    if (sub) {
      result.submittedAtText = sub[1].trim()
      result.submittedAt = parseSubmittedAt(sub[1])
      continue
    }

    rest.push(t)
  }

  // Strict pairing. A trailing unpaired line is kept with an empty answer
  // rather than dropped — losing a pasted line silently is worse than showing
  // a blank one.
  for (let i = 0; i < rest.length; i += 2) {
    result.answers.push({ question: rest[i], answer: rest[i + 1] ?? '' })
  }

  return result
}

/**
 * Pull a value out of parsed answers by trying each label in order.
 * Used to prefill the lead's own columns from the paste.
 */
export function pickAnswer(answers: FormAnswer[], ...labels: string[]): string | null {
  for (const label of labels) {
    const hit = answers.find((a) => a.question.trim().toLowerCase() === label.toLowerCase())
    if (hit?.answer) return hit.answer.trim()
  }
  return null
}

/** Best-effort contact details from a pasted form, for prefilling a new lead. */
export function contactFromAnswers(parsed: FormAnswers) {
  return {
    contactName: pickAnswer(parsed.answers, 'Full name', 'Teljes név', 'Név', 'Name'),
    email: pickAnswer(parsed.answers, 'Email', 'E-mail', 'Email cím', 'E-mail cím'),
    phone: pickAnswer(parsed.answers, 'Phone number', 'Telefonszám', 'Phone', 'Telefon'),
    website: pickAnswer(parsed.answers, 'Cég weboldala?', 'Weboldal', 'Website', 'Cég weboldala'),
    companyName: pickAnswer(parsed.answers, 'Cégnév', 'Company name', 'Cég neve', 'Company'),
  }
}
