'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Loader2, RefreshCw, Radio, Unplug } from 'lucide-react'

export type GoogleStatus = {
  configured: boolean
  connected: boolean
  email: string | null
  lastSyncAt: string | null
  lastSyncSource: string | null
  lastError: string | null
  revision: number
  pushEnabled: boolean
  calendars: { id: string; summary: string; color: string; enabled: boolean; primary: boolean }[]
}

const DOT: Record<string, string> = {
  indigo: 'bg-indigo-400',
  rose: 'bg-rose-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  sky: 'bg-sky-400',
  violet: 'bg-violet-400',
  orange: 'bg-orange-400',
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function GoogleCalendarPanel({
  status,
  onStatusChange,
  onSynced,
}: {
  status: GoogleStatus | null
  onStatusChange: (status: GoogleStatus) => void
  onSynced: () => void
}) {
  const [busy, setBusy] = useState<'sync' | 'disconnect' | string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!status) return null

  if (!status.configured) {
    return (
      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3.5 py-3">
        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500/80" />
        <div>
          <p className="text-xs font-medium text-amber-400/90">Google Calendar not configured</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-600/70">
            Add{' '}
            <code className="rounded bg-amber-500/10 px-1 font-mono text-amber-500/80">GOOGLE_CLIENT_ID</code> and{' '}
            <code className="rounded bg-amber-500/10 px-1 font-mono text-amber-500/80">GOOGLE_CLIENT_SECRET</code> to
            your environment. See <code className="font-mono text-amber-500/80">GOOGLE_CALENDAR_SETUP.md</code>.
          </p>
        </div>
      </div>
    )
  }

  if (!status.connected) {
    return (
      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Google Calendar</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Mirror your Google events into this calendar. Read-only — nothing is written back to Google.
        </p>
        <a
          href="/api/google/connect"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-400"
        >
          Connect Google Calendar
        </a>
      </div>
    )
  }

  async function call(action: string, run: () => Promise<Response>) {
    setBusy(action)
    setError(null)
    try {
      const res = await run()
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
      // The calendars endpoint answers with a fresh status; /sync does not.
      if (body.configured !== undefined) onStatusChange(body as GoogleStatus)
      else {
        const refreshed = await fetch('/api/google/status')
        if (refreshed.ok) onStatusChange(await refreshed.json())
      }
      onSynced()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect Google Calendar? Every mirrored event will be removed from this dashboard.')) return
    setBusy('disconnect')
    setError(null)
    try {
      const res = await fetch('/api/google/status', { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Disconnect failed')
      const refreshed = await fetch('/api/google/status')
      if (refreshed.ok) onStatusChange(await refreshed.json())
      onSynced()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100">Google Calendar</h3>
          <p className="truncate text-[11px] text-zinc-500">{status.email}</p>
        </div>
        <span
          title={
            status.pushEnabled
              ? 'Google pushes changes here as they happen'
              : 'No public HTTPS URL configured — falling back to scheduled polling'
          }
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            status.pushEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
          }`}
        >
          <Radio size={9} /> {status.pushEnabled ? 'Live' : 'Polling'}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-zinc-600">
        Synced {relativeTime(status.lastSyncAt)}
        {status.lastSyncSource ? ` · ${status.lastSyncSource}` : ''}
      </p>

      {status.lastError && (
        <p className="mt-2 rounded-lg bg-rose-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-rose-400">
          {status.lastError}
        </p>
      )}

      {status.calendars.length > 0 && (
        <div className="mt-3 space-y-0.5">
          {status.calendars.map(cal => (
            <button
              key={cal.id}
              disabled={busy !== null}
              onClick={() =>
                call(cal.id, () =>
                  fetch('/api/google/calendars', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: cal.id, enabled: !cal.enabled }),
                  })
                )
              }
              className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              <span
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                  cal.enabled ? `border-transparent ${DOT[cal.color] ?? 'bg-sky-400'}` : 'border-zinc-700'
                }`}
              >
                {busy === cal.id ? (
                  <Loader2 size={9} className="animate-spin text-white" />
                ) : cal.enabled ? (
                  <Check size={9} className="text-zinc-950" strokeWidth={3} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{cal.summary}</span>
              {cal.primary && <span className="shrink-0 text-[9px] uppercase tracking-wider text-zinc-600">main</span>}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-rose-400">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          disabled={busy !== null}
          onClick={() => call('sync', () => fetch('/api/google/sync', { method: 'POST' }))}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-800 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy === 'sync' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Sync now
        </button>
        <button
          disabled={busy !== null}
          onClick={disconnect}
          title="Disconnect"
          className="flex items-center justify-center rounded-lg bg-zinc-800 px-2.5 py-1.5 text-zinc-500 transition-colors hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-50"
        >
          {busy === 'disconnect' ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />}
        </button>
      </div>
    </div>
  )
}
