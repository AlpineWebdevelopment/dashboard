// Recurring time slots → concrete times, and auto-fill. Pure: no clock beyond
// the `from` passed in, no database. Shared by the editor preview and the
// auto-fill action.
//
// A slot is "18:00 on Mon/Wed/Fri" for one account, read in its own timezone,
// so it stays 18:00 across a DST change. A post with several targets needs a
// time that every targeted account with slots has as a slot, and that none of
// them has already given to another post. Accounts with no slots at all don't
// constrain the choice.

import { partsInTz, zonedTimeToUtc } from '@/lib/tz'
import type { SocialSlot } from './types'

const HORIZON_DAYS = 120

/** Every occurrence of an account's active slots from `from` onwards, as ms since epoch. */
export function slotOccurrences(slots: SocialSlot[], from: Date, days = HORIZON_DAYS): number[] {
  const out: number[] = []
  const active = slots.filter((s) => s.active && s.weekdays.length)
  if (!active.length) return out
  // Walk calendar days in each slot's zone. Date.UTC does the day arithmetic,
  // which is zone-free; the zone only matters when the wall time is resolved.
  for (const slot of active) {
    const start = partsInTz(from, slot.timezone)
    const [hh, mm] = slot.time_local.split(':').map(Number)
    for (let i = 0; i <= days; i++) {
      const day = new Date(Date.UTC(start.year, start.month - 1, start.day + i))
      const isoWeekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay()
      if (!slot.weekdays.includes(isoWeekday)) continue
      const at = zonedTimeToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh, mm, slot.timezone)
      if (at.getTime() >= from.getTime()) out.push(at.getTime())
    }
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

export type FillInput = {
  /** In the order they should be given times. */
  posts: { id: string; target_ids: string[] }[]
  slotsByAccount: Map<string, SocialSlot[]>
  /** Minutes already taken per account (other posts' scheduled times). */
  takenByAccount: Map<string, Set<number>>
  from: Date
}

export type FillResult = {
  assigned: { id: string; scheduled_at: string }[]
  skipped: { id: string; reason: string }[]
}

const minuteKey = (ms: number) => Math.floor(ms / 60_000)

export function autoFill(input: FillInput): FillResult {
  const assigned: FillResult['assigned'] = []
  const skipped: FillResult['skipped'] = []
  const taken = new Map<string, Set<number>>()
  for (const [k, v] of input.takenByAccount) taken.set(k, new Set([...v].map(minuteKey)))
  const occurrences = new Map<string, number[]>()
  for (const [accountId, slots] of input.slotsByAccount) {
    occurrences.set(accountId, slotOccurrences(slots, input.from))
  }

  for (const post of input.posts) {
    if (!post.target_ids.length) {
      skipped.push({ id: post.id, reason: 'No accounts ticked.' })
      continue
    }
    const constrained = post.target_ids.filter((a) => (occurrences.get(a)?.length ?? 0) > 0)
    if (!constrained.length) {
      skipped.push({ id: post.id, reason: 'None of its accounts has time slots.' })
      continue
    }
    // Candidates come from the first constrained account; the rest must share the minute.
    const others = constrained.slice(1).map((a) => new Set(occurrences.get(a)!.map(minuteKey)))
    const pick = occurrences.get(constrained[0])!.find((ms) => {
      const key = minuteKey(ms)
      if (!others.every((set) => set.has(key))) return false
      return post.target_ids.every((a) => !taken.get(a)?.has(key))
    })
    if (pick === undefined) {
      skipped.push({
        id: post.id,
        reason:
          constrained.length > 1
            ? 'Its accounts have no free slot in common. Give them a shared time, or schedule the accounts separately.'
            : 'No free slot in the next 120 days.',
      })
      continue
    }
    for (const a of post.target_ids) {
      if (!taken.has(a)) taken.set(a, new Set())
      taken.get(a)!.add(minuteKey(pick))
    }
    assigned.push({ id: post.id, scheduled_at: new Date(pick).toISOString() })
  }
  return { assigned, skipped }
}
