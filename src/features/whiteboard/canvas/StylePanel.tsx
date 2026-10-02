import { motion } from 'framer-motion'
import { ArrowUpRight, BringToFront, Copy, Minus, SendToBack, Trash2, ArrowUp, ArrowDown, Layers, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { Menu, Popover, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { WbElement } from '../types'
import type { BoardEditor } from './useBoardEditor'
import { rectOf, resolveColor, STICKY_COLORS, STROKE_COLORS, unionRect } from './geometry'

function PanelBtn({ label, onClick, children, active, danger }: { label: string; onClick?: () => void; children: ReactNode; active?: boolean; danger?: boolean }) {
  return (
    <Tooltip content={label} side="top">
      <button
        onClick={onClick}
        className={cn(
          'flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-1.5 text-muted transition [&>svg]:h-4 [&>svg]:w-4',
          danger ? 'hover:bg-danger/15 hover:text-danger' : 'hover:bg-line/10 hover:text-fg',
          active && 'bg-accent/15 text-accent',
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

const Sep = () => <div className="mx-0.5 h-5 w-px bg-line/10" />

const FONT_SIZES: { label: string; v: number | undefined }[] = [
  { label: '자동', v: undefined }, { label: 'S', v: 14 }, { label: 'M', v: 20 }, { label: 'L', v: 28 }, { label: 'XL', v: 40 },
]

export function StylePanel({ ed, width }: { ed: BoardEditor; width: number }) {
  const sel = ed.selectedEls
  if (!sel.length || ed.editingId) return null
  const ids = sel.map((e) => e.id)
  const types = new Set(sel.map((e) => e.type))
  const has = (...t: WbElement['type'][]) => t.some((x) => types.has(x))
  const only = (...t: WbElement['type'][]) => [...types].every((x) => t.includes(x))

  const b = unionRect(sel.map(rectOf))!
  const { view } = ed
  let left = view.x + (b.x + b.w / 2) * view.zoom
  let top = view.y + b.y * view.zoom - 62
  if (top < 72) top = view.y + (b.y + b.h) * view.zoom + 18
  left = Math.max(220, Math.min(width - 220, left))

  const patch = (fn: (el: WbElement) => Partial<WbElement>) => ed.update(ids, fn)
  const first = sel[0]

  return (
    <motion.div
      key={ids.join(',')}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15 }}
      className="glass-strong absolute z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-xl p-1 shadow-float"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {has('sticky') && (
        <div className="flex items-center gap-1 px-1">
          {STICKY_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => ed.update(sel.filter((e) => e.type === 'sticky').map((e) => e.id), () => ({ fill: c.fill }))}
              className={cn('h-5 w-5 rounded-md transition hover:scale-110', sel.some((e) => e.type === 'sticky' && e.fill === c.fill) && 'ring-2 ring-accent ring-offset-1 ring-offset-surface')}
              style={{ background: c.fill }}
            />
          ))}
        </div>
      )}

      {has('rect', 'ellipse', 'frame') && (
        <Popover
          placement="top-start"
          className="min-w-0"
          trigger={({ toggle }) => (
            <PanelBtn label="채우기" onClick={toggle}>
              <span className="h-4 w-4 rounded-md border border-line/20" style={{ background: sel.find((e) => e.type !== 'sticky')?.fill ?? 'transparent' }} />
            </PanelBtn>
          )}
        >
          <div className="flex gap-1 p-1">
            <button onClick={() => ed.update(sel.filter((e) => e.type === 'rect' || e.type === 'ellipse').map((e) => e.id), () => ({ fill: 'none' }))} className="relative h-6 w-6 overflow-hidden rounded-md border border-line/20" title="없음">
              <span className="absolute left-1/2 top-[-4px] h-8 w-px rotate-45 bg-danger" />
            </button>
            {STROKE_COLORS.filter((c) => c !== 'ink').map((c) => (
              <button key={c} onClick={() => ed.update(sel.filter((e) => e.type === 'rect' || e.type === 'ellipse' || e.type === 'frame').map((e) => e.id), (e) => ({ fill: c, ...(e.type === 'frame' ? { stroke: c } : {}) }))} className="h-6 w-6 rounded-md transition hover:scale-110" style={{ background: c }} />
            ))}
          </div>
        </Popover>
      )}

      {has('rect', 'ellipse', 'line', 'arrow', 'path', 'text') && (
        <Popover
          placement="top-start"
          className="min-w-0"
          trigger={({ toggle }) => (
            <PanelBtn label="선/글자 색" onClick={toggle}>
              <span className="h-4 w-4 rounded-full border-2" style={{ borderColor: resolveColor(sel.find((e) => e.type !== 'sticky' && e.type !== 'frame')?.stroke) }} />
            </PanelBtn>
          )}
        >
          <div className="flex gap-1 p-1">
            {STROKE_COLORS.map((c) => (
              <button key={c} onClick={() => ed.update(sel.filter((e) => e.type !== 'sticky' && e.type !== 'frame' && e.type !== 'image').map((e) => e.id), () => ({ stroke: c }))} className="h-6 w-6 rounded-full border border-line/15 transition hover:scale-110" style={{ background: resolveColor(c) }} />
            ))}
          </div>
        </Popover>
      )}

      {has('rect', 'ellipse', 'line', 'arrow', 'path') && (
        <Popover
          placement="top-start"
          className="min-w-0"
          trigger={({ toggle }) => (
            <PanelBtn label="선 굵기" onClick={toggle}>
              <span className="w-4 rounded-full bg-current" style={{ height: Math.min(6, Math.max(1.5, (first.strokeWidth ?? 2) / 1.5)) }} />
            </PanelBtn>
          )}
        >
          {(close) => (
            <div className="flex gap-1 p-1">
              {[1, 2, 3, 5, 8, 12].map((w) => (
                <button key={w} onClick={() => { ed.update(sel.filter((e) => e.type !== 'sticky' && e.type !== 'text' && e.type !== 'frame' && e.type !== 'image').map((e) => e.id), () => ({ strokeWidth: w })); close() }} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-line/10">
                  <span className="w-5 rounded-full bg-fg" style={{ height: Math.max(1, w / 1.5) }} />
                </button>
              ))}
            </div>
          )}
        </Popover>
      )}

      {only('line', 'arrow') && (
        <PanelBtn label={first.type === 'arrow' ? '선으로 변경' : '화살표로 변경'} onClick={() => patch((e) => ({ type: e.type === 'arrow' ? 'line' : 'arrow' }))}>
          {first.type === 'arrow' ? <Minus className="-rotate-45" /> : <ArrowUpRight />}
        </PanelBtn>
      )}

      {has('sticky', 'text', 'rect', 'ellipse') && (
        <Popover
          placement="top-start"
          className="min-w-0"
          trigger={({ toggle }) => <PanelBtn label="글자 크기" onClick={toggle}><Type /></PanelBtn>}
        >
          {(close) => (
            <div className="flex gap-0.5 p-1">
              {FONT_SIZES.filter((f) => f.v !== undefined || has('sticky')).map((f) => (
                <button
                  key={f.label}
                  onClick={() => { ed.update(sel.filter((e) => e.type === 'sticky' || e.type === 'text' || e.type === 'rect' || e.type === 'ellipse').map((e) => e.id), (e) => ({ fontSize: f.v ?? (e.type === 'sticky' ? undefined : 20) })); close() }}
                  className={cn('h-8 min-w-[2rem] rounded-lg px-2 text-xs font-semibold text-muted hover:bg-line/10 hover:text-fg', first.fontSize === f.v && 'bg-accent/15 text-accent')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </Popover>
      )}

      <Sep />
      <Menu
        placement="top-start"
        trigger={<PanelBtn label="레이어 순서"><Layers /></PanelBtn>}
        items={[
          { label: '맨 앞으로', icon: <BringToFront />, shortcut: '⇧⌘]', onClick: () => ed.reorder('front') },
          { label: '앞으로', icon: <ArrowUp />, shortcut: '⌘]', onClick: () => ed.reorder('forward') },
          { label: '뒤로', icon: <ArrowDown />, shortcut: '⌘[', onClick: () => ed.reorder('backward') },
          { label: '맨 뒤로', icon: <SendToBack />, shortcut: '⇧⌘[', onClick: () => ed.reorder('back') },
        ]}
      />
      <PanelBtn label="복제 (⌘D)" onClick={() => ed.duplicate(ids)}><Copy /></PanelBtn>
      <PanelBtn label="삭제 (Del)" danger onClick={() => ed.remove(ids)}><Trash2 /></PanelBtn>
    </motion.div>
  )
}
