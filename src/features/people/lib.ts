import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import type { Department, User } from '@/store/types'
import { hashIndex } from '@/lib/utils'
import type { KudosBadge, LeaveEntry, LeaveType, WorkMode } from './types'

/* ───────────── Departments ───────────── */

export const DEPARTMENTS: Department[] = ['경영', '제품', '엔지니어링', '디자인', '마케팅', '영업', '피플팀']

export const DEPT_META: Record<Department, { color: string; emoji: string; gradient: string }> = {
  경영: { color: '#a78bfa', emoji: '🧭', gradient: 'from-violet-500 to-indigo-600' },
  제품: { color: '#22d3ee', emoji: '🧩', gradient: 'from-cyan-400 to-blue-600' },
  엔지니어링: { color: '#60a5fa', emoji: '⚙️', gradient: 'from-sky-400 to-indigo-500' },
  디자인: { color: '#f472b6', emoji: '🎨', gradient: 'from-pink-500 to-rose-600' },
  마케팅: { color: '#fbbf24', emoji: '📣', gradient: 'from-amber-400 to-orange-600' },
  영업: { color: '#34d399', emoji: '🤝', gradient: 'from-emerald-400 to-teal-600' },
  피플팀: { color: '#a3e635', emoji: '🌱', gradient: 'from-lime-400 to-emerald-600' },
}

/* ───────────── Time helpers ───────────── */

/** Re-renders every `ms` and returns current Date. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function dateKey(d: Date = new Date()) {
  return format(d, 'yyyy-MM-dd')
}

export function localTimeIn(tz: string, d: Date = new Date()) {
  try {
    return new Intl.DateTimeFormat('ko-KR', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d)
  } catch {
    return format(d, 'a h:mm')
  }
}

/** Hour (0–23, fractional) in a given timezone. */
export function hourIn(tz: string, d: Date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d)
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
    return h + m / 60
  } catch {
    return d.getHours() + d.getMinutes() / 60
  }
}

/** UTC offset of a timezone at a given instant, in minutes (e.g. Seoul → +540, LA (PDT) → -420). */
export function tzOffsetMinutes(tz: string, d: Date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(d)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
    const base = Math.floor(d.getTime() / 60000) * 60000
    return Math.round((asUtc - base) / 60000)
  } catch {
    return -d.getTimezoneOffset()
  }
}

/** Offset (in hours) of timezone `tz` relative to `from` (default: the viewer's local zone). Real offset, e.g. LA vs Seoul → -16. */
export function tzDiffHours(tz: string, d: Date = new Date(), from?: string) {
  const base = from ? tzOffsetMinutes(from, d) : -d.getTimezoneOffset()
  return Math.round(((tzOffsetMinutes(tz, d) - base) / 60) * 2) / 2
}

/** -1 / 0 / +1 — whether it's yesterday / today / tomorrow in `tz` compared to the viewer. */
export function tzDayShift(tz: string, d: Date = new Date()) {
  try {
    const local = format(d, 'yyyy-MM-dd')
    const there = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    return there === local ? 0 : there < local ? -1 : 1
  } catch {
    return 0
  }
}

/** "오전 9:23", prefixed with 어제/내일 when the date differs from the viewer's. */
export function localTimeLabel(tz: string, d: Date = new Date()) {
  const shift = tzDayShift(tz, d)
  return `${shift < 0 ? '어제 ' : shift > 0 ? '내일 ' : ''}${localTimeIn(tz, d)}`
}

const TZ_ABBR: Record<string, string> = { 'Asia/Seoul': 'KST', 'Asia/Tokyo': 'JST', 'Asia/Singapore': 'SGT', UTC: 'UTC' }

export function tzShortName(tz: string, d: Date = new Date()) {
  if (TZ_ABBR[tz]) return TZ_ABBR[tz]
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(d)
    return p.find((x) => x.type === 'timeZoneName')?.value ?? tz
  } catch {
    return tz
  }
}

export function isLocalNight(tz: string, d = new Date()) {
  const h = hourIn(tz, d)
  return h < 7 || h >= 21
}

