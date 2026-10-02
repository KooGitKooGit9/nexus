import { useMemo, useRef, useState } from 'react'
import { addDays, addMinutes, differenceInCalendarDays, isSameDay, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { motion } from 'framer-motion'
import { Popover } from '@/components/ui'
import { cn } from '@/lib/utils'
import { toast } from '@/store/core'
import { useCalendar } from '../store'
import { allDayLanes } from '../layout'
import { fmt, getEventsForDay, isAllDayLike } from '../utils'
import { holidayOn } from '../holidays'
import { EventPill } from '../components/EventBlock'
import type { DisplayEvent } from '../types'

const MAX = 3
const TOP = 32
const ROW = 22
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const DND_TYPE = 'application/x-nexus-event'
const notHoliday = (ev: DisplayEvent) => ev.type !== 'holiday'

/** Column (0–6) under the pointer within a week row. */
function colAt(e: React.DragEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect()
  return Math.min(6, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * 7)))
}

interface Props {
  date: Date
  events: DisplayEvent[]
  onEventClick: (id: string, rect: DOMRect) => void
  onCreate: (start: Date, end: Date, allDay?: boolean) => void
  onSelectDay: (d: Date) => void
  locked?: boolean
}

export function MonthView({ date, events, onEventClick, onCreate, onSelectDay, locked }: Props) {
  const moveEvent = useCalendar((s) => s.moveEvent)
  const [dropDay, setDropDay] = useState<number | null>(null)
  const lockedAtDown = useRef(false)
  const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 0 })
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridStart.getTime()],
  )

  const onDrop = (target: Date, e: React.DragEvent) => {
    e.preventDefault()
    setDropDay(null)
    try {
      const { id, from } = JSON.parse(e.dataTransfer.getData(DND_TYPE)) as { id: string; from: string }
      const ev = events.find((x) => x.id === id)
      if (!ev) return
      const delta = differenceInCalendarDays(target, new Date(from))
      if (!delta) return
      const s = addDays(new Date(ev.start), delta)
      moveEvent(id, s, addDays(new Date(ev.end), delta))
      toast('일정을 옮겼어요', { description: `${ev.title} → ${fmt(s, 'M월 d일 (EEE)')}`, variant: 'success', emoji: '🗓️', duration: 2400 })
    } catch { /* not ours */ }
  }

  /** `from` = the day the user grabbed; for bars pass the week so the grabbed column is resolved from the pointer. */
  const dragStart = (ev: DisplayEvent, from: Date | Date[]) => (e: React.DragEvent) => {
    if (ev.readOnly) return e.preventDefault()
    let day = Array.isArray(from) ? from[0] : from
    if (Array.isArray(from)) {
      const row = (e.currentTarget as HTMLElement).closest('[data-week]')
      if (row) {
        const r = row.getBoundingClientRect()
        day = from[Math.min(6, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * 7)))]
      }
    }
    e.dataTransfer.setData(DND_TYPE, JSON.stringify({ id: ev.id, from: day.toISOString() }))
    e.dataTransfer.effectAllowed = 'move'
    window.addEventListener('dragend', () => setDropDay(null), { once: true })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-line/10 bg-bg/70 backdrop-blur-xl">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={cn('py-2 text-center text-[11px] font-semibold', i === 0 ? 'text-rose-600 dark:text-rose-400' : i === 6 ? 'text-sky-600 dark:text-sky-400' : 'text-muted')}>{w}</div>
        ))}
      </div>
      <div className="grid min-h-[640px] flex-1" style={{ gridTemplateRows: 'repeat(6, minmax(118px, 1fr))' }}>
        {weeks.map((days, wi) => {
          const lanes = allDayLanes(events, days, (ev) => notHoliday(ev) && isAllDayLike(ev))
          return (
            <div
              key={wi}
              data-week
              className="relative grid grid-cols-7 border-b border-line/[0.07] last:border-b-0"
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DND_TYPE)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const di = colAt(e)
                setDropDay(wi * 7 + di)
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropDay(null) }}
              onDrop={(e) => onDrop(days[colAt(e)], e)}
            >
              {days.map((d, di) => {
                const inMonth = isSameMonth(d, date)
                const hol = events.find((ev) => ev.type === 'holiday' && isSameDay(new Date(ev.start), d))
                const weekend = d.getDay() === 0 || d.getDay() === 6
                const today = isToday(d)
                const idx = wi * 7 + di
                return (
                  <div
                    key={di}
                    onPointerDown={() => { lockedAtDown.current = !!locked }}
                    onClick={() => !lockedAtDown.current && onCreate(addMinutes(startOfDay(d), 9 * 60), addMinutes(startOfDay(d), 10 * 60))}
                    className={cn(
                      'group relative cursor-pointer border-l border-line/[0.07] transition-colors first:border-l-0 hover:bg-line/[0.025]',
                      weekend && 'bg-line/[0.022]',
                      !inMonth && 'bg-line/[0.035]',
                      today && 'bg-accent/[0.06]',
                      dropDay === idx && 'bg-accent/[0.12] ring-2 ring-inset ring-accent/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 px-2 pt-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectDay(d) }}
                        className={cn('relative flex items-center justify-center rounded-full text-[12px] font-semibold transition', !today && 'h-6 min-w-6 px-1 hover:bg-line/10', !inMonth && 'opacity-40')}
                      >
                        {today ? (
                          <span className="-my-0.5 rounded-full bg-accent-gradient-3 p-[2px] shadow-glow-sm">
                            <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-accent-gradient px-1 text-white ring-2 ring-bg">{d.getDate()}</span>
                          </span>
                        ) : (
                          <span className={cn(holidayOn(d) || d.getDay() === 0 ? 'text-rose-600 dark:text-rose-400' : d.getDay() === 6 ? 'text-sky-600 dark:text-sky-400' : 'text-fg')}>
                            {d.getDate() === 1 ? fmt(d, 'M월 d일') : d.getDate()}
                          </span>
                        )}
                      </button>
                      {hol && (
                        <button
                          type="button"
                          title={hol.title}
                          onClick={(e) => { e.stopPropagation(); onEventClick(hol.id, e.currentTarget.getBoundingClientRect()) }}
                          className={cn('min-w-0 truncate rounded px-1 text-[10px] font-medium text-rose-600/90 dark:text-rose-400/90 transition hover:bg-rose-400/10', !inMonth && 'opacity-40')}
                        >
                          {hol.title}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* bars (all-day / multi-day) */}
              {lanes.filter((l) => l.lane < MAX).map((l) => (
                <div key={l.ev.id} className="pointer-events-none absolute px-1" style={{ top: TOP + l.lane * ROW, left: `${(l.startIdx / 7) * 100}%`, width: `${((l.endIdx - l.startIdx + 1) / 7) * 100}%` }}>
                  <motion.div initial={{ opacity: 0, scaleX: 0.96 }} animate={{ opacity: 1, scaleX: 1 }} className="pointer-events-auto origin-left">
                    <EventPill
                      ev={l.ev}
                      filled
                      continuesBefore={l.continuesBefore}
                      continuesAfter={l.continuesAfter}
                      draggable={!l.ev.readOnly}
                      onDragStart={dragStart(l.ev, days)}
                      onClick={(r) => onEventClick(l.ev.id, r)}
                    />
                  </motion.div>
                </div>
              ))}

              {/* timed pills + overflow */}
              {days.map((d, di) => {
                const covering = lanes.filter((l) => l.startIdx <= di && l.endIdx >= di)
                const used = new Set(covering.map((l) => l.lane))
                const timed = getEventsForDay(events, d).filter((e) => notHoliday(e) && !isAllDayLike(e))
                const placed: { ev: DisplayEvent; slot: number }[] = []
                let slot = 0
                for (const ev of timed) {
                  while (used.has(slot)) slot++
                  if (slot >= MAX) break
                  placed.push({ ev, slot })
                  slot++
                }
                const hidden = covering.filter((l) => l.lane >= MAX).length + (timed.length - placed.length)
                const all = getEventsForDay(events, d).filter(notHoliday)
                return (
                  <div key={`t${di}`} className="pointer-events-none absolute inset-y-0" style={{ left: `${(di / 7) * 100}%`, width: `${100 / 7}%` }}>
                    {placed.map(({ ev, slot: s }) => (
                      <div key={ev.id} className="pointer-events-auto absolute inset-x-1" style={{ top: TOP + s * ROW }}>
                        <EventPill ev={ev} draggable={!ev.readOnly} onDragStart={dragStart(ev, d)} onClick={(r) => onEventClick(ev.id, r)} />
                      </div>
                    ))}
                    {hidden > 0 && (
                      <div className="pointer-events-auto absolute inset-x-1" style={{ top: TOP + MAX * ROW }} onClick={(e) => e.stopPropagation()}>
                        <Popover
                          placement="bottom-start"
                          className="w-64 p-2"
                          trigger={({ toggle }) => (
                            <button onClick={toggle} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-muted transition hover:bg-line/[0.08] hover:text-fg">
                              +{hidden}개 더
                            </button>
                          )}
                        >
                          {(close) => (
                            <div>
                              <div className="mb-1.5 flex items-baseline gap-2 px-1.5 pt-1">
                                <span className="font-display text-xl font-bold">{d.getDate()}</span>
                                <span className="text-xs text-muted">{fmt(d, 'EEEE')}</span>
                              </div>
                              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                                {all.map((ev) => (
                                  <EventPill key={ev.id} ev={ev} filled={isAllDayLike(ev)} onClick={(r) => { close(); onEventClick(ev.id, r) }} />
                                ))}
                              </div>
                            </div>
                          )}
                        </Popover>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
