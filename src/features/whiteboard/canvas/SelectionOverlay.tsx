import type { WbElement } from '../types'
import { isLinear, rectOf, unionRect, type Rect } from './geometry'

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'p1' | 'p2'

const CURSOR: Record<string, string> = {
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', p1: 'move', p2: 'move',
}

function handlePositions(r: Rect): [Handle, number, number][] {
  const { x, y, w, h } = r
  return [
    ['nw', x, y], ['n', x + w / 2, y], ['ne', x + w, y], ['e', x + w, y + h / 2],
    ['se', x + w, y + h], ['s', x + w / 2, y + h], ['sw', x, y + h], ['w', x, y + h / 2],
  ]
}

function HandleDot({ id, x, y, zoom, round }: { id: Handle; x: number; y: number; zoom: number; round?: boolean }) {
  const s = 10 / zoom
  return (
    <div
      data-handle={id}
      className="absolute border-accent bg-white shadow"
      style={{
        left: x - s / 2, top: y - s / 2, width: s, height: s,
        borderWidth: 1.5 / zoom, borderRadius: round ? '50%' : 3 / zoom, cursor: CURSOR[id], pointerEvents: 'auto',
      }}
    />
  )
}

export function SelectionOverlay({ selected, zoom, editing }: { selected: WbElement[]; zoom: number; editing: boolean }) {
  if (!selected.length) return null
  const bw = 1.5 / zoom
  if (selected.length === 1) {
    const el = selected[0]
    if (isLinear(el)) {
      return (
        <div className="pointer-events-none absolute left-0 top-0">
          <HandleDot id="p1" x={el.x} y={el.y} zoom={zoom} round />
          <HandleDot id="p2" x={el.x + el.w} y={el.y + el.h} zoom={zoom} round />
        </div>
      )
    }
    const r = rectOf(el)
    const pad = el.type === 'sticky' ? 3 / zoom : 2 / zoom
    const box = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
    const handles = el.type === 'text' ? handlePositions(box).filter(([h]) => h === 'e' || h === 'w') : handlePositions(box)
    return (
      <div className="pointer-events-none absolute left-0 top-0">
        <div
          className="absolute rounded-[3px]"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h, border: `${bw}px solid rgb(var(--accent))`, boxShadow: `0 0 0 ${3 / zoom}px rgb(var(--accent) / 0.15)` }}
        />
        {!editing && handles.map(([id, x, y]) => <HandleDot key={id} id={id} x={x} y={y} zoom={zoom} />)}
        {!editing && (
          <div
            className="absolute whitespace-nowrap rounded-md bg-accent px-1.5 py-0.5 font-mono text-white"
            style={{ left: box.x + box.w / 2, top: box.y + box.h + 10 / zoom, transform: `translateX(-50%) scale(${1 / zoom})`, transformOrigin: 'top center', fontSize: 10 }}
          >
            {Math.round(r.w)} × {Math.round(r.h)}
          </div>
        )}
      </div>
    )
  }
  const u = unionRect(selected.map(rectOf))!
  return (
    <div className="pointer-events-none absolute left-0 top-0">
      {selected.map((el) => {
        const r = rectOf(el)
        return <div key={el.id} className="absolute rounded-[3px]" style={{ left: r.x, top: r.y, width: r.w, height: r.h, border: `${bw}px solid rgb(var(--accent) / 0.6)` }} />
      })}
      <div
        className="absolute rounded-md"
        style={{ left: u.x - 6 / zoom, top: u.y - 6 / zoom, width: u.w + 12 / zoom, height: u.h + 12 / zoom, border: `${bw}px dashed rgb(var(--accent))` }}
      />
      <div
        className="absolute whitespace-nowrap rounded-md bg-accent px-1.5 py-0.5 text-white"
        style={{ left: u.x + u.w / 2, top: u.y + u.h + 14 / zoom, transform: `translateX(-50%) scale(${1 / zoom})`, transformOrigin: 'top center', fontSize: 11 }}
      >
        {selected.length}개 선택됨
      </div>
    </div>
  )
}
