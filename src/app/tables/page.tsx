export const dynamic = 'force-dynamic'

import { getSpreadsheetsByFolder, getFolders, getFolder } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import NewTableButton from '@/components/NewTableButton'
import NewFolderButton from '@/components/NewFolderButton'
import FolderHeader from '@/components/FolderHeader'
import Link from 'next/link'
import { Table2, FolderOpen, ChevronLeft } from 'lucide-react'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { folder: folderParam } = await searchParams
  const folderId = typeof folderParam === 'string' ? folderParam : null

  const [sheets, folders, currentFolder] = await Promise.all([
    getSpreadsheetsByFolder(folderId),
    folderId ? Promise.resolve([]) : getFolders('tables'),
    folderId ? getFolder(folderId) : Promise.resolve(null),
  ])

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-8 pt-10 pb-16 max-w-3xl">
        {folderId && currentFolder ? (
          /* ── Folder view ── */
          <>
            <Link
              href="/tables"
              className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-8"
            >
              <ChevronLeft size={13} />
              Tables
            </Link>

            <FolderHeader folder={currentFolder} />

            <div className="flex items-center justify-between mb-6">
              <p className="text-[11px] text-zinc-700">
                {sheets.length} table{sheets.length !== 1 ? 's' : ''} in this folder
              </p>
              {supabaseConfigured && <NewTableButton folderId={folderId} />}
            </div>

            {sheets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-white/[0.06]">
                <div className="w-11 h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
                  <Table2 size={16} className="text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500 mb-1">No tables yet</p>
                <p className="text-xs text-zinc-700">Hit "New Table" to add one here</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sheets.map((sheet, i) => (
                  <Link
                    key={sheet.id}
                    href={`/tables/${sheet.id}`}
                    className="group relative flex items-center justify-between px-5 py-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.09] transition-all duration-200 overflow-hidden"
                  >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-indigo-400/60 transition-all duration-200" />
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-[11px] text-zinc-700 tabular-nums w-5 text-right shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors truncate">
                          {sheet.name || 'Untitled Table'}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {sheet.columns.length} col{sheet.columns.length !== 1 ? 's' : ''} ·{' '}
                          {sheet.rows.length} row{sheet.rows.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 ml-6 tabular-nums">
                      {timeAgo(sheet.updated_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Root view ── */
          <>
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-3">
                  Collection
                </p>
                <h1 className="text-[28px] font-semibold text-zinc-100 tracking-tight leading-tight">
                  Tables
                </h1>
              </div>
              {supabaseConfigured && (
                <div className="flex items-center gap-2">
                  <NewFolderButton type="tables" />
                  <NewTableButton />
                </div>
              )}
            </div>

            {/* Folders */}
            {folders.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-700 mb-3">
                  Folders
                </p>
                <div className="space-y-1.5">
                  {folders.map((folder) => (
                    <Link
                      key={folder.id}
                      href={`/tables?folder=${folder.id}`}
                      className="group relative flex items-center gap-4 px-5 py-3.5 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.09] transition-all duration-200 overflow-hidden"
                    >
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-6 rounded-r-full bg-amber-400/50 transition-all duration-200" />
                      <FolderOpen size={14} className="text-zinc-600 group-hover:text-amber-400/70 transition-colors shrink-0" />
                      <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors truncate">
                        {folder.name}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Root tables */}
            {folders.length > 0 && sheets.length > 0 && (
              <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-700 mb-3">
                Tables
              </p>
            )}

            {sheets.length === 0 && folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 rounded-2xl border border-dashed border-white/[0.06]">
                <div className="w-11 h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
                  <Table2 size={16} className="text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500 mb-1">
                  {supabaseConfigured ? 'No tables yet' : 'Supabase not connected'}
                </p>
                <p className="text-xs text-zinc-700">
                  {supabaseConfigured
                    ? 'Hit "New Table" to get started'
                    : 'Add env vars to start saving'}
                </p>
              </div>
            ) : sheets.length > 0 ? (
              <div className="space-y-1.5">
                {sheets.map((sheet, i) => (
                  <Link
                    key={sheet.id}
                    href={`/tables/${sheet.id}`}
                    className="group relative flex items-center justify-between px-5 py-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.09] transition-all duration-200 overflow-hidden"
                  >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-indigo-400/60 transition-all duration-200" />
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-[11px] text-zinc-700 tabular-nums w-5 text-right shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors truncate">
                          {sheet.name || 'Untitled Table'}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {sheet.columns.length} col{sheet.columns.length !== 1 ? 's' : ''} ·{' '}
                          {sheet.rows.length} row{sheet.rows.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 ml-6 tabular-nums">
                      {timeAgo(sheet.updated_at)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
