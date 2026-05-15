'use client'

import { useActionState } from 'react'
import { createPage } from '@/lib/actions'
import { Plus, Loader2, AlertCircle } from 'lucide-react'

const initialState = { error: '' }

export default function NewPageButton() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string }) => {
      try {
        await createPage()
        return { error: '' }
      } catch (e) {
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {isPending ? 'Creating…' : 'New Page'}
        </button>
      </form>
      {state?.error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} />
          {state.error}
        </div>
      )}
    </div>
  )
}
