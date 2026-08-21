// The tools ported over from the standalone AlpineStudios tools project.
//
// The list lives here rather than inside the hub page so a tool's name, blurb
// and accent are stated once and reused by the hub grid and by each tool's own
// header. Accents follow the sidebar's convention: one hue per destination.

import type { LucideIcon } from 'lucide-react'
import { Image as ImageIcon, Mail, MessagesSquare, AudioLines, Target } from 'lucide-react'

export type ToolAccent = 'sky' | 'emerald' | 'amber' | 'violet' | 'blue'

export type Tool = {
  /** Stable slug — also the last segment of the route. */
  key: string
  name: string
  href: string
  /** One line for the hub card. */
  description: string
  /** Longer line shown under the tool's own heading. */
  tagline: string
  icon: LucideIcon
  accent: ToolAccent
  /** True for tools that keep everything on the device (no upload, no DB). */
  offline?: boolean
  /** Set when the tool lives outside /tools — the hub links out to it. */
  external?: boolean
}

export const TOOLS: Tool[] = [
  {
    key: 'chat-recreator',
    name: 'Chat Recreator',
    href: '/tools/chat-recreator',
    description: 'Rebuild and export chat conversations as clean markdown.',
    tagline:
      'Import a ChatGPT, Claude or Perplexity export, edit the thread, and save it as a template.',
    icon: MessagesSquare,
    accent: 'sky',
  },
  {
    key: 'webp-converter',
    name: 'Image to .webp',
    href: '/tools/webp-converter',
    description: 'Convert images to .webp right in your browser.',
    tagline: 'Convert images to .webp — all in your browser, nothing uploaded.',
    icon: ImageIcon,
    accent: 'emerald',
    offline: true,
  },
  {
    key: 'emailsender',
    name: 'Email Sender',
    href: '/tools/emailsender',
    description: 'Compose and send templated email from any sender account.',
    tagline: 'Multi-account templated email, sent through Resend.',
    icon: Mail,
    accent: 'amber',
  },
  {
    key: 'yt-dwnld',
    name: 'Video to .wav',
    href: '/tools/yt-dwnld',
    description: 'Pull audio out of a video and export a high-quality WAV.',
    tagline:
      'Pull the audio out of a video, or re-encode an audio file — all in your browser.',
    icon: AudioLines,
    accent: 'violet',
    offline: true,
  },
  {
    key: 'ads',
    name: 'Ads Tracker',
    href: '/ads',
    description: 'Track campaigns and waves to keep ad spend in check.',
    tagline: 'Campaigns, waves and CBO folders.',
    icon: Target,
    accent: 'blue',
    external: true,
  },
]

export function toolByKey(key: string): Tool | undefined {
  return TOOLS.find((t) => t.key === key)
}

/** Tailwind classes per accent. Written out in full so the JIT compiler sees them. */
export const TOOL_ACCENTS: Record<
  ToolAccent,
  {
    /** Icon tile + icon colour. */
    icon: string
    tile: string
    /** Hairline across the top of a card. */
    via: string
    /** Card hover border. */
    hoverBorder: string
    /** Primary action button. */
    button: string
    /** Focus ring on inputs. */
    focus: string
    /** Filled segment of a segmented control. */
    segment: string
  }
> = {
  sky: {
    icon: 'text-sky-500 dark:text-sky-400',
    tile: 'border-sky-500/20 bg-sky-500/[0.08]',
    via: 'via-sky-400/30',
    hoverBorder: 'hover:border-sky-500/25',
    button:
      'bg-sky-500/90 hover:bg-sky-500 text-white dark:bg-sky-500/20 dark:hover:bg-sky-500/30 dark:text-sky-100 border border-transparent dark:border-sky-500/30',
    focus: 'focus:border-sky-500/50',
    segment: 'bg-sky-500/15 text-sky-700 dark:text-sky-100 border-sky-500/30',
  },
  emerald: {
    icon: 'text-emerald-500 dark:text-emerald-400',
    tile: 'border-emerald-500/20 bg-emerald-500/[0.08]',
    via: 'via-emerald-400/30',
    hoverBorder: 'hover:border-emerald-500/25',
    button:
      'bg-emerald-500/90 hover:bg-emerald-500 text-white dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 dark:text-emerald-100 border border-transparent dark:border-emerald-500/30',
    focus: 'focus:border-emerald-500/50',
    segment: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-100 border-emerald-500/30',
  },
  amber: {
    icon: 'text-amber-500 dark:text-amber-400',
    tile: 'border-amber-500/20 bg-amber-500/[0.08]',
    via: 'via-amber-400/30',
    hoverBorder: 'hover:border-amber-500/25',
    button:
      'bg-amber-500/90 hover:bg-amber-500 text-white dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-100 border border-transparent dark:border-amber-500/30',
    focus: 'focus:border-amber-500/50',
    segment: 'bg-amber-500/15 text-amber-700 dark:text-amber-100 border-amber-500/30',
  },
  violet: {
    icon: 'text-violet-500 dark:text-violet-400',
    tile: 'border-violet-500/20 bg-violet-500/[0.08]',
    via: 'via-violet-400/30',
    hoverBorder: 'hover:border-violet-500/25',
    button:
      'bg-violet-500/90 hover:bg-violet-500 text-white dark:bg-violet-500/20 dark:hover:bg-violet-500/30 dark:text-violet-100 border border-transparent dark:border-violet-500/30',
    focus: 'focus:border-violet-500/50',
    segment: 'bg-violet-500/15 text-violet-700 dark:text-violet-100 border-violet-500/30',
  },
  blue: {
    icon: 'text-blue-500 dark:text-blue-400',
    tile: 'border-blue-500/20 bg-blue-500/[0.08]',
    via: 'via-blue-400/30',
    hoverBorder: 'hover:border-blue-500/25',
    button:
      'bg-blue-500/90 hover:bg-blue-500 text-white dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:text-blue-100 border border-transparent dark:border-blue-500/30',
    focus: 'focus:border-blue-500/50',
    segment: 'bg-blue-500/15 text-blue-700 dark:text-blue-100 border-blue-500/30',
  },
}
