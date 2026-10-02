import { memo } from 'react'
import type { WbElement } from '../types'
import { arrowHead, boundsOf, resolveColor, smoothPath } from '../canvas/geometry'

/** Lightweight SVG miniature of a board's content (no text, just shapes). */
export const BoardThumbnail = memo(function BoardThumbnail({ elements, className, pad = 60 }: { elements: WbElement[]; className?: string; pad?: number }) {
  const b = boundsOf(elements)
  if (!b) {
    return (
      <svg className={className} viewBox="0 0 400 220">
        <text x="200" y="118" textAnchor="middle" fontSize="15" fill="rgb(var(--subtle))">빈 캔버스</text>
      </svg>
    )
  }
  const vb = `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`
  const sw = Math.max(b.w, b.h) / 300
  return (
    <svg className={className} viewBox={vb} preserveAspectRatio="xMidYMid meet">
      {elements.map((el) => {
        const ink = resolveColor(el.stroke, 'rgb(var(--fg) / 0.7)')
        switch (el.type) {
          case 'frame':
            return (
              <g key={el.id}>
                <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={16} fill={el.fill} fillOpacity={0.1} stroke={el.fill} strokeOpacity={0.5} strokeWidth={sw * 1.5} />
                <rect x={el.x + 16} y={el.y + 18} width={Math.min(el.w * 0.4, 200)} height={18} rx={9} fill={el.fill} fillOpacity={0.55} />
              </g>
            )
          case 'sticky':
            return <rect key={el.id} x={el.x} y={el.y} width={el.w} height={el.h} rx={6} fill={el.fill} transform={el.rotation ? `rotate(${el.rotation} ${el.x + el.w / 2} ${el.y + el.h / 2})` : undefined} />
          case 'rect':
            return <rect key={el.id} x={el.x} y={el.y} width={el.w} height={el.h} rx={12} fill={el.fill && el.fill !== 'none' ? el.fill : 'none'} fillOpacity={0.3} stroke={resolveColor(el.stroke)} strokeWidth={sw * 2} />
          case 'ellipse':
            return <ellipse key={el.id} cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={el.fill && el.fill !== 'none' ? el.fill : 'none'} fillOpacity={0.3} stroke={resolveColor(el.stroke)} strokeWidth={sw * 2} />
          case 'line':
          case 'arrow':
            return (
              <g key={el.id}>
                <line x1={el.x} y1={el.y} x2={el.x + el.w} y2={el.y + el.h} stroke={ink} strokeWidth={Math.max(sw * 1.5, el.strokeWidth ?? 2)} strokeLinecap="round" />
                {el.type === 'arrow' && <polygon points={arrowHead(el.x, el.y, el.x + el.w, el.y + el.h, sw * 10 + 8)} fill={ink} />}
              </g>
            )
          case 'path':
            return <path key={el.id} d={smoothPath(el.points ?? [])} transform={`translate(${el.x} ${el.y})`} fill="none" stroke={ink} strokeWidth={Math.max(sw * 2, el.strokeWidth ?? 3)} strokeLinecap="round" strokeLinejoin="round" />
          case 'text': {
            const fs = el.fontSize ?? 20
            const len = Math.min(el.w, (el.text?.length ?? 4) * fs * 0.62)
            return <rect key={el.id} x={el.x} y={el.y + fs * 0.3} width={len} height={fs * 0.7} rx={fs * 0.3} fill={ink} fillOpacity={0.35} />
          }
          case 'image':
            return <rect key={el.id} x={el.x} y={el.y} width={el.w} height={el.h} rx={8} fill="rgb(var(--line) / 0.15)" />
          default:
            return null
        }
      })}
    </svg>
  )
})
