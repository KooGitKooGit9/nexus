import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock3, Plus, Video } from 'lucide-react'
import { Avatar, Kbd } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useCore } from '@/store/core'
import { useCalendar, useCalendarPrefs } from '../store'
import { EVENT_TYPES, TYPE_META, alpha, userColor } from '../constants'
import { involves, relativeStart } from '../utils'
import { useNow } from '../hooks'
import { MiniCalendar } from './MiniCalendar'
import type { DisplayEvent } from '../types'

interface Props {
  date: Date
  onDate: (d: Date) => void
  events: DisplayEvent[]
  range: { start: Date; end: Date }
  onNew: () => void
  onEventClick: (id: string, rect: DOMRect) => void
}

export function LeftPanel({ date, onDate, events, range, onNew, onEventClick }: Props) {
  const all = useCalendar((s) => s.events)
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const { hiddenTypes, overlayUserIds, toggleType, toggleOverlay } = useCalendarPrefs()
  const now = useNow(30_000)

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    all.forEach((e) => { if (e.type === 'holiday' || involves(e, me)) m[e.type] = (m[e.type] ?? 0) + 1 })
    return m
  }, [all, me])

  const upcoming = useMemo(
    () =>
      all
        .filter((e) => involves(e, me) && e.type !== 'holiday' && new Date(e.end) > now && e.rsvp?.[me] !== 'no')
        .sort((a, b) => +new Date(a.start) - +new Date(b.start))
        .slice(0, 5),
    [all, me, now],
  )

  return (
    <aside className="flex h-full w-[284px] shrink-0 flex-col gap-5 overflow-y-auto [&>*]:shrink-0 bg-surface/30 p-4 backdrop-blur-xl">
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onNew}
        className="group relative flex h-11 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-accent-gradient-3 bg-[length:200%_200%] text-[14px] font-semibold text-white shadow-glow animate-gradient-x"
      >
        <span className="absolute inset-0 bg-white/0 transition group-hover:bg-white/10" />
        <Plus className="h-[18px] w-[18px] transition-transform group-hover:rotate-90" />
        일정 만들기
        <Kbd className="ml-1 border-white/25 bg-white/15 text-white/90">N</Kbd>
      </motion.button>

      <MiniCalendar selected={date} onSelect={onDate} events={events} range={range} />

      <section>
        <h4 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">내 캘린더</h4>
        <div className="space-y-0.5">
          {EVENT_TYPES.map((t) => {
            const meta = TYPE_META[t]
            const on = !hiddenTypes.includes(t)
            return (
              <button key={t} onClick={() => toggleType(t)} className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition hover:bg-line/[0.06]">
                <span
                  className={cn('flex h-[16px] w-[16px] items-center justify-center rounded-[5px] border-2 transition')}
                  style={{ borderColor: meta.color, background: on ? meta.color : 'transparent', boxShadow: on ? `0 0 10px ${alpha(meta.color, 0.55)}` : undefined }}
                >
                  {on && <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={4}><path d="M5 12l5 5L20 7" /></svg>}
                </span>
                <span className={cn('flex-1 text-left transition', on ? 'text-fg' : 'text-subtle')}>{meta.label}</span>
                <span className="text-[11px] tabular-nums text-subtle">{counts[t] ?? 0}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h4 className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">
          팀원 캘린더
          {overlayUserIds.length > 0 && <span className="normal-case tracking-normal text-accent">{overlayUserIds.length}명 표시 중</span>}
        </h4>
        <div className="space-y-0.5">
          {users.filter((u) => u.id !== me).map((u) => {
            const on = overlayUserIds.includes(u.id)
            const c = userColor(u.id)
            return (
              <button key={u.id} onClick={() => toggleOverlay(u.id)} className={cn('group flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-[13px] transition hover:bg-line/[0.06]', on && 'bg-line/[0.04]')}>
                <span className="relative">
                  <Avatar userId={u.id} size="xs" className={cn('transition', !on && 'opacity-60 grayscale-[40%]')} />
                </span>
                <span className={cn('flex-1 truncate text-left', on ? 'text-fg' : 'text-muted')}>{u.name}</span>
                <span
                  className="h-2.5 w-2.5 rounded-full border-2 transition"
                  style={{ borderColor: c, background: on ? c : 'transparent', boxShadow: on ? `0 0 8px ${alpha(c, 0.8)}` : undefined }}
                />
              </button>
            )
          })}
        </div>
      </section>

      <section className="pb-2">
        <h4 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">다가오는 일정</h4>
        <div className="space-y-1.5">
          {upcoming.map((e, i) => {
            const c = e.color ?? TYPE_META[e.type].color
            const label = relativeStart(e, now)
            const soon = label === '진행 중' || label.endsWith('분 후')
            return (
              <motion.button
                key={e.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={(ev) => onEventClick(e.id, ev.currentTarget.getBoundingClientRect())}
                className="group flex w-full items-start gap-2.5 rounded-xl border border-line/[0.06] bg-line/[0.02] p-2.5 text-left transition hover:border-line/15 hover:bg-line/[0.05]"
              >
                <span className="mt-0.5 h-8 w-[3px] shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${alpha(c, 0.7)}` }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-fg">{e.title}</span>
                  <span className={cn('flex items-center gap-1 text-[11px]', soon ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted')}>
                    {soon && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
                    {!soon && <Clock3 className="h-3 w-3" />}
                    {label}
                  </span>
                </span>
                {e.videoLink && <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-2" />}
              </motion.button>
            )
          })}
          {!upcoming.length && <p className="px-2 text-[12px] text-subtle">예정된 일정이 없어요 🎉</p>}
        </div>
      </section>
    </aside>
  )
}
