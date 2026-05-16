'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { saveSpreadsheet, deleteSpreadsheet } from '@/lib/actions'
import { Save, Trash2, Check, Loader2, Plus, Clipboard, X, Download } from 'lucide-react'
import type { Spreadsheet, SheetColumn, SheetRow } from '@/lib/supabase'

function uid() {
  return crypto.randomUUID()
}

function parseTSV(text: string): { columns: SheetColumn[]; rows: SheetRow[] } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { columns: [], rows: [] }

  const headers = lines[0].split('\t').map((h) => h.trim())
  const columns: SheetColumn[] = headers.map((name) => ({
    id: uid(),
    name: name || 'Column',
  }))

  const dataLines = lines.length > 1 ? lines.slice(1) : []
  const rows: SheetRow[] = dataLines.map((line) => {
    const cells = line.split('\t')
    const row: SheetRow = { id: uid() }
    columns.forEach((col, i) => {
      row[col.id] = cells[i]?.trim() ?? ''
    })
    return row
  })

  if (rows.length === 0) rows.push({ id: uid() })

  return { columns, rows }
}

function toCSV(columns: SheetColumn[], rows: SheetRow[]) {
  const header = columns.map((c) => `"${c.name.replace(/"/g, '""')}"`).join(',')
  const body = rows
    .map((row) =>
      columns.map((col) => `"${String(row[col.id] ?? '').replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')
  return header + '\n' + body
}

export default function TableEditor({ sheet }: { sheet: Spreadsheet }) {
  const defaultCol = { id: uid(), name: 'Column 1' }
  const defaultRow = { id: uid() }

  const [name, setName] = useState(sheet.name)
  const [columns, setColumns] = useState<SheetColumn[]>(
    sheet.columns.length > 0 ? sheet.columns : [defaultCol]
  )
  const [rows, setRows] = useState<SheetRow[]>(
    sheet.rows.length > 0 ? sheet.rows : [defaultRow]
  )
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleting] = useTransition()
  const [showImport, setShowImport] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const tableRef = useRef<HTMLDivElement>(null)

  function handleSave() {
    startTransition(async () => {
      await saveSpreadsheet(sheet.id, name, columns, rows)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  function handleDelete() {
    if (!confirm('Delete this table? This cannot be undone.')) return
    startDeleting(async () => {
      await deleteSpreadsheet(sheet.id)
    })
  }

  function handleExport() {
    const csv = toCSV(columns, rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name || 'table'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function addColumn() {
    const col: SheetColumn = { id: uid(), name: `Column ${columns.length + 1}` }
    setColumns((prev) => [...prev, col])
  }

  function removeColumn(colId: string) {
    if (columns.length <= 1) return
    setColumns((prev) => prev.filter((c) => c.id !== colId))
    setRows((prev) =>
      prev.map((row) => {
        const next = { ...row }
        delete next[colId]
        return next
      })
    )
  }

  function renameColumn(colId: string, name: string) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)))
  }

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { id: uid() }])
  }, [])

  function removeRow(rowId: string) {
    if (rows.length <= 1) {
      setRows([{ id: uid() }])
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  function updateCell(rowId: string, colId: string, value: string) {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [colId]: value } : row))
    )
  }

  function handleImport() {
    if (!pasteText.trim()) return
    const { columns: cols, rows: rs } = parseTSV(pasteText)
    if (cols.length > 0) {
      setColumns(cols)
      setRows(rs)
    }
    setPasteText('')
    setShowImport(false)
  }

  function focusCell(rowIdx: number, colIdx: number) {
    const el = tableRef.current?.querySelector(
      `input[data-r="${rowIdx}"][data-c="${colIdx}"]`
    ) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  function handleCellKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const next = e.shiftKey ? colIdx - 1 : colIdx + 1
      if (next >= 0 && next < columns.length) {
        focusCell(rowIdx, next)
      } else if (!e.shiftKey) {
        if (rowIdx + 1 < rows.length) {
          focusCell(rowIdx + 1, 0)
        } else {
          addRow()
          setTimeout(() => focusCell(rowIdx + 1, 0), 16)
        }
      } else if (rowIdx > 0) {
        focusCell(rowIdx - 1, columns.length - 1)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (rowIdx + 1 < rows.length) {
        focusCell(rowIdx + 1, colIdx)
      } else {
        addRow()
        setTimeout(() => focusCell(rowIdx + 1, colIdx), 16)
      }
    }
  }

  const wordCount = `${rows.length} row${rows.length !== 1 ? 's' : ''} · ${columns.length} col${columns.length !== 1 ? 's' : ''}`

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-8 py-6 sm:py-10">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
        <p className="text-[11px] text-zinc-700 tabular-nums">{wordCount}</p>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/[0.08] bg-white/[0.03] text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-300 transition-all"
          >
            <Clipboard size={12} />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/[0.08] bg-white/[0.03] text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-300 transition-all"
          >
            <Download size={12} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
          >
            <Trash2 size={12} />
            <span className="hidden sm:inline">Delete</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              saved
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-white/[0.06] border border-white/[0.1] text-zinc-300 hover:bg-white/[0.09] hover:text-zinc-100'
            }`}
          >
            {isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <Check size={12} />
            ) : (
              <Save size={12} />
            )}
            {isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Untitled Table"
        className="w-full bg-transparent text-2xl sm:text-[28px] font-semibold text-zinc-100 placeholder-zinc-800 outline-none mb-6 sm:mb-8 tracking-tight leading-tight"
      />

      {/* Import panel */}
      {showImport && (
        <div className="mb-6 relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-zinc-300">Import from Excel / Google Sheets</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                Select and copy cells, then paste below. First row becomes column headers.
              </p>
            </div>
            <button
              onClick={() => { setPasteText(''); setShowImport(false) }}
              className="text-zinc-600 hover:text-zinc-400 transition-colors ml-4 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            autoFocus
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste here (Ctrl+V / ⌘V)…"
            rows={6}
            className="w-full bg-black/20 border border-white/[0.06] rounded-lg px-3 py-2.5 text-[13px] text-zinc-300 placeholder-zinc-700 outline-none resize-none font-mono leading-relaxed focus:border-indigo-500/30 transition-colors"
          />
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={handleImport}
              disabled={!pasteText.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.1] bg-white/[0.06] text-zinc-200 hover:bg-white/[0.1] disabled:opacity-40 transition-all"
            >
              Import data
            </button>
            <p className="text-[11px] text-zinc-700">This replaces current table contents.</p>
          </div>
        </div>
      )}

      {/* Spreadsheet grid */}
      <div ref={tableRef} className="flex-1 overflow-x-auto rounded-xl border border-white/[0.07]">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-white/[0.04]">
              <th className="w-10 border-b border-r border-white/[0.06] px-2 py-2" />
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="group/th border-b border-r border-white/[0.06] px-0 py-0 min-w-[120px] sm:min-w-[150px]"
                >
                  <div className="flex items-center">
                    <input
                      value={col.name}
                      onChange={(e) => renameColumn(col.id, e.target.value)}
                      className="flex-1 bg-transparent px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 outline-none focus:text-zinc-200 transition-colors w-full"
                    />
                    {columns.length > 1 && (
                      <button
                        onClick={() => removeColumn(col.id)}
                        className="opacity-0 group-hover/th:opacity-100 pr-2 text-zinc-700 hover:text-red-400 transition-all"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="border-b border-white/[0.06] w-10">
                <button
                  onClick={addColumn}
                  className="w-full h-full flex items-center justify-center py-2 px-2 text-zinc-700 hover:text-zinc-400 hover:bg-white/[0.04] transition-all"
                >
                  <Plus size={13} />
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.id} className="group/row hover:bg-white/[0.02] transition-colors">
                <td className="border-b border-r border-white/[0.04] px-2 text-center">
                  <span className="text-[10px] text-zinc-700 tabular-nums group-hover/row:hidden">
                    {rowIdx + 1}
                  </span>
                  <button
                    onClick={() => removeRow(row.id)}
                    className="hidden group-hover/row:flex items-center justify-center w-full text-zinc-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </td>

                {columns.map((col, colIdx) => (
                  <td
                    key={col.id}
                    className="border-b border-r border-white/[0.04] p-0"
                  >
                    <input
                      data-r={rowIdx}
                      data-c={colIdx}
                      value={String(row[col.id] ?? '')}
                      onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                      onKeyDown={(e) => handleCellKey(e, rowIdx, colIdx)}
                      className="w-full px-3 py-2 text-sm text-zinc-300 bg-transparent outline-none focus:bg-indigo-500/[0.06] focus:text-zinc-100 transition-colors"
                    />
                  </td>
                ))}

                <td className="border-b border-white/[0.04]" />
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={addRow}
          className="flex items-center gap-2 px-4 py-2.5 w-full text-left text-[11px] text-zinc-700 hover:text-zinc-500 hover:bg-white/[0.03] transition-all border-t border-white/[0.04]"
        >
          <Plus size={12} />
          Add row
        </button>
      </div>
    </div>
  )
}
