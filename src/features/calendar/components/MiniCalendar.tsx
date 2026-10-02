import { useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, isSameDay, isSameMonth, isToday, isWithinInterval, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmt, getEventsForDay } from '../utils'
import { holidayOn } from '../holidays'
import type { DisplayEvent } from '../types'

interface Props {
  selected: Date
  onSelect: (d: Date) => void
  events: DisplayEvent[]
  range?: { start: Date; end: Date }
}

export function MiniCalendar({ selected, onSelect, events, range }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(selected))
  const [dir, setDir] = useState(0)
  useEffect(() => {
    if (!isSameMonth(cursor, selected)) {
      setDir(selected > cursor ? 1 : -1)
      setCursor(startOfMonth(selected))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const days = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 0 })
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [cursor])

  const dots = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const d of days) {
      const evs = getEventsForDay(events, d).filter((e) => e.type !== 'holiday' && !e.overlayUserId)
      if (evs.length) m.set(d.getTime(), Array.from(new Set(evs.map((e) => e.tint))).slice(0, 3))
    }
    return m
  }, [days, events])

  const go = (n: number) => { setDir(n); setCursor((c) => addMonths(c, n)) }

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between px-1">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={cursor.getTime()}
            custom={dir}
            initial={{ opacity: 0, y: dir * 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dir * -8 }}
            transition={{ duration: 0.18 }}
            className="font-display text-[14px] font-semibold"
          >
            {fmt(cursor, 'yyyy년 M월')}
          </motion.span>
        </AnimatePresence>
        <div className="flex items-center">
          <button onClick={() => go(-1)} className="rounded-md p-1 text-muted transition hover:bg-line/10 hover:text-fg"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => go(1)} className="rounded-md p-1 text-muted transition hover:bg-line/10 hover:text-fg"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-subtle">
        {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
          <span key={w} className={cn('py-1', i === 0 && 'text-rose-600/80 dark:text-rose-400/80', i === 6 && 'text-sky-600/80 dark:text-sky-400/80')}>{w}</span>
        ))}
      </div>
      <motion.div
        key={cursor.getTime()}
        initial={{ opacity: 0, x: dir * 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-7 gap-y-0.5"
      >
        {days.map((d) => {
          const sel = isSameDay(d, selected)
          const today = isToday(d)
          const inRange = range && isWithinInterval(d, { start: startOfDay(range.start), end: range.end })
          const hol = holidayOn(d)
          const tints = dots.get(d.getTime())
          return (
            <button
              key={d.getTime()}
              onClick={() => onSelect(d)}
              title={hol?.name}
              className={cn(
                'relative mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-lg text-[12px] font-medium transition',
                !isSameMonth(d, cursor) && 'opacity-35',
                inRange && !sel && 'bg-accent/[0.08]',
                sel ? 'bg-accent-gradient text-white shadow-glow-sm' : 'hover:bg-line/10',
                !sel && today && 'text-accent ring-1 ring-accent/60',
                !sel && !today && (hol || d.getDay() === 0) && 'text-rose-600 dark:text-rose-400',
                !sel && !today && !hol && d.getDay() === 6 && 'text-sky-600 dark:text-sky-400',
              )}
            >
              <span className="leading-none">{d.getDate()}</span>
              {tints && (
                <span className="absolute bottom-[3px] flex gap-[2px]">
                  {tints.map((t) => <span key={t} className="h-[3px] w-[3px] rounded-full" style={{ background: sel ? '#fff' : t }} />)}
                </span>
              )}
            </button>
          )
        })}
      </motion.div>
    </div>
  )
}
