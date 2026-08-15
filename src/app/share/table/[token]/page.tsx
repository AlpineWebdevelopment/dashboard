import { getSpreadsheetByShareToken } from '@/lib/actions'
import { notFound } from 'next/navigation'

export default async function SharedTableView({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const sheet = await getSpreadsheetByShareToken(token)
  if (!sheet) notFound()

  const columns = sheet.columns ?? []
  const rows = sheet.rows ?? []

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="border-b border-white/[0.06] bg-[rgba(7,7,15,0.9)] px-6 py-3 flex items-center justify-between">
        <span className="text-[13px] text-zinc-600 font-medium tracking-widest uppercase dark:text-zinc-200">View only</span>
        <span className="text-[13px] text-zinc-700 dark:text-zinc-100">Shared via dashboard</span>
      </div>

      {/* Content */}
      <div className="px-6 py-10 max-w-full overflow-x-auto">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-6 tracking-tight">{sheet.name}</h1>

        {columns.length === 0 ? (
          <p className="text-zinc-600 text-sm italic dark:text-zinc-200">This table has no columns yet.</p>
        ) : (
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-white/[0.04] border-b border-white/[0.07]">
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className="text-left px-4 py-2.5 text-[13px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap dark:text-zinc-200"
                    >
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                  >
                    {columns.map((col) => (
                      <td key={col.id} className="px-4 py-2.5 text-zinc-500 text-sm dark:text-zinc-200">
                        {row[col.id] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-600 text-sm italic dark:text-zinc-200">
                      No rows yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[13px] text-zinc-700 dark:text-zinc-100">
          {rows.length} row{rows.length !== 1 ? 's' : ''} · {columns.length} column{columns.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}
