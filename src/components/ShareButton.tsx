'use client'

import { useState } from 'react'
import { Share2, Copy, Check, X, Trash2 } from 'lucide-react'
import {
  generatePageShareToken,
  generateSpreadsheetShareToken,
  revokePageShareToken,
  revokeSpreadsheetShareToken,
} from '@/lib/actions'

export default function ShareButton({
  id,
  type,
  initialToken,
}: {
  id: string
  type: 'page' | 'table'
  initialToken: string | null
}) {
  const [token, setToken]       = useState(initialToken)
  const [open, setOpen]         = useState(false)
  const [generating, setGen]    = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [copied, setCopied]     = useState(false)

  const origin =
    typeof window !== 'undefined' ? window.location.origin : ''
  const url = token ? `${origin}/share/${type}/${token}` : null

  const open_ = async () => {
    setOpen(true)
    if (!token) {
      setGen(true)
      try {
        const t =
          type === 'page'
            ? await generatePageShareToken(id)
            : await generateSpreadsheetShareToken(id)
        setToken(t)
      } finally {
        setGen(false)
      }
    }
  }

  const revoke = async () => {
    setRevoking(true)
    try {
      type === 'page'
        ? await revokePageShareToken(id)
        : await revokeSpreadsheetShareToken(id)
      setToken(null)
      setOpen(false)
    } finally {
      setRevoking(false)
    }
  }

  const copy = () => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button
        onClick={open_}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
      >
        <Share2 size={12} />
        {token ? 'Shared' : 'Share'}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[rgba(14,14,22,0.98)] border border-white/[0.1] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Share link</h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Anyone with the link can view this {type} — read-only.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200 flex items-center justify-center transition-all"
              >
                <X size={13} />
              </button>
            </div>

            {generating ? (
              <div className="flex items-center justify-center py-6 text-zinc-600 text-sm">
                Generating link…
              </div>
            ) : (
              <>
                {/* URL row */}
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={url ?? ''}
                    className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono truncate focus:outline-none"
                  />
                  <button
                    onClick={copy}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border font-medium transition-all ${
                      copied
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'
                    }`}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Revoke */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-zinc-600">
                    Your original stays private — they can only view, not edit.
                  </p>
                  <button
                    onClick={revoke}
                    disabled={revoking}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={10} />
                    {revoking ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
