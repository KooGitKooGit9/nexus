import { useEffect, useRef } from 'react'
import { uid } from '@/lib/utils'
import { getUser } from '@/store/core'
import type { WbElement } from '../types'
import type { BoardEditor } from './useBoardEditor'
import { boundsOf, intersects, rectOf, type Pt, type Rect } from './geometry'

export interface Collaborator {
  userId: string
  color: string
  stickyFill: string
}

export const COLLAB_COLORS = ['#f472b6', '#22d3ee', '#fbbf24', '#34d399', '#a78bfa']

const IDEAS = [
  '👍 좋아요! 이것도 같이 검토해요',
  '사용자 인터뷰 결과 공유 예정 🎤',
  '우선순위 투표 필요 🗳️',
  '이건 다음 스프린트로?',
  '데이터로 먼저 검증해봐요 📊',
  '+1 완전 동의합니다',
  'MVP 범위로 줄여보기 ✂️',
  '레퍼런스 찾아서 공유할게요 🔗',
  '예산은 어느 정도일까요?',
  '디자인 시안 붙여둘게요 🎨',
  '리스크: 일정 빠듯함 ⚠️',
  '고객사 피드백도 비슷했어요!',
]

interface CursorState {
  c: Collaborator
  name: string
  pos: Pt
  from: Pt
  c1: Pt
  c2: Pt
  to: Pt
  t0: number
  dur: number
  moving: boolean
  pauseUntil: number
  plan: null | { kind: 'sticky'; x: number; y: number } | { kind: 'focus'; rect: Rect }
  writingUntil: number
}

const MAX_ADDS = 4

/** Readable label ink for a cursor colour (amber/cyan/emerald need dark text). */
function labelInk(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#111827' : '#ffffff'
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
}
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function findFreeSpot(els: WbElement[]): Pt | null {
  const stickies = els.filter((e) => e.type === 'sticky')
  const solids = els.filter((e) => e.type !== 'frame' && e.type !== 'path' && e.type !== 'line' && e.type !== 'arrow').map(rectOf)
  const offsets: Pt[] = [[190, 0], [0, 190], [-190, 0], [0, -190], [190, 190], [-190, 190]]
  for (let tries = 0; tries < 14 && stickies.length; tries++) {
    const s = stickies[Math.floor(Math.random() * stickies.length)]
    const o = offsets[Math.floor(Math.random() * offsets.length)]
    const r = { x: s.x + o[0], y: s.y + o[1], w: s.w, h: s.h }
    const inflated = { x: r.x - 8, y: r.y - 8, w: r.w + 16, h: r.h + 16 }
    if (!solids.some((x) => intersects(inflated, x))) return [r.x, r.y]
  }
  const b = boundsOf(els)
  if (!b) return [rand(-200, 200), rand(-200, 200)]
  return [b.x + b.w + 60, b.y + rand(0, Math.max(0, b.h - 200))]
}

