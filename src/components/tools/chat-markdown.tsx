'use client'

/* ═══════════════════════════════════════════════════════════════════════════
   ZERO-DEPENDENCY MARKDOWN RENDERER
   Covers what AI chat output actually uses: headings, bold/italic/strikethrough,
   inline code, fenced code blocks, links, {{src}} chips, lists, blockquotes,
   horizontal rules, and GFM tables. Renders to JSX (no dangerouslySetInnerHTML),
   so raw HTML in the source is escaped and safe by default.

   Presentation lives in the `.md-*` rules in globals.css.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useLayoutEffect, type ReactNode } from 'react'
import { Check, ChevronRight, Copy } from 'lucide-react'

const COLLAPSE_MAX = 360 // px — messages taller than this collapse with a fade
const REASON_LANGS = new Set(['thinking', 'reasoning', 'think', 'thought'])

export type Sources = Record<string, string>

/* ── SOURCE TOKEN HELPERS ────────────────────────────────────────────────────
   The message text only ever holds the short token `{{src: label}}`. The real
   (often 1000-char) URL is kept off the text, on the message's `sources` map. */

/**
 * Pull `|url` out of any `{{src: label|url}}` token: returns the cleaned text
 * (tokens reduced to `{{src: label}}`) plus a merged label→url map. Idempotent —
 * tokens that already lack a URL are left untouched.
 */
export function extractSources(
  text: string,
  base: Sources = {}
): { text: string; sources: Sources } {
  const sources: Sources = { ...base }
  const clean = (text || '').replace(
    /\{\{src:\s*([^}|]+?)\s*\|\s*([^}]+?)\s*\}\}/g,
    (_full, label: string, url: string) => {
      const l = label.trim()
      sources[l] = url.trim()
      return `{{src: ${l}}}`
    }
  )
  return { text: clean, sources }
}

/**
 * Inverse of the chip collapse — expand `{{src: label}}` back to real
 * `[label](url)` markdown for portable export. Tokens without a known URL are
 * left as-is.
 */
export function expandSources(text: string, sources?: Sources): string {
  if (!sources) return text || ''
  return (text || '').replace(/\{\{src:\s*([^}|]+?)\s*\}\}/g, (full, label: string) => {
    const url = sources[label.trim()]
    return url ? `[${label.trim()}](${url})` : full
  })
}

/* ── INLINE PARSING ──────────────────────────────────────────────────────────
   Ordered matchers; earliest match wins, ties broken by array order. Recurses
   into the inner text of formatting spans so **_nested_** works.             */

