import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { getUser } from '@/store/core'
import { cn } from '@/lib/utils'
import type { WbElement } from '../types'
import { arrowHead, autoFontSize, resolveColor, smoothPath, STICKY_FONT } from './geometry'

interface Props {
  el: WbElement
  editing: boolean
  onCommitText: (id: string, text: string) => void
  onMeasure: (id: string, h: number) => void
}

const STICKY_INK = '#1f2937'

function isFresh(el: WbElement) {
  return !!el.bornAt && Date.now() - el.bornAt < 1200
}

/** Text editor overlay — keeps live text so auto-sizing follows typing.
 *  `center` mode: auto-height textarea vertically centered by its flex parent. */
function TextEditor({
  initial, onDone, style, onChange, center = true,
}: { initial: string; onDone: (t: string) => void; style?: CSSProperties; onChange?: (t: string) => void; center?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)
  const fit = () => {
    const t = ref.current
    if (!t || !center) return
    t.style.height = '0px'
    t.style.height = `${t.scrollHeight}px`
  }
  useLayoutEffect(() => {
    const t = ref.current
    if (!t) return
    fit()
    t.focus()
    t.select()
  }, [])
  useLayoutEffect(fit)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone(ref.current?.value ?? initial)
  }
  return (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={initial}
      onChange={(e) => { onChange?.(e.target.value); fit() }}
      onBlur={finish}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.nativeEvent.isComposing) return // Korean IME: let the composition finish first
        if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) { e.preventDefault(); finish() }
      }}
      spellCheck={false}
      className={cn('resize-none overflow-hidden border-0 bg-transparent p-0 outline-none', center ? 'block max-h-full w-full' : 'absolute inset-0')}
      style={{ textAlign: center ? 'center' : 'left', ...style }}
    />
  )
}

function StickyView({ el, editing, onCommitText }: Props) {
  const [draft, setDraft] = useState(el.text ?? '')
  useEffect(() => { if (!editing) setDraft(el.text ?? '') }, [editing, el.text])
  const fs = el.fontSize ?? autoFontSize(editing ? draft : el.text, el.w, el.h)
  const author = el.authorId ? getUser(el.authorId) : undefined
  const textStyle: CSSProperties = { fontFamily: STICKY_FONT, fontSize: fs, lineHeight: 1.18, color: STICKY_INK, fontWeight: 700 }
  return (
    <div
      className="absolute inset-0 rounded-[3px]"
      style={{
        background: `linear-gradient(170deg, rgba(255,255,255,.42), rgba(255,255,255,0) 32%), ${el.fill}`,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        boxShadow: '0 1px 1px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.06), 0 14px 28px -12px rgba(0,0,0,.45)',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-3 rounded-t-[3px]" style={{ background: 'rgba(0,0,0,.035)' }} />
      {editing ? (
        <div className="absolute inset-3.5 flex items-center">
          <TextEditor initial={el.text ?? ''} onChange={setDraft} onDone={(t) => onCommitText(el.id, t)} style={textStyle} />
        </div>
      ) : (
        <div className="absolute inset-3.5 flex items-center justify-center overflow-hidden text-center whitespace-pre-wrap break-words" style={textStyle}>
          {el.text}
        </div>
      )}
      {author && !editing && el.w >= 140 && (
        <div className="absolute bottom-1.5 right-2 text-[10px] font-medium" style={{ color: 'rgba(31,41,55,.45)' }}>{author.name}</div>
      )}
    </div>
  )
}

function ShapeView({ el, editing, onCommitText }: Props) {
  const stroke = resolveColor(el.stroke)
  const sw = el.strokeWidth ?? 2
  const fill = el.fill && el.fill !== 'none' ? el.fill : 'none'
  const fs = el.fontSize ?? 18
  const textStyle: CSSProperties = { fontSize: fs, lineHeight: 1.35, color: 'rgb(var(--fg))', fontWeight: 600 }
  return (
    <>
      <svg className="absolute inset-0 overflow-visible" width={el.w} height={el.h}>
        {el.type === 'rect' ? (
          <rect x={sw / 2} y={sw / 2} width={Math.max(0, el.w - sw)} height={Math.max(0, el.h - sw)} rx={Math.min(16, el.w / 6, el.h / 6)} fill={fill} fillOpacity={0.2} stroke={stroke} strokeWidth={sw} />
        ) : (
          <ellipse cx={el.w / 2} cy={el.h / 2} rx={Math.max(0, el.w / 2 - sw / 2)} ry={Math.max(0, el.h / 2 - sw / 2)} fill={fill} fillOpacity={0.2} stroke={stroke} strokeWidth={sw} />
        )}
      </svg>
      {editing ? (
        <div className="absolute inset-3 flex items-center">
          <TextEditor initial={el.text ?? ''} onDone={(t) => onCommitText(el.id, t)} style={textStyle} />
        </div>
      ) : (
        el.text && (
          <div className="absolute inset-3 flex items-center justify-center overflow-hidden text-center whitespace-pre-wrap break-words" style={textStyle}>
            {el.text}
          </div>
        )
      )}
    </>
  )
}

function TextView({ el, editing, onCommitText, onMeasure }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(el.text ?? '')
  useEffect(() => { if (!editing) setDraft(el.text ?? '') }, [editing, el.text])
  const fs = el.fontSize ?? 20
  const style: CSSProperties = {
    fontSize: fs,
    lineHeight: 1.35,
    color: resolveColor(el.stroke),
    fontWeight: fs >= 28 ? 700 : 500,
    letterSpacing: fs >= 28 ? '-0.02em' : undefined,
    fontFamily: fs >= 28 ? '"Space Grotesk", "Pretendard Variable", sans-serif' : undefined,
  }
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const h = node.offsetHeight
    if (Math.abs(h - el.h) > 1) onMeasure(el.id, h)
  })
  return (
    <div ref={ref} className="relative min-h-[1em] whitespace-pre-wrap break-words" style={{ ...style, width: el.w }}>
      <span style={{ visibility: editing ? 'hidden' : 'visible' }}>{(editing ? draft : el.text) || ' '}{editing && ' '}</span>
      {editing && <TextEditor initial={el.text ?? ''} onChange={setDraft} onDone={(t) => onCommitText(el.id, t)} center={false} style={{ ...style, padding: 0 }} />}
    </div>
  )
}

