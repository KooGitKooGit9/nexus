import confetti from 'canvas-confetti'
import type { Tone } from '@/components/ui'
import type { KeyResult, Objective } from './types'

export type ObjectiveStatus = Objective['status']

export const STATUS_META: Record<ObjectiveStatus, { label: string; tone: Tone; color: string; emoji: string }> = {
  on_track: { label: '순항', tone: 'success', color: '#34d399', emoji: '🟢' },
  at_risk: { label: '위험', tone: 'warning', color: '#fbbf24', emoji: '🟡' },
  off_track: { label: '지연', tone: 'danger', color: '#fb7185', emoji: '🔴' },
  done: { label: '완료', tone: 'accent', color: '#a78bfa', emoji: '✅' },
}

/** Company-level (전사) objective — team objectives align under these. */
export function isCompanyObjective(o: Pick<Objective, 'team' | 'parentId'>) {
  return o.team === '전사'
}

export const STATUS_ORDER: ObjectiveStatus[] = ['on_track', 'at_risk', 'off_track', 'done']

/** 0–100. Handles "lower is better" KRs (target < start). */
export function krProgress(kr: KeyResult): number {
  const start = kr.start ?? 0
  const span = kr.target - start
  if (span === 0) return kr.current >= kr.target ? 100 : 0
  const p = ((kr.current - start) / span) * 100
  return Math.max(0, Math.min(100, Math.round(p)))
}

export function objectiveProgress(o: Objective): number {
  if (!o.keyResults.length) return 0
  return Math.round(o.keyResults.reduce((a, k) => a + krProgress(k), 0) / o.keyResults.length)
}

export function averageProgress(objs: Objective[]): number {
  if (!objs.length) return 0
  return Math.round(objs.reduce((a, o) => a + objectiveProgress(o), 0) / objs.length)
}

export function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('ko-KR')
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

export function progressTone(p: number): 'success' | 'accent' | 'warning' | 'danger' {
  if (p >= 100) return 'success'
  if (p >= 60) return 'accent'
  if (p >= 35) return 'warning'
  return 'danger'
}

/** Elapsed fraction (0–1) of a "2026 Q4"-style quarter, relative to now. */
export function quarterElapsed(quarter: string): number {
  const m = quarter.match(/(\d{4})\s*Q([1-4])/)
  if (!m) return 0
  const y = +m[1]
  const q = +m[2]
  const start = new Date(y, (q - 1) * 3, 1).getTime()
  const end = new Date(y, q * 3, 1).getTime()
  return Math.max(0, Math.min(1, (Date.now() - start) / (end - start)))
}

export function quarterOf(date = new Date()): string {
  return `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`
}

/** Previous / current / next quarter relative to today, plus any quarter that already has objectives. */
export function quarterOptions(objectives: { quarter: string }[], now = new Date()): string[] {
  const shift = (months: number) => quarterOf(new Date(now.getFullYear(), now.getMonth() + months, 1))
  return Array.from(new Set([shift(-3), shift(0), shift(3), ...objectives.map((o) => o.quarter)])).sort()
}

export function burstConfetti(origin?: { x: number; y: number }) {
  const colors = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24']
  confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin: origin ?? { x: 0.5, y: 0.6 }, colors, zIndex: 9999, scalar: 0.9 })
}

export function bigConfetti() {
  const colors = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24']
  const end = Date.now() + 900
  ;(function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 9999 })
    confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 9999 })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
  confetti({ particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.55 }, colors, zIndex: 9999 })
}

/** Converts a DOM element's center to confetti origin coordinates. */
export function originFromEl(el: Element | null | undefined) {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
}