const INLINE = [
  { type: 'code', re: /`([^`]+)`/ },
  { type: 'chip', re: /\{\{src:\s*([^}|]+?)\s*\}\}/ },
  { type: 'link', re: /\[([^\]]+)\]\(([^)\s]+)\)/ },
  { type: 'bolditalic', re: /\*\*\*([^*]+?)\*\*\*/ },
  { type: 'bold', re: /\*\*([^*]+?)\*\*/ },
  { type: 'boldu', re: /__([^_]+?)__/ },
  { type: 'italic', re: /\*([^*]+?)\*/ },
  { type: 'italicu', re: /(?<![A-Za-z0-9])_([^_]+?)_(?![A-Za-z0-9])/ },
  { type: 'strike', re: /~~([^~]+?)~~/ },
] as const

type InlineHit = { type: (typeof INLINE)[number]['type']; match: RegExpExecArray }

function firstInline(str: string): InlineHit | null {
  let best: InlineHit | null = null
  for (const m of INLINE) {
    const match = m.re.exec(str)
    if (match && (best === null || match.index < best.match.index)) {
      best = { type: m.type, match }
    }
  }
  return best
}

function parseInline(text: string, sources: Sources | undefined, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text || ''
  let k = 0
  while (rest.length) {
    const hit = firstInline(rest)
    if (!hit) {
      out.push(rest)
      break
    }
    const { type, match } = hit
    if (match.index > 0) out.push(rest.slice(0, match.index))
    const key = `${keyBase}-${k++}`
    const g1 = match[1]
    const g2 = match[2]

    switch (type) {
      case 'code':
        out.push(
          <code key={key} className="md-inline-code">
            {g1}
          </code>
        )
        break
      case 'chip':
        out.push(<SrcChip key={key} label={g1.trim()} url={sources?.[g1.trim()]} />)
        break
      case 'link':
        out.push(
          <a key={key} href={g2} target="_blank" rel="noopener noreferrer">
            {parseInline(g1, sources, key)}
          </a>
        )
        break
      case 'bolditalic':
        out.push(
          <strong key={key}>
            <em>{parseInline(g1, sources, key)}</em>
          </strong>
        )
        break
      case 'bold':
      case 'boldu':
        out.push(<strong key={key}>{parseInline(g1, sources, key)}</strong>)
        break
      case 'italic':
      case 'italicu':
        out.push(<em key={key}>{parseInline(g1, sources, key)}</em>)
        break
      case 'strike':
        out.push(<del key={key}>{parseInline(g1, sources, key)}</del>)
        break
      default:
        out.push(match[0])
    }
    rest = rest.slice(match.index + match[0].length)
  }
  return out
}

/** Inline parse that turns single newlines into <br/> (chat expects hard breaks). */
function inlineBreaks(
  text: string,
  sources: Sources | undefined,
  keyBase: string
): ReactNode[] {
  const lines = (text || '').split('\n')
  const out: ReactNode[] = []
  lines.forEach((ln, i) => {
    if (i > 0) out.push(<br key={`${keyBase}-br${i}`} />)
    out.push(...parseInline(ln, sources, `${keyBase}-l${i}`))
  })
  return out
}

/* ── SOURCE CHIP ─────────────────────────────────────────────────────────── */

function SrcChip({ label, url }: { label: string; url?: string }) {
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="src-chip" title={url}>
        {label}
      </a>
    )
  }
  return (
    <span className="src-chip src-chip-inert" title={label}>
      {label}
    </span>
  )
}

/* ── CODE BLOCK ──────────────────────────────────────────────────────────── */

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="md-code">
      <div className="md-code-head">
        <span>{lang || 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

/* ── COLLAPSIBLE REASONING BLOCK ─────────────────────────────────────────── */

function ReasoningBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <details className="md-reason">
      <summary>
        <ChevronRight size={11} className="md-reason-caret" />
        {lang ? lang[0].toUpperCase() + lang.slice(1) : 'Reasoning'}
      </summary>
      <pre>{code}</pre>
    </details>
  )
}

/* ── BLOCKS ──────────────────────────────────────────────────────────────── */

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'hr' }
  | { type: 'code'; lang: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: { indent: number; text: string }[] }
  | { type: 'table'; header: string[]; align: (string | null)[]; rows: string[][] }
  | { type: 'para'; text: string }

function TableBlock({
  block,
  sources,
}: {
  block: Extract<Block, { type: 'table' }>
  sources?: Sources
}) {
  const { header, rows, align } = block
  return (
    <table>
      <thead>
        <tr>
          {header.map((c, i) => (
            <th
              key={i}
              style={align[i] ? { textAlign: align[i] as 'left' | 'right' | 'center' } : undefined}
            >
              {parseInline(c, sources, `th${i}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {header.map((_, ci) => (
              <td
                key={ci}
                style={
                  align[ci] ? { textAlign: align[ci] as 'left' | 'right' | 'center' } : undefined
                }
              >
                {parseInline(r[ci] ?? '', sources, `td${ri}-${ci}`)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function isBlockStart(line: string): boolean {
  return (
    /^```/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^\s*(---|\*\*\*|___)\s*$/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*([-*+]|\d+\.)\s+/.test(line)
  )
}

function parseBlocks(md: string): Block[] {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    // Fenced code
    const fence = line.match(/^```(.*)$/)
    if (fence) {
      const lang = fence[1].trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push({ type: 'code', lang, code: buf.join('\n') })
      continue
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() })
      i++
      continue
    }

    // Horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // GFM table (header row + separator row of dashes)
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      lines[i + 1].includes('-') &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])
    ) {
      const header = splitRow(line)
      const align = splitRow(lines[i + 1]).map((c) => {
        const t = c.trim()
        const l = t.startsWith(':')
        const r = t.endsWith(':')
        return l && r ? 'center' : r ? 'right' : l ? 'left' : null
      })
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push({ type: 'table', header, align, rows })
      continue
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', text: buf.join('\n') })
      continue
    }

    // List (ordered or unordered)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items: { indent: number; text: string }[] = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)!
        items.push({ indent: m[1].length, text: m[3] })
        i++
        // wrapped continuation lines belong to the current item
        while (
          i < lines.length &&
          lines[i].trim() &&
          /^\s+/.test(lines[i]) &&
          !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])
        ) {
          items[items.length - 1].text += '\n' + lines[i].trim()
          i++
        }
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // Paragraph
    const buf = [line]
    i++
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ type: 'para', text: buf.join('\n') })
  }

  return blocks
}

function renderBlock(b: Block, sources: Sources | undefined, key: string): ReactNode {
  switch (b.type) {
    case 'heading':
      return React.createElement(`h${b.level}`, { key }, inlineBreaks(b.text, sources, key))
    case 'hr':
      return <hr key={key} />
    case 'code':
      return REASON_LANGS.has((b.lang || '').toLowerCase()) ? (
        <ReasoningBlock key={key} code={b.code} lang={b.lang} />
      ) : (
        <CodeBlock key={key} code={b.code} lang={b.lang} />
      )
    case 'quote':
      return <blockquote key={key}>{inlineBreaks(b.text, sources, key)}</blockquote>
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul'
      return React.createElement(
        Tag,
        { key },
        b.items.map((it, ii) => (
          <li
            key={ii}
            style={
              it.indent ? { marginLeft: `${Math.min(it.indent, 8) * 0.5}rem` } : undefined
            }
          >
            {inlineBreaks(it.text, sources, `${key}-${ii}`)}
          </li>
        ))
      )
    }
    case 'table':
      return <TableBlock key={key} block={b} sources={sources} />
    default:
      return <p key={key}>{inlineBreaks(b.text, sources, key)}</p>
  }
}

/* ── PUBLIC COMPONENT ────────────────────────────────────────────────────── */

export function MessageMarkdown({ text, sources }: { text: string; sources?: Sources }) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Re-measure whenever the body changes — that is the only thing that moves the
  // height. Expanding does not: `overflow` stays true, only the mask comes off.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setOverflow(el.scrollHeight > COLLAPSE_MAX + 40)
  }, [text])

  const blocks = parseBlocks(text || '')
  const collapsed = overflow && !expanded

  return (
    <div>
      <div ref={ref} className={`md-body select-text ${collapsed ? 'md-collapsed' : ''}`}>
        {blocks.map((b, i) => renderBlock(b, sources, `b${i}`))}
      </div>
      {overflow && (
        <button className="md-showmore" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
