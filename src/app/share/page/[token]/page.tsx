import { getPageByShareToken } from '@/lib/actions'
import { notFound } from 'next/navigation'

export default async function SharedPageView({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const page = await getPageByShareToken(token)
  if (!page) notFound()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100">
      {/* Top bar */}
      <div className="border-b border-zinc-200 dark:border-white/[0.06] bg-white/90 dark:bg-[rgba(7,7,15,0.9)] px-6 py-3 flex items-center justify-between">
        <span className="text-[11px] text-zinc-400 dark:text-zinc-600 font-medium tracking-widest uppercase">View only</span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-700">Shared via dashboard</span>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 mb-8 leading-tight tracking-tight">
          {page.title}
        </h1>
        {page.content ? (
          <div
            className="tiptap-editor text-zinc-600 dark:text-zinc-300 text-[15px] leading-[1.8]"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        ) : (
          <p className="text-zinc-400 dark:text-zinc-600 italic">No content.</p>
        )}
        <style>{`
          .tiptap-editor p { margin-bottom: 0.75em; }
          .tiptap-editor h1 { font-size: 1.6em; font-weight: 700; color: #18181b; margin: 1em 0 0.4em; line-height: 1.3; }
          .tiptap-editor h2 { font-size: 1.3em; font-weight: 600; color: #27272a; margin: 0.9em 0 0.3em; }
          .tiptap-editor h3 { font-size: 1.1em; font-weight: 600; color: #3f3f46; margin: 0.8em 0 0.3em; }
          .tiptap-editor ul, .tiptap-editor ol { padding-left: 1.4em; margin-bottom: 0.75em; }
          .tiptap-editor ul { list-style-type: disc; }
          .tiptap-editor ol { list-style-type: decimal; }
          .tiptap-editor li { margin-bottom: 0.2em; }
          .tiptap-editor blockquote { border-left: 3px solid #d4d4d8; padding: 0.4em 1em; color: #71717a; margin: 0.75em 0; }
          .tiptap-editor code { background: rgba(0,0,0,0.05); border-radius: 4px; padding: 0.15em 0.4em; font-family: monospace; font-size: 0.875em; }
          .tiptap-editor strong { color: #18181b; font-weight: 600; }
          .tiptap-editor mark { border-radius: 3px; padding: 0.1em 0.2em; }
          .editor-link { color: #818cf8; text-decoration: underline; text-underline-offset: 3px; }
          .editor-link:hover { color: #a5b4fc; }
          .dark .tiptap-editor h1 { color: #f4f4f5; }
          .dark .tiptap-editor h2 { color: #e4e4e7; }
          .dark .tiptap-editor h3 { color: #d4d4d8; }
          .dark .tiptap-editor blockquote { border-left-color: #3f3f46; color: #71717a; }
          .dark .tiptap-editor code { background: rgba(255,255,255,0.06); }
          .dark .tiptap-editor strong { color: #f4f4f5; }
        `}</style>
      </div>
    </div>
  )
}
