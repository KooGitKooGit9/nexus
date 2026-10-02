import { AnimatePresence, motion } from 'framer-motion'
import {
  MousePointer2, Hand, StickyNote, Square, Circle, ArrowUpRight, Minus, Type, Pencil, Eraser, Image as ImageIcon, Undo2, Redo2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tool } from '../types'
import type { BoardEditor } from './useBoardEditor'
import { resolveColor, STICKY_COLORS, STROKE_COLORS } from './geometry'

const TOOLS: { id: Tool; icon: ReactNode; label: string; key: string }[] = [
  { id: 'select', icon: <MousePointer2 />, label: '선택', key: 'V' },
  { id: 'hand', icon: <Hand />, label: '손 (이동)', key: 'H' },
  { id: 'sticky', icon: <StickyNote />, label: '스티키 노트', key: 'N' },
  { id: 'rect', icon: <Square />, label: '사각형', key: 'R' },
  { id: 'ellipse', icon: <Circle />, label: '원', key: 'O' },
  { id: 'arrow', icon: <ArrowUpRight />, label: '화살표', key: 'A' },
  { id: 'line', icon: <Minus className="-rotate-45" />, label: '선', key: 'L' },
  { id: 'text', icon: <Type />, label: '텍스트', key: 'T' },
  { id: 'pen', icon: <Pencil />, label: '펜', key: 'P' },
  { id: 'eraser', icon: <Eraser />, label: '지우개', key: 'E' },
  { id: 'image', icon: <ImageIcon />, label: '이미지 (URL)', key: 'I' },
]

function ToolButton({ active, onClick, label, shortcut, children, disabled, compact }: { active?: boolean; onClick: () => void; label: string; shortcut?: string; children: ReactNode; disabled?: boolean; compact?: boolean }) {
  return (
    <div className="group/tb relative">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'relative flex items-center justify-center rounded-xl transition-colors',
          compact ? 'h-9 w-9' : 'h-10 w-10',
          'disabled:opacity-30 [&>svg]:relative [&>svg]:h-[18px] [&>svg]:w-[18px]',
          active ? 'text-white' : 'text-muted hover:bg-line/[0.08] hover:text-fg',
        )}
      >
        {active && <motion.span layoutId="wb-tool-active" className="absolute inset-0 rounded-xl bg-accent-gradient shadow-glow-sm" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
        {children}
      </button>
      <span className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-950/95 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/tb:opacity-100">
        {label}{shortcut && <span className="ml-1.5 text-white/50">{shortcut}</span>}
      </span>
    </div>
  )
}

export function Toolbar({ ed, onImage, compact }: { ed: BoardEditor; onImage: () => void; compact?: boolean }) {
  const { tool, setTool, style, setStyle } = ed
  const showSticky = tool === 'sticky'
  const showStroke = tool === 'pen' || tool === 'rect' || tool === 'ellipse' || tool === 'arrow' || tool === 'line' || tool === 'text'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex flex-col items-center gap-2">
      <AnimatePresence>
        {(showSticky || showStroke) && (
          <motion.div
            key={showSticky ? 'sticky' : 'stroke'}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            className="pointer-events-auto glass-strong flex max-w-[calc(100%-24px)] flex-wrap items-center justify-center gap-1.5 rounded-2xl p-1.5 shadow-float"
          >
            {showSticky &&
              STICKY_COLORS.map((c) => (
                <button
                  key={c.key}
                  title={c.label}
                  onClick={() => setStyle((s) => ({ ...s, stickyColor: c.fill }))}
                  className={cn('h-8 w-8 rounded-lg shadow-sm transition-transform hover:scale-110', style.stickyColor === c.fill && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
                  style={{ background: c.fill }}
                />
              ))}
            {showStroke && (
              <>
                {STROKE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStyle((s) => ({ ...s, stroke: c }))}
                    className={cn('h-7 w-7 rounded-full border border-line/15 transition-transform hover:scale-110', style.stroke === c && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
                    style={{ background: resolveColor(c) }}
                  />
                ))}
                {(tool === 'pen' || tool === 'line' || tool === 'arrow') && (
                  <>
                    <div className="mx-1 h-6 w-px bg-line/10" />
                    {[2, 3, 6, 10].map((w) => (
                      <button
                        key={w}
                        onClick={() => setStyle((s) => ({ ...s, strokeWidth: w }))}
                        className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-line/10', style.strokeWidth === w && 'bg-accent/15')}
                      >
                        <span className="rounded-full bg-fg" style={{ width: Math.max(4, w + 2), height: Math.max(4, w + 2) }} />
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
        className={cn('pointer-events-auto glass-strong flex items-center rounded-2xl shadow-float', compact ? 'gap-0 p-1' : 'gap-0.5 p-1.5')}
      >
        {TOOLS.map((t) => (
          <ToolButton key={t.id} compact={compact} active={tool === t.id} label={t.label} shortcut={t.key} onClick={() => (t.id === 'image' ? onImage() : setTool(t.id))}>
            {t.id === 'sticky' ? (
              <span className="relative flex h-[18px] w-[18px] items-center justify-center">
                <StickyNote className="h-[18px] w-[18px]" />
                <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full ring-2 ring-surface" style={{ background: style.stickyColor }} />
              </span>
            ) : (
              t.icon
            )}
          </ToolButton>
        ))}
        <div className="mx-1 h-6 w-px bg-line/10" />
        <ToolButton compact={compact} label="실행 취소" shortcut="⌘Z" onClick={ed.undo} disabled={!ed.canUndo}><Undo2 /></ToolButton>
        <ToolButton compact={compact} label="다시 실행" shortcut="⇧⌘Z" onClick={ed.redo} disabled={!ed.canRedo}><Redo2 /></ToolButton>
      </motion.div>
    </div>
  )
}
