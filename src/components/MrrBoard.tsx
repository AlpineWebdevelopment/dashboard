'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createMrrClient, deleteMrrClient, updateMrrClient, type MrrClientInput } from '@/lib/actions'
import type { MrrClient } from '@/lib/supabase'
import {
  earnedForMonth,
  fmtDate,
  fmtMoney,
  fmtMoneyCompact,
  idxLabel,
  idxLabelShort,
  isActiveInMonth,
  monthIdxOf,
  mrrForMonth,
  oneOffForMonth,
  outstandingSetup,
  setupFeesForMonth,
} from '@/lib/mrr'
import { Briefcase, Loader2, Pencil, Plus, Repeat, Trash2, TrendingUp, X } from 'lucide-react'

// ─── Board ───────────────────────────────────────────────────────────────────

export default function MrrBoard({
  initialClients,
  supabaseConfigured,
}: {
  initialClients: MrrClient[]
  supabaseConfigured: boolean
}) {
  const [clients, setClients] = useState<MrrClient[]>(initialClients)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; client: MrrClient } | null>(null)

  const now = new Date()
  const currentIdx = now.getFullYear() * 12 + now.getMonth()
  const [selectedIdx, setSelectedIdx] = useState(currentIdx)

  const firstIdx = useMemo(
    () => (clients.length ? Math.min(...clients.map((c) => monthIdxOf(c.start_date))) : currentIdx),
    [clients, currentIdx]
  )

  const monthOptions = useMemo(() => {
    const opts: number[] = []
    for (let i = currentIdx; i >= Math.min(firstIdx, currentIdx); i--) opts.push(i)
    return opts
  }, [currentIdx, firstIdx])

  const mrr = mrrForMonth(clients, selectedIdx)
  const setupFees = setupFeesForMonth(clients, selectedIdx)
  const oneOff = oneOffForMonth(clients, selectedIdx)
  const totalEarned = mrr + setupFees + oneOff
  const activeCount = clients.filter((c) => isActiveInMonth(c, selectedIdx)).length
  const outstanding = outstandingSetup(clients)

  const recurring = useMemo(
    () =>
      clients
        .filter((c) => c.kind === 'recurring')
        .sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [clients]
  )
  const oneOffs = useMemo(
    () =>
      clients
        .filter((c) => c.kind === 'oneoff')
        .sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [clients]
  )

  function upsertLocal(saved: MrrClient) {
    setClients((prev) => {
      const i = prev.findIndex((c) => c.id === saved.id)
      if (i === -1) return [...prev, saved]
      const next = [...prev]
      next[i] = saved
      return next
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
        <div>
          <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2 sm:mb-3">
            Revenue
          </p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
            MRR
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.1] rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors cursor-pointer"
          >
            {monthOptions.map((idx) => (
              <option key={idx} value={idx}>
                {idxLabel(idx)}{idx === currentIdx ? ' (current)' : ''}
              </option>
            ))}
          </select>
          {supabaseConfigured && (
            <button
              onClick={() => setModal({ mode: 'create' })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-teal-500/20 bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 text-[13px] font-medium transition-all duration-150"
            >
              <Plus size={13} />
              Add Client
            </button>
          )}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <StatTile
          label={`MRR · ${idxLabel(selectedIdx)}`}
          value={fmtMoney(mrr)}
          sub={`${activeCount} active client${activeCount !== 1 ? 's' : ''}`}
        />
        <StatTile
          label="Setup fees this month"
          value={fmtMoney(setupFees)}
          sub={
            outstanding.count > 0
              ? `${fmtMoney(outstanding.total)} pending from ${outstanding.count} onboarding client${outstanding.count !== 1 ? 's' : ''}`
              : 'no setup outstanding'
          }
        />
        <StatTile
          label="Total earned this month"
          value={fmtMoney(totalEarned)}
          sub={`${fmtMoney(mrr)} monthly · ${fmtMoney(setupFees)} setup · ${fmtMoney(oneOff)} one-off`}
        />
      </div>

      {/* Income over time */}
      <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] p-5 mb-10">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-4">
          Income over time
        </p>
        {clients.length > 0 ? (
          <IncomeChart clients={clients} firstIdx={firstIdx} currentIdx={currentIdx} selectedIdx={selectedIdx} />
        ) : (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 py-10 text-center">
            The income path shows up once you add your first client.
          </p>
        )}
      </div>

      {/* Lists */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 sm:py-28 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
          <div className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center mb-4">
            <TrendingUp size={16} className="text-zinc-400 dark:text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500 mb-1">
            {supabaseConfigured ? 'No clients yet' : 'Supabase not connected'}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-700">
            {supabaseConfigured ? 'Hit "Add Client" to start tracking revenue' : 'Add env vars to start saving'}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Repeat size={13} className="text-teal-600 dark:text-teal-400" />
              <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Recurring clients</h2>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{recurring.length}</span>
            </div>
            {recurring.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-600">No recurring clients yet.</p>
            ) : (
              <div className="space-y-2">
                {recurring.map((c) => (
                  <ClientRow key={c.id} client={c} currentIdx={currentIdx} onEdit={() => setModal({ mode: 'edit', client: c })} onDeleted={() => setClients((prev) => prev.filter((x) => x.id !== c.id))} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <Briefcase size={13} className="text-amber-600 dark:text-amber-400" />
              <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">One-off jobs</h2>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{oneOffs.length}</span>
            </div>
            {oneOffs.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-600">No one-off jobs yet.</p>
            ) : (
              <div className="space-y-2">
                {oneOffs.map((c) => (
                  <ClientRow key={c.id} client={c} currentIdx={currentIdx} onEdit={() => setModal({ mode: 'edit', client: c })} onDeleted={() => setClients((prev) => prev.filter((x) => x.id !== c.id))} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {modal && (
        <ClientModal
          client={modal.mode === 'edit' ? modal.client : null}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            upsertLocal(saved)
            setModal(null)
          }}
        />
      )}
    </>
  )
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] p-5">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">
        {label}
      </p>
      <p className="text-[26px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight mb-1">{value}</p>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-600">{sub}</p>
    </div>
  )
}

// ─── Chart ───────────────────────────────────────────────────────────────────

function niceCeil(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 100, step: 25 }
  const rough = max / 4
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  let step = 10 * pow
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (rough <= m * pow) { step = m * pow; break }
  }
  return { top: Math.ceil(max / step) * step, step }
}

function IncomeChart({
  clients,
  firstIdx,
  currentIdx,
  selectedIdx,
}: {
  clients: MrrClient[]
  firstIdx: number
  currentIdx: number
  selectedIdx: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null) // point index into `points`

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const points = useMemo(() => {
    const pts: { idx: number; earned: number }[] = []
    // Clamp so a client whose start date is in a future month can't empty the range
    for (let i = Math.min(firstIdx, currentIdx); i <= currentIdx; i++) pts.push({ idx: i, earned: earnedForMonth(clients, i) })
    return pts
  }, [clients, firstIdx, currentIdx])

  const height = 240
  const pad = { top: 16, right: 16, bottom: 26, left: 48 }
  const innerW = Math.max(width - pad.left - pad.right, 1)
  const innerH = height - pad.top - pad.bottom

  const { top: yMax, step: yStep } = niceCeil(Math.max(...points.map((p) => p.earned)))
  const yTicks: number[] = []
  for (let v = 0; v <= yMax; v += yStep) yTicks.push(v)

  const xFor = (i: number) => pad.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2)
  const yFor = (v: number) => pad.top + innerH - (v / yMax) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p.earned).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xFor(points.length - 1).toFixed(1)},${yFor(0)} L${xFor(0).toFixed(1)},${yFor(0)} Z`

  // Thin the x labels so they never collide (~60px per label)
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(Math.floor(innerW / 60), 1)))

  function onPointerMove(e: React.PointerEvent) {
    if (!containerRef.current || points.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const t = points.length > 1 ? (x - pad.left) / innerW : 0
    const i = Math.round(t * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }

  const selectedPoint = points.findIndex((p) => p.idx === selectedIdx)
  const last = points[points.length - 1]
  const hoverPt = hover !== null ? points[hover] : null

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-none"
        >
          {/* gridlines + y ticks */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={pad.left} x2={width - pad.right} y1={yFor(v)} y2={yFor(v)}
                className="stroke-zinc-200 dark:stroke-white/[0.06]" strokeWidth={1}
              />
              <text
                x={pad.left - 8} y={yFor(v) + 3} textAnchor="end"
                className="fill-zinc-400 dark:fill-zinc-600 text-[10px]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtMoneyCompact(v)}
              </text>
            </g>
          ))}

          {/* x labels */}
          {points.map((p, i) =>
            i % labelEvery === 0 ? (
              <text
                key={p.idx} x={xFor(i)} y={height - 8} textAnchor="middle"
                className="fill-zinc-400 dark:fill-zinc-600 text-[10px]"
              >
                {idxLabelShort(p.idx, p.idx % 12 === 0 || i === 0)}
              </text>
            ) : null
          )}

          {/* area + line */}
          <path d={areaPath} className="fill-teal-500/10 dark:fill-teal-400/10" />
          <path d={linePath} fill="none" className="stroke-teal-500 dark:stroke-teal-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* selected month marker */}
          {selectedPoint !== -1 && selectedPoint !== points.length - 1 && (
            <>
              <circle cx={xFor(selectedPoint)} cy={yFor(points[selectedPoint].earned)} r={6} className="fill-white dark:fill-[#111118]" />
              <circle cx={xFor(selectedPoint)} cy={yFor(points[selectedPoint].earned)} r={4} className="fill-teal-500/50 dark:fill-teal-400/50" />
            </>
          )}

          {/* end marker + direct label */}
          <circle cx={xFor(points.length - 1)} cy={yFor(last.earned)} r={6} className="fill-white dark:fill-[#111118]" />
          <circle cx={xFor(points.length - 1)} cy={yFor(last.earned)} r={4} className="fill-teal-500 dark:fill-teal-400" />
          <text
            x={xFor(points.length - 1) - 8} y={yFor(last.earned) - 10} textAnchor="end"
            className="fill-zinc-700 dark:fill-zinc-300 text-[11px] font-semibold"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fmtMoney(last.earned)}
          </text>

          {/* crosshair */}
          {hoverPt && (
            <>
              <line
                x1={xFor(hover!)} x2={xFor(hover!)} y1={pad.top} y2={pad.top + innerH}
                className="stroke-zinc-300 dark:stroke-white/[0.15]" strokeWidth={1}
              />
              <circle cx={xFor(hover!)} cy={yFor(hoverPt.earned)} r={6} className="fill-white dark:fill-[#111118]" />
              <circle cx={xFor(hover!)} cy={yFor(hoverPt.earned)} r={4} className="fill-teal-500 dark:fill-teal-400" />
            </>
          )}
        </svg>
      )}

      {/* tooltip */}
      {hoverPt && width > 0 && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#111118] shadow-lg px-3 py-2"
          style={{
            left: Math.min(Math.max(xFor(hover!) + 10, 0), width - 150),
            top: Math.max(yFor(hoverPt.earned) - 54, 0),
          }}
        >
          <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtMoney(hoverPt.earned)}
          </p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded-full bg-teal-500 dark:bg-teal-400" />
            Income · {idxLabel(hoverPt.idx)}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Client row ──────────────────────────────────────────────────────────────

function ClientRow({
  client,
  currentIdx,
  onEdit,
  onDeleted,
}: {
  client: MrrClient
  currentIdx: number
  onEdit: () => void
  onDeleted: () => void
}) {
  const [deleting, startDelete] = useTransition()
  const isRecurring = client.kind === 'recurring'
  const ended = isRecurring && !!client.end_date && monthIdxOf(client.end_date) < currentIdx

  function handleDelete() {
    if (!confirm(`Delete "${client.name}"? This can't be undone.`)) return
    startDelete(async () => {
      await deleteMrrClient(client.id)
      onDeleted()
    })
  }

  return (
    <div className="group rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100/70 dark:hover:bg-white/[0.05] p-4 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{client.name}</p>
            {isRecurring ? (
              !client.golive_date ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  Onboarding · {fmtMoney(Number(client.setup_fee) / 2)} pending
                </span>
              ) : ended ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-200/70 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-500">
                  Ended {client.end_date ? fmtDate(client.end_date) : ''}
                </span>
              ) : (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300">
                  Active{client.end_date ? ` · ends ${fmtDate(client.end_date)}` : ''}
                </span>
              )
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                One-off
              </span>
            )}
          </div>
          {client.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-1.5 line-clamp-2">{client.description}</p>
          )}
          {isRecurring && client.monthly_description && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 line-clamp-1">
              Monthly: {client.monthly_description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            {isRecurring ? (
              <>
                <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(Number(client.monthly_fee))}
                  <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-600">/mo</span>
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(Number(client.setup_fee))} setup · since {fmtDate(client.start_date)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(Number(client.setup_fee))}
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-600">{fmtDate(client.start_date)}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/[0.06] transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
              title="Delete"
            >
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add / edit modal ────────────────────────────────────────────────────────

const inputClass =
  'w-full bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

const labelClass =
  'block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5'

function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: MrrClient | null
  onClose: () => void
  onSaved: (saved: MrrClient) => void
}) {
  const [kind, setKind] = useState<'recurring' | 'oneoff'>(client?.kind ?? 'recurring')
  const [name, setName] = useState(client?.name ?? '')
  const [description, setDescription] = useState(client?.description ?? '')
  const [setupFee, setSetupFee] = useState(client ? String(client.setup_fee) : '')
  const [monthlyFee, setMonthlyFee] = useState(client ? String(client.monthly_fee) : '')
  const [monthlyDescription, setMonthlyDescription] = useState(client?.monthly_description ?? '')
  const [startDate, setStartDate] = useState(client?.start_date ?? new Date().toISOString().slice(0, 10))
  const [goliveDate, setGoliveDate] = useState(client?.golive_date ?? '')
  const [firstBillingDate, setFirstBillingDate] = useState(client?.first_billing_date ?? '')
  const [endDate, setEndDate] = useState(client?.end_date ?? '')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!startDate) { setError('Start date is required'); return }
    setError('')
    const input: MrrClientInput = {
      name: name.trim(),
      description: description.trim(),
      kind,
      setup_fee: Number(setupFee) || 0,
      monthly_fee: kind === 'recurring' ? Number(monthlyFee) || 0 : 0,
      monthly_description: kind === 'recurring' ? monthlyDescription.trim() : '',
      start_date: startDate,
      golive_date: kind === 'recurring' && goliveDate ? goliveDate : null,
      first_billing_date: kind === 'recurring' && firstBillingDate ? firstBillingDate : null,
      end_date: kind === 'recurring' && endDate ? endDate : null,
    }
    start(async () => {
      try {
        const saved = client ? await updateMrrClient(client.id, input) : await createMrrClient(input)
        onSaved(saved)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="h-1 w-full bg-gradient-to-r from-teal-500/60 via-emerald-500/60 to-cyan-500/60" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center">
                {kind === 'recurring' ? (
                  <Repeat size={15} className="text-teal-600 dark:text-teal-400" />
                ) : (
                  <Briefcase size={15} className="text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                {client ? 'Edit' : 'Add'} {kind === 'recurring' ? 'Client' : 'One-off Job'}
              </h2>
            </div>
            <button onClick={onClose} className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Kind toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08]">
              {(
                [
                  { key: 'recurring', label: 'Recurring client', icon: <Repeat size={12} /> },
                  { key: 'oneoff', label: 'One-off job', icon: <Briefcase size={12} /> },
                ] as const
              ).map((k) => (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setKind(k.key)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    kind === k.key
                      ? 'bg-white dark:bg-white/[0.1] text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {k.icon}
                  {k.label}
                </button>
              ))}
            </div>

            <div>
              <label className={labelClass}>{kind === 'recurring' ? 'Client name' : 'Job title'}</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'recurring' ? 'e.g. Acme Corp' : 'e.g. Landing page for Acme'}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Job description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are we building for them?"
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{kind === 'recurring' ? 'Setup fee (Ft)' : 'Income (Ft)'}</label>
                <input
                  value={setupFee}
                  onChange={(e) => setSetupFee(e.target.value)}
                  type="number" min="0" step="any" placeholder="0"
                  className={inputClass}
                />
              </div>
              {kind === 'recurring' && (
                <div>
                  <label className={labelClass}>Monthly fee (Ft)</label>
                  <input
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    type="number" min="0" step="any" placeholder="0"
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            {kind === 'recurring' && (
              <div>
                <label className={labelClass}>Monthly job description</label>
                <textarea
                  value={monthlyDescription}
                  onChange={(e) => setMonthlyDescription(e.target.value)}
                  placeholder="What do we do for them every month?"
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{kind === 'recurring' ? 'Contract date' : 'Date'}</label>
                <input
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  type="date"
                  className={inputClass}
                />
                {kind === 'recurring' && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">50% of setup fee paid here</p>
                )}
              </div>
              {kind === 'recurring' && (
                <div>
                  <label className={labelClass}>Go-live date</label>
                  <input
                    value={goliveDate}
                    onChange={(e) => setGoliveDate(e.target.value)}
                    type="date"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
                    Other 50% + billing starts. Empty = onboarding
                  </p>
                </div>
              )}
            </div>

            {kind === 'recurring' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>First billing (optional)</label>
                  <input
                    value={firstBillingDate}
                    onChange={(e) => setFirstBillingDate(e.target.value)}
                    type="date"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
                    Only if the monthly fee starts later than go-live
                  </p>
                </div>
                <div>
                  <label className={labelClass}>End date (optional)</label>
                  <input
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    type="date"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-teal-500/20 border border-teal-500/20 text-teal-700 dark:text-teal-300 hover:bg-teal-500/30 disabled:opacity-40 transition-colors"
              >
                {pending && <Loader2 size={11} className="animate-spin" />}
                {pending ? 'Saving…' : client ? 'Save Changes' : kind === 'recurring' ? 'Add Client' : 'Add Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
