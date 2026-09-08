/**
 * Turns a pasted blob of text or a dropped file into a grid the table editor
 * can adopt.
 *
 * Everything runs in the browser — the editor already holds the whole table in
 * memory, so there is nothing to gain by round-tripping a file through the
 * server. `.xlsx` is unzipped with the JSZip the webp converter already pulls
 * in: a workbook is a zip of XML parts, so no spreadsheet dependency is needed.
 */

/** A parsed sheet: one header row, then the body. Every row is `headers.length` wide. */
export type Grid = { headers: string[]; rows: string[][] }

/** A workbook may hold several sheets; every other format yields exactly one. */
export type ParsedTable = { sheets: { name: string; grid: Grid }[] }

export const IMPORT_ACCEPT = '.csv,.tsv,.txt,.xlsx,.xlsm,.xml,.json'

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Drops all-empty rows off the top and bottom, and empty columns off the right. */
function trimEdges(matrix: string[][]): string[][] {
  const filled = (row: string[]) => row.some((cell) => cell.trim() !== '')
  let start = 0
  let end = matrix.length
  while (start < end && !filled(matrix[start])) start++
  while (end > start && !filled(matrix[end - 1])) end--
  const body = matrix.slice(start, end)
  let width = Math.max(0, ...body.map((row) => row.length))
  while (width > 0 && body.every((row) => (row[width - 1] ?? '').trim() === '')) width--
  return body.map((row) => row.slice(0, width))
}

/** First row becomes the headers; every row is padded out to the same width. */
function toGrid(matrix: string[][]): Grid {
  const body = trimEdges(matrix)
  if (body.length === 0) return { headers: [], rows: [] }
  const width = Math.max(...body.map((row) => row.length))
  const headers = Array.from({ length: width }, (_, i) => body[0][i]?.trim() || `Column ${i + 1}`)
  const rows = body.slice(1).map((row) => Array.from({ length: width }, (_, i) => (row[i] ?? '').trim()))
  return { headers, rows }
}

function one(name: string, grid: Grid): ParsedTable {
  return { sheets: [{ name, grid }] }
}

// ── Delimited text (CSV / TSV / clipboard) ───────────────────────────────────

const DELIMITERS = ['\t', ',', ';', '|']

/**
 * Picks the separator by counting candidates outside quotes over the first few
 * lines. Tab keeps its lead on a tie, because that is what a copy out of Excel
 * or Google Sheets produces — the case this panel was built for.
 */
function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n')
  let best = ','
  let bestCount = 0
  for (const delimiter of DELIMITERS) {
    let count = 0
    let quoted = false
    for (const ch of sample) {
      if (ch === '"') quoted = !quoted
      else if (!quoted && ch === delimiter) count++
    }
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

/**
 * RFC 4180 with a configurable separator: a quoted field may hold the
 * separator, a newline, or a doubled `""` standing in for one quote. A quote
 * anywhere but the start of a field is a literal character, which is what
 * hand-written CSV tends to mean by it.
 */
export function parseDelimited(text: string, delimiter?: string): Grid {
  // A CSV saved by Excel opens with a byte-order mark, which would otherwise
  // ride along inside the first header name.
  const src = text.replace(/^\uFEFF/, '')
  const sep = delimiter ?? detectDelimiter(src)
  const matrix: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch !== '"') cell += ch
      else if (src[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
      continue
    }
    if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      matrix.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') cell += ch
  }
  row.push(cell)
  matrix.push(row)

  return toGrid(matrix)
}

// ── XML ──────────────────────────────────────────────────────────────────────

function parseXmlDoc(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('That file is not valid XML.')
  return doc
}

/** Child elements by local name — every part of a workbook is namespaced. */
function kids(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((child) => child.localName === name)
}

/** Attribute by local name, so `r:id` and `ss:Index` are reachable without their prefix. */
function attr(el: Element, name: string): string | null {
  for (const a of Array.from(el.attributes)) if (a.localName === name) return a.value
  return null
}

function firstDeep(el: Element, name: string): Element | null {
  for (const child of Array.from(el.children)) {
    if (child.localName === name) return child
    const found = firstDeep(child, name)
    if (found) return found
  }
  return null
}

function allDeep(el: Element, name: string): Element[] {
  const out: Element[] = []
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.localName === name) out.push(child)
      else walk(child)
    }
  }
  walk(el)
  return out
}

