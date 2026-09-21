// Database + Storage access for the social scheduler. Server-only.
//
// Every social_* table has RLS on with no policies, so the anon key sees
// nothing; all of it runs through the service-role client (crmDb), the same
// posture as the CRM and finances. The row mappers here are the one place
// token columns are dropped — nothing returned from this module carries one.

import { crmConfigured, crmDb } from '@/lib/crm/db'
import { STORAGE_BUCKET } from './config'
import type {
  IgQuota,
  SocialAccount,
  SocialConnection,
  SocialJob,
  SocialMedia,
  SocialPost,
  SocialSlot,
} from './types'

export const socialConfigured = crmConfigured
export const db = crmDb

type Row = Record<string, unknown>

const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

export function toConnection(r: Row): SocialConnection {
  return {
    id: String(r.id),
    fb_user_id: String(r.fb_user_id),
    fb_name: str(r.fb_name),
    user_token_expires_at: str(r.user_token_expires_at),
    data_access_expires_at: str(r.data_access_expires_at),
    scopes: (r.scopes as string[] | null) ?? [],
    status: (r.status as SocialConnection['status']) ?? 'ok',
    last_checked_at: str(r.last_checked_at),
  }
}

export function toAccount(r: Row): SocialAccount {
  return {
    id: String(r.id),
    connection_id: String(r.connection_id),
    platform: r.platform as SocialAccount['platform'],
    external_id: String(r.external_id),
    page_id: String(r.page_id),
    name: str(r.name),
    username: str(r.username),
    picture_url: str(r.picture_url),
    enabled: !!r.enabled,
    token_status: (r.token_status as SocialAccount['token_status']) ?? 'ok',
    last_error: str(r.last_error),
    quota: (r.quota as IgQuota | null) ?? null,
  }
}

export function toJob(r: Row): SocialJob {
  return {
    id: String(r.id),
    post_id: String(r.post_id),
    account_id: String(r.account_id),
    status: r.status as SocialJob['status'],
    run_at: String(r.run_at),
    attempts: Number(r.attempts ?? 0),
    remote_id: str(r.remote_id),
    permalink: str(r.permalink),
    error_kind: (r.error_kind as SocialJob['error_kind']) ?? null,
    error_code: num(r.error_code),
    error_subcode: num(r.error_subcode),
    error_message: str(r.error_message),
    published_at: str(r.published_at),
  }
}

export function toMedia(r: Row, thumbUrl: string | null): SocialMedia {
  return {
    id: String(r.id),
    kind: r.kind as SocialMedia['kind'],
    mime: String(r.mime),
    bytes: Number(r.bytes),
    jpeg_bytes: num(r.jpeg_bytes),
    has_jpeg: !!r.jpeg_path,
    width: num(r.width),
    height: num(r.height),
    duration_s: num(r.duration_s),
    video_codec: str(r.video_codec),
    audio_codec: str(r.audio_codec),
    faststart: r.faststart === null || r.faststart === undefined ? null : !!r.faststart,
    fps: num(r.fps),
    original_name: str(r.original_name),
    purged: !!r.purged_at,
    thumb_url: thumbUrl,
  }
}

export function toSlot(r: Row): SocialSlot {
  return {
    id: String(r.id),
    account_id: String(r.account_id),
    weekdays: ((r.weekdays as number[] | null) ?? []).map(Number),
    time_local: String(r.time_local).slice(0, 5),
    timezone: String(r.timezone ?? 'Europe/Budapest'),
    active: !!r.active,
  }
}

// ─── Storage ────────────────────────────────────────────────────────────────

/** Signed read URLs, keyed by path. Missing or failed paths are simply absent. */
export async function signPaths(paths: string[], seconds: number): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return out
  const { data, error } = await db().storage.from(STORAGE_BUCKET).createSignedUrls(unique, seconds)
  if (error) {
    console.error('[social] signing failed', error.message)
    return out
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out.set(item.path, item.signedUrl)
  }
  return out
}

export async function signPath(path: string, seconds: number): Promise<string> {
  const { data, error } = await db().storage.from(STORAGE_BUCKET).createSignedUrl(path, seconds)
  if (error || !data?.signedUrl) throw new Error(`Could not sign ${path}: ${error?.message ?? 'no url'}`)
  return data.signedUrl
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export const POST_SELECT =
  '*, social_post_media(position, social_media(*)), social_post_targets(account_id), social_publish_jobs(*)'

/** Nested post rows → SocialPost, signing every thumbnail in one request. */
export async function assemblePosts(rows: Row[]): Promise<SocialPost[]> {
  const thumbPaths: string[] = []
  for (const r of rows) {
    for (const pm of (r.social_post_media as Row[] | null) ?? []) {
      const m = pm.social_media as Row | null
      if (m?.thumb_path) thumbPaths.push(String(m.thumb_path))
    }
  }
  const signed = await signPaths(thumbPaths, 60 * 60)

  return rows.map((r) => {
    const media = [...((r.social_post_media as Row[] | null) ?? [])]
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((pm) => pm.social_media as Row)
      .filter(Boolean)
      .map((m) => toMedia(m, m.thumb_path ? signed.get(String(m.thumb_path)) ?? null : null))
    return {
      id: String(r.id),
      post_type: r.post_type as SocialPost['post_type'],
      caption: String(r.caption ?? ''),
      scheduled_at: str(r.scheduled_at),
      status: r.status as SocialPost['status'],
      sort_key: Number(r.sort_key ?? 0),
      created_at: String(r.created_at),
      media,
      target_ids: ((r.social_post_targets as Row[] | null) ?? []).map((t) => String(t.account_id)),
      jobs: ((r.social_publish_jobs as Row[] | null) ?? []).map(toJob),
    }
  })
}

export async function loadPostsByIds(ids: string[]): Promise<SocialPost[]> {
  if (!ids.length) return []
  const { data, error } = await db().from('social_posts').select(POST_SELECT).in('id', ids)
  if (error) throw error
  return assemblePosts((data ?? []) as Row[])
}
