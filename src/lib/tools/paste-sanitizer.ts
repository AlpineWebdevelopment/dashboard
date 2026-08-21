'use client'

import { useEffect } from 'react'

// Shorten the visible label but keep the real URL after a `|` so the chip stays
// clickable. The `|url` part is later extracted out of the text onto the
// message's `sources` map (see extractSources in components/tools/chat-markdown),
// so the giant URL never bloats the edit textarea.
function shortLabel(url: string): string | null {
  try {
    const u = new URL(url)
    const filename = u.pathname.split('/').pop() || ''

    if (filename && filename.includes('.') && filename.toLowerCase() !== 'index.html') {
      const name = decodeURIComponent(filename)
      if (name.length > 30) return name.slice(0, 12) + '...' + name.slice(-12)
      return name
    }

    const host = (u.hostname || '').replace(/^www\./, '')
    if (host) return host

    return null
  } catch {
    return null
  }
}

function simplifyMarkdownLink(url: string): string {
  const short = shortLabel(url)
  if (!short) return url
  return '{{src: ' + short + '|' + url + '}}'
}

export function sanitizePastedText(text: string): string {
  let out = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_full, _label: string, url: string) => simplifyMarkdownLink(url)
  )
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

/**
 * Route every paste into a text field through `sanitizePastedText`.
 *
 * Mounted by the chat recreator only — it is a document-level listener, so it
 * must not be left running on routes that want raw pastes.
 */
export function usePasteSanitizer(): void {
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const el = e.target as HTMLElement | null
      if (!el) return
      const isField = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
      if (!isField && !el.isContentEditable) return

      e.preventDefault()
      const raw = e.clipboardData?.getData('text/plain') || ''
      const clean = sanitizePastedText(raw)

      if (isField) {
        const field = el as HTMLTextAreaElement | HTMLInputElement
        const start = field.selectionStart || 0
        const end = field.selectionEnd || 0
        const proto =
          field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype
        // React tracks the input's value on the DOM node; assigning through the
        // native setter is what makes it notice the change.
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set

        const next = field.value.slice(0, start) + clean + field.value.slice(end)
        if (nativeSetter) nativeSetter.call(field, next)
        else field.value = next

        field.dispatchEvent(new Event('input', { bubbles: true }))
        return
      }

      document.execCommand('insertText', false, clean)
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])
}