function FrameView({ el, editing, onCommitText }: Props) {
  const c = el.fill ?? '#8b5cf6'
  return (
    <>
      <div className="absolute inset-0 rounded-[28px]" style={{ background: `${c}12`, border: `2px solid ${c}55`, boxShadow: `inset 0 0 60px ${c}0d` }} />
      <div
        className="wb-frame-title absolute left-5 top-4 flex h-9 items-center rounded-full px-4 text-[17px] font-bold"
        style={{ background: `${c}2e`, color: c, pointerEvents: 'auto', border: `1px solid ${c}55`, minWidth: 80 }}
      >
        {editing ? (
          <input
            autoFocus
            defaultValue={el.text}
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => onCommitText(el.id, e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.nativeEvent.isComposing) return; if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
            className="w-56 bg-transparent outline-none"
            style={{ color: c }}
          />
        ) : (
          el.text || '프레임'
        )}
      </div>
    </>
  )
}

function LinearView({ el }: Props) {
  const stroke = resolveColor(el.stroke)
  const sw = el.strokeWidth ?? 2
  const x2 = el.w
  const y2 = el.h
  const head = Math.max(10, sw * 4)
  // shorten line so it doesn't poke through the arrow head
  const len = Math.hypot(x2, y2) || 1
  const ex = el.type === 'arrow' ? x2 - (x2 / len) * head * 0.6 : x2
  const ey = el.type === 'arrow' ? y2 - (y2 / len) * head * 0.6 : y2
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      <line x1={0} y1={0} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(16, sw + 12)} style={{ pointerEvents: 'stroke' }} strokeLinecap="round" />
      <line x1={0} y1={0} x2={ex} y2={ey} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      {el.type === 'arrow' && <polygon points={arrowHead(0, 0, x2, y2, head)} fill={stroke} stroke={stroke} strokeWidth={1} strokeLinejoin="round" />}
    </svg>
  )
}

function PathView({ el }: Props) {
  const d = smoothPath(el.points ?? [])
  const sw = el.strokeWidth ?? 3
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(14, sw + 10)} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'stroke' }} />
      <path d={d} fill="none" stroke={resolveColor(el.stroke)} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ImageView({ el }: Props) {
  const [err, setErr] = useState(false)
  return err ? (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-dashed border-line/25 bg-line/[0.05] text-xs text-subtle">이미지를 불러올 수 없어요</div>
  ) : (
    <img src={el.src} alt="" draggable={false} onError={() => setErr(true)} className="pointer-events-none absolute inset-0 h-full w-full rounded-xl object-cover shadow-card" />
  )
}

export const ElementView = memo(function ElementView(props: Props) {
  const { el } = props
  const linear = el.type === 'line' || el.type === 'arrow' || el.type === 'path'
  const style: CSSProperties = linear
    ? { left: el.x, top: el.y, width: 0, height: 0 }
    : el.type === 'text'
      ? { left: el.x, top: el.y, width: el.w }
      : { left: el.x, top: el.y, width: el.w, height: el.h }
  return (
    <div
      data-el-id={el.id}
      className={cn(
        'wb-el absolute',
        el.type === 'frame' && 'pointer-events-none',
        linear && 'pointer-events-none',
        (el.type === 'sticky' || el.type === 'rect' || el.type === 'ellipse' || el.type === 'image' || el.type === 'text') && 'wb-box',
        isFresh(el) && 'wb-pop',
      )}
      style={style}
    >
      {el.type === 'sticky' && <StickyView {...props} />}
      {(el.type === 'rect' || el.type === 'ellipse') && <ShapeView {...props} />}
      {el.type === 'text' && <TextView {...props} />}
      {el.type === 'frame' && <FrameView {...props} />}
      {(el.type === 'line' || el.type === 'arrow') && <LinearView {...props} />}
      {el.type === 'path' && <PathView {...props} />}
      {el.type === 'image' && <ImageView {...props} />}
    </div>
  )
})
