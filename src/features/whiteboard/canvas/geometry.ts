import type { WbElement } from '../types'

export interface Rect { x: number; y: number; w: number; h: number }
export type Pt = [number, number]

export const STICKY_COLORS = [
  { key: 'yellow', fill: '#fde68a', label: '노랑' },
  { key: 'pink', fill: '#fbcfe8', label: '분홍' },
  { key: 'green', fill: '#bbf7d0', label: '초록' },
  { key: 'blue', fill: '#bfdbfe', label: '파랑' },
  { key: 'purple', fill: '#ddd6fe', label: '보라' },
  { key: 'orange', fill: '#fed7aa', label: '주황' },
] as const

export const STROKE_COLORS = ['ink', '#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#f87171', '#60a5fa'] as const

export const STICKY_FONT = '"Gaegu", "Nanum Pen Script", "Pretendard Variable", cursive'

export function resolveColor(c: string | undefined, fallback = 'rgb(var(--fg))'): string {
  if (!c || c === 'ink') return fallback
  return c
}

export function isLinear(el: WbElement) {
  return el.type === 'line' || el.type === 'arrow'
}

/** Positive-size bounding rect of an element. */
export function rectOf(el: WbElement): Rect {
  if (isLinear(el)) {
    return { x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.abs(el.w), h: Math.abs(el.h) }
  }
  return { x: el.x, y: el.y, w: el.w, h: el.h }
}

export function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  rects.forEach((r) => {
    x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h)
  })
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export function boundsOf(els: WbElement[]) {
  return unionRect(els.map(rectOf))
}

export function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function contains(outer: Rect, inner: Rect) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}

export function normRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

/** Smooth polyline through points using quadratic curves between midpoints. */
export function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]} l 0.01 0`
  if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    const [nx, ny] = pts[i + 1]
    d += ` Q ${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`
  return d
}

/** Ramer–Douglas–Peucker simplification. */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts
  const sq = eps * eps
  const segDist = (p: Pt, a: Pt, b: Pt) => {
    let [x, y] = a
    let dx = b[0] - x
    let dy = b[1] - y
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) { x = b[0]; y = b[1] } else if (t > 0) { x += dx * t; y += dy * t }
    }
    dx = p[0] - x
    dy = p[1] - y
    return dx * dx + dy * dy
  }
  const rec = (first: number, last: number, out: Pt[]) => {
    let max = sq
    let idx = -1
    for (let i = first + 1; i < last; i++) {
      const d = segDist(pts[i], pts[first], pts[last])
      if (d > max) { idx = i; max = d }
    }
    if (idx > -1) {
      if (idx - first > 1) rec(first, idx, out)
      out.push(pts[idx])
      if (last - idx > 1) rec(idx, last, out)
    }
  }
  const out: Pt[] = [pts[0]]
  rec(0, pts.length - 1, out)
  out.push(pts[pts.length - 1])
  return out
}

/** Arrow head polygon points at (x2,y2) pointing from (x1,y1). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const s = size
  const p1 = [x2 - s * Math.cos(a - Math.PI / 7), y2 - s * Math.sin(a - Math.PI / 7)]
  const p2 = [x2 - s * Math.cos(a + Math.PI / 7), y2 - s * Math.sin(a + Math.PI / 7)]
  return `${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`
}

/** Pick a font size that fits text into a sticky note. */
export function autoFontSize(text: string | undefined, w: number, h: number) {
  const t = (text ?? '').trim()
  if (!t) return Math.min(30, Math.max(16, w / 8))
  const lines = t.split('\n').length
  const len = Math.max(t.length, 1) + lines * 4
  const area = Math.max(1, (w - 28) * (h - 28))
  const fs = Math.sqrt(area / (len * 1.05))
  return Math.max(13, Math.min(44, fs))
}

/** Normalize a path element so (x,y) is the bbox top-left and points are relative to it. */
export function normalizePath(el: WbElement): WbElement {
  const pts = el.points ?? []
  if (!pts.length) return el
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  pts.forEach(([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) })
  return {
    ...el,
    x: el.x + minX,
    y: el.y + minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
    points: pts.map(([x, y]) => [x - minX, y - minY] as Pt),
  }
}
