import { uid } from '@/lib/utils'
import type { TemplateId, WbElement } from './types'
import { STICKY_COLORS, type Pt } from './canvas/geometry'

type StickyKey = (typeof STICKY_COLORS)[number]['key']
export const stickyFill = (k: StickyKey) => STICKY_COLORS.find((c) => c.key === k)!.fill

let tilt = 0
const nextTilt = () => {
  tilt = (tilt + 1) % 7
  return [-1.6, 0.8, -0.4, 1.4, -1, 0.3, 1.8][tilt]
}

/** Tiny DSL for building board content. */
export const B = {
  sticky: (x: number, y: number, text: string, color: StickyKey = 'yellow', authorId?: string, size: [number, number] = [170, 170]): WbElement => ({
    id: uid('el'), type: 'sticky', x, y, w: size[0], h: size[1], fill: stickyFill(color), text, authorId, rotation: nextTilt(),
  }),
  frame: (x: number, y: number, w: number, h: number, title: string, color: string): WbElement => ({
    id: uid('el'), type: 'frame', x, y, w, h, fill: color, stroke: color, text: title,
  }),
  text: (x: number, y: number, text: string, fontSize = 20, w = 400, stroke = 'ink'): WbElement => ({
    id: uid('el'), type: 'text', x, y, w, h: Math.round(fontSize * 1.5 * Math.max(1, text.split('\n').length)), text, fontSize, stroke,
  }),
  rect: (x: number, y: number, w: number, h: number, text = '', fill = '#8b5cf6', stroke = fill, fontSize?: number): WbElement => ({
    id: uid('el'), type: 'rect', x, y, w, h, text, fill, stroke, strokeWidth: 2, fontSize,
  }),
  ellipse: (x: number, y: number, w: number, h: number, text = '', fill = '#22d3ee', stroke = fill, fontSize?: number): WbElement => ({
    id: uid('el'), type: 'ellipse', x, y, w, h, text, fill, stroke, strokeWidth: 2, fontSize,
  }),
  arrow: (x1: number, y1: number, x2: number, y2: number, stroke = 'ink', strokeWidth = 2): WbElement => ({
    id: uid('el'), type: 'arrow', x: x1, y: y1, w: x2 - x1, h: y2 - y1, stroke, strokeWidth,
  }),
  line: (x1: number, y1: number, x2: number, y2: number, stroke = 'ink', strokeWidth = 2): WbElement => ({
    id: uid('el'), type: 'line', x: x1, y: y1, w: x2 - x1, h: y2 - y1, stroke, strokeWidth,
  }),
  path: (pts: Pt[], stroke = '#f472b6', strokeWidth = 4): WbElement => {
    const minX = Math.min(...pts.map((p) => p[0]))
    const minY = Math.min(...pts.map((p) => p[1]))
    const maxX = Math.max(...pts.map((p) => p[0]))
    const maxY = Math.max(...pts.map((p) => p[1]))
    return {
      id: uid('el'), type: 'path', x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY),
      points: pts.map(([x, y]) => [x - minX, y - minY] as Pt), stroke, strokeWidth,
    }
  },
}

/** Hand-drawn-looking loop around a center (for "circled" highlights). */
export function scribbleLoop(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i <= 40; i++) {
    const a = (i / 36) * Math.PI * 2 - 0.4
    const wob = 1 + Math.sin(i * 1.7) * 0.03
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob])
  }
  return pts
}

/* ───────────── Templates (fresh content for new boards) ───────────── */

export const TEMPLATES: { id: TemplateId; name: string; emoji: string; description: string; gradient: string }[] = [
  { id: 'blank', name: '빈 보드', emoji: '✨', description: '자유롭게 시작하기', gradient: 'from-slate-500 to-slate-700' },
  { id: 'brainstorm', name: '브레인스토밍', emoji: '💡', description: '주제 중심으로 아이디어 확산', gradient: 'from-amber-400 to-orange-600' },
  { id: 'kpt', name: '회고 KPT', emoji: '🔁', description: 'Keep · Problem · Try', gradient: 'from-emerald-400 to-teal-600' },
  { id: 'journey', name: '사용자 여정 지도', emoji: '🗺️', description: '단계별 행동·생각·감정 정리', gradient: 'from-cyan-400 to-blue-600' },
  { id: 'mindmap', name: '마인드맵', emoji: '🧠', description: '생각을 가지처럼 뻗어나가기', gradient: 'from-violet-500 to-fuchsia-500' },
]

