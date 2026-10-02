import { useEffect } from 'react'
import { getCurrentUserId, notify } from '@/store/core'
import { useCalendar } from './store'
import { involves } from './utils'

const KEY = 'nexus:calendar-reminded'
const WINDOW_MS = 10 * 60_000
let started = false

// per user: several members may share one browser (`?as=` tabs)
const keyFor = () => `${KEY}@${getCurrentUserId()}`

function readSent(): string[] {
  try { return JSON.parse(localStorage.getItem(keyFor()) ?? '[]') as string[] } catch { return [] }
}

function check() {
  const me = getCurrentUserId()
  const now = Date.now()
  const sent = readSent()
  let changed = false
  for (const ev of useCalendar.getState().events) {
    if (ev.allDay || !involves(ev, me) || ev.rsvp?.[me] === 'no') continue
    const diff = new Date(ev.start).getTime() - now
    const k = `${ev.id}@${ev.start}`
    if (diff <= 0 || diff > WINDOW_MS || sent.includes(k)) continue
    const mins = Math.max(1, Math.round(diff / 60_000))
    notify({
      type: 'event',
      title: `${mins}분 후 일정: ${ev.title}`,
      body: [ev.location, ev.videoLink ? '화상 회의' : null].filter(Boolean).join(' · ') || undefined,
      link: `/calendar?event=${ev.id}`,
      actorId: ev.organizerId !== me ? ev.organizerId : undefined,
    })
    sent.push(k)
    changed = true
  }
  if (changed) {
    try { localStorage.setItem(keyFor(), JSON.stringify(sent.slice(-200))) } catch { /* ignore */ }
  }
}

/** Idempotent: starts a global 30s checker for upcoming events (keeps running across routes). */
export function startEventReminders() {
  if (started || typeof window === 'undefined') return
  started = true
  check()
  window.setInterval(check, 30_000)
}

export function useEventReminders() {
  useEffect(() => startEventReminders(), [])
}
