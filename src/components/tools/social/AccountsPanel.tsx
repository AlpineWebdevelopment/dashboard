'use client'

// /tools/social/accounts: the Facebook connection, which Pages and IG accounts
// the scheduler may post to, token health, time slots, and a manual publisher
// run (the only way to tick on localhost, which Supabase's pg_net can't reach).

import { useMemo, useState } from 'react'
import { Link2, Play, RefreshCw, TriangleAlert, Unplug } from 'lucide-react'
import {
  disconnectConnection,
  refreshTokenHealth,
  runPublisherNow,
  setAccountEnabled,
  type SocialOverview,
} from '@/lib/social/actions'
import { relative } from '@/lib/social/time'
import type { SocialAccount, SocialSlot } from '@/lib/social/types'
import { toolByKey } from '@/lib/tools/registry'
import { CARD_CLS, EmptyState, btnPrimary, btnSecondary, btnDanger } from '@/components/tools/ui'
import { AccountAvatar, SocialHeader, accountLabel } from './shared'
import SlotsEditor from './SlotsEditor'

const TOOL = toolByKey('social')!

export type ConnectFlash = {
  meta?: string
  pages?: string
  ig?: string
  missing?: string
  meta_error?: string
  detail?: string
}

const ERRORS: Record<string, string> = {
  not_configured: 'SOCIAL_META_APP_ID and SOCIAL_META_APP_SECRET are not set.',
  bad_state: 'The login response did not match the request. Try again.',
  missing_code: 'Facebook did not send a login code back. Try again.',
  user_denied: 'The Facebook login was cancelled.',
  connect_failed: 'Connecting failed.',
}

