'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function PagesError({
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center">
      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle size={18} className="text-red-400" />
      </div>
      <h2 className="text-base font-semibold text-zinc-100 mb-2">Couldn't load pages</h2>
      <p className="text-sm text-zinc-500 mb-1 max-w-sm dark:text-zinc-200">{error.message}</p>
      <p className="text-[13px] text-zinc-600 mb-6 max-w-xs dark:text-zinc-200">
        The <code className="font-mono bg-white/[0.05] px-1 rounded">pages</code> table may be missing from this project&apos;s Supabase database.
      </p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
