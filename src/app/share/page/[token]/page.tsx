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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="border-b border-white/[0.06] bg-[rgba(7,7,15,0.9)] px-6 py-3 flex items-center justify-between">
        <span className="text-[11px] text-zinc-600 font-medium tracking-widest uppercase">View only</span>
        <span className="text-[11px] text-zinc-700">Shared via dashboard</span>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold text-zinc-100 mb-8 leading-tight tracking-tight">
          {page.title}
        </h1>
        {page.content ? (
          <div
            className="tiptap-editor text-zinc-300 text-[15px] leading-[1.8]"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        ) : (
          <p className="text-zinc-600 italic">No content.</p>
        )}
        <style>{`
          .tiptap-editor p { margin-bottom: 0.75em; }
          .tiptap-editor h1 { font-size: 1.6em; font-weight: 700; color: #f4f4f5; margin: 1em 0 0.4em; line-height: 1.3; }
          .tiptap-editor h2 { font-size: 1.3em; font-weight: 600; color: #e4e4e7; margin: 0.9em 0 0.3em; }
          .tiptap-editor h3 { font-size: 1.1em; font-weight: 600; color: #d4d4d8; margin: 0.8em 0 0.3em; }
          .tiptap-editor ul, .tiptap-editor ol { padding-left: 1.4em; margin-bottom: 0.75em; }
          .tiptap-editor ul { list-style-type: disc; }
          .tiptap-editor ol { list-style-type: decimal; }
          .tiptap-editor li { margin-bottom: 0.2em; }
          .tiptap-editor blockquote { border-left: 3px solid #3f3f46; padding: 0.4em 1em; color: #71717a; margin: 0.75em 0; }
          .tiptap-editor code { background: rgba(255,255,255,0.06); border-radius: 4px; padding: 0.15em 0.4em; font-family: monospace; font-size: 0.875em; }
          .tiptap-editor strong { color: #f4f4f5; font-weight: 600; }
          .tiptap-editor mark { border-radius: 3px; padding: 0.1em 0.2em; }
          .editor-link { color: #818cf8; text-decoration: underline; text-underline-offset: 3px; }
          .editor-link:hover { color: #a5b4fc; }
        `}</style>
      </div>
    </div>
  )
}
