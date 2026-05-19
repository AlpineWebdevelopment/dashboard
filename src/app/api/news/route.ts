import { NextResponse } from 'next/server'

export const revalidate = 300 // 5-min server cache

const AI_KEYWORDS = [
  'ai', 'gpt', 'llm', 'openai', 'anthropic', 'claude', 'gemini',
  'machine learning', 'neural', 'deepmind', 'artificial intelligence',
  'chatgpt', 'mistral', 'llama', 'language model', 'nvidia', 'stable diffusion',
  'midjourney', 'sora', 'runway', 'inference', 'transformer', 'copilot',
  'grok', 'perplexity', 'cursor', 'agentic', 'agent', 'rag', 'embedding',
  'fine-tun', 'foundation model', 'multimodal', 'diffusion', 'robotics',
]

const TECH_KEYWORDS = [
  'startup', 'funding', 'launch', 'open source', 'github',
  'google', 'apple', 'meta', 'microsoft', 'amazon', 'aws', 'cloud',
  'developer', 'programming', 'software', 'hardware', 'chip', 'saas',
  'api', 'product', 'series a', 'series b', 'unicorn', 'yc', 'y combinator',
]

export interface NewsItem {
  id: number
  title: string
  url: string
  hnUrl: string
  score: number
  comments: number
  by: string
  time: number
  category: 'ai' | 'tech'
}

function score(title: string): { category: 'ai' | 'tech' | null; weight: number } {
  const t = title.toLowerCase()
  const aiHits = AI_KEYWORDS.filter((k) => t.includes(k)).length
  if (aiHits > 0) return { category: 'ai', weight: aiHits * 3 }
  const techHits = TECH_KEYWORDS.filter((k) => t.includes(k)).length
  if (techHits > 0) return { category: 'tech', weight: techHits }
  return { category: null, weight: 0 }
}

export async function GET() {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error('HN fetch failed')
    const ids: number[] = await res.json()

    // Fetch top 80 stories in parallel
    const settled = await Promise.allSettled(
      ids.slice(0, 80).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          next: { revalidate: 300 },
        }).then((r) => r.json())
      )
    )

    const items: NewsItem[] = []

    for (const s of settled) {
      if (s.status !== 'fulfilled') continue
      const story = s.value
      if (!story?.title || story.type !== 'story') continue

      const { category, weight } = score(story.title)
      if (!category) continue

      items.push({
        id: story.id,
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        hnUrl: `https://news.ycombinator.com/item?id=${story.id}`,
        score: story.score ?? 0,
        comments: story.descendants ?? 0,
        by: story.by ?? '',
        time: story.time ?? 0,
        category,
      })
    }

    // Sort: AI first, then by HN score
    items.sort((a, b) => {
      if (a.category !== b.category) return a.category === 'ai' ? -1 : 1
      return b.score - a.score
    })

    return NextResponse.json(items.slice(0, 30))
  } catch {
    return NextResponse.json([])
  }
}