export function formatDuration(ms: number, withSeconds = true) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${h}시간 ${m}분`
}

/* ───────────── Attendance (deterministic demo data) ───────────── */

export const WORK_MODE_META: Record<WorkMode, { label: string; emoji: string; tone: 'accent' | 'cyan' | 'warning' | 'pink' }> = {
  office: { label: '사무실', emoji: '🏢', tone: 'accent' },
  remote: { label: '재택', emoji: '🏠', tone: 'cyan' },
  field: { label: '외근', emoji: '🚗', tone: 'warning' },
  leave: { label: '휴가', emoji: '🌴', tone: 'pink' },
}

export const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: '연차',
  half_am: '오전 반차',
  half_pm: '오후 반차',
  sick: '병가',
  workshop: '교육/워크숍',
}

export function leaveCovers(l: LeaveEntry, d: Date) {
  const k = dateKey(d)
  return dateKey(new Date(l.start)) <= k && k <= dateKey(new Date(l.end))
}

/** Default work mode inferred from the user's profile. */
export function defaultWorkMode(u: User): Exclude<WorkMode, 'leave'> {
  if (u.location.includes('재택') || u.timezone !== 'Asia/Seoul') return 'remote'
  if (u.statusText?.includes('방문') || u.statusText?.includes('외근')) return 'field'
  return 'office'
}

/** Deterministic arrival minute-of-day (local) for a user/day pair: 08:20 ~ 10:05 */
export function arrivalMinutes(userId: string, key: string) {
  return 8 * 60 + 20 + hashIndex(userId + key, 106)
}

/** Deterministic worked hours for a past day (weekday 7.6h–10.8h, weekend mostly 0). */
export function pastDayHours(userId: string, d: Date) {
  const day = d.getDay()
  const h = hashIndex(userId + dateKey(d), 100)
  if (day === 0 || day === 6) return h > 85 ? 2 + (h % 3) : 0
  return Math.round((7.6 + (h / 100) * 3.2) * 10) / 10
}

/* ───────────── Kudos ───────────── */

export const KUDOS_BADGES: Record<KudosBadge, { label: string; emoji: string; from: string; to: string; ring: string }> = {
  collab: { label: '협업', emoji: '🤝', from: '#8b5cf6', to: '#6366f1', ring: 'rgba(139,92,246,.45)' },
  impact: { label: '임팩트', emoji: '🚀', from: '#06b6d4', to: '#3b82f6', ring: 'rgba(6,182,212,.45)' },
  challenge: { label: '도전', emoji: '🔥', from: '#f97316', to: '#ef4444', ring: 'rgba(249,115,22,.45)' },
  customer: { label: '고객집착', emoji: '💎', from: '#10b981', to: '#14b8a6', ring: 'rgba(16,185,129,.45)' },
  care: { label: '배려', emoji: '💖', from: '#ec4899', to: '#f43f5e', ring: 'rgba(236,72,153,.45)' },
  growth: { label: '성장', emoji: '🌱', from: '#84cc16', to: '#22c55e', ring: 'rgba(132,204,22,.45)' },
}

/** Rolling 30-day window used for kudos stats / leaderboard (a calendar month looks empty on the 1st). */
export function isRecentKudos(iso: string, now: Date = new Date()) {
  return now.getTime() - new Date(iso).getTime() <= 30 * 86400000
}

export const KUDOS_BADGE_KEYS = Object.keys(KUDOS_BADGES) as KudosBadge[]

/* ───────────── Org tree ───────────── */

export function directReports(users: User[], id: string) {
  return users.filter((u) => u.managerId === id)
}

export function managerChain(users: User[], id: string): string[] {
  const chain: string[] = []
  let cur = users.find((u) => u.id === id)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.push(cur.id)
    cur = cur.managerId ? users.find((u) => u.id === cur!.managerId) : undefined
  }
  return chain
}

export function tenureLabel(joinedAt: string) {
  const months = Math.max(0, Math.floor((Date.now() - new Date(joinedAt).getTime()) / (30.44 * 86400000)))
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}개월`
  return m ? `${y}년 ${m}개월` : `${y}년`
}
