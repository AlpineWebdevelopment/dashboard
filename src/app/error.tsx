'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
      <AlertTriangle size={32} className="text-red-400 mb-4" />
      <h2 className="text-lg font-semibold text-zinc-100 mb-2">Something went wrong</h2>
      <p className="text-sm text-zinc-500 mb-1 max-w-sm">{error.message}</p>
      <p className="text-xs text-zinc-600 mb-6 max-w-sm">
        Make sure your Supabase table exists — run <code className="font-mono bg-white/[0.05] px-1 rounded">supabase-schema.sql</code> in your Supabase SQL Editor.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
