import { addDays, addMinutes, differenceInMinutes, format, isSameDay, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { isHoliday } from './holidays'
import type { CalEvent } from './types'

/* ───────────── basic helpers ───────────── */

export const involves = (ev: CalEvent, userId: string) => ev.organizerId === userId || ev.attendeeIds.includes(userId)

/** All-day or ≥24h events render in the all-day row / as month bars. */
export function isAllDayLike(ev: CalEvent): boolean {
  return !!ev.allDay || differenceInMinutes(new Date(ev.end), new Date(ev.start)) >= 24 * 60
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()

/* ───────────── public reusable helpers (home dashboard etc.) ───────────── */

/** Events that touch the given calendar day, sorted: all-day first, then by start time. */
export function getEventsForDay<T extends CalEvent>(events: T[], date: Date): T[] {
  const ds = startOfDay(date)
  const de = addDays(ds, 1)
  return events
    .filter((ev) => {
      const s = new Date(ev.start)
      const e = new Date(ev.end)
      return s < de && (e > ds || (s >= ds && s.getTime() === e.getTime()))
    })
    .sort((a, b) => {
      const aa = isAllDayLike(a) ? 0 : 1
      const bb = isAllDayLike(b) ? 0 : 1
      if (aa !== bb) return aa - bb
      return new Date(a.start).getTime() - new Date(b.start).getTime() || new Date(b.end).getTime() - new Date(a.end).getTime()
    })
}

/** Does this event make `userId` unavailable? */
export function blocksUser(ev: CalEvent, userId: string): boolean {
  if (!involves(ev, userId)) return false
  if (ev.rsvp?.[userId] === 'no') return false
  if (ev.type === 'holiday' || ev.type === 'deadline') return false
  if (isAllDayLike(ev)) return ev.type === 'ooo'
  return true
}

/** First event that makes the user busy in [start, end), if any. */
export function userConflict(events: CalEvent[], userId: string, start: Date, end: Date, excludeId?: string): CalEvent | undefined {
  return events.find((ev) => ev.id !== excludeId && blocksUser(ev, userId) && overlaps(new Date(ev.start), new Date(ev.end), start, end))
}

export function roomConflict(events: CalEvent[], roomId: string, start: Date, end: Date, excludeId?: string): CalEvent | undefined {
  return events.find((ev) => ev.id !== excludeId && ev.room === roomId && overlaps(new Date(ev.start), new Date(ev.end), start, end))
}

export interface FreeSlotOptions {
  attendeeIds: string[]
  durationMin: number
  /** search from (default: now rounded up to the next step) */
  from?: Date
  /** how many calendar days to scan, starting with the `from` day (default 14; 0 or 1 = that day only) */
  days?: number
  workStartHour?: number // default 9
  workEndHour?: number // default 18
  stepMin?: number // default 30
  limit?: number // default 3
  excludeEventId?: string
  avoidLunch?: boolean // default true (12:00–13:00)
  skipWeekends?: boolean // default true (also skips public holidays)
}

export interface Slot {
  start: Date
  end: Date
}

/** Earliest common free slots for all attendees within working hours. */
export function findFreeSlots(events: CalEvent[], opts: FreeSlotOptions): Slot[] {
  const {
    attendeeIds, durationMin, days = 14, workStartHour = 9, workEndHour = 18, stepMin = 30, limit = 3,
    excludeEventId, avoidLunch = true, skipWeekends = true,
  } = opts
  const now = new Date()
  const base = opts.from && opts.from > now ? opts.from : now
  const stepMs = stepMin * 60_000
  const from = new Date(Math.ceil(base.getTime() / stepMs) * stepMs)
  const relevant = events.filter((ev) => ev.id !== excludeEventId && attendeeIds.some((u) => blocksUser(ev, u)))
  const out: Slot[] = []
  for (let i = 0; i < Math.max(1, days) && out.length < limit; i++) {
    const day = addDays(startOfDay(from), i)
    if (skipWeekends && (day.getDay() === 0 || day.getDay() === 6 || isHoliday(day))) continue
    let t = workStartHour * 60
    while (t + durationMin <= workEndHour * 60 && out.length < limit) {
      const s = addMinutes(day, t)
      const e = addMinutes(s, durationMin)
      if (s < from) { t += stepMin; continue }
      if (avoidLunch && overlaps(s, e, addMinutes(day, 12 * 60), addMinutes(day, 13 * 60))) { t += stepMin; continue }
      const busy = relevant.some((ev) => overlaps(new Date(ev.start), new Date(ev.end), s, e) && attendeeIds.some((u) => blocksUser(ev, u)))
      if (!busy) {
        out.push({ start: s, end: e })
        t += Math.max(durationMin, stepMin)
      } else t += stepMin
    }
  }
  return out
}

/* ───────────── formatting ───────────── */

export const fmt = (d: Date | string, p: string) => format(new Date(d), p, { locale: ko })

/** "오후 2:00" (drops ":00"? no — keeps minutes for clarity) */
export const timeLabel = (d: Date | string) => fmt(d, 'a h:mm')

/** Short label for time grid & pills: "오후 2시" / "오후 2:30" */
export function shortTime(d: Date | string) {
  const x = new Date(d)
  return x.getMinutes() === 0 ? fmt(x, 'a h시') : fmt(x, 'a h:mm')
}

export function durationLabel(min: number) {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h >= 24 && m === 0 && h % 24 === 0) return `${h / 24}일`
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

export function formatRange(ev: Pick<CalEvent, 'start' | 'end' | 'allDay'>) {
  const s = new Date(ev.start)
  const e = new Date(ev.end)
  if (ev.allDay) {
    return isSameDay(s, e) ? `${fmt(s, 'M월 d일 (EEE)')} · 종일` : `${fmt(s, 'M월 d일 (EEE)')} – ${fmt(e, 'M월 d일 (EEE)')} · 종일`
  }
  if (isSameDay(s, e)) return `${fmt(s, 'M월 d일 (EEE)')} · ${timeLabel(s)} – ${timeLabel(e)}`
  return `${fmt(s, 'M월 d일 (EEE) a h:mm')} – ${fmt(e, 'M월 d일 (EEE) a h:mm')}`
}

export function eventDuration(ev: Pick<CalEvent, 'start' | 'end'>) {
  return differenceInMinutes(new Date(ev.end), new Date(ev.start))
}

/** "12분 후", "진행 중", "내일 오전 10:00" */
export function relativeStart(ev: CalEvent, now = new Date()) {
  const s = new Date(ev.start)
  const e = new Date(ev.end)
  if (s <= now && e > now) return ev.allDay ? (isSameDay(e, now) ? '오늘 종일' : `종일 · ${fmt(e, 'M월 d일')}까지`) : '진행 중'
  const diff = differenceInMinutes(s, now)
  if (diff >= 0 && diff < 60) return `${Math.max(1, diff)}분 후`
  if (isSameDay(s, now)) return ev.allDay ? '오늘 종일' : `오늘 ${timeLabel(s)}`
  if (isSameDay(s, addDays(now, 1))) return ev.allDay ? '내일 종일' : `내일 ${timeLabel(s)}`
  return ev.allDay ? fmt(s, 'M월 d일 (EEE)') : fmt(s, 'M월 d일 (EEE) a h:mm')
}

/** 15-minute options for time selects: value "HH:mm" */
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  const d = new Date(2000, 0, 1, h, m)
  return { value: format(d, 'HH:mm'), label: format(d, 'a h:mm', { locale: ko }) }
})

export function generateMeetLink() {
  const a = 'abcdefghijkmnopqrstuvwxyz'
  const r = (n: number) => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join('')
  return `https://meet.nexus.app/${r(3)}-${r(4)}`
}

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')
