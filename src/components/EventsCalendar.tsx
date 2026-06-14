'use client'

import { useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock, Trash2 } from 'lucide-react'
import type { Event } from '@/lib/personal-db'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const COLOR_DOTS: Record<string, string> = {
  indigo: 'bg-indigo-400',
  rose: 'bg-rose-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  sky: 'bg-sky-400',
  violet: 'bg-violet-400',
  orange: 'bg-orange-400',
}

const COLOR_PILLS: Record<string, string> = {
  indigo: 'bg-indigo-500/20 text-indigo-300',
  rose: 'bg-rose-500/20 text-rose-300',
  emerald: 'bg-emerald-500/20 text-emerald-300',
  amber: 'bg-amber-500/20 text-amber-300',
  sky: 'bg-sky-500/20 text-sky-300',
  violet: 'bg-violet-500/20 text-violet-300',
  orange: 'bg-orange-500/20 text-orange-300',
}

export default function EventsCalendar({
  initialEvents,
  initialYear,
  initialMonth,
}: {
  initialEvents: Event[]
  initialYear: number
  initialMonth: number
}) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', time: '', description: '', color: 'indigo' })
  const [isPending, startTransition] = useTransition()

  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
    loadEvents(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
    loadEvents(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1)
  }

  function loadEvents(y: number, m: number) {
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
    startTransition(async () => {
      const res = await fetch(`/api/events?from=${from}&to=${to}`)
      if (res.ok) setEvents(await res.json())
    })
  }

  const eventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date === dateStr)
  }

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : ''

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, date: form.date || selectedDateStr }),
    })
    if (res.ok) {
      const event = await res.json()
      setEvents(prev => [...prev, event])
      setShowForm(false)
      setForm({ title: '', date: '', time: '', description: '', color: 'indigo' })
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Calendar grid */}
      <div className="flex-1 min-w-0">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-zinc-100">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-medium tracking-widest uppercase text-zinc-600 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-zinc-800 rounded-xl overflow-hidden border border-zinc-800">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-zinc-950 h-20 sm:h-24" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayEvents = eventsForDay(day)
            const isToday = isCurrentMonth && day === today.getDate()
            const isSelected = day === selectedDay

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`bg-zinc-950 h-20 sm:h-24 p-1.5 cursor-pointer transition-colors hover:bg-zinc-900 ${isSelected ? 'bg-zinc-900 ring-1 ring-inset ring-orange-500/50' : ''}`}
              >
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-orange-500 text-white' : isSelected ? 'text-orange-400' : 'text-zinc-400'}`}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map(ev => (
                    <div key={ev.id} className={`text-[10px] leading-tight truncate px-1 py-0.5 rounded ${COLOR_PILLS[ev.color] ?? 'bg-indigo-500/20 text-indigo-300'}`}>
                      {ev.time ? `${ev.time} ` : ''}{ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-zinc-600">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Side panel */}
      <div className="lg:w-72 shrink-0">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          {selectedDay ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {MONTHS[month]} {selectedDay}
                </h3>
                <button
                  onClick={() => { setShowForm(true); setForm(f => ({ ...f, date: selectedDateStr })) }}
                  className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
              {eventsForDay(selectedDay).length === 0 ? (
                <p className="text-xs text-zinc-600">No events. Add one!</p>
              ) : (
                <div className="space-y-2">
                  {eventsForDay(selectedDay).map(ev => (
                    <div key={ev.id} className="group flex items-start gap-2 p-2 rounded-lg hover:bg-zinc-800 transition-colors">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${COLOR_DOTS[ev.color] ?? 'bg-indigo-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-200 font-medium truncate">{ev.title}</div>
                        {ev.time && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                            <Clock size={10} /> {ev.time}
                          </div>
                        )}
                        {ev.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{ev.description}</p>}
                      </div>
                      <button onClick={() => handleDelete(ev.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-zinc-600">Select a day to see events.</p>
          )}
        </div>

        {/* Add event form */}
        {showForm && (
          <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-100">New Event</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-600 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleAddEvent} className="space-y-2.5">
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Event title"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50"
              />
              <input
                type="date"
                required
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500/50"
              />
              <input
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-orange-500/50"
              />
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 resize-none"
              />
              <div className="flex gap-1.5">
                {Object.entries(COLOR_DOTS).map(([color, cls]) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className={`w-5 h-5 rounded-full ${cls} ${form.color === color ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900' : ''}`}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Add Event
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