export function SetupNotices({ overview }: { overview: SocialOverview }) {
  const notes: string[] = []
  if (!overview.configured) notes.push('SUPABASE_SERVICE_ROLE_KEY is missing from the environment.')
  else if (overview.tablesMissing) notes.push('The social tables are missing — run the Social Scheduler migration in Supabase (project figvcskjslkvomoxubuq).')
  if (!overview.metaConfigured) notes.push('SOCIAL_META_APP_ID / SOCIAL_META_APP_SECRET are not set, so Facebook can’t be connected yet.')
  if (!overview.tickConfigured) notes.push('SOCIAL_TICK_SECRET is not set, so Supabase can’t trigger the publisher. “Run publisher now” still works.')
  if (!notes.length) return null
  return (
    <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 space-y-1">
      {notes.map((n) => (
        <p key={n} className="flex gap-2 text-[13px] text-amber-800 dark:text-amber-200">
          <TriangleAlert size={14} className="shrink-0 mt-0.5" />
          {n}
        </p>
      ))}
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-9 h-5 rounded-full transition-colors ${on ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-white/15'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

function AccountRow({
  account,
  slots,
  onToggle,
  onSlots,
}: {
  account: SocialAccount
  slots: SocialSlot[]
  onToggle: (v: boolean) => void
  onSlots: (s: SocialSlot[]) => void
}) {
  return (
    <div className={`${CARD_CLS} p-3 sm:p-4`}>
      <div className="flex items-center gap-3">
        <AccountAvatar account={account} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-zinc-900 dark:text-white truncate">{accountLabel(account)}</div>
          <div className="text-[13px] text-zinc-500 dark:text-zinc-200 flex flex-wrap gap-x-2">
            <span>{account.platform === 'facebook' ? 'Facebook Page' : `Instagram · ${account.name ?? ''}`}</span>
            {account.quota && (
              <span title={`Checked ${relative(account.quota.checked_at)}`}>
                · {account.quota.usage}/{account.quota.total} posts in 24 h
              </span>
            )}
          </div>
          {account.token_status === 'invalid' && (
            <div className="mt-1 text-[13px] text-red-600 dark:text-red-400">
              {account.last_error ?? 'Token is no longer valid.'} Reconnect above.
            </div>
          )}
        </div>
        <Switch on={account.enabled} onChange={onToggle} label={`Post to ${accountLabel(account)}`} />
      </div>
      {account.enabled && <SlotsEditor accountId={account.id} slots={slots} onChange={onSlots} />}
    </div>
  )
}

export default function AccountsPanel({ initial, flash }: { initial: SocialOverview; flash: ConnectFlash }) {
  const [overview, setOverview] = useState(initial)
  const [message, setMessage] = useState<{ text: string; err?: boolean } | null>(() => {
    if (flash.meta === 'connected') {
      const missing = flash.missing ? ` Not granted: ${flash.missing.replaceAll(',', ', ')} — reconnect and allow them.` : ''
      return { text: `Connected: ${flash.pages ?? 0} Page(s), ${flash.ig ?? 0} Instagram account(s).${missing}`, err: !!flash.missing }
    }
    if (flash.meta_error) {
      return { text: `${ERRORS[flash.meta_error] ?? `Facebook said: ${flash.meta_error}.`} ${flash.detail ?? ''}`.trim(), err: true }
    }
    return null
  })
  const [busy, setBusy] = useState<string | null>(null)

  const grouped = useMemo(() => {
    // Each Page, followed by the IG account linked to it.
    const pages = overview.accounts.filter((a) => a.platform === 'facebook')
    return pages.map((p) => ({
      page: p,
      ig: overview.accounts.filter((a) => a.platform === 'instagram' && a.page_id === p.page_id),
    }))
  }, [overview.accounts])

  const toggle = async (a: SocialAccount, enabled: boolean) => {
    setOverview((o) => ({ ...o, accounts: o.accounts.map((x) => (x.id === a.id ? { ...x, enabled } : x)) }))
    const res = await setAccountEnabled(a.id, enabled)
    if (!res.ok) {
      setMessage({ text: res.error.message, err: true })
      setOverview((o) => ({ ...o, accounts: o.accounts.map((x) => (x.id === a.id ? { ...x, enabled: !enabled } : x)) }))
    }
  }

  const health = async () => {
    setBusy('health')
    const res = await refreshTokenHealth()
    setBusy(null)
    if (!res.ok) return setMessage({ text: res.error.message, err: true })
    setOverview(res.data)
    const bad = res.data.accounts.filter((a) => a.token_status === 'invalid').length
    setMessage({ text: bad ? `${bad} account(s) need reconnecting.` : 'All tokens are valid.', err: bad > 0 })
  }

  const disconnect = async (id: string) => {
    if (!confirm('Disconnect this Facebook login? Its Pages, Instagram accounts, and their scheduled jobs are removed. Posts stay as drafts.')) return
    setBusy('disconnect')
    const res = await disconnectConnection(id)
    setBusy(null)
    if (!res.ok) return setMessage({ text: res.error.message, err: true })
    setOverview((o) => ({
      ...o,
      connections: o.connections.filter((c) => c.id !== id),
      accounts: o.accounts.filter((a) => a.connection_id !== id),
    }))
    setMessage({ text: 'Disconnected.' })
  }

  const runNow = async () => {
    setBusy('run')
    const res = await runPublisherNow()
    setBusy(null)
    if (!res.ok) return setMessage({ text: res.error.message, err: true })
    const s = res.data
    setMessage({
      text: s.claimed
        ? `Publisher ran: ${s.processed} job(s) handled, ${s.published} published, ${s.failed} failed${s.released ? `, ${s.released} left for next time` : ''}.`
        : 'Publisher ran: nothing was due.',
    })
  }

  const slotsFor = (id: string) => overview.slots.filter((s) => s.account_id === id)
  const setSlotsFor = (id: string, slots: SocialSlot[]) =>
    setOverview((o) => ({ ...o, slots: [...o.slots.filter((s) => s.account_id !== id), ...slots] }))

  const connectBtn = (label: string) => (
    <a
      href="/api/tools/social/oauth/start"
      aria-disabled={!overview.metaConfigured}
      className={`${btnPrimary(TOOL.accent)} px-3 py-2 text-[13px] ${overview.metaConfigured ? '' : 'pointer-events-none opacity-45'}`}
    >
      <Link2 size={14} /> {label}
    </a>
  )

  return (
    <>
      <SocialHeader />
      <SetupNotices overview={overview} />

      {message && (
        <p className={`mb-4 text-[13px] ${message.err ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {message.text}
        </p>
      )}

      <section className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Facebook connection</h2>
          {overview.connections.length > 0 && (
            <button onClick={health} disabled={busy !== null} className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}>
              <RefreshCw size={13} className={busy === 'health' ? 'animate-spin' : ''} /> Check tokens
            </button>
          )}
        </div>

        {overview.connections.length === 0 ? (
          <div className={`${CARD_CLS} px-4`}>
            <EmptyState
              icon={Link2}
              title="No Facebook login connected yet."
              hint="Connect once; every Page you manage and its linked Instagram account show up below."
            />
            <div className="flex justify-center pb-8">{connectBtn('Connect Facebook')}</div>
          </div>
        ) : (
          <div className="space-y-2">
            {overview.connections.map((c) => {
              const bad = c.status !== 'ok'
              return (
                <div key={c.id} className={`${CARD_CLS} p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-zinc-900 dark:text-white">{c.fb_name ?? 'Facebook user'}</div>
                    <div className="text-[13px] text-zinc-500 dark:text-zinc-200">
                      {c.status === 'invalid'
                        ? 'The login is no longer valid.'
                        : c.user_token_expires_at
                          ? `Login token expires ${relative(c.user_token_expires_at)}`
                          : 'Login token does not expire'}
                      {' · '}Page tokens don’t expire; reconnecting refreshes the Page list.
                      {c.last_checked_at && ` · Checked ${relative(c.last_checked_at)}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {connectBtn(bad ? 'Reconnect now' : 'Reconnect')}
                    <button
                      onClick={() => disconnect(c.id)}
                      disabled={busy !== null}
                      className={`${btnDanger()} px-3 py-2 text-[13px]`}
                    >
                      <Unplug size={14} /> Disconnect
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {grouped.length > 0 && (
        <section className="mb-6">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white mb-1">Accounts</h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mb-3">
            Switch on the ones the scheduler may post to. Only switched-on accounts appear as targets.
          </p>
          <div className="space-y-4">
            {grouped.map(({ page, ig }) => (
              <div key={page.id} className="space-y-2">
                {[page, ...ig].map((a) => (
                  <AccountRow
                    key={a.id}
                    account={a}
                    slots={slotsFor(a.id)}
                    onToggle={(v) => toggle(a, v)}
                    onSlots={(s) => setSlotsFor(a.id, s)}
                  />
                ))}
                {ig.length === 0 && (
                  <p className="pl-1 text-[13px] text-zinc-500 dark:text-zinc-200">
                    No Instagram professional account is linked to {page.name}. Link one in the Page’s settings, then reconnect.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={`${CARD_CLS} p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Publisher</h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
            Supabase checks for due posts every minute and calls the publisher when one is. Run it by hand to test, or on
            localhost, where Supabase can’t reach it.
          </p>
        </div>
        <button onClick={runNow} disabled={busy !== null} className={`${btnSecondary()} px-3 py-2 text-[13px] shrink-0`}>
          <Play size={14} className={busy === 'run' ? 'animate-pulse' : ''} /> Run publisher now
        </button>
      </section>
    </>
  )
}
