import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { addMinutes, endOfDay, isSameDay, isToday, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import { cn, clamp } from '@/lib/utils'
import { toast } from '@/store/core'
import { useCalendar } from '../store'
import { HOUR_H, SNAP_MIN, alpha } from '../constants'
import { allDayLanes, packColumns, timedSegments } from '../layout'
import { fmt, minutesOfDay, shortTime, timeLabel } from '../utils'
import { holidayOn } from '../holidays'
import { useNow } from '../hooks'
import { EventBlock, EventPill } from '../components/EventBlock'
import type { DisplayEvent } from '../types'

export interface TimeGridProps {
  days: Date[]
  events: DisplayEvent[]
  ghost?: { start: Date; end: Date } | null
  /** true while a popover is open: first click on the grid only dismisses it */
  locked?: boolean
  onEventClick: (id: string, rect: DOMRect) => void
  onCreate: (start: Date, end: Date, allDay?: boolean) => void
  onSelectDay?: (d: Date) => void
}

type Drag =
  | { kind: 'create'; day: number; a: number; b: number }
  | { kind: 'move' | 'resize'; id: string; start: Date; end: Date }

const LANE_H = 22

/** Create-drag span: dragging downward covers [anchor, b); upward it still includes the anchor cell. */
const createSpan = (a: number, b: number): [number, number] => (b > a ? [a, b] : [b, a + SNAP_MIN])

/** "GMT+9", "GMT-3:30" — the viewer's local offset (the grid renders in local time). */
function gmtLabel() {
  const off = -new Date().getTimezoneOffset()
  const h = Math.floor(Math.abs(off) / 60)
  const m = Math.abs(off) % 60
  return `GMT${off >= 0 ? '+' : '-'}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

export function TimeGrid({ days, events, ghost, locked, onEventClick, onCreate, onSelectDay }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const now = useNow(60_000)
  const moveEvent = useCalendar((s) => s.moveEvent)
  const [drag, setDrag] = useState<Drag | null>(null)
  const lockedAtDown = useRef(false)
  const n = days.length

  // auto-scroll to ~8am on mount
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_H - 16
  }, [])

  const segs = useMemo(() => packColumns(timedSegments(events, days)), [events, days])
  const lanes = useMemo(() => allDayLanes(events, days), [events, days])
  const laneCount = lanes.reduce((m, l) => Math.max(m, l.lane + 1), 0)

  const preview = useMemo(() => {
    if (!drag || drag.kind === 'create') return []
    const ev = events.find((e) => e.id === drag.id)
    if (!ev) return []
    return timedSegments([{ ...ev, start: drag.start.toISOString(), end: drag.end.toISOString() }], days)
  }, [drag, events, days])

  const locate = (x: number, y: number) => {
    const r = gridRef.current!.getBoundingClientRect()
    const day = clamp(Math.floor(((x - r.left) / r.width) * n), 0, n - 1)
    const min = clamp(((y - r.top) / HOUR_H) * 60, 0, 1440)
    return { day, min }
  }

  const autoScroll = (y: number) => {
    const sc = scrollRef.current
    if (!sc) return
    const r = sc.getBoundingClientRect()
    if (y < r.top + 90) sc.scrollTop -= 14
    else if (y > r.bottom - 40) sc.scrollTop += 14
  }

  const listen = (move: (e: PointerEvent) => void, up: (e: PointerEvent) => void, cancel?: () => void) => {
    const off = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    const onUp = (e: PointerEvent) => { off(); up(e) }
    const onCancel = () => { off(); setDrag(null); cancel?.() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  /* ── create by click / drag on empty grid ── */
  const onGridDown = (e: RPointerEvent) => {
    if (e.button !== 0 || locked) return
    if ((e.target as HTMLElement).closest('[data-event]')) return
    e.preventDefault()
    const { day, min } = locate(e.clientX, e.clientY)
    const anchor = Math.floor(min / SNAP_MIN) * SNAP_MIN
    let st: Drag & { kind: 'create' } = { kind: 'create', day, a: anchor, b: anchor + SNAP_MIN }
    let moved = false
    setDrag(st)
    listen(
      (pe) => {
        autoScroll(pe.clientY)
        const m = locate(pe.clientX, pe.clientY).min
        const b = m >= anchor ? Math.max(anchor + SNAP_MIN, Math.ceil(m / SNAP_MIN) * SNAP_MIN) : Math.floor(m / SNAP_MIN) * SNAP_MIN
        if (b !== st.b) moved = true
        st = { ...st, b }
        setDrag(st)
      },
      () => {
        setDrag(null)
        let [s, en] = createSpan(st.a, st.b)
        if (!moved) { s = Math.floor(anchor / 30) * 30; en = s + 60 }
        if (en > 1440) { en = 1440; s = Math.min(s, 1380) }
        const base = startOfDay(days[st.day])
        onCreate(addMinutes(base, s), addMinutes(base, en))
      },
    )
  }

  /* ── move / resize existing events ── */
  const onEventDown = (ev: DisplayEvent) => (e: RPointerEvent, mode: 'move' | 'resize') => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = (e.target as HTMLElement).closest('[data-event]') as HTMLElement
    const rect = el.getBoundingClientRect()
    const origin = locate(e.clientX, e.clientY)
    const ox = e.clientX
    const oy = e.clientY
    const s0 = new Date(ev.start)
    const e0 = new Date(ev.end)
    let moved = false
    let res: { start: Date; end: Date } | null = null
    listen(
      (pe) => {
        if (!moved && Math.hypot(pe.clientX - ox, pe.clientY - oy) < 4) return
        if (ev.readOnly) return
        moved = true
        autoScroll(pe.clientY)
        const p = locate(pe.clientX, pe.clientY)
        if (mode === 'move') {
          const delta = Math.round(((p.day - origin.day) * 1440 + (p.min - origin.min)) / SNAP_MIN) * SNAP_MIN
          res = { start: addMinutes(s0, delta), end: addMinutes(e0, delta) }
        } else {
          const delta = Math.round(((p.day - origin.day) * 1440 + (p.min - origin.min)) / SNAP_MIN) * SNAP_MIN
          let ne = addMinutes(e0, delta)
          if (ne.getTime() - s0.getTime() < SNAP_MIN * 60_000) ne = addMinutes(s0, SNAP_MIN)
          res = { start: s0, end: ne }
        }
        setDrag({ kind: mode, id: ev.id, ...res })
      },
      () => {
        setDrag(null)
        if (!moved) return onEventClick(ev.id, rect)
        if (!res || (res.start.getTime() === s0.getTime() && res.end.getTime() === e0.getTime())) return
        moveEvent(ev.id, res.start, res.end)
        toast(mode === 'move' ? '일정을 옮겼어요' : '일정 시간을 변경했어요', {
          description: `${ev.title} · ${fmt(res.start, 'M월 d일 (EEE)')} ${timeLabel(res.start)} – ${timeLabel(res.end)}`,
          variant: 'success',
          emoji: mode === 'move' ? '🗓️' : '↕️',
          duration: 2600,
        })
      },
    )
  }

  const todayIdx = days.findIndex((d) => isToday(d))
  const nowTop = (minutesOfDay(now) / 60) * HOUR_H
  const draggingId = drag && drag.kind !== 'create' ? drag.id : null

  return (
    <div ref={scrollRef} className="relative h-full overflow-auto select-none">
      <div className={cn('relative', n > 1 && 'min-w-[600px]')}>
        {/* ── sticky header: day labels + all-day row ── */}
        <div className="sticky top-0 z-40 border-b border-line/10 bg-bg/95 backdrop-blur-xl">
          <div className="flex">
            <div className="sticky left-0 z-10 flex w-16 shrink-0 items-end justify-end bg-bg pb-1.5 pr-2 text-[10px] font-medium text-subtle">{gmtLabel()}</div>
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
              {days.map((d, i) => {
                const hol = holidayOn(d)
                const red = d.getDay() === 0 || !!hol
                const blue = d.getDay() === 6 && !hol
                const today = isToday(d)
                return (
                  <button
                    key={i}
                    onClick={() => onSelectDay?.(d)}
                    className={cn('group flex flex-col items-center gap-0.5 border-l border-line/[0.06] py-2 transition hover:bg-line/[0.03]', n === 1 && 'items-start pl-4')}
                  >
                    <span className={cn('text-[11px] font-medium', today ? 'text-accent' : red ? 'text-rose-600 dark:text-rose-400' : blue ? 'text-sky-600 dark:text-sky-400' : 'text-muted')}>{fmt(d, 'EEE')}</span>
                    <span
                      className={cn(
                        'flex h-9 min-w-9 items-center justify-center rounded-full px-1 font-display text-[19px] font-semibold transition',
                        today ? 'bg-accent-gradient text-white shadow-glow-sm' : cn('group-hover:bg-line/[0.07]', red ? 'text-rose-600 dark:text-rose-400' : blue ? 'text-sky-600 dark:text-sky-400' : 'text-fg'),
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          {/* all-day row */}
          <div className="flex border-t border-line/[0.06]">
            <div className="sticky left-0 z-10 w-16 shrink-0 bg-bg py-1.5 pr-2 text-right text-[10px] font-medium text-subtle">종일</div>
            <div className="relative flex-1" style={{ height: Math.max(1, laneCount) * LANE_H + 8 }}>
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
                {days.map((d, i) => (
                  <div
                    key={i}
                    onPointerDown={() => { lockedAtDown.current = !!locked }}
                    onClick={() => !lockedAtDown.current && onCreate(startOfDay(d), endOfDay(d), true)}
                    className={cn('cursor-pointer border-l border-line/[0.06] transition hover:bg-accent/[0.05]', (d.getDay() === 0 || d.getDay() === 6) && 'bg-line/[0.02]')}
                  />
                ))}
              </div>
              {lanes.map((l) => (
                <motion.div
                  key={l.ev.id}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute px-[3px]"
                  style={{ top: 4 + l.lane * LANE_H, left: `${(l.startIdx / n) * 100}%`, width: `${((l.endIdx - l.startIdx + 1) / n) * 100}%` }}
                >
                  <EventPill ev={l.ev} filled continuesBefore={l.continuesBefore} continuesAfter={l.continuesAfter} onClick={(r) => onEventClick(l.ev.id, r)} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── body ── */}
        <div className="relative flex" style={{ height: 24 * HOUR_H }}>
          {/* gutter */}
          <div className="sticky left-0 z-[35] w-16 shrink-0 bg-bg">
            {Array.from({ length: 23 }, (_, i) => i + 1).filter((h) => todayIdx < 0 || Math.abs(h * HOUR_H - nowTop) > 12).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium tabular-nums text-subtle" style={{ top: h * HOUR_H }}>
                {fmt(new Date(2000, 0, 1, h), 'a h시')}
              </span>
            ))}
            {todayIdx >= 0 && (
              <span className="absolute right-1 z-10 -translate-y-1/2 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-[0_0_12px_rgba(244,63,94,0.6)]" style={{ top: nowTop }}>
                {shortTime(now)}
              </span>
            )}
          </div>

          {/* grid */}
          <div
            ref={gridRef}
            onPointerDown={onGridDown}
            className="relative grid flex-1 cursor-crosshair"
            style={{
              gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`,
              backgroundImage: `linear-gradient(to bottom, rgb(var(--line) / 0.075) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--line) / 0.03) 1px, transparent 1px)`,
              backgroundSize: `100% ${HOUR_H}px, 100% ${HOUR_H / 2}px`,
            }}
          >
            {days.map((d, i) => {
              const weekend = d.getDay() === 0 || d.getDay() === 6 || !!holidayOn(d)
              return (
                <div key={i} className={cn('relative border-l border-line/[0.06]', weekend && 'bg-line/[0.025]', isToday(d) && 'bg-accent/[0.035]')}>
                  {/* working hours hint */}
                  {!weekend && <div className="pointer-events-none absolute inset-x-0 bg-accent/[0.015]" style={{ top: 9 * HOUR_H, height: 9 * HOUR_H }} />}
                </div>
              )
            })}

            {/* events layer */}
            <div className="pointer-events-none absolute inset-0">
              {segs.map((s) => {
                const top = (s.startMin / 60) * HOUR_H
                const height = ((s.endMin - s.startMin) / 60) * HOUR_H - 2
                return (
                  <div key={`${s.ev.id}-${s.day}`} className="pointer-events-none absolute inset-y-0" style={{ left: `${(s.day / n) * 100}%`, width: `${100 / n}%` }}>
                    <EventBlock
                      ev={s.ev}
                      top={top}
                      height={height}
                      left={s.left}
                      width={s.width}
                      isStart={s.isStart}
                      isEnd={s.isEnd}
                      faded={draggingId === s.ev.id}
                      past={new Date(s.ev.end) < now}
                      onPointerDown={onEventDown(s.ev)}
                    />
                  </div>
                )
              })}
              {preview.map((s) => (
                <div key={`pv-${s.day}`} className="absolute inset-y-0" style={{ left: `${(s.day / n) * 100}%`, width: `${100 / n}%` }}>
                  <EventBlock ev={s.ev} top={(s.startMin / 60) * HOUR_H} height={((s.endMin - s.startMin) / 60) * HOUR_H - 2} left={0} width={1} isStart={s.isStart} isEnd={s.isEnd} dragging />
                </div>
              ))}
            </div>

            {/* ghost for create-drag / pending draft */}
            {(() => {
              let g: { day: number; s: number; e: number } | null = null
              if (drag?.kind === 'create') { const [cs, ce] = createSpan(drag.a, drag.b); g = { day: drag.day, s: cs, e: ce } }
              else if (ghost && !drag) {
                const di = days.findIndex((d) => isSameDay(d, ghost.start))
                if (di >= 0) g = { day: di, s: minutesOfDay(ghost.start), e: isSameDay(ghost.start, ghost.end) ? minutesOfDay(ghost.end) : 1440 }
              }
              if (!g) return null
              const base = startOfDay(days[g.day])
              return (
                <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: `${(g.day / n) * 100}%`, width: `${100 / n}%` }}>
                  <motion.div
                    layout
                    transition={{ duration: 0.08 }}
                    className="absolute inset-x-1 overflow-hidden rounded-[10px] border-2 border-dashed border-accent/70 bg-accent/20 px-2 py-1 shadow-glow backdrop-blur-sm"
                    style={{ top: (g.s / 60) * HOUR_H, height: Math.max(((g.e - g.s) / 60) * HOUR_H - 2, 16) }}
                  >
                    <p className="text-[11px] font-semibold text-fg">(제목 없음)</p>
                    <p className="text-[10.5px] text-muted">{timeLabel(addMinutes(base, g.s))} – {timeLabel(addMinutes(base, g.e))}</p>
                  </motion.div>
                </div>
              )
            })()}

            {/* current time line */}
            {todayIdx >= 0 && (
              <>
                <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-rose-500/25" style={{ top: nowTop }} />
                <div className="pointer-events-none absolute z-30" style={{ top: nowTop, left: `${(todayIdx / n) * 100}%`, width: `${100 / n}%` }}>
                  <div className="relative h-[2px] bg-rose-500" style={{ boxShadow: `0 0 8px ${alpha('#f43f5e', 0.8)}` }}>
                    <span className="absolute -left-[5px] -top-[4px] h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
                    <span className="absolute -left-[5px] -top-[4px] h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse-ring" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
