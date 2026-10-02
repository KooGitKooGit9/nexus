import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, MapPin, Video } from 'lucide-react'
import { AvatarStack, Badge, Button } from '@/components/ui'
import { useCore, useUI } from '@/store/core'
import { cn, formatTime } from '@/lib/utils'
import { useCalendar } from '@/features/calendar/store'
import type { CalEvent, EventType } from '@/features/calendar/types'
import { eventsOn, isAllDayLike, useNow } from '../lib'
import { MiniEmpty, Widget, WidgetLink } from '../components/Widget'

const TYPE_COLOR: Record<EventType, string> = {
  meeting: '#8b5cf6', focus: '#22d3ee', personal: '#34d399', deadline: '#fb7185', holiday: '#fbbf24', ooo: '#94a3b8',
}
const TYPE_LABEL: Record<EventType, string> = { meeting: '회의', focus: '포커스', personal: '개인', deadline: '마감', holiday: '휴일', ooo: '부재' }

export function TodayEvents({ className, delay }: { className?: string; delay?: number }) {
  const navigate = useNavigate()
  const events = useCalendar((s) => s.events)
  const me = useCore((s) => s.currentUserId)
  const now = useNow(30_000)
  const today = useMemo(() => eventsOn(events ?? [], now, me), [events, me, now])
  const allDay = today.filter(isAllDayLike)
  const timed = today.filter((e) => !isAllDayLike(e))
  const remaining = timed.filter((e) => new Date(e.end) > now).length

  return (
    <Widget
      className={className}
      delay={delay}
      title="오늘 일정"
      subtitle={timed.length ? `${timed.length}개 일정 · 남은 일정 ${remaining}개` : '일정 없음'}
      icon={<CalendarDays />}
      gradient="from-violet-500 to-fuchsia-500"
      action={<WidgetLink onClick={() => navigate('/calendar')}>캘린더 →</WidgetLink>}
    >
      {allDay.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {allDay.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1.5 rounded-lg border border-line/10 bg-line/[0.04] px-2 py-1 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color ?? TYPE_COLOR[e.type] }} />
              종일 · {e.title}
            </span>
          ))}
        </div>
      )}
      {timed.length === 0 ? (
        <MiniEmpty emoji="🎧" title="오늘은 예정된 일정이 없어요">
          집중하기 좋은 날이에요.{' '}
          <button className="text-accent hover:underline" onClick={() => navigate('/calendar?new=1')}>일정 만들기</button>
        </MiniEmpty>
      ) : (
        <div className="-mr-1 max-h-[420px] overflow-y-auto pr-1">
          <ol className="relative space-y-1.5">
            <span className="absolute bottom-3 left-[64px] top-3 w-px bg-line/10" />
            {timed.map((e, i) => (
              <EventRow key={e.id} e={e} now={now} delay={(delay ?? 0) + 0.05 * i} onOpen={() => navigate(`/calendar?event=${e.id}`)} />
            ))}
          </ol>
        </div>
      )}
    </Widget>
  )
}

function EventRow({ e, now, delay, onOpen }: { e: CalEvent; now: Date; delay: number; onOpen: () => void }) {
  const start = new Date(e.start)
  const end = new Date(e.end)
  const live = start <= now && now < end
  const past = end <= now
  const minsUntil = Math.round((start.getTime() - now.getTime()) / 60000)
  const soon = !live && !past && minsUntil <= 60
  const pct = live ? ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100 : 0
  const color = e.color ?? TYPE_COLOR[e.type]
  const join = () =>
    useUI.getState().startCall({ title: e.title, participantIds: Array.from(new Set([e.organizerId, ...e.attendeeIds])), video: true })

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay + 0.2 }}
      className={cn('relative flex gap-3', past && 'opacity-45')}
    >
      <div className="w-[48px] shrink-0 pt-2.5 text-right text-[11px] tabular-nums leading-tight text-muted">
        {formatTime(e.start).replace('오전 ', '').replace('오후 ', '')}
        <div className="text-[10px] text-subtle">{start.getHours() < 12 ? '오전' : '오후'}</div>
      </div>
      <span className="relative z-10 mt-3.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        {live && <span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: color }} />}
        <span className="h-2.5 w-2.5 rounded-full ring-4 ring-surface" style={{ background: color }} />
      </span>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onOpen())}
        className={cn(
          'group min-w-0 flex-1 cursor-pointer rounded-xl border px-3 py-2.5 text-left transition focus-ring',
          live ? 'border-accent/40 bg-accent/10 shadow-glow-sm' : 'border-transparent hover:border-line/10 hover:bg-line/[0.04]',
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {live && <Badge tone="accent" dot className="animate-pulse">지금 진행 중</Badge>}
              {soon && <Badge tone="warning">{minsUntil}분 후</Badge>}
              {!live && !soon && <span className="text-[10px] font-medium" style={{ color }}>{TYPE_LABEL[e.type]}</span>}
            </div>
            <div className="mt-1 truncate text-[13px] font-medium text-fg">{e.title}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-subtle">
              <span className="tabular-nums">{formatTime(e.start)} – {formatTime(e.end)}</span>
              {e.location && (
                <span className="flex min-w-0 items-center gap-0.5 truncate"><MapPin className="h-3 w-3 shrink-0" />{e.location}</span>
              )}
            </div>
          </div>
          {e.attendeeIds.length > 0 && <AvatarStack userIds={e.attendeeIds} max={3} size="xs" className="mt-1 shrink-0" />}
        </div>
        {(live || soon) && e.type === 'meeting' && (
          <div className="mt-2.5 flex items-center gap-2">
            {live && (
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-line/10">
                <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${pct}%` }} />
              </div>
            )}
            <Button size="xs" variant={live ? 'primary' : 'outline'} leftIcon={<Video className="h-3.5 w-3.5" />} onClick={(ev) => { ev.stopPropagation(); join() }} className={cn(!live && 'ml-auto')}>
              {live ? '지금 참여' : '참여'}
            </Button>
          </div>
        )}
      </div>
    </motion.li>
  )
}
