'use client'

// Monthly net as signed bars, with the running balance as a line over them.
//
// Modelled on IncomeChart in MrrBoard.tsx — same hand-rolled SVG, ResizeObserver,
// padding, crosshair and clamped HTML tooltip; there is no chart library in this
// repo and this is not the place to add one. What it could not reuse is the
// scale: that chart's yFor() assumes a zero baseline at the bottom of the plot,
// and this data spends four months below zero (April is -426k).

import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtMoney, fmtMoneyCompact, idxLabel, idxLabelShort } from '@/lib/mrr'
import type { FinanceMonth } from '@/lib/finances'

/** Axis bounds that always contain zero, so the baseline is a real gridline. */
function niceBounds(min: number, max: number): { bottom: number; top: number; step: number } {
  const lo = Math.min(0, min)
  const hi = Math.max(0, max)
  const span = hi - lo || 1
  const rough = span / 5
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  let step = 10 * pow
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (rough <= m * pow) {
      step = m * pow
      break
    }
  }
  return { bottom: Math.floor(lo / step) * step, top: Math.ceil(hi / step) * step, step }
}

export default function BalanceChart({ months }: { months: FinanceMonth[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const height = 260
  const pad = { top: 16, right: 16, bottom: 26, left: 52 }
  const innerW = Math.max(width - pad.left - pad.right, 1)
  const innerH = height - pad.top - pad.bottom

  const bounds = useMemo(() => {
    if (months.length === 0) return { bottom: 0, top: 100, step: 25 }
    const vals = months.flatMap((m) => [m.net, m.running])
    return niceBounds(Math.min(...vals), Math.max(...vals))
  }, [months])

  if (months.length === 0) {
    return (
      <p className="text-[13px] text-zinc-500 dark:text-zinc-200 py-8 text-center">
        No dated entries yet — the chart appears once there is a month to plot.
      </p>
    )
  }

  const { bottom, top, step } = bounds
  const yTicks: number[] = []
  for (let v = bottom; v <= top + 1e-6; v += step) yTicks.push(Math.round(v))

  const yFor = (v: number) => pad.top + innerH - ((v - bottom) / (top - bottom)) * innerH
  // Bars sit in slots; the line's points are the slot centres.
  const slotW = innerW / months.length
  const xFor = (i: number) => pad.left + slotW * (i + 0.5)
  const barW = Math.max(Math.min(slotW * 0.55, 34), 3)
  const zeroY = yFor(0)

  const linePath = months
    .map((m, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(m.running).toFixed(1)}`)
    .join(' ')

  const labelEvery = Math.max(1, Math.ceil(months.length / Math.max(Math.floor(innerW / 60), 1)))
  const hoverPt = hover !== null ? months[hover] : null

  function onPointerMove(e: React.PointerEvent) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - pad.left) / slotW)
    setHover(Math.max(0, Math.min(months.length - 1, i)))
  }

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
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={yFor(v)}
                y2={yFor(v)}
                strokeWidth={1}
                className={
                  v === 0
                    ? 'stroke-zinc-300 dark:stroke-white/[0.14]'
                    : 'stroke-zinc-200 dark:stroke-white/[0.06]'
                }
              />
              <text
                x={pad.left - 8}
                y={yFor(v) + 3}
                textAnchor="end"
                className="fill-zinc-400 dark:fill-zinc-600 text-[12px]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtMoneyCompact(v)}
              </text>
            </g>
          ))}

          {months.map((m, i) =>
            i % labelEvery === 0 ? (
              <text
                key={m.idx}
                x={xFor(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-zinc-400 dark:fill-zinc-600 text-[12px]"
              >
                {idxLabelShort(m.idx, m.idx % 12 === 0 || i === 0)}
              </text>
            ) : null
          )}

          {/* Net bars — green above the zero line, red below, the same reading
              the spreadsheet's conditional formatting gave each row. */}
          {months.map((m, i) => {
            const y = m.net >= 0 ? yFor(m.net) : zeroY
            const h = Math.max(Math.abs(yFor(m.net) - zeroY), 1)
            return (
              <rect
                key={m.idx}
                x={xFor(i) - barW / 2}
                y={y}
                width={barW}
                height={h}
                rx={2}
                className={
                  m.net >= 0
                    ? 'fill-emerald-500/45 dark:fill-emerald-400/40'
                    : 'fill-rose-500/45 dark:fill-rose-400/40'
                }
              />
            )
          })}

          <path
            d={linePath}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-indigo-500 dark:stroke-indigo-400"
          />

          {/* End marker for the balance line, labelled directly. */}
          <circle
            cx={xFor(months.length - 1)}
            cy={yFor(months[months.length - 1].running)}
            r={6}
            className="fill-white dark:fill-[#111118]"
          />
          <circle
            cx={xFor(months.length - 1)}
            cy={yFor(months[months.length - 1].running)}
            r={4}
            className="fill-indigo-500 dark:fill-indigo-400"
          />

          {hoverPt && (
            <>
              <line
                x1={xFor(hover!)}
                x2={xFor(hover!)}
                y1={pad.top}
                y2={pad.top + innerH}
                strokeWidth={1}
                className="stroke-zinc-300 dark:stroke-white/[0.15]"
              />
              <circle cx={xFor(hover!)} cy={yFor(hoverPt.running)} r={6} className="fill-white dark:fill-[#111118]" />
              <circle cx={xFor(hover!)} cy={yFor(hoverPt.running)} r={4} className="fill-indigo-500 dark:fill-indigo-400" />
            </>
          )}
        </svg>
      )}

      {hoverPt && width > 0 && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#111118] shadow-lg px-3 py-2"
          style={{
            left: Math.min(Math.max(xFor(hover!) + 10, 0), Math.max(width - 190, 0)),
            top: Math.max(yFor(hoverPt.running) - 96, 0),
          }}
        >
          <p className="text-[13px] font-semibold text-zinc-900 dark:text-white mb-1">
            {idxLabel(hoverPt.idx)}
          </p>
          <p
            className="text-[12px] text-zinc-500 dark:text-zinc-200 flex items-center gap-1.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span className="inline-block w-3 h-0.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Bevétel {fmtMoney(hoverPt.income)}
          </p>
          <p
            className="text-[12px] text-zinc-500 dark:text-zinc-200 flex items-center gap-1.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span className="inline-block w-3 h-0.5 rounded-full bg-rose-500 dark:bg-rose-400" />
            Kiadás {fmtMoney(hoverPt.expense)}
          </p>
          <p
            className="text-[12px] text-zinc-500 dark:text-zinc-200 flex items-center gap-1.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span className="inline-block w-3 h-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
            Egyenleg {fmtMoney(hoverPt.running)}
          </p>
        </div>
      )}
    </div>
  )
}
