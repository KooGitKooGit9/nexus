import { useMemo } from 'react'
import { endOfDay, isToday, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import { CalendarCheck2, Clock3, Sparkles, Target, Users } from 'lucide-react'
import { ProgressRing } from '@/components/ui'
import { cn } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import { TimeGrid, type TimeGridProps } from './TimeGrid'
import { useCalendar } from '../store'
import { findFreeSlots, fmt, getEventsForDay, isAllDayLike, timeLabel, durationLabel, eventDuration } from '../utils'
import { holidayOn } from '../holidays'
import { alpha } from '../constants'

export function DayView({ date, ...rest }: Omit<TimeGridProps, 'days'> & { date: Date }) {
  const key = startOfDay(date).getTime()
  const days = useMemo(() => [new Date(key)], [key])
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1">
        <TimeGrid days={days} {...rest} />
      </div>
      <DaySummary date={days[0]} events={rest.events} onEventClick={rest.onEventClick} onCreate={rest.onCreate} />
    </div>
  )
}

function DaySummary({ date, events, onEventClick, onCreate }: Pick<TimeGridProps, 'events' | 'onEventClick' | 'onCreate'> & { date: Date }) {
  const all = useCalendar((s) => s.events)
  const me = getCurrentUserId()
  const dayEvents = getEventsForDay(events, date)
  const timed = dayEvents.filter((e) => !isAllDayLike(e) && !e.overlayUserId)
  const meetings = timed.filter((e) => e.type === 'meeting')
  const meetingMin = meetings.reduce((s, e) => s + eventDuration(e), 0)
  const focusMin = timed.filter((e) => e.type === 'focus').reduce((s, e) => s + eventDuration(e), 0)
  const load = Math.min(100, Math.round(((meetingMin + focusMin) / (9 * 60)) * 100))
  const isPast = endOfDay(date) < new Date()
  const free = useMemo(
    // findFreeSlots never searches the past — for a past day it would return *today's* slots
    () => (isPast ? [] : findFreeSlots(all, { attendeeIds: [me], durationMin: 30, from: startOfDay(date), days: 0, limit: 4, skipWeekends: false })),
    [all, me, date, isPast],
  )
  const hol = holidayOn(date)

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line/10 p-5 xl:flex">
      <div>
        <p className="text-xs font-medium text-muted">{isToday(date) ? '오늘' : fmt(date, 'EEEE')}</p>
        <h3 className="font-display text-2xl font-bold tracking-tight">{fmt(date, 'M월 d일')}</h3>
        {hol && <p className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-400">🎌 {hol.name}</p>}
      </div>

      <div className="glass flex items-center gap-4 rounded-2xl p-4">
        <ProgressRing value={load} size={64} stroke={7}>
          <span className="font-display text-sm">{load}%</span>
        </ProgressRing>
        <div className="min-w-0 space-y-1 text-[13px]">
          <p className="font-semibold text-fg">일정 밀도</p>
          <p className="flex items-center gap-1.5 text-muted"><Users className="h-3.5 w-3.5 text-violet-400" />회의 {meetings.length}개 · {durationLabel(meetingMin || 0)}</p>
          <p className="flex items-center gap-1.5 text-muted"><Target className="h-3.5 w-3.5 text-cyan-400" />집중 {focusMin ? durationLabel(focusMin) : '없음'}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><Sparkles className="h-3.5 w-3.5 text-accent" />비어 있는 시간</p>
        {free.length ? (
          <div className="flex flex-wrap gap-1.5">
            {free.map((s) => (
              <button
                key={s.start.toISOString()}
                onClick={() => onCreate(s.start, s.end)}
                className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-400/20"
              >
                {timeLabel(s.start)}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-subtle">{isPast ? '지난 날짜예요' : '근무 시간 내 빈 시간이 없어요'}</p>
        )}
      </div>

      <div className="min-h-0">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted"><CalendarCheck2 className="h-3.5 w-3.5" />일정 {dayEvents.length}개</p>
        <div className="space-y-1.5">
          {dayEvents.map((e, i) => (
            <motion.button
              key={e.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={(ev) => onEventClick(e.id, ev.currentTarget.getBoundingClientRect())}
              className={cn('flex w-full items-start gap-2.5 rounded-xl border border-line/[0.06] p-2.5 text-left transition hover:border-line/15 hover:bg-line/[0.04]')}
            >
              <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full" style={{ background: e.tint, boxShadow: `0 0 8px ${alpha(e.tint, 0.6)}` }} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-fg">{e.title}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <Clock3 className="h-3 w-3" />
                  {isAllDayLike(e) ? '종일' : `${timeLabel(e.start)} – ${timeLabel(e.end)}`}
                </span>
              </span>
            </motion.button>
          ))}
          {!dayEvents.length && <p className="rounded-xl border border-dashed border-line/10 p-4 text-center text-[12px] text-subtle">일정이 없는 하루예요 ☀️</p>}
        </div>
      </div>
    </aside>
  )
}
