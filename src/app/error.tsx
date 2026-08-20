'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * A chunk that 404s means the deploy moved under an open tab: the page in the
 * browser is from the previous build and is asking for a script the new one
 * replaced. Nothing is wrong with the app or the database, and `reset()` cannot
 * help — re-rendering asks for the same dead file again. Only a fresh document
 * fixes it.
 */
function isStaleDeploy(error: Error): boolean {
  return /loading chunk|failed to load chunk|chunkloaderror|dynamically imported module/i.test(
    `${error.name} ${error.message}`
  )
}

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

  const stale = isStaleDeploy(error)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
      <AlertTriangle size={32} className={stale ? 'text-amber-400 mb-4' : 'text-red-400 mb-4'} />
      <h2 className="text-lg font-semibold text-zinc-100 mb-2">
        {stale ? 'This page is out of date' : 'Something went wrong'}
      </h2>

      {stale ? (
        <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mb-6 max-w-sm">
          A new version was deployed while this tab was open, so it asked for a file that no longer
          exists. Reloading picks up the new one — nothing is wrong with your data.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-500 mb-1 max-w-sm dark:text-zinc-200">{error.message}</p>
          {/* Only a guess, so it is worded as one — a wrong certainty here sends
              you to the Supabase dashboard for a problem that is not there. */}
          <p className="text-[13px] text-zinc-600 mb-6 max-w-sm dark:text-zinc-200">
            If this page reads from Supabase, a missing table is the usual cause — check it is the
            dashboard&apos;s project.
          </p>
        </>
      )}

      <button
        onClick={() => (stale ? window.location.reload() : reset())}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
      >
        {stale && <RefreshCw size={14} />}
        {stale ? 'Reload' : 'Try again'}
      </button>
    </div>
  )
}
