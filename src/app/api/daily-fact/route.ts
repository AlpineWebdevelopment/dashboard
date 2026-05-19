import { NextResponse } from 'next/server'

export const revalidate = 3600 // cache 1 hour

const AI_KEYWORDS = [
  'ai', 'gpt', 'llm', 'openai', 'anthropic', 'claude', 'gemini',
  'machine learning', 'neural', 'deepmind', 'artificial intelligence',
  'chatgpt', 'mistral', 'llama', 'language model', 'nvidia', 'stable diffusion',
  'midjourney', 'sora', 'runway', 'inference', 'transformer', 'copilot',
  'grok', 'perplexity', 'cursor', 'agentic', 'agent', 'rag', 'embedding',
]

const TECH_KEYWORDS = [
  'startup', 'funding', 'launch', 'product', 'open source', 'github',
  'google', 'apple', 'meta', 'microsoft', 'amazon', 'aws', 'cloud',
  'developer', 'programming', 'software', 'hardware', 'chip', 'model',
]

interface DailyFact {
  type: 'ai-news' | 'tech-news' | 'history'
  emoji: string
  title: string
  url: string | null
  source: string
  score?: number
}

async function getHackerNewsStory(): Promise<DailyFact | null> {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const ids: number[] = await res.json()

    // Fetch the top 30 stories in parallel
    const fetched = await Promise.allSettled(
      ids.slice(0, 30).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          next: { revalidate: 3600 },
        }).then((r) => r.json())
      )
    )

    const stories = fetched
      .filter((s): s is PromiseFulfilledResult<any> => s.status === 'fulfilled')
      .map((s) => s.value)
      .filter((s) => s?.title && s?.type === 'story')

    // Prefer AI-related stories
    const aiStory = stories.find((s) =>
      AI_KEYWORDS.some((kw) => s.title.toLowerCase().includes(kw))
    )
    if (aiStory) {
      return {
        type: 'ai-news',
        emoji: '🤖',
        title: aiStory.title,
        url: aiStory.url || `https://news.ycombinator.com/item?id=${aiStory.id}`,
        source: `HN · ${aiStory.score} pts`,
        score: aiStory.score,
      }
    }

    // Fall back to top tech story
    const techStory = stories.find((s) =>
      TECH_KEYWORDS.some((kw) => s.title.toLowerCase().includes(kw))
    )
    const pick = techStory || stories[0]
    if (pick) {
      return {
        type: 'tech-news',
        emoji: '💡',
        title: pick.title,
        url: pick.url || `https://news.ycombinator.com/item?id=${pick.id}`,
        source: `HN · ${pick.score} pts`,
        score: pick.score,
      }
    }
  } catch {
    // fall through
  }
  return null
}

async function getWikipediaOnThisDay(): Promise<DailyFact | null> {
  try {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return null

    const data = await res.json()
    const events: any[] = data.events || []
    if (events.length === 0) return null

    // Pick from top 8 — use day-of-year to make it deterministic per day
    const idx = now.getDate() % Math.min(events.length, 8)
    const event = events[idx]

    return {
      type: 'history',
      emoji: '📅',
      title: `${event.year}: ${event.text}`,
      url: event.pages?.[0]?.content_urls?.desktop?.page ?? null,
      source: 'On this day',
    }
  } catch {
    return null
  }
}

export async function GET() {
  const story = await getHackerNewsStory()
  if (story) return NextResponse.json(story)

  const historical = await getWikipediaOnThisDay()
  if (historical) return NextResponse.json(historical)

  return NextResponse.json({
    type: 'tech-news',
    emoji: '✨',
    title: 'Have a productive day.',
    url: null,
    source: '',
  } satisfies DailyFact)
}
