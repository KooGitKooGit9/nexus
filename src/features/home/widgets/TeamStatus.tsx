import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Avatar, Tooltip, PRESENCE_LABEL, useLiveUsers } from '@/components/ui'
import { useCore } from '@/store/core'
import type { Presence } from '@/store/types'
import { useCalendar } from '@/features/calendar/store'
import { useApprovals } from '@/features/approvals/store'
import { eventsOn } from '../lib'
import { Widget, WidgetLink } from '../components/Widget'

const ORDER: Record<Presence, number> = { online: 0, dnd: 1, away: 2, offline: 3 }

/** ISO timestamps or date-only "yyyy-MM-dd" (parsed as a *local* day, not UTC midnight). */
function parseDay(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v)
}

export function TeamStatus({ className, delay }: { className?: string; delay?: number }) {
  const navigate = useNavigate()
  const users = useLiveUsers()
  const me = useCore((s) => s.currentUserId)
  const events = useCalendar((s) => s.events)
  const requests = useApprovals((s) => s.requests)

  const { team, counts, onLeave } = useMemo(() => {
    const team = users.filter((u) => u.id !== me).sort((a, b) => ORDER[a.presence] - ORDER[b.presence])
    const counts = { online: 0, away: 0, dnd: 0, offline: 0 } as Record<Presence, number>
    users.forEach((u) => counts[u.presence]++)
    const now = new Date()
    const leave = new Set<string>()
    // OOO calendar events today
    for (const u of users) {
      if (eventsOn(events ?? [], now, u.id).some((e) => e.type === 'ooo' && e.organizerId === u.id)) leave.add(u.id)
    }
    // approved leave covering today
    for (const r of requests ?? []) {
      if (r.kind === 'leave' && r.status === 'approved' && r.startDate && r.endDate) {
        const s = parseDay(r.startDate); s.setHours(0, 0, 0, 0)
        const e = parseDay(r.endDate); e.setHours(23, 59, 59, 999)
        if (s <= now && now <= e) leave.add(r.requesterId)
      }
    }
    return { team, counts, onLeave: Array.from(leave) }
  }, [users, me, events, requests])

  return (
    <Widget
      className={className}
      delay={delay}
      title="팀 현황"
      subtitle={`${counts.online}명 온라인 · 전체 ${users.length}명`}
      icon={<Users />}
      gradient="from-emerald-400 to-teal-600"
      action={<WidgetLink onClick={() => navigate('/people')}>디렉터리 →</WidgetLink>}
    >
      <div className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-line/10">
        {(['online', 'dnd', 'away', 'offline'] as Presence[]).map((p) => (
          <div
            key={p}
            className={{ online: 'bg-emerald-400', dnd: 'bg-rose-500', away: 'bg-amber-400', offline: 'bg-zinc-500/50' }[p]}
            style={{ width: `${(counts[p] / Math.max(1, users.length)) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {team.slice(0, 14).map((u) => (
          <Tooltip key={u.id} content={`${u.name} · ${u.statusEmoji ?? ''} ${u.statusText ?? PRESENCE_LABEL[u.presence]}`}>
            <button onClick={() => navigate(`/people/${u.id}`)} aria-label={u.name} className="relative rounded-full transition hover:scale-110 focus-ring">
              <Avatar userId={u.id} size="sm" showPresence className={u.presence === 'offline' ? 'opacity-50' : ''} />
              {onLeave.includes(u.id) && <span className="absolute -top-1.5 -right-1 text-[11px]">🌴</span>}
            </button>
          </Tooltip>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {team.filter((u) => u.statusText && u.presence !== 'offline').slice(0, 3).map((u) => (
          <li key={u.id} className="flex items-center gap-2 text-[12px]">
            <span className="w-4 text-center">{u.statusEmoji}</span>
            <span className="shrink-0 font-medium text-fg/90">{u.name}</span>
            <span className="min-w-0 truncate text-subtle">{u.statusText}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl border border-line/10 bg-line/[0.03] px-3 py-2">
        <div className="text-[11px] font-medium text-muted">🌴 오늘 휴가 · 부재</div>
        {onLeave.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {onLeave.map((id) => (
              <span key={id} className="flex items-center gap-1.5 rounded-full bg-line/[0.05] py-0.5 pl-0.5 pr-2 text-[11px] text-fg/90">
                <Avatar userId={id} size="xs" />
                {users.find((u) => u.id === id)?.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-0.5 text-[11px] text-subtle">오늘은 모두 출근했어요</div>
        )}
      </div>
    </Widget>
  )
}
