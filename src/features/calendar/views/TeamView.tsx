import { useMemo } from 'react'
import { addMinutes, differenceInMinutes, endOfDay, isToday, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import { CalendarPlus, Sparkles } from 'lucide-react'
import { Avatar, Button, Checkbox } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useCore } from '@/store/core'
import { useCalendar, useCalendarPrefs } from '../store'
import { TYPE_META, alpha, userColor } from '../constants'
import { blocksUser, fmt, getEventsForDay, involves, isAllDayLike, minutesOfDay, shortTime, timeLabel } from '../utils'
import { holidayOn } from '../holidays'
import { useNow } from '../hooks'

const START_H = 7
const END_H = 22
const HOUR_W = 84
const LABEL_W = 232

const endOfWorkPassed = (day: Date, now: Date) => isToday(day) && minutesOfDay(now) >= 18 * 60 - 30

interface Props {
  date: Date
  onEventClick: (id: string, rect: DOMRect) => void
  onCreate: (start: Date, end: Date, attendeeIds: string[]) => void
}

export function TeamView({ date, onEventClick, onCreate }: Props) {
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const events = useCalendar((s) => s.events)
  const focus = useCalendarPrefs((s) => s.teamFocusIds)
  const toggleFocus = useCalendarPrefs((s) => s.toggleTeamFocus)
  const now = useNow(60_000)
  const day = useMemo(() => startOfDay(date), [date])
  const dayEvents = useMemo(() => getEventsForDay(events, day), [events, day])
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const width = (END_H - START_H) * HOUR_W
  const x = (min: number) => ((min - START_H * 60) / 60) * HOUR_W

  const sortedUsers = useMemo(() => {
    const meU = users.filter((u) => u.id === me)
    const rest = users.filter((u) => u.id !== me).sort((a, b) => Number(focus.includes(b.id)) - Number(focus.includes(a.id)))
    return [...meU, ...rest]
  }, [users, me, focus])

  const hol = holidayOn(day)
  const offDay = day.getDay() === 0 || day.getDay() === 6 || !!hol

  // 15-minute free map for focused users (working hours on working days, future only)
  const freeRanges = useMemo(() => {
    const ranges: { s: number; e: number }[] = []
    if (!focus.length || offDay) return ranges
    let cur: { s: number; e: number } | null = null
    for (let m = START_H * 60; m < END_H * 60; m += 15) {
      const s = addMinutes(day, m)
      const e = addMinutes(s, 15)
      const busy = dayEvents.some((ev) => new Date(ev.start) < e && new Date(ev.end) > s && focus.some((u) => blocksUser(ev, u)))
      const workHour = m >= 9 * 60 && m < 18 * 60
      const past = s < now
      if (!busy && workHour && !past) {
        if (cur && cur.e === m) cur.e = m + 15
        else { cur = { s: m, e: m + 15 }; ranges.push(cur) }
      }
    }
    return ranges.filter((r) => r.e - r.s >= 30)
  }, [dayEvents, focus, day, now, offDay])

  const upcomingFree = freeRanges[0]
  const today = isToday(day)
  const nowX = x(minutesOfDay(now))

  const onRowClick = (userId: string) => (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const min = START_H * 60 + Math.floor((((e.clientX - r.left) / HOUR_W) * 60) / 30) * 30
    const s = addMinutes(day, min)
    onCreate(s, addMinutes(s, 30), Array.from(new Set([me, userId])))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* summary bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-600 dark:text-emerald-400"><Sparkles className="h-4 w-4" /></div>
          <div>
            <p className="text-[13px] font-semibold">
              {fmt(day, 'M월 d일 (EEE)')} · 선택한 {focus.length}명 모두 가능한 시간
              {hol && <span className="ml-2 text-rose-600 dark:text-rose-400">🎌 {hol.name}</span>}
            </p>
            <p className="text-[11px] text-muted">체크박스로 비교할 팀원을 고르고, 빈 칸을 클릭하면 바로 회의를 잡을 수 있어요</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {freeRanges.slice(0, 5).map((r) => (
            <button
              key={r.s}
              onClick={() => onCreate(addMinutes(day, r.s), addMinutes(day, Math.min(r.e, r.s + 60)), focus)}
              className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-400/20"
            >
              {shortTime(addMinutes(day, r.s))} – {shortTime(addMinutes(day, r.e))}
            </button>
          ))}
          {!freeRanges.length && (
            <span className="text-xs text-subtle">
              {!focus.length ? '비교할 팀원을 선택하세요' : offDay ? '주말·공휴일이에요' : endOfDay(day) < now ? '지난 날짜예요' : endOfWorkPassed(day, now) ? '오늘 근무 시간이 끝났어요' : '근무 시간 내 공통 빈 시간이 없어요'}
            </span>
          )}
          {upcomingFree && (
            <Button size="sm" variant="primary" leftIcon={<CalendarPlus className="h-3.5 w-3.5" />} onClick={() => {
              onCreate(addMinutes(day, upcomingFree.s), addMinutes(day, Math.min(upcomingFree.e, upcomingFree.s + 30)), focus)
            }}>
              가장 빠른 시간에 회의 잡기
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: LABEL_W + width }}>
          {/* hour header */}
          <div className="sticky top-0 z-20 flex border-b border-line/10 bg-bg/80 backdrop-blur-xl">
            <div className="sticky left-0 z-10 shrink-0 bg-bg/80 px-4 py-2 text-[11px] font-semibold text-muted backdrop-blur-xl" style={{ width: LABEL_W }}>팀원 {sortedUsers.length}명</div>
            {hours.map((h) => (
              <div key={h} className="shrink-0 border-l border-line/[0.07] px-2 py-2 text-[11px] font-medium tabular-nums text-subtle" style={{ width: HOUR_W }}>
                {fmt(new Date(2000, 0, 1, h), 'a h시')}
              </div>
            ))}
          </div>

          {/* "모두 가능" row */}
          <div className="flex border-b border-line/10 bg-emerald-400/[0.03]">
            <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-bg/85 px-4 py-2.5 backdrop-blur-xl" style={{ width: LABEL_W }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-sm">✅</span>
              <div>
                <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">모두 가능</p>
                <p className="text-[10.5px] text-muted">근무 시간 09–18시 기준</p>
              </div>
            </div>
            <div className="relative" style={{ width }}>
              {freeRanges.map((r) => (
                <motion.button
                  key={r.s}
                  initial={{ opacity: 0, scaleX: 0.6 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  onClick={() => onCreate(addMinutes(day, r.s), addMinutes(day, Math.min(r.e, r.s + 60)), focus)}
                  className="absolute inset-y-2 origin-left rounded-lg border border-emerald-400/40 bg-emerald-400/20 px-2 text-left text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 shadow-[0_0_18px_-6px_rgba(52,211,153,0.8)] transition hover:bg-emerald-400/30"
                  style={{ left: x(r.s) + 1, width: x(r.e) - x(r.s) - 2 }}
                >
                  <span className="truncate">{shortTime(addMinutes(day, r.s))}~</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* rows */}
          <div className="relative">
            {/* free bands across rows */}
            <div className="pointer-events-none absolute inset-y-0" style={{ left: LABEL_W, width }}>
              {freeRanges.map((r) => (
                <div key={r.s} className="absolute inset-y-0 bg-emerald-400/[0.05]" style={{ left: x(r.s), width: x(r.e) - x(r.s) }} />
              ))}
              {hours.map((h) => <div key={h} className="absolute inset-y-0 border-l border-line/[0.06]" style={{ left: x(h * 60) }} />)}
              {today && nowX >= 0 && nowX <= width && (
                <div className="absolute inset-y-0 z-10 w-[2px] bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]" style={{ left: nowX }}>
                  <span className="absolute -left-[4px] -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                </div>
              )}
            </div>

            {sortedUsers.map((u, i) => {
              const userEvents = dayEvents.filter((ev) => involves(ev, u.id) && ev.type !== 'holiday')
              const ooo = userEvents.find((ev) => ev.type === 'ooo' && isAllDayLike(ev))
              const timed = userEvents.filter((ev) => !isAllDayLike(ev) && ev.rsvp?.[u.id] !== 'no')
              const busyMin = timed.reduce((s, ev) => s + Math.max(0, (new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000), 0)
              const checked = focus.includes(u.id)
              const c = userColor(u.id)
              return (
                <motion.div
                  key={u.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn('group flex border-b border-line/[0.06]', checked && 'bg-accent/[0.025]')}
                >
                  <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2.5 bg-bg/85 px-4 py-2 backdrop-blur-xl" style={{ width: LABEL_W }}>
                    <Checkbox checked={checked} onChange={() => toggleFocus(u.id)} />
                    <Avatar userId={u.id} size="sm" showPresence />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{u.name}{u.id === me && <span className="ml-1 text-[10px] text-accent">(나)</span>}</p>
                      <p className="truncate text-[10.5px] text-muted">{ooo ? '🌴 부재 중' : busyMin ? `일정 ${Math.round((busyMin / 60) * 10) / 10}시간` : u.title}</p>
                    </div>
                  </div>
                  <div className="relative h-12 cursor-copy" style={{ width }} onClick={onRowClick(u.id)}>
                    {ooo && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEventClick(ooo.id, e.currentTarget.getBoundingClientRect()) }}
                        className="absolute inset-x-0 inset-y-1.5 flex items-center gap-2 rounded-lg border border-emerald-400/30 px-3 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400"
                        style={{ background: `repeating-linear-gradient(135deg, ${alpha('#10b981', 0.16)} 0 8px, ${alpha('#10b981', 0.05)} 8px 16px)` }}
                      >
                        🌴 {ooo.title}
                      </button>
                    )}
                    {timed.map((ev) => {
                      // clip to this day's visible window (handles events that started yesterday / end tomorrow)
                      const s = Math.max(START_H * 60, differenceInMinutes(new Date(ev.start), day))
                      const e = Math.min(END_H * 60, differenceInMinutes(new Date(ev.end), day))
                      if (e <= s) return null
                      const tint = ev.color ?? TYPE_META[ev.type].color
                      const isPrivate = ev.type === 'personal' && !involves(ev, me)
                      const title = isPrivate ? '바쁨' : ev.title
                      return (
                        <button
                          key={ev.id}
                          title={`${title} · ${timeLabel(ev.start)} – ${timeLabel(ev.end)}`}
                          onClick={(evt) => { evt.stopPropagation(); if (!isPrivate) onEventClick(ev.id, evt.currentTarget.getBoundingClientRect()) }}
                          className="absolute inset-y-1.5 overflow-hidden rounded-lg border px-2 text-left backdrop-blur transition hover:z-10 hover:brightness-110"
                          style={{
                            left: x(s) + 1,
                            width: Math.max(x(e) - x(s) - 2, 6),
                            background: isPrivate ? `repeating-linear-gradient(135deg, ${alpha(c, 0.14)} 0 6px, ${alpha(c, 0.05)} 6px 12px)` : `linear-gradient(160deg, ${alpha(tint, 0.3)}, ${alpha(tint, 0.14)})`,
                            borderColor: alpha(isPrivate ? c : tint, 0.4),
                          }}
                        >
                          <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: isPrivate ? c : tint }} />
                          <span className="block truncate pl-1 text-[11px] font-semibold leading-tight text-fg">{title}</span>
                          {x(e) - x(s) > 70 && <span className="block truncate pl-1 text-[10px] leading-tight text-muted">{shortTime(ev.start)} – {shortTime(ev.end)}</span>}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
