import { Plane, Receipt, ShoppingCart, KeyRound, FileText, Palmtree, type LucideIcon } from 'lucide-react'
import type { Tone } from '@/components/ui'
import type { ApprovalKind, ApprovalRequest, ApprovalStatus, LeaveType } from './types'
import { isDemoWorkspace } from '@/lib/workspace'

export interface KindMeta {
  label: string
  /** formal document title (spaced) */
  docTitle: string
  icon: LucideIcon
  emoji: string
  gradient: string
  /** text/bg color classes */
  text: string
  soft: string
  description: string
}

export const KIND_META: Record<ApprovalKind, KindMeta> = {
  leave: { label: '휴가', docTitle: '휴 가 신 청 서', icon: Palmtree, emoji: '🌴', gradient: 'from-emerald-400 to-teal-600', text: 'text-emerald-700 dark:text-emerald-400', soft: 'bg-emerald-500/15', description: '연차 · 반차 · 병가 · 경조사' },
  expense: { label: '경비', docTitle: '지 출 결 의 서', icon: Receipt, emoji: '🧾', gradient: 'from-amber-400 to-orange-600', text: 'text-amber-700 dark:text-amber-400', soft: 'bg-amber-500/15', description: '법인카드 · 개인 지출 정산' },
  purchase: { label: '구매', docTitle: '구 매 요 청 서', icon: ShoppingCart, emoji: '🛒', gradient: 'from-sky-400 to-blue-600', text: 'text-sky-700 dark:text-sky-400', soft: 'bg-sky-500/15', description: '장비 · 소프트웨어 · 비품' },
  travel: { label: '출장', docTitle: '출 장 신 청 서', icon: Plane, emoji: '✈️', gradient: 'from-violet-500 to-indigo-600', text: 'text-violet-700 dark:text-violet-400', soft: 'bg-violet-500/15', description: '국내 · 해외 출장 및 경비' },
  access: { label: '권한', docTitle: '권 한 신 청 서', icon: KeyRound, emoji: '🔐', gradient: 'from-pink-500 to-rose-600', text: 'text-pink-700 dark:text-pink-400', soft: 'bg-pink-500/15', description: '시스템 · 데이터 접근 권한' },
  general: { label: '일반', docTitle: '기 안 서', icon: FileText, emoji: '📄', gradient: 'from-slate-400 to-slate-600', text: 'text-slate-600 dark:text-slate-400', soft: 'bg-slate-500/15', description: '품의 · 보고 · 기타 기안' },
}

export const KIND_ORDER: ApprovalKind[] = ['leave', 'expense', 'purchase', 'travel', 'access', 'general']

export const STATUS_META: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  pending: { label: '진행중', tone: 'info' },
  approved: { label: '승인', tone: 'success' },
  rejected: { label: '반려', tone: 'danger' },
  cancelled: { label: '회수', tone: 'neutral' },
}

export const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: '연차',
  half_am: '오전 반차',
  half_pm: '오후 반차',
  sick: '병가',
  family: '경조사',
}

export const ANNUAL_LEAVE_TOTAL = 15
/** Leave already used this year before the seeded requests (u_me) */
export const BASE_LEAVE_USED: Record<string, number> = { u_me: 6.5, u_design: 8, u_pm: 4, u_design2: 3 }

export const won = (n: number | undefined) => (n === undefined ? '-' : `₩${Math.round(n).toLocaleString('ko-KR')}`)

export function currentStepIndex(r: ApprovalRequest) {
  return r.steps.findIndex((s) => s.status === 'pending')
}

export function isPendingOn(r: ApprovalRequest, userId: string) {
  return r.status === 'pending' && r.steps.some((s) => s.status === 'pending' && s.approverId === userId)
}

/** Business days between two dates inclusive (Mon–Fri). */
export function businessDays(startIso: string, endIso: string): number {
  const s = new Date(startIso)
  const e = new Date(endIso)
  s.setHours(0, 0, 0, 0)
  e.setHours(0, 0, 0, 0)
  if (e < s) return 0
  let n = 0
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) n++
  }
  return n
}

export function leaveDays(type: LeaveType | undefined, start?: string, end?: string): number {
  if (!start) return 0
  // a half day only counts when it falls on a business day
  if (type === 'half_am' || type === 'half_pm') return businessDays(start, start) ? 0.5 : 0
  return businessDays(start, end ?? start)
}

/** Count of approved annual leave days for a user (from requests) + base usage. */
export function usedLeave(requests: ApprovalRequest[], userId: string): number {
  const fromReq = requests
    .filter((r) => r.kind === 'leave' && r.requesterId === userId && r.status === 'approved' && r.leaveType !== 'sick' && r.leaveType !== 'family')
    .reduce((n, r) => n + (r.days ?? leaveDays(r.leaveType, r.startDate, r.endDate)), 0)
  // the pre-existing usage is demo flavour — real workspaces only count what was actually approved here
  return (isDemoWorkspace() ? BASE_LEAVE_USED[userId] ?? 5 : 0) + fromReq
}

/** Default approval line: walk up the managerId chain. */
export function managerChain(users: { id: string; managerId: string | null }[], userId: string, max = 3): string[] {
  const chain: string[] = []
  let cur = users.find((u) => u.id === userId)
  while (cur?.managerId && chain.length < max) {
    if (chain.includes(cur.managerId)) break
    const next = users.find((u) => u.id === cur!.managerId)
    // a manager who left the workspace can't approve anything
    if (!next) break
    chain.push(next.id)
    cur = next
  }
  return chain
}

/** Korean particle picker: josa('휴가 신청', '을/를') → '휴가 신청을'. Falls back to "을(를)" for non-Hangul endings. */
export function josa(word: string, pair: '을/를' | '이/가' | '은/는' | '과/와' | '으로/로') {
  const [withB, withoutB] = pair.split('/')
  const ch = word.trim().replace(/[\s"'”’)\]]+$/, '').slice(-1)
  const code = ch.charCodeAt(0) - 0xac00
  if (code < 0 || code > 11171) {
    if (/[0-9]/.test(ch)) return word + ('0136789'.includes(ch) ? withB : withoutB)
    return `${word}${withB}(${withoutB})`
  }
  const jong = code % 28
  if (pair === '으로/로' && jong === 8) return word + withoutB
  return word + (jong ? withB : withoutB)
}

/** Only the particle part of `josa` (e.g. '을', '를' or '을(를)'). */
export const particle = (word: string, pair: Parameters<typeof josa>[1]) => josa(word, pair).slice(word.length)
