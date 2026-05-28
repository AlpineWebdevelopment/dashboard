'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import FontFamily from '@tiptap/extension-font-family'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { savePage, deletePage } from '@/lib/actions'
import {
  Bold, Italic, Underline, Link as LinkIcon,
  Highlighter, Trash2, Check, Loader2, X,
} from 'lucide-react'
import type { Page } from '@/lib/supabase'

/* ─── Hex color preview extension ────────────────────────────── */

const HEX_RE = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g

const HexColorPreview = Extension.create({
  name: 'hexColorPreview',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('hexColorPreview'),
        props: {
          decorations(state) {
            const decos: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              HEX_RE.lastIndex = 0
              let m: RegExpExecArray | null
              while ((m = HEX_RE.exec(node.text)) !== null) {
                const hex = m[0]
                const end = pos + m.index + hex.length
                decos.push(
                  Decoration.widget(end, () => {
                    const el = document.createElement('span')
                    el.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:50%;background:${hex};border:1px solid rgba(255,255,255,0.18);margin-left:3px;vertical-align:middle;flex-shrink:0;`
                    return el
                  }, { side: 1 })
                )
              }
            })
            return DecorationSet.create(state.doc, decos)
          },
        },
      }),
    ]
  },
})

/* ─── Config ─────────────────────────────────────────────────── */

const FONTS = [
  { label: 'Sans',    value: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif',   value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono',    value: 'ui-monospace, "Fira Code", monospace' },
  { label: 'Cursive', value: '"Brush Script MT", cursive' },
]

const TEXT_COLORS = [
  '#ffffff', '#a1a1aa', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff',
  '#fecaca', '#fed7aa', '#f0abfc',
]

/* ─── Sub-components ──────────────────────────────────────────── */

function Divider() {
  return <span className="w-px h-4 bg-zinc-200 dark:bg-white/[0.08] mx-0.5 shrink-0" />
}

function ToolBtn({
  active, onClick, title, children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all shrink-0 ${
        active
          ? 'bg-zinc-200 dark:bg-white/[0.12] text-zinc-900 dark:text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  )
}

function ColorPicker({
  colors, value, onChange, icon,
}: {
  colors: string[]
  value: string
  onChange: (c: string) => void
  icon: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open) }}
        className="w-7 h-7 rounded-md flex flex-col items-center justify-center gap-0.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all"
      >
        {icon}
        <span
          className="w-3.5 h-[3px] rounded-full"
          style={{ backgroundColor: value || 'transparent', border: value ? 'none' : '1px solid #52525b' }}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-[rgba(14,14,22,0.98)] border border-zinc-300 dark:border-white/[0.1] rounded-xl shadow-xl z-50 flex flex-wrap gap-1.5 w-[120px]">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false) }}
            className="w-5 h-5 rounded border border-zinc-300 dark:border-white/20 flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-[9px]"
            title="Remove"
          >
            <X size={9} />
          </button>
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(c); setOpen(false) }}
              className="w-5 h-5 rounded border border-zinc-200 dark:border-white/10 hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LinkDialog({
  initial, onConfirm, onRemove, onClose,
}: {
  initial: string
  onConfirm: (url: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const [url, setUrl] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/20 dark:bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-[rgba(14,14,22,0.98)] border border-zinc-300 dark:border-white/[0.1] rounded-xl shadow-2xl p-4 w-80 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Insert link</p>
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onConfirm(url) } if (e.key === 'Escape') onClose() }}
          placeholder="https://"
          className="w-full bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.09] rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-white/20"
        />
        <div className="flex gap-2">
          {initial && (
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(url)}
            className="flex-1 py-1.5 rounded-lg text-xs bg-indigo-600 text-white hover:bg-indigo-500 font-medium transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────── */

export default function PageEditor({ page }: { page: Page }) {
  const [title, setTitle]       = useState(page.title)
  const [saveStatus, setSave]   = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isDeleting, startDel]  = useTransition()
  const [showLink, setShowLink] = useState(false)
  const [textColor, setTextColor]   = useState('')
  const [hlColor, setHlColor]       = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestTitle = useRef(page.title)

  const triggerSave = useCallback((html: string, t: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSave('idle')
    timerRef.current = setTimeout(async () => {
      setSave('saving')
      await savePage(page.id, t, html)
      setSave('saved')
      setTimeout(() => setSave('idle'), 2000)
    }, 800)
  }, [page.id])

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      FontFamily,
      HexColorPreview,
    ],
    content: page.content || '<p></p>',
    editorProps: {
      attributes: {
        class: 'tiptap-editor outline-none min-h-[50vh] text-[15px] leading-[1.8] text-zinc-700 dark:text-zinc-300',
      },
    },
    onUpdate({ editor }) {
      triggerSave(editor.getHTML(), latestTitle.current)
    },
  })

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    latestTitle.current = e.target.value
    triggerSave(editor?.getHTML() ?? '', e.target.value)
  }

  const handleDelete = () => {
    if (!confirm('Delete this page? This cannot be undone.')) return
    startDel(async () => { await deletePage(page.id) })
  }

  const applyTextColor = (c: string) => {
    setTextColor(c)
    if (!editor) return
    c ? editor.chain().focus().setColor(c).run()
      : editor.chain().focus().unsetColor().run()
  }

  const applyHighlight = (c: string) => {
    setHlColor(c)
    if (!editor) return
    c ? editor.chain().focus().setHighlight({ color: c }).run()
      : editor.chain().focus().unsetHighlight().run()
  }

  const openLink = () => setShowLink(true)

  const applyLink = (url: string) => {
    setShowLink(false)
    if (!editor) return
    if (!url) { editor.chain().focus().unsetLink().run(); return }
    const href = url.startsWith('http') ? url : `https://${url}`
    editor.chain().focus().setLink({ href }).run()
  }

  const removeLink = () => {
    setShowLink(false)
    editor?.chain().focus().unsetLink().run()
  }

  const currentFont = editor?.getAttributes('textStyle').fontFamily ?? ''
  const currentLink = editor?.getAttributes('link').href ?? ''

  /* ─── render ── */
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10">

      {/* Link dialog */}
      {showLink && (
        <LinkDialog
          initial={currentLink}
          onConfirm={applyLink}
          onRemove={removeLink}
          onClose={() => setShowLink(false)}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <span className="text-[11px] text-zinc-400 dark:text-zinc-700">
          {editor ? editor.storage?.characterCount?.words?.() ?? '' : ''}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] h-4">
            {saveStatus === 'saving' && <><Loader2 size={10} className="animate-spin text-zinc-400 dark:text-zinc-600" /><span className="text-zinc-400 dark:text-zinc-600">Saving…</span></>}
            {saveStatus === 'saved'  && <><Check size={10} className="text-emerald-500" /><span className="text-emerald-500">Saved</span></>}
          </span>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 dark:text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
          >
            <Trash2 size={12} />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus() } }}
        placeholder="Untitled"
        className="w-full bg-transparent text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-800 outline-none mb-6 tracking-tight leading-tight"
      />

      {/* Formatting toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-0.5 flex-wrap px-3 py-2 mb-4 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-white/95 dark:bg-[rgba(10,10,18,0.9)] backdrop-blur-md">
        {/* Font family */}
        <select
          value={currentFont}
          onChange={(e) => {
            const v = e.target.value
            if (v) editor?.chain().focus().setFontFamily(v).run()
            else editor?.chain().focus().unsetFontFamily().run()
          }}
          className="bg-transparent text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 outline-none cursor-pointer pr-1 mr-1 max-w-[72px]"
        >
          <option value="">Default</option>
          {FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>

        <Divider />

        <ToolBtn active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold (⌘B)">
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic (⌘I)">
          <Italic size={13} />
        </ToolBtn>
        <ToolBtn active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()} title="Underline (⌘U)">
          <Underline size={13} />
        </ToolBtn>

        <Divider />

        {/* Text color */}
        <ColorPicker
          colors={TEXT_COLORS}
          value={textColor}
          onChange={applyTextColor}
          icon={<span className="text-[11px] font-bold leading-none">A</span>}
        />

        {/* Highlight color */}
        <ColorPicker
          colors={HIGHLIGHT_COLORS}
          value={hlColor}
          onChange={applyHighlight}
          icon={<Highlighter size={12} />}
        />

        <Divider />

        {/* Link */}
        <ToolBtn active={editor?.isActive('link')} onClick={openLink} title="Link">
          <LinkIcon size={13} />
        </ToolBtn>
      </div>

      {/* Editor styles */}
      <style>{`
        .tiptap-editor p { margin-bottom: 0.75em; }
        .tiptap-editor h1 { font-size: 1.6em; font-weight: 700; color: #f4f4f5; margin: 1em 0 0.4em; line-height: 1.3; }
        .tiptap-editor h2 { font-size: 1.3em; font-weight: 600; color: #e4e4e7; margin: 0.9em 0 0.3em; line-height: 1.4; }
        .tiptap-editor h3 { font-size: 1.1em; font-weight: 600; color: #d4d4d8; margin: 0.8em 0 0.3em; }
        .tiptap-editor ul, .tiptap-editor ol { padding-left: 1.4em; margin-bottom: 0.75em; }
        .tiptap-editor ul { list-style-type: disc; }
        .tiptap-editor ol { list-style-type: decimal; }
        .tiptap-editor li { margin-bottom: 0.2em; }
        .tiptap-editor blockquote { border-left: 3px solid #3f3f46; margin: 0.75em 0; padding: 0.4em 1em; color: #71717a; }
        .tiptap-editor code { background: rgba(255,255,255,0.06); border-radius: 4px; padding: 0.15em 0.4em; font-family: ui-monospace, monospace; font-size: 0.875em; }
        .tiptap-editor hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1.5em 0; }
        .tiptap-editor strong { color: #f4f4f5; font-weight: 600; }
        .tiptap-editor em { font-style: italic; }
        .editor-link { color: #818cf8; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
        .editor-link:hover { color: #a5b4fc; }
        .tiptap-editor mark { border-radius: 3px; padding: 0.1em 0.2em; }
        .tiptap-editor p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #3f3f46; pointer-events: none; float: left; height: 0; }
      `}</style>

      {/* Rich text editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
