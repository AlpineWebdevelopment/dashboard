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
      <p className="text-sm text-zinc-500 mb-1 max-w-sm dark:text-zinc-200">{error.message}</p>
      <p className="text-[13px] text-zinc-600 mb-6 max-w-sm dark:text-zinc-200">
        Most likely a table this page reads is missing — check Supabase, and check it is the
        dashboard&apos;s project.
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