/** Simulated live teammates: smooth bezier cursors that occasionally drop sticky notes. */
export function Collaborators({ ed, collaborators, enabled }: { ed: BoardEditor; collaborators: Collaborator[]; enabled: boolean }) {
  const cursorEls = useRef<(HTMLDivElement | null)[]>([])
  const labelEls = useRef<(HTMLSpanElement | null)[]>([])
  const ringEls = useRef<(HTMLDivElement | null)[]>([])
  const edRef = useRef(ed)
  edRef.current = ed

  useEffect(() => {
    if (!enabled) return
    const els0 = edRef.current.elsRef.current
    const b = boundsOf(els0) ?? { x: -300, y: -200, w: 600, h: 400 }
    const now0 = performance.now()
    const state: CursorState[] = collaborators.map((c, i) => {
      const p: Pt = [b.x + rand(0.2, 0.8) * b.w, b.y + rand(0.2, 0.8) * b.h]
      return {
        c, name: getUser(c.userId)?.name ?? '동료', pos: p, from: p, c1: p, c2: p, to: p, t0: now0, dur: 1, moving: false,
        pauseUntil: now0 + 300 + i * 700, plan: null, writingUntil: 0,
      }
    })
    let adds = 0
    let lastAdd = now0 - 6000
    let raf = 0
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }

    const plan = (s: CursorState, now: number) => {
      const els = edRef.current.elsRef.current
      const bounds = boundsOf(els) ?? b
      let target: Pt
      s.plan = null
      const canAdd = adds < MAX_ADDS && now - lastAdd > 14000 && !state.some((o) => o !== s && o.plan?.kind === 'sticky')
      if (canAdd && Math.random() < 0.22) {
        const spot = findFreeSpot(els)
        if (spot) {
          s.plan = { kind: 'sticky', x: spot[0], y: spot[1] }
          target = [spot[0] + 85, spot[1] + 85]
          lastAdd = now
        } else target = [bounds.x + rand(0, bounds.w), bounds.y + rand(0, bounds.h)]
      } else {
        const candidates = els.filter((e) => e.type === 'sticky' || e.type === 'rect' || e.type === 'ellipse' || e.type === 'text')
        if (candidates.length && Math.random() < 0.7) {
          const e = candidates[Math.floor(Math.random() * candidates.length)]
          const r = rectOf(e)
          target = [r.x + r.w * rand(0.3, 0.75), r.y + r.h * rand(0.35, 0.8)]
          if (Math.random() < 0.55) s.plan = { kind: 'focus', rect: r }
        } else {
          target = [bounds.x + rand(0, bounds.w), bounds.y + rand(0, bounds.h)]
        }
      }
      const [x0, y0] = s.pos
      const dx = target[0] - x0
      const dy = target[1] - y0
      const dist = Math.hypot(dx, dy)
      const nx = -dy / (dist || 1)
      const ny = dx / (dist || 1)
      const bend1 = rand(-0.35, 0.35) * dist
      const bend2 = rand(-0.25, 0.25) * dist
      s.from = [x0, y0]
      s.c1 = [x0 + dx * 0.3 + nx * bend1, y0 + dy * 0.3 + ny * bend1]
      s.c2 = [x0 + dx * 0.7 + nx * bend2, y0 + dy * 0.7 + ny * bend2]
      s.to = target
      s.t0 = now
      s.dur = Math.min(3400, Math.max(900, 450 + dist * 1.5))
      s.moving = true
    }

    const arrive = (s: CursorState, i: number, now: number) => {
      s.moving = false
      const ring = ringEls.current[i]
      const z = edRef.current.viewRef.current.zoom
      if (s.plan?.kind === 'focus' && ring) {
        const r = s.plan.rect
        Object.assign(ring.style, { left: `${r.x - 6}px`, top: `${r.y - 6}px`, width: `${r.w + 12}px`, height: `${r.h + 12}px`, opacity: '1', borderWidth: `${2 / z}px` })
        later(() => { if (ring) ring.style.opacity = '0' }, 1600)
        s.pauseUntil = now + rand(1400, 2600)
      } else if (s.plan?.kind === 'sticky') {
        const p = s.plan
        s.writingUntil = now + 1300
        const label = labelEls.current[i]
        if (label) label.textContent = `${s.name} · ✍️ 작성 중…`
        later(() => {
          const ed = edRef.current
          const el: WbElement = {
            id: uid('el'), type: 'sticky', x: Math.round(p.x), y: Math.round(p.y), w: 170, h: 170, fill: s.c.stickyFill,
            text: IDEAS[Math.floor(Math.random() * IDEAS.length)], authorId: s.c.userId, rotation: Math.round(rand(-2, 2) * 10) / 10, bornAt: Date.now(),
          }
          ed.remoteAdd([el])
          adds++
          if (label) label.textContent = s.name
          if (ring) {
            Object.assign(ring.style, { left: `${el.x - 6}px`, top: `${el.y - 6}px`, width: `${el.w + 12}px`, height: `${el.h + 12}px`, opacity: '1', borderWidth: `${2 / ed.viewRef.current.zoom}px` })
            later(() => { if (ring) ring.style.opacity = '0' }, 1800)
          }
        }, 1300)
        s.pauseUntil = now + 3000
      } else {
        s.pauseUntil = now + rand(350, 1800)
      }
      s.plan = s.plan?.kind === 'sticky' ? null : s.plan
    }

    let lastFrame = 0
    const tick = (now: number) => {
      raf = 0
      if (document.hidden) return
      // ~30fps is plenty for remote cursors and halves the main-thread cost.
      if (now - lastFrame < 32) { raf = requestAnimationFrame(tick); return }
      lastFrame = now
      const z = edRef.current.viewRef.current.zoom
      state.forEach((s, i) => {
        if (s.moving) {
          const t = Math.min(1, (now - s.t0) / s.dur)
          const e = ease(t)
          s.pos = [bez(s.from[0], s.c1[0], s.c2[0], s.to[0], e), bez(s.from[1], s.c1[1], s.c2[1], s.to[1], e)]
          if (t >= 1) arrive(s, i, now)
        } else if (now > s.pauseUntil) {
          plan(s, now)
        } else {
          // idle micro-jitter so the cursor feels "alive"
          s.pos = [s.pos[0] + Math.sin(now / 420 + i) * 0.08, s.pos[1] + Math.cos(now / 530 + i) * 0.08]
        }
        const node = cursorEls.current[i]
        if (node) node.style.transform = `translate3d(${s.pos[0]}px, ${s.pos[1]}px, 0) scale(${1 / z})`
      })
      raf = requestAnimationFrame(tick)
    }
    // Stop the loop entirely while the tab is hidden; on return shift timelines so cursors resume smoothly.
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now()
        if (raf) cancelAnimationFrame(raf)
        raf = 0
      } else {
        const gap = hiddenAt ? performance.now() - hiddenAt : 0
        state.forEach((s) => { s.t0 += gap; s.pauseUntil += gap; s.writingUntil += gap })
        lastAdd += gap
        hiddenAt = 0
        if (!raf) raf = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) raf = requestAnimationFrame(tick)
    else hiddenAt = performance.now()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      timers.forEach(clearTimeout)
    }
  }, [collaborators, enabled])

  if (!enabled) return null
  return (
    <>
      {collaborators.map((c, i) => (
        <div
          key={`ring-${c.userId}`}
          ref={(n) => { ringEls.current[i] = n }}
          className="pointer-events-none absolute rounded-lg transition-opacity duration-500"
          style={{ opacity: 0, borderStyle: 'solid', borderColor: c.color, boxShadow: `0 0 18px ${c.color}66` }}
        />
      ))}
      {collaborators.map((c, i) => (
        <div
          key={c.userId}
          ref={(n) => { cursorEls.current[i] = n }}
          className="pointer-events-none absolute left-0 top-0 z-10"
          style={{ transformOrigin: '0 0', willChange: 'transform' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.35))' }}>
            <path d="M4 2.5 L10.8 21 L13.4 13.4 L21 10.8 Z" fill={c.color} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span
            ref={(n) => { labelEls.current[i] = n }}
            className="absolute left-4 top-5 whitespace-nowrap rounded-full rounded-tl-sm px-2 py-0.5 text-[11px] font-semibold shadow-lg"
            style={{ background: c.color, color: labelInk(c.color) }}
          >
            {getUser(c.userId)?.name ?? '동료'}
          </span>
        </div>
      ))}
    </>
  )
}
