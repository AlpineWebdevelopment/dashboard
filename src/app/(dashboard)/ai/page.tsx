'use client'

import { useState, useEffect } from 'react'

interface Model {
  modelId: string
  displayName: string
  platform: string
  monthlyTokenBudget: string | null
  tpdLimit: number | null
  rpdLimit: number | null
  rpmLimit: number | null
}

interface AnalyticsSummary {
  totalRequests: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
  avgLatencyMs: number
  estimatedCostSavings: number
}

interface ModelStat {
  modelId: string
  displayName: string
  platform: string
  requests: number
  totalInputTokens: number
  totalOutputTokens: number
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function parseBudget(s: string | null | undefined): number | null {
  if (!s) return null
  const match = s.match(/([\d.]+)/)
  if (!match) return null
  const n = parseFloat(match[1])
  if (isNaN(n)) return null
  if (/M/i.test(s)) return n * 1_000_000
  if (/K/i.test(s)) return n * 1_000
  return n
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50/50 dark:bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1">{label}</p>
      <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AIUsagePage() {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [byModel, setByModel] = useState<ModelStat[]>([])
  const [modelLimits, setModelLimits] = useState<Record<string, Model>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ai/models')
      .then(r => r.json())
      .then((data: Model[]) => {
        const map: Record<string, Model> = {}
        data.forEach(m => { map[`${m.platform}-${m.modelId}`] = m })
        setModelLimits(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/ai/analytics?range=${range}`)
      .then(r => r.json())
      .then(d => { setSummary(d.summary); setByModel(d.byModel ?? []) })
      .finally(() => setLoading(false))
  }, [range])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Hub</h1>
        <p className="text-[13px] text-zinc-400 dark:text-zinc-600 mt-0.5">FreeLLMAPI usage across all models</p>
      </div>

      <div className="flex gap-1.5">
        {(['24h', '7d', '30d'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
              range === r
                ? 'bg-cyan-500/10 border border-cyan-500/25 text-cyan-500'
                : 'border border-zinc-200 dark:border-white/[0.07] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50/50 dark:bg-white/[0.03] px-4 py-3 animate-pulse">
              <div className="h-2 bg-zinc-200 dark:bg-white/[0.05] rounded w-1/2 mb-3" />
              <div className="h-5 bg-zinc-200 dark:bg-white/[0.05] rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <>
          {(() => {
            const totalBudget = Object.values(modelLimits).reduce((s, m) => s + (parseBudget(m.monthlyTokenBudget) ?? 0), 0)
            const totalUsed = (summary.totalInputTokens ?? 0) + (summary.totalOutputTokens ?? 0)
            const budgetSub = totalBudget > 0
              ? `${formatTokens(totalUsed)} / ${formatTokens(totalBudget)} monthly limit`
              : `${formatTokens(summary.totalInputTokens ?? 0)} in · ${formatTokens(summary.totalOutputTokens ?? 0)} out`
            return (
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Requests" value={summary.totalRequests ?? '—'} sub={summary.successRate != null ? `${summary.successRate}% success` : undefined} />
                <StatCard label="Tokens used" value={formatTokens(totalUsed)} sub={budgetSub} />
                <StatCard label="Est. savings" value={`$${(summary.estimatedCostSavings ?? 0).toFixed(2)}`} sub="vs paid APIs" />
                <StatCard label="Avg latency" value={summary.avgLatencyMs != null ? `${summary.avgLatencyMs}ms` : '—'} />
              </div>
            )
          })()}

          {byModel.length > 0 && (
            <div>
              <p className="text-[10px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">By model</p>
              <div className="space-y-1.5">
                {(() => {
                  const totalTok = byModel.reduce((s, m) => s + (m.totalInputTokens ?? 0) + (m.totalOutputTokens ?? 0), 0)
                  return byModel.map(m => {
                    const limits = modelLimits[`${m.platform}-${m.modelId}`]
                    const usedTok = (m.totalInputTokens ?? 0) + (m.totalOutputTokens ?? 0)
                    const budgetStr = limits?.monthlyTokenBudget ?? null
                    const budgetNum = parseBudget(budgetStr)
                    const tpd = limits?.tpdLimit ?? null
                    const rpd = limits?.rpdLimit ?? null
                    const rpm = limits?.rpmLimit ?? null
                    const pct = budgetNum && budgetNum > 0 ? Math.min(100, (usedTok / budgetNum) * 100)
                      : tpd && tpd > 0 ? Math.min(100, (usedTok / tpd) * 100)
                      : totalTok > 0 ? (usedTok / totalTok) * 100
                      : 0
                    const pctLabel = budgetNum ? 'of monthly budget' : tpd ? 'of daily limit' : 'of total usage'
                    const hasLimits = budgetStr || tpd || rpd || rpm
                    return (
                      <div key={`${m.platform}-${m.modelId}`} className="rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02] px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300 truncate">{m.displayName || m.modelId}</p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 capitalize">{m.platform}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300">{m.requests} req</p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
                              {formatTokens(usedTok)}{budgetStr ? ` / ${budgetStr} mo` : tpd ? ` / ${formatTokens(tpd)} day` : ''} tok
                            </p>
                          </div>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-zinc-200 dark:bg-white/[0.07] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                              style={{ width: `${pct}%`, minWidth: pct > 0 ? '3px' : '0' }}
                            />
                          </div>
                          <span className={`text-[10px] font-medium shrink-0 ${pct > 80 ? 'text-red-400' : pct > 50 ? 'text-amber-400' : 'text-cyan-400'}`}>
                            {pct < 0.01 ? pct.toFixed(4) : pct < 0.1 ? pct.toFixed(3) : pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}% {pctLabel}
                          </span>
                        </div>
                        {hasLimits && (
                          <div className="flex flex-wrap gap-x-3 mt-1">
                            {budgetStr && <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{budgetStr} tok/mo</span>}
                            {tpd && <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{formatTokens(tpd)} tok/day</span>}
                            {rpd && <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{rpd.toLocaleString()} req/day</span>}
                            {rpm && <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{rpm.toLocaleString()} req/min</span>}
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-zinc-400">No data yet.</p>
      )}
    </div>
  )
}
