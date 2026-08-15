export const dynamic = 'force-dynamic'

import { getSpreadsheetsByFolder, getFolders, getFolder } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import NewTableButton from '@/components/NewTableButton'
import NewFolderButton from '@/components/NewFolderButton'
import FolderHeader from '@/components/FolderHeader'
import TablesList from '@/components/TablesList'
import Link from 'next/link'
import { Table2, ChevronLeft } from 'lucide-react'

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

  const [sheets, currentFolder] = await Promise.all([
    getSpreadsheetsByFolder(folderId),
    folderId ? getFolder(folderId) : Promise.resolve(null),
  ])
  const folders = folderId ? [] : await getFolders('tables')

  const backHref = currentFolder?.parent_folder_id
    ? `/tables?folder=${currentFolder.parent_folder_id}`
    : '/tables'

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        {folderId && currentFolder ? (
          <>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors mb-6 sm:mb-8"
            >
              <ChevronLeft size={13} />
              {currentFolder.parent_folder_id ? 'Back' : 'Tables'}
            </Link>

            <FolderHeader folder={currentFolder} />

            <div className="flex items-center justify-between mb-6">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
                {sheets.length} table{sheets.length !== 1 ? 's' : ''}
              </p>
              {supabaseConfigured && (
                <div className="flex items-center gap-2">
                  <NewFolderButton type="tables" />
                  <NewTableButton folderId={folderId} />
                </div>
              )}
            </div>

            <TablesList sheets={sheets} folders={folders} folderId={folderId} />
          </>
        ) : (
          <>
            <div className="flex items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
              <div>
                <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
                  Collection
                </p>
                <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
                  Tables
                </h1>
              </div>
              {supabaseConfigured && (
                <div className="flex items-center gap-2 shrink-0">
                  <NewFolderButton type="tables" />
                  <NewTableButton />
                </div>
              )}
            </div>

            {sheets.length === 0 && folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 sm:py-28 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
                <div className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center mb-4">
                  <Table2 size={16} className="text-zinc-500 dark:text-zinc-200" />
                </div>
                <p className="text-sm text-zinc-500 mb-1 dark:text-zinc-200">
                  {supabaseConfigured ? 'No tables yet' : 'Supabase not connected'}
                </p>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
                  {supabaseConfigured ? 'Hit "New Table" to get started' : 'Add env vars to start saving'}
                </p>
              </div>
            ) : (
              <TablesList sheets={sheets} folders={folders} folderId={null} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
