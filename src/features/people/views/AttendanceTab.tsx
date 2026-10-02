import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { addDays, endOfWeek, format, startOfDay, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarHeart, Palmtree, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCore } from '@/store/core'
import { Avatar, Badge, Card, CardHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useSyncStatus } from '@/lib/sync'
import { usePeople } from '../store'
import { useAllLeaves, useLeaveSummary } from '../leaves'
import { teamAttendance, type AttendanceStatus } from '../attendance'
import { LEAVE_LABEL, useNow, WORK_MODE_META } from '../lib'
import type { WorkMode } from '../types'
import { ClockCard } from '../components/ClockCard'
import { WeeklyHours } from '../components/WeeklyHours'
import { Chip } from '../components/common'
import { isHuman } from '@/features/people/format'
import { isDemoWorkspace } from '@/lib/workspace'

const STATUS_META: Record<AttendanceStatus, { label: string; cls: string; dot: string }> = {
  working: { label: '근무 중', cls: 'text-emerald-400', dot: 'bg-emerald-400' },
  left: { label: '퇴근', cls: 'text-muted', dot: 'bg-zinc-400' },
  notyet: { label: '미출근', cls: 'text-subtle', dot: 'bg-zinc-600' },
  leave: { label: '휴가', cls: 'text-pink-400', dot: 'bg-pink-400' },
  unknown: { label: '기록 공유 전', cls: 'text-subtle', dot: 'bg-zinc-600/60' },
}

export function AttendanceTab() {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <ClockCard />
        <TeamTable />
      </div>
      <div className="space-y-5">
        <WeeklyHours />
        <LeaveBalanceCard />
        <UpcomingLeaves />
      </div>
    </div>
  )
}