export function buildTemplate(id: TemplateId, title = ''): WbElement[] {
  switch (id) {
    case 'brainstorm': {
      const cx = 0, cy = 0
      const center = B.ellipse(cx - 150, cy - 85, 300, 170, title || '🎯 주제를 입력하세요', '#8b5cf6', '#8b5cf6', 24)
      const colors: StickyKey[] = ['yellow', 'pink', 'green', 'blue', 'purple', 'orange']
      const out: WbElement[] = [center]
      colors.forEach((c, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        const sx = cx + Math.cos(a) * 380 - 85
        const sy = cy + Math.sin(a) * 300 - 85
        out.unshift(B.line(cx + Math.cos(a) * 150, cy + Math.sin(a) * 85, sx + 85 - Math.cos(a) * 85, sy + 85 - Math.sin(a) * 85, '#8b5cf6', 2))
        out.push(B.sticky(sx, sy, i === 0 ? '아이디어를 적어보세요 ✍️' : '', c))
      })
      out.push(B.text(-300, -470, '💡 브레인스토밍', 40, 600))
      out.push(B.text(-300, -405, '판단은 나중에! 양이 질을 만듭니다. 더블클릭으로 편집하세요.', 16, 640, '#94a3b8'))
      return out
    }
    case 'kpt': {
      const cols: [string, string, StickyKey, string][] = [
        ['👍 Keep — 계속할 것', '#34d399', 'green', '잘 된 점을 적어주세요'],
        ['🤔 Problem — 문제점', '#f472b6', 'pink', '아쉬웠던 점은?'],
        ['🚀 Try — 시도할 것', '#60a5fa', 'blue', '다음에 해볼 것'],
      ]
      const out: WbElement[] = [B.text(0, -110, '🔁 스프린트 회고', 40, 700), B.text(0, -50, '각 영역에 스티키를 붙이고, 마지막에 투표로 액션 아이템을 정해요.', 16, 800, '#94a3b8')]
      cols.forEach(([t, color, sc, ph], i) => {
        out.push(B.frame(i * 450, 0, 410, 640, t, color))
        out.push(B.sticky(i * 450 + 25, 80, ph, sc))
      })
      return out
    }
    case 'journey': {
      const stages = [['인지', '#8b5cf6'], ['탐색', '#6366f1'], ['가입', '#22d3ee'], ['온보딩', '#34d399'], ['활성화', '#fbbf24']] as const
      const rows = ['행동', '생각', '감정', '페인포인트', '기회']
      const out: WbElement[] = [B.text(0, -130, '🗺️ 사용자 여정 지도', 40, 800), B.text(0, -70, '페르소나: ______ · 목표: ______', 18, 800, '#94a3b8')]
      stages.forEach(([s, c], i) => {
        out.push(B.rect(180 + i * 260, 0, 240, 64, s, c, c, 22))
        if (i < stages.length - 1) out.push(B.arrow(180 + i * 260 + 244, 32, 180 + (i + 1) * 260 - 4, 32, '#94a3b8', 2))
      })
      rows.forEach((r, i) => {
        out.push(B.text(0, 120 + i * 180, r, 22, 160))
        out.push(B.line(0, 100 + i * 180, 180 + 5 * 260, 100 + i * 180, '#94a3b855', 1))
      })
      return out
    }
    case 'mindmap': {
      const out: WbElement[] = []
      const center = B.ellipse(-130, -70, 260, 140, title || '🧠 중심 주제', '#8b5cf6', '#8b5cf6', 24)
      const branches: [string, string, number, number][] = [
        ['목표', '#22d3ee', -520, -260], ['아이디어', '#f472b6', 300, -260], ['리소스', '#34d399', -520, 160], ['리스크', '#fbbf24', 300, 160],
      ]
      branches.forEach(([label, color, bx, by]) => {
        const node = B.rect(bx, by, 220, 90, label, color, color, 22)
        out.push(B.line(0, 0, bx + 110, by + 45, color, 3))
        out.push(node)
        const dir = bx < 0 ? -1 : 1
        ;[0, 1].forEach((k) => {
          const sx = bx + (dir < 0 ? -230 : 260)
          const sy = by - 40 + k * 130
          out.push(B.line(bx + (dir < 0 ? 0 : 220), by + 45, sx + (dir < 0 ? 170 : 0), sy + 50, color, 2))
          out.push(B.sticky(sx, sy, '', k ? 'blue' : 'yellow', undefined, [170, 100]))
        })
      })
      out.push(center)
      return out
    }
    default:
      return []
  }
}
