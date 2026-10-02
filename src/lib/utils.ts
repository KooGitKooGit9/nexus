import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { nanoid } from 'nanoid'
import { formatDistanceToNowStrict, format, isToday, isYesterday } from 'date-fns'
import { ko } from 'date-fns/locale'

/** Merge Tailwind classes safely. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Short unique id with an optional prefix, e.g. uid('msg') → "msg_V1StGXR8". */
export function uid(prefix = 'id') {
  return `${prefix}_${nanoid(10)}`
}

/** ISO string for "now + n days" at an optional hour/minute. Used by seed data so demos always look fresh. */
export function daysFromNow(days: number, hour?: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  if (hour !== undefined) d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** ISO string for "now − n minutes". */
export function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString()
}

/** "방금 전", "5분 전", "3일 전" */
export function timeAgo(iso: string | number | Date): string {
  const d = new Date(iso)
  if (Date.now() - d.getTime() < 45_000) return '방금 전'
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: ko })
}

/** "오후 3:24" */
export function formatTime(iso: string | number | Date): string {
  return format(new Date(iso), 'a h:mm', { locale: ko })
}

/** "오늘", "어제", "10월 3일 (금)" */
export function formatDayLabel(iso: string | number | Date): string {
  const d = new Date(iso)
  if (isToday(d)) return '오늘'
  if (isYesterday(d)) return '어제'
  return format(d, 'M월 d일 (EEE)', { locale: ko })
}

export function formatDate(iso: string | number | Date, pattern = 'yyyy.MM.dd'): string {
  return format(new Date(iso), pattern, { locale: ko })
}

/** Deterministic hash → index, used to pick stable gradient colors per id/name. */
export function hashIndex(str: string, mod: number): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % mod
}

export const GRADIENTS = [
  'from-violet-500 to-fuchsia-500',
  'from-cyan-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-purple-600',
  'from-sky-400 to-indigo-500',
  'from-lime-400 to-emerald-600',
] as const

export function gradientFor(key: string): string {
  return GRADIENTS[hashIndex(key, GRADIENTS.length)]
}

/** Hex palette for charts/labels that need raw colors. */
export const PALETTE = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185', '#a3e635'] as const

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function initials(name: string): string {
  const t = name.trim()
  if (/^[가-힣]/.test(t)) return t.length >= 3 ? t.slice(1) : t
  return t.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}