/**
 * Excel's "XML Spreadsheet 2003" export — the thing you actually get from
 * *Save as → XML* — is a real grid rather than a record list, so it is read as
 * one. `ss:Index` skips ahead to a column, which is how blank cells are stored.
 */
function parseSpreadsheetML(doc: Document): ParsedTable {
  const sheets = allDeep(doc.documentElement, 'Worksheet').map((worksheet, i) => {
    const table = firstDeep(worksheet, 'Table')
    const matrix: string[][] = []
    for (const rowEl of table ? kids(table, 'Row') : []) {
      const row: string[] = []
      for (const cellEl of kids(rowEl, 'Cell')) {
        const index = Number(attr(cellEl, 'Index') ?? 0)
        if (index > 0) while (row.length < index - 1) row.push('')
        const data = kids(cellEl, 'Data')[0]
        row.push(data?.textContent?.trim() ?? '')
        // A merged cell covers the columns to its right; they hold no data.
        const across = Number(attr(cellEl, 'MergeAcross') ?? 0)
        for (let k = 0; k < across; k++) row.push('')
      }
      matrix.push(row)
    }
    return { name: attr(worksheet, 'Name') ?? `Sheet ${i + 1}`, grid: toGrid(matrix) }
  })
  return { sheets: sheets.length > 0 ? sheets : [{ name: 'Sheet 1', grid: { headers: [], rows: [] } }] }
}

/**
 * Finds the repeating element that carries the records — `<item>` inside
 * `<items>`, `<row>` inside `<rows>`, whatever the exporter called it. Wrapper
 * elements with a single child are walked through; the first level with real
 * siblings is the record list.
 */
function findRecords(root: Element): Element[] {
  let node = root
  for (let depth = 0; depth < 20; depth++) {
    const children = Array.from(node.children)
    if (children.length === 0) break
    const groups = new Map<string, Element[]>()
    for (const child of children) {
      const bucket = groups.get(child.localName)
      if (bucket) bucket.push(child)
      else groups.set(child.localName, [child])
    }
    let largest: Element[] = []
    for (const group of groups.values()) if (group.length > largest.length) largest = group
    if (largest.length > 1) return largest
    if (children.length !== 1) break
    node = children[0]
  }
  // Nothing repeats — the document describes a single thing, so it is one row.
  return [node]
}

/**
 * Flattens one record into `field → value`. Nested elements become dotted
 * paths, attributes keep their own name, and anything that appears twice is
 * joined rather than silently overwritten.
 */
function flattenRecord(record: Element): Map<string, string> {
  const out = new Map<string, string>()
  const add = (key: string, value: string) => {
    const existing = out.get(key)
    out.set(key, existing ? `${existing}; ${value}` : value)
  }
  const walk = (el: Element, prefix: string) => {
    for (const a of Array.from(el.attributes)) {
      if (a.name === 'xmlns' || a.prefix === 'xmlns') continue
      add(prefix ? `${prefix}@${a.localName}` : a.localName, a.value.trim())
    }
    for (const child of Array.from(el.children)) {
      const path = prefix ? `${prefix}.${child.localName}` : child.localName
      if (child.children.length === 0 && child.attributes.length === 0) {
        add(path, child.textContent?.trim() ?? '')
      } else walk(child, path)
    }
  }
  walk(record, '')
  return out
}

export function parseXml(text: string, sheetName: string): ParsedTable {
  const doc = parseXmlDoc(text)
  const root = doc.documentElement
  if (root.localName === 'Workbook') return parseSpreadsheetML(doc)

  const records = findRecords(root)
  const flattened = records.map(flattenRecord)
  // Columns in order of first appearance, unioned across every record — an
  // exporter that omits empty fields still gets a complete header row.
  const headers: string[] = []
  for (const record of flattened) {
    for (const key of record.keys()) if (!headers.includes(key)) headers.push(key)
  }
  const rows = flattened.map((record) => headers.map((key) => record.get(key) ?? ''))
  return one(sheetName, { headers, rows })
}

// ── JSON ─────────────────────────────────────────────────────────────────────

function jsonCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function parseJson(text: string, sheetName: string): ParsedTable {
  const data: unknown = JSON.parse(text)
  let records: unknown[]
  if (Array.isArray(data)) records = data
  else if (data && typeof data === 'object') {
    // `{ "rows": [...] }` and friends — take the first array property if the
    // object is only a wrapper, otherwise treat the object itself as one row.
    const arrays = Object.values(data as Record<string, unknown>).filter(Array.isArray)
    records = arrays.length === 1 ? (arrays[0] as unknown[]) : [data]
  } else records = [data]

  const headers: string[] = []
  const asRecord = (item: unknown): Record<string, unknown> =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : { value: item }
  const objects = records.map(asRecord)
  for (const object of objects) {
    for (const key of Object.keys(object)) if (!headers.includes(key)) headers.push(key)
  }
  return one(sheetName, {
    headers,
    rows: objects.map((object) => headers.map((key) => jsonCell(object[key]))),
  })
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

/** `"BC12"` → 54. Column letters are base-26 with no zero. */
function columnIndex(ref: string): number {
  const letters = /^([A-Za-z]+)/.exec(ref)
  if (!letters) return -1
  let n = 0
  for (const ch of letters[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** `<si>` is either a plain `<t>` or a run of them; `<rPh>` holds furigana, not the value. */
function sharedStringText(si: Element): string {
  let out = ''
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (child.localName === 'rPh') continue
      if (child.localName === 't') out += child.textContent ?? ''
      else walk(child)
    }
  }
  walk(si)
  return out
}

type CellFormat = { hasDate: boolean; hasTime: boolean }

/** Built-in number formats that render a date or a time (ECMA-376 §18.8.30). */
const BUILTIN_DATE_FORMATS: Record<number, CellFormat> = {
  14: { hasDate: true, hasTime: false },
  15: { hasDate: true, hasTime: false },
  16: { hasDate: true, hasTime: false },
  17: { hasDate: true, hasTime: false },
  18: { hasDate: false, hasTime: true },
  19: { hasDate: false, hasTime: true },
  20: { hasDate: false, hasTime: true },
  21: { hasDate: false, hasTime: true },
  22: { hasDate: true, hasTime: true },
  45: { hasDate: false, hasTime: true },
  46: { hasDate: false, hasTime: true },
  47: { hasDate: false, hasTime: true },
}
// 27–36 and 50–58 are the East Asian locale date formats.
for (let id = 27; id <= 36; id++) BUILTIN_DATE_FORMATS[id] = { hasDate: true, hasTime: false }
for (let id = 50; id <= 58; id++) BUILTIN_DATE_FORMATS[id] = { hasDate: true, hasTime: false }

/**
 * A format code is a date if a field token survives once the parts that are
 * not tokens are stripped: quoted literals, `[$-409]` locale tags, colours and
 * backslash escapes. `m` alone is a month here — a bare minute format is not a
 * thing Excel writes without an `h` beside it.
 */
function readFormat(code: string): CellFormat | null {
  const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '')
  if (!/[ymdhs]/i.test(bare)) return null
  const hasTime = /[hs]/i.test(bare) || /am\/pm/i.test(bare)
  return { hasDate: /[ymd]/i.test(bare), hasTime }
}

/** Style index → date format, for the cells that carry one. */
function readCellFormats(styles: Document | null): (CellFormat | null)[] {
  if (!styles) return []
  const custom = new Map<number, CellFormat | null>()
  for (const numFmt of allDeep(styles.documentElement, 'numFmt')) {
    custom.set(Number(attr(numFmt, 'numFmtId')), readFormat(attr(numFmt, 'formatCode') ?? ''))
  }
  const cellXfs = firstDeep(styles.documentElement, 'cellXfs')
  if (!cellXfs) return []
  return kids(cellXfs, 'xf').map((xf) => {
    const id = Number(attr(xf, 'numFmtId') ?? 0)
    return custom.has(id) ? custom.get(id) ?? null : BUILTIN_DATE_FORMATS[id] ?? null
  })
}

/**
 * Serial days → a readable string. The 1900 epoch is dated to 30 December 1899
 * because Excel believes 1900 was a leap year; that is only wrong for the first
 * two months of 1900, which no real spreadsheet contains.
 */
function formatSerial(serial: number, format: CellFormat, date1904: boolean): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const d = new Date(epoch + Math.round(serial * 86400) * 1000)
  if (Number.isNaN(d.getTime())) return String(serial)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const seconds = d.getUTCSeconds()
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${seconds ? `:${pad(seconds)}` : ''}`
  if (!format.hasDate) return time
  return format.hasTime ? `${date} ${time}` : date
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedTable> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)

  const readXml = async (path: string) => {
    const entry = zip.file(path)
    return entry ? parseXmlDoc(await entry.async('string')) : null
  }

  const workbook = await readXml('xl/workbook.xml')
  const styles = await readXml('xl/styles.xml')
  const stringsDoc = await readXml('xl/sharedStrings.xml')
  const strings = stringsDoc ? kids(stringsDoc.documentElement, 'si').map(sharedStringText) : []
  const cellFormats = readCellFormats(styles)

  const workbookPr = workbook ? firstDeep(workbook.documentElement, 'workbookPr') : null
  const date1904Attr = workbookPr ? attr(workbookPr, 'date1904') : null
  const date1904 = date1904Attr === '1' || date1904Attr === 'true'

  // Relationship ids point at the sheet parts; the order the `<sheet>` entries
  // appear in is the tab order.
  const relsDoc = await readXml('xl/_rels/workbook.xml.rels')
  const targets = new Map<string, string>()
  if (relsDoc) {
    for (const rel of kids(relsDoc.documentElement, 'Relationship')) {
      const id = attr(rel, 'Id')
      const target = attr(rel, 'Target')
      if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`)
    }
  }

  let entries: { name: string; path: string }[] = []
  const sheetsEl = workbook ? firstDeep(workbook.documentElement, 'sheets') : null
  if (sheetsEl) {
    entries = kids(sheetsEl, 'sheet')
      .map((sheet, i) => {
        const rid = attr(sheet, 'id')
        return { name: attr(sheet, 'name') ?? `Sheet ${i + 1}`, path: (rid && targets.get(rid)) || '' }
      })
      .filter((entry) => entry.path && zip.file(entry.path))
  }
  if (entries.length === 0) {
    // No usable workbook part — fall back to whatever worksheets are in the zip.
    entries = Object.keys(zip.files)
      .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
      .sort()
      .map((path, i) => ({ name: `Sheet ${i + 1}`, path }))
  }
  if (entries.length === 0) throw new Error('That workbook has no readable sheets.')

  const sheets: { name: string; grid: Grid }[] = []
  for (const entry of entries) {
    const doc = await readXml(entry.path)
    const sheetData = doc ? firstDeep(doc.documentElement, 'sheetData') : null
    const matrix: string[][] = []
    for (const rowEl of sheetData ? kids(sheetData, 'row') : []) {
      // `r` is 1-based and may skip rows entirely when they are empty.
      const rowIndex = Number(attr(rowEl, 'r') ?? 0) - 1
      const row: string[] = []
      let cursor = 0
      for (const cellEl of kids(rowEl, 'c')) {
        const ref = attr(cellEl, 'r')
        const index = ref ? columnIndex(ref) : cursor
        const at = index >= 0 ? index : cursor
        while (row.length < at) row.push('')
        cursor = at + 1

        const type = attr(cellEl, 't')
        const v = kids(cellEl, 'v')[0]?.textContent ?? ''
        let value: string
        if (type === 's') value = strings[Number(v)] ?? ''
        else if (type === 'inlineStr') {
          const is = kids(cellEl, 'is')[0]
          value = is ? sharedStringText(is) : ''
        } else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE'
        else if (type === 'str' || type === 'e') value = v
        else {
          const format = cellFormats[Number(attr(cellEl, 's') ?? -1)]
          const numeric = Number(v)
          value = format && v !== '' && Number.isFinite(numeric) ? formatSerial(numeric, format, date1904) : v
        }
        row.push(value)
      }
      if (rowIndex >= 0) while (matrix.length < rowIndex) matrix.push([])
      matrix.push(row)
    }
    sheets.push({ name: entry.name, grid: toGrid(matrix) })
  }
  return { sheets }
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '') || fileName
}

export async function parseTableFile(file: File): Promise<ParsedTable> {
  const ext = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? ''
  const name = baseName(file.name)

  if (ext === 'xlsx' || ext === 'xlsm') return parseXlsx(await file.arrayBuffer())
  if (ext === 'xls') {
    throw new Error('Legacy .xls files are a binary format — re-save as .xlsx or .csv first.')
  }

  const text = await file.text()
  if (ext === 'xml') return parseXml(text, name)
  if (ext === 'json') return parseJson(text, name)
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') return one(name, parseDelimited(text))

  // Unknown extension: go by what the file actually starts with.
  const head = text.trimStart()[0]
  if (head === '<') return parseXml(text, name)
  if (head === '{' || head === '[') return parseJson(text, name)
  return one(name, parseDelimited(text))
}
