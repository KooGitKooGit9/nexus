import { useEffect, useMemo, useState } from 'react'
import { addDays, isSameDay, startOfDay, endOfDay } from 'date-fns'
import { getEventsForDay, involves, isAllDayLike } from '@/features/calendar/utils'
import { useCore } from '@/store/core'
import { useCalendar } from '@/features/calendar/store'
import { useProjects } from '@/features/projects/store'
import { useApprovals } from '@/features/approvals/store'
import type { CalEvent } from '@/features/calendar/types'
import type { Task } from '@/features/projects/types'
import type { ApprovalRequest } from '@/features/approvals/types'

/** Re-renders every `ms` milliseconds and returns the current Date. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** "하늘님" — Korean given name for friendly greetings. */
export function friendlyName(name: string) {
  if (/^[가-힣]{3}$/.test(name)) return `${name.slice(1)}님`
  if (/^[가-힣]{2,4}$/.test(name)) return `${name.slice(1)}님`
  return `${name.split(' ')[0]}님`
}

export function greetingFor(d: Date): { text: string; emoji: string } {
  const h = d.getHours()
  if (h >= 5 && h < 11) return { text: '좋은 아침이에요', emoji: '☀️' }
  if (h >= 11 && h < 14) return { text: '맛있는 점심 드세요', emoji: '🍱' }
  if (h >= 14 && h < 18) return { text: '오후도 힘내세요', emoji: '💪' }
  if (h >= 18 && h < 22) return { text: '오늘 하루 수고 많았어요', emoji: '🌇' }
  return { text: '늦은 시간까지 고생 많아요', emoji: '🌙' }
}

export function mockWeather(d: Date) {
  const h = d.getHours()
  const night = h < 6 || h >= 19
  const high = 21
  const low = 12
  // daily curve: coldest at 05시, warmest at 15시 — always within [low, high]
  const hh = (h - 5 + 24) % 24
  const f = hh <= 10 ? (1 - Math.cos((Math.PI * hh) / 10)) / 2 : (1 + Math.cos((Math.PI * (hh - 10)) / 14)) / 2
  const temp = Math.round(low + (high - low) * f)
  return { city: '서울', temp, label: '맑음', emoji: night ? '🌙' : '☀️', high, low }
}

/** Local yyyy-MM-dd (not UTC). */
export function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ───────────── domain selectors (pure) ───────────── */

export function isMine(e: CalEvent, me: string) {
  return involves(e, me)
}

/** All-day or ≥24h events (shown as chips, not on the timeline). */
export { isAllDayLike }

/**
 * My events touching `day` (same rules as the calendar: end is exclusive) plus public holidays.
 * Sorted all-day first, then by start time.
 */
export function eventsOn(events: CalEvent[], day: Date, me: string) {
  return getEventsForDay(events.filter((ev) => ev.type === 'holiday' || isMine(ev, me)), day)
}

export function myOpenTasks(tasks: Task[], me: string) {
  return tasks.filter((t) => t.assigneeIds.includes(me) && t.status !== 'done')
}

export function isOverdue(t: Task, now = new Date()) {
  return !!t.dueDate && t.status !== 'done' && new Date(t.dueDate).getTime() < startOfDay(now).getTime()
}

/** Due today or tomorrow (not yet overdue). */
export function isDueSoon(t: Task, now = new Date()) {
  if (!t.dueDate || t.status === 'done' || isOverdue(t, now)) return false
  const due = new Date(t.dueDate).getTime()
  return due <= endOfDay(addDays(now, 1)).getTime()
}

export function pendingOnMe(requests: ApprovalRequest[], me: string) {
  return requests.filter((r) => r.status === 'pending' && r.steps.some((s) => s.approverId === me && s.status === 'pending'))
}

/** Counts for the hero's one-line daily brief. */
export function useDailyBrief() {
  const me = useCore((s) => s.currentUserId)
  const events = useCalendar((s) => s.events)
  const tasks = useProjects((s) => s.tasks)
  const requests = useApprovals((s) => s.requests)
  // re-evaluate every 30s so "next event" / day rollover stay fresh
  const tick = useNow(30_000)
  return useMemo(() => {
    const now = tick
    const today = eventsOn(events ?? [], now, me)
    const meetings = today.filter((e) => e.type === 'meeting' && !isAllDayLike(e)).length
    const mine = myOpenTasks(tasks ?? [], me)
    const urgent = mine.filter((t) => isDueSoon(t, now)).length
    const overdue = mine.filter((t) => isOverdue(t, now)).length
    const approvals = pendingOnMe(requests ?? [], me).length
    const next = today.find((e) => !isAllDayLike(e) && new Date(e.start) > now)
    return { meetings, urgent, overdue, approvals, openTasks: mine.length, next }
  }, [events, tasks, requests, me, tick])
}

export { isSameDay }
