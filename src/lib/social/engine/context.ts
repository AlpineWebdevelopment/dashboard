// What a platform step gets to work with, and what it hands back.
//
// A step is called with the job in its current status and returns the next
// one. It never waits on Meta: anything that would mean waiting comes back as
// `runAt` in the future, and the next tick picks it up. `runAt: null` means
// "carry on now" — the runner calls the step again within the same tick, so an
// IG image goes container → publish in one pass when Meta is quick.

import type { JobStatus } from '../types'

export type JobRow = {
  id: string
  post_id: string
  account_id: string
  status: JobStatus
  run_at: string
  attempts: number
  container_id: string | null
  child_ids: string[] | null
  remote_id: string | null
  permalink: string | null
  publish_started_at: string | null
  stage_started_at: string | null
}

export type MediaRow = {
  id: string
  kind: 'image' | 'video'
  mime: string
  storage_path: string
  jpeg_path: string | null
  width: number | null
  height: number | null
  duration_s: number | null
}

export type StepContext = {
  job: JobRow
  post: { id: string; caption: string; post_type: 'image' | 'reel' | 'carousel' }
  media: MediaRow[]
  account: { id: string; platform: 'facebook' | 'instagram'; external_id: string; page_id: string }
  token: string
  /** Persists progress (container ids, publish markers) before the next Meta call. */
  save: (patch: Partial<JobRow>) => Promise<void>
  /** A signed URL Meta can fetch, for the variant that platform accepts. */
  mediaUrl: (m: MediaRow) => Promise<string>
  /** Store the IG publishing quota reading on the account. */
  saveQuota: (usage: number, total: number) => Promise<void>
  /** How many Facebook reels this account published through us in the last 24 h. */
  fbReelsLast24h: () => Promise<{ count: number; oldest: string | null }>
}

export type StepResult =
  | { status: Exclude<JobStatus, 'published' | 'failed' | 'cancelled'>; runAt: Date | null; patch?: Partial<JobRow>; note?: string }
  | { status: 'published'; remoteId: string; permalink: string | null }

export const inSeconds = (s: number) => new Date(Date.now() + s * 1000)

/** Thrown by a step for a failure Meta did not phrase as an error response. */
export class StepFailure extends Error {
  constructor(message: string, readonly permanent = true) {
    super(message)
    this.name = 'StepFailure'
  }
}
