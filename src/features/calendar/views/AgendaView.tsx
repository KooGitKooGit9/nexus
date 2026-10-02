import { useMemo } from 'react'
import { addDays, isToday, isTomorrow, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import { CalendarX2, Clock3, MapPin, Video } from 'lucide-react'
import { AvatarStack, Badge, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import { TYPE_META, alpha } from '../constants'
import { durationLabel, eventDuration, fmt, getEventsForDay, isAllDayLike, relativeStart, timeLabel } from '../utils'
import { holidayOn } from '../holidays'
import { useNow } from '../hooks'
import { RsvpChip } from '../components/Rsvp'
import type { DisplayEvent } from '../types'

const DAYS = 30

export function AgendaView({ date, events, onEventClick }: { date: Date; events: DisplayEvent[]; onEventClick: (id: string, rect: DOMRect) => void }) {
  const now = useNow(60_000)
  const groups = useMemo(() => {
    const out: { day: Date; items: DisplayEvent[] }[] = []
    for (let i = 0; i < DAYS; i++) {
      const day = addDays(startOfDay(date), i)
      const items = getEventsForDay(events, day)
      if (items.length || isToday(day)) out.push({ day, items })
    }
    return out
  }, [events, date])

  if (!groups.length) {
    return <EmptyState icon={<CalendarX2 />} title="다가오는 일정이 없어요" description="왼쪽의 '일정 만들기'로 새 일정을 추가해 보세요." />
  }

  const me = getCurrentUserId()
  let n = 0
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-6">
        {groups.map(({ day, items }) => {
          const hol = holidayOn(day)
          const today = isToday(day)
          return (
            <section key={day.toISOString()} className="relative mb-6 grid grid-cols-[88px_1fr] gap-5">
              <div className="sticky top-4 self-start text-right">
                <p className={cn('font-display text-4xl font-bold leading-none tracking-tight', today ? 'gradient-text' : day.getDay() === 0 || hol ? 'text-rose-600 dark:text-rose-400' : day.getDay() === 6 ? 'text-sky-600 dark:text-sky-400' : 'text-fg')}>{day.getDate()}</p>
                <p className="mt-1 text-xs font-medium text-muted">{fmt(day, 'M월 · EEE')}</p>
                {(today || isTomorrow(day)) && (
                  <span className={cn('mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold', today ? 'bg-accent-gradient text-white shadow-glow-sm' : 'bg-line/10 text-muted')}>{today ? '오늘' : '내일'}</span>
                )}
              </div>
              <div className="space-y-2 border-l border-line/10 pl-5">
                {!items.length && <p className="rounded-2xl border border-dashed border-line/10 px-4 py-5 text-sm text-subtle">오늘은 일정이 없어요. 깊은 집중의 하루를 보내세요 ✨</p>}
                {items.map((ev) => {
                  const meta = TYPE_META[ev.type]
                  const past = new Date(ev.end) < now
                  const live = new Date(ev.start) <= now && new Date(ev.end) > now
                  const allDay = isAllDayLike(ev)
                  return (
                    <motion.button
                      key={ev.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(n++ * 0.025, 0.5), ease: [0.22, 1, 0.36, 1] }}
                      onClick={(e) => onEventClick(ev.id, e.currentTarget.getBoundingClientRect())}
                      className={cn('glass group relative flex w-full items-stretch gap-4 overflow-hidden rounded-2xl p-4 text-left card-hover', past && 'opacity-60')}
                    >
                      <span className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(500px circle at 0% 0%, ${alpha(ev.tint, 0.14)}, transparent 45%)` }} />
                      <span className="relative w-1 shrink-0 rounded-full" style={{ background: ev.tint, boxShadow: `0 0 12px ${alpha(ev.tint, 0.7)}` }} />
                      <div className="relative w-24 shrink-0">
                        {allDay ? (
                          <p className="text-sm font-semibold text-fg">종일</p>
                        ) : (
                          <>
                            <p className="text-sm font-semibold tabular-nums text-fg">{timeLabel(ev.start)}</p>
                            <p className="text-xs text-muted">{durationLabel(eventDuration(ev))}</p>
                          </>
                        )}
                        {live && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />진행 중</span>}
                      </div>
                      <div className="relative min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[15px] font-semibold text-fg">{ev.title}</p>
                          <Badge className="shrink-0" icon={<span>{meta.emoji}</span>}>{meta.label}</Badge>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          {!allDay && <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeLabel(ev.start)} – {timeLabel(ev.end)}</span>}
                          {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{ev.location}</span>}
                          {ev.videoLink && <span className="flex items-center gap-1 text-accent-2"><Video className="h-3.5 w-3.5" />화상 회의</span>}
                          {!past && !allDay && <span className="text-subtle">· {relativeStart(ev, now)}</span>}
                        </div>
                        {ev.description && <p className="mt-2 line-clamp-1 text-xs text-subtle">{ev.description.split('\n')[0]}</p>}
                      </div>
                      <div className="relative flex shrink-0 flex-col items-end justify-between gap-2">
                        {ev.attendeeIds.length > 1 && <AvatarStack userIds={ev.attendeeIds} max={4} size="xs" />}
                        {ev.attendeeIds.includes(me) && ev.organizerId !== me && ev.type !== 'holiday' && <RsvpChip status={ev.rsvp?.[me]} />}
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