function TeamTable() {
  const allUsers = useCore((s) => s.users)
  const users = useMemo(() => allUsers.filter(isHuman), [allUsers])
  const [simulate] = useState(isDemoWorkspace)
  const meId = useCore((s) => s.currentUserId)
  const leaves = useAllLeaves()
  const clock = usePeople((s) => s.clock)
  const now = useNow(30_000)
  const navigate = useNavigate()
  const [mode, setMode] = useState<WorkMode | 'all'>('all')
  const rows = useMemo(() => teamAttendance(users, leaves, clock, meId, now, simulate), [users, leaves, clock, meId, now, simulate])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    rows.forEach((r) => { if (r.status !== 'unknown') c[r.mode] = (c[r.mode] ?? 0) + 1 })
    return c
  }, [rows])
  const shown = rows.filter((r) => mode === 'all' || (r.mode === mode && r.status !== 'unknown'))
  const working = rows.filter((r) => r.status === 'working').length
  const serverMode = useSyncStatus((s) => s.mode === 'server')
  const online = useSyncStatus((s) => s.online)
  const liveCount = serverMode ? rows.filter((r) => online.includes(r.user.id)).length : 0

  return (
    <Card padded={false}>
      <div className="p-5 pb-3">
        <CardHeader
          className="mb-3"
          icon={<Users className="h-4 w-4" />}
          title="오늘의 팀 근태"
          subtitle={`${format(now, 'M월 d일 (EEE)', { locale: ko })} · ${rows.length}명 중 ${working}명 근무 중${liveCount ? ` · ${liveCount}명 Nexus 접속 중` : ''}`}
        />
        <div className="flex flex-wrap gap-2">
          <Chip active={mode === 'all'} onClick={() => setMode('all')} count={rows.length}>전체</Chip>
          {(Object.keys(WORK_MODE_META) as WorkMode[]).map((m) => (
            <Chip key={m} active={mode === m} onClick={() => setMode(mode === m ? 'all' : m)} count={counts[m] ?? 0}>
              {WORK_MODE_META[m].emoji} {WORK_MODE_META[m].label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-line/10 text-left text-[11px] font-medium uppercase tracking-wider text-subtle">
              <th className="px-5 py-2.5 font-medium">구성원</th>
              <th className="px-3 py-2.5 font-medium">근무 형태</th>
              <th className="px-3 py-2.5 font-medium">출근 시각</th>
              <th className="px-3 py-2.5 font-medium">퇴근 시각</th>
              <th className="px-3 py-2.5 font-medium">근무 시간</th>
              <th className="px-5 py-2.5 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const st = STATUS_META[r.status]
              const wm = WORK_MODE_META[r.mode]
              return (
                <motion.tr
                  key={r.user.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  onClick={() => navigate(`/people/${r.user.id}`)}
                  className={cn('cursor-pointer border-b border-line/[0.06] transition-colors last:border-0 hover:bg-accent/[0.05]', r.user.id === meId && 'bg-accent/[0.04]')}
                >
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar user={r.user} size="sm" showPresence />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium text-fg">
                          {r.user.name}
                          {r.user.id === meId && <span className="rounded bg-accent/20 px-1 text-[9px] font-bold text-accent">나</span>}
                          {serverMode && online.includes(r.user.id) && (
                            <span className="inline-flex items-center gap-1 rounded bg-success/15 px-1 text-[9.5px] font-semibold text-success" title="지금 Nexus에 접속해 있어요">
                              <span className="h-1 w-1 rounded-full bg-success" />접속 중
                            </span>
                          )}
                        </div>
                        {(r.note ?? r.user.title) && <div className="truncate text-[11px] text-subtle">{r.note ?? r.user.title}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{r.status === 'unknown' ? <span className="text-subtle">—</span> : <Badge tone={wm.tone}>{wm.emoji} {wm.label}</Badge>}</td>
                  <td className="px-3 py-2.5 font-mono text-[13px] tabular-nums text-fg/90">{r.inLabel ?? <span className="text-subtle">—</span>}</td>
                  <td className="px-3 py-2.5 font-mono text-[13px] tabular-nums text-muted">{r.outLabel ?? <span className="text-subtle">—</span>}</td>
                  <td className="px-3 py-2.5">
                    {r.workedMin > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line/10">
                          <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${Math.min(100, (r.workedMin / 540) * 100)}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted">{Math.floor(r.workedMin / 60)}h {Math.round(r.workedMin % 60)}m</span>
                      </div>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={cn('flex items-center gap-1.5 text-xs font-medium', st.cls)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', st.dot, r.status === 'working' && 'animate-pulse')} />
                      {st.label}
                    </span>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!simulate && rows.length > 1 && (
        <p className="border-t border-line/[0.06] px-5 py-2.5 text-[11.5px] text-subtle">
          지금은 내 출퇴근 기록만 보여요. 팀원 근태 공유는 곧 제공돼요. (승인된 휴가는 모두에게 표시돼요)
        </p>
      )}
    </Card>
  )
}

function Ring({ value, total, color, size = 76 }: { value: number; total: number; color: string; size?: number }) {
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total ? Math.min(1, value / total) : 0
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-line/10" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke={color} strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - pct * c }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
      />
    </svg>
  )
}

function LeaveBalanceCard() {
  const meId = useCore((s) => s.currentUserId)
  const b = useLeaveSummary(meId)
  const navigate = useNavigate()
  const items = [
    { label: '연차', used: b.annualUsed, total: b.annualTotal, unit: '일', color: '#8b5cf6', emoji: '🌴' },
    { label: '반차', used: b.halfUsed, total: b.halfTotal, unit: '회', color: '#22d3ee', emoji: '🌤️' },
    { label: '병가', used: b.sickUsed, total: b.sickTotal, unit: '일', color: '#f472b6', emoji: '🩺' },
  ]
  return (
    <Card>
      <CardHeader icon={<Palmtree className="h-4 w-4" />} title="내 휴가 잔여" subtitle={`${new Date().getFullYear()}년 기준`} />
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col items-center rounded-2xl border border-line/10 bg-line/[0.03] px-2 py-3 text-center">
            <div className="relative">
              <Ring value={it.used} total={it.total} color={it.color} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base leading-none">{it.emoji}</span>
                <span className="mt-1 font-display text-sm font-bold tabular-nums text-fg">{Math.max(0, it.total - it.used)}</span>
              </div>
            </div>
            <div className="mt-2 text-xs font-semibold text-fg">{it.label}</div>
            <div className="text-[10px] text-subtle tabular-nums">{it.total}{it.unit} 중 {it.used}{it.unit} 사용</div>
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate('/approvals?new=1')}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-line/10 bg-line/[0.03] px-3 py-2 text-left text-xs text-muted transition hover:border-accent/40 hover:text-fg"
      >
        <span>{b.annualPending > 0 ? `승인 대기 중인 연차 ${b.annualPending}일` : '전자결재에서 휴가 신청하기'}</span>
        <span className="font-medium text-accent">휴가 신청 →</span>
      </button>
    </Card>
  )
}

function UpcomingLeaves() {
  const leaves = useAllLeaves()
  const users = useCore((s) => s.users)
  const navigate = useNavigate()
  const groups = useMemo(() => {
    const today = startOfDay(new Date())
    const thisEnd = endOfWeek(today, { weekStartsOn: 1 })
    const nextStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7)
    const nextEnd = endOfWeek(nextStart, { weekStartsOn: 1 })
    const relevant = leaves
      .filter((l) => new Date(l.end) >= today && new Date(l.start) <= nextEnd)
      .sort((a, b) => a.start.localeCompare(b.start))
    return [
      { label: '이번 주', items: relevant.filter((l) => new Date(l.start) <= thisEnd) },
      { label: '다음 주', items: relevant.filter((l) => new Date(l.start) > thisEnd) },
    ]
  }, [leaves])

  return (
    <Card>
      <CardHeader icon={<CalendarHeart className="h-4 w-4" />} title="휴가 캘린더" subtitle="이번 주 · 다음 주 부재 일정" />
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">{g.label}</div>
            {g.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line/15 px-3 py-3 text-center text-xs text-subtle">예정된 휴가가 없어요 🙌</div>
            ) : (
              <div className="space-y-1.5">
                {g.items.map((l) => {
                  const u = users.find((x) => x.id === l.userId)
                  if (!u) return null
                  const s = new Date(l.start)
                  const e = new Date(l.end)
                  const same = format(s, 'yyyyMMdd') === format(e, 'yyyyMMdd')
                  return (
                    <button
                      key={l.id}
                      onClick={() => navigate(`/people/${u.id}`)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-line/[0.05]"
                    >
                      <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-accent/10 py-1 text-accent">
                        <span className="text-[9px] font-semibold">{format(s, 'EEE', { locale: ko })}</span>
                        <span className="font-display text-base font-bold leading-none">{format(s, 'd')}</span>
                      </div>
                      <Avatar user={u} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-fg">{u.name}</div>
                        <div className="truncate text-[11px] text-subtle">
                          {same ? format(s, 'M/d') : `${format(s, 'M/d')} ~ ${format(e, 'M/d')}`}
                          {l.note && ` · ${l.note}`}
                        </div>
                      </div>
                      <Badge tone={l.type === 'sick' ? 'danger' : l.type.startsWith('half') ? 'cyan' : l.type === 'workshop' ? 'info' : 'pink'}>{LEAVE_LABEL[l.type]}</Badge>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
