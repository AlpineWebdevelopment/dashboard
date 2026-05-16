'use client'

import { useActionState } from 'react'
import { createSpreadsheet } from '@/lib/actions'
import { Plus, Loader2, AlertCircle } from 'lucide-react'

const initialState = { error: '' }

function isRedirectError(e: unknown) {
  return (
    typeof e === 'object' &&
    e !== null &&
    'digest' in e &&
    typeof (e as { digest: unknown }).digest === 'string' &&
    (e as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

export default function NewTableButton({ folderId }: { folderId?: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string }) => {
      try {
        await createSpreadsheet(folderId ?? null)
        return { error: '' }
      } catch (e) {
        if (isRedirectError(e)) throw e
        return { error: (e as Error).message }
      }
    },
    initialState
  )

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.1] bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 text-zinc-200 text-[13px] font-medium transition-all duration-150"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          {isPending ? 'Creating…' : 'New Table'}
        </button>
      </form>
      {state?.error && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400/80">
          <AlertCircle size={11} />
          {state.error}
        </div>
      )}
    </div>
  )
}
