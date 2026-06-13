'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Send, Trash2, Bot, User, BarChart2, MessageSquare, ChevronDown } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Model {
  modelId: string
  displayName: string
  platform: string
  sizeLabel: string | null
  hasProvider: boolean
  keyCount: number
  enabled: boolean
  supportsTools: boolean
}

interface AnalyticsSummary {
  totalRequests: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
  avgLatencyMs: number
  estimatedCostSavings: number
}

interface ModelStat {
  modelId: string
  displayName: string
  platform: string
  requests: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50/50 dark:bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1">{label}</p>
      <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function UsageTab() {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [byModel, setByModel] = useState<ModelStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/ai/analytics?range=${range}`)
      .then(r => r.json())
      .then(d => { setSummary(d.summary); setByModel(d.byModel ?? []) })
      .finally(() => setLoading(false))
  }, [range])

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 space-y-5">
      {/* Range selector */}
      <div className="flex gap-1.5">
        {(['24h', '7d', '30d'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
              range === r
                ? 'bg-cyan-500/10 border border-cyan-500/25 text-cyan-500'
                : 'border border-zinc-200 dark:border-white/[0.07] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50/50 dark:bg-white/[0.03] px-4 py-3 animate-pulse">
              <div className="h-2 bg-zinc-200 dark:bg-white/[0.05] rounded w-1/2 mb-3" />
              <div className="h-5 bg-zinc-200 dark:bg-white/[0.05] rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Requests" value={String(summary.totalRequests)} sub={`${summary.successRate}% success`} />
            <StatCard label="Tokens used" value={formatTokens((summary.totalInputTokens ?? 0) + (summary.totalOutputTokens ?? 0))} sub={`${formatTokens(summary.totalInputTokens)} in · ${formatTokens(summary.totalOutputTokens)} out`} />
            <StatCard label="Est. savings" value={`$${summary.estimatedCostSavings.toFixed(2)}`} sub="vs paid APIs" />
            <StatCard label="Avg latency" value={`${summary.avgLatencyMs}ms`} />
          </div>

          {byModel.length > 0 && (
            <div>
              <p className="text-[10px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">By model</p>
              <div className="space-y-1.5">
                {byModel.map(m => (
                  <div key={`${m.platform}-${m.modelId}`} className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300 truncate">{m.displayName || m.modelId}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-600 capitalize">{m.platform}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300">{m.requests} req</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-600">{formatTokens((m.totalInputTokens ?? 0) + (m.totalOutputTokens ?? 0))} tok</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-zinc-400">No data yet.</p>
      )}
    </div>
  )
}

export default function AIChat() {
  const [tab, setTab] = useState<'chat' | 'usage'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('auto')
  const [modelOpen, setModelOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/ai/models')
      .then(r => r.json())
      .then((data: Model[]) => {
        const available = data.filter(m => m.hasProvider && m.keyCount > 0 && m.enabled)
        setModels(available)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const selectedLabel = selectedModel === 'auto'
    ? 'Auto'
    : models.find(m => m.modelId === selectedModel)?.displayName ?? selectedModel

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, model: selectedModel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      const reply = data.choices[0].message.content
      setMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}` }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">Intelligence</p>
            <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">AI Agent</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {tab === 'chat' && messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-zinc-200 dark:border-white/[0.06]">
          {([['chat', MessageSquare, 'Chat'], ['usage', BarChart2, 'Usage']] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-all -mb-px ${
                tab === id
                  ? 'border-cyan-500 text-cyan-500'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'usage' ? <UsageTab /> : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-2 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 flex items-center justify-center">
                  <Bot size={20} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">How can I help you?</p>
                  <p className="text-[12px] text-zinc-400 dark:text-zinc-600 mt-1">Ask me anything. I remember the conversation.</p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg border border-cyan-500/25 bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} className="text-cyan-400" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-500/10 border border-indigo-500/20 text-zinc-800 dark:text-zinc-200 rounded-tr-sm'
                    : 'bg-zinc-100/80 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.07] text-zinc-700 dark:text-zinc-300 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg border border-indigo-500/25 bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={12} className="text-indigo-400" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-6 h-6 rounded-lg border border-cyan-500/25 bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={12} className="text-cyan-400" />
                </div>
                <div className="bg-zinc-100/80 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-4 sm:px-8 pb-6 pt-3 space-y-2">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setModelOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.07] text-[11px] text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/[0.12] transition-all"
              >
                <Bot size={10} className="text-cyan-400" />
                {selectedLabel}
                <ChevronDown size={10} />
              </button>

              {modelOpen && (
                <div className="absolute bottom-full mb-1 left-0 z-50 w-64 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[rgba(12,12,20,0.97)] shadow-xl overflow-hidden">
                  <div className="max-h-56 overflow-y-auto py-1">
                    <button
                      onClick={() => { setSelectedModel('auto'); setModelOpen(false) }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors ${selectedModel === 'auto' ? 'text-cyan-500' : 'text-zinc-700 dark:text-zinc-300'}`}
                    >
                      <span className="font-medium">Auto</span>
                      <span className="text-zinc-400 dark:text-zinc-600 text-[10px]">best available</span>
                    </button>
                    <div className="h-px bg-zinc-100 dark:bg-white/[0.05] mx-2 my-1" />
                    {models.map(m => (
                      <button
                        key={`${m.platform}-${m.modelId}`}
                        onClick={() => { setSelectedModel(m.modelId); setModelOpen(false) }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors ${selectedModel === m.modelId ? 'text-cyan-500' : 'text-zinc-700 dark:text-zinc-300'}`}
                      >
                        <span className="truncate font-medium">{m.displayName}</span>
                        <span className="text-zinc-400 dark:text-zinc-600 text-[10px] capitalize shrink-0 ml-2">{m.platform}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={send} className="relative flex items-end gap-2 bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.07] rounded-2xl px-4 py-3 focus-within:border-zinc-300 dark:focus-within:border-white/[0.12] transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message… (Enter to send, Shift+Enter for newline)"
                rows={1}
                style={{ resize: 'none' }}
                className="flex-1 bg-transparent text-[13px] text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none max-h-40 overflow-y-auto leading-relaxed"
                onInput={(e) => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = t.scrollHeight + 'px'
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="shrink-0 w-7 h-7 rounded-lg bg-cyan-500/90 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
              >
                <Send size={13} className="text-white" />
              </button>
            </form>
            <p className="text-center text-[10px] text-zinc-300 dark:text-zinc-700">Powered by FreeLLMAPI · Gemini · Groq · GitHub Models</p>
          </div>
        </>
      )}
    </div>
  )
}
