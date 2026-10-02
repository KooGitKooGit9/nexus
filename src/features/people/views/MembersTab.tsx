import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid, List, MessageSquare, Phone, Search, SearchX, ChevronRight, UserPlus } from 'lucide-react'
import { useCore } from '@/store/core'
import type { Department, Presence, User } from '@/store/types'
import { Avatar, Button, EmptyState, Input, PRESENCE_COLOR, PRESENCE_LABEL, Tabs, Tooltip, useLiveUsers } from '@/components/ui'
import { cn } from '@/lib/utils'
import { DEPARTMENTS, DEPT_META, useNow } from '../lib'
import { ProfileCard } from '../components/ProfileCard'
import { Chip, DeptBadge, LocalTime, useQuickActions } from '../components/common'
import { isHuman } from '@/features/people/format'
import { useNavigate } from 'react-router-dom'

type PresenceFilter = 'all' | Presence
type ViewMode = 'grid' | 'list'

export function matchesUser(u: User, q: string) {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [u.name, u.nameEn, u.title, u.department, u.email, u.location, u.statusText, ...(u.skills ?? [])].some((f) => f?.toLowerCase().includes(s))
}

export function MembersTab() {
  const live = useLiveUsers()
  const users = useMemo(() => live.filter(isHuman), [live])
  const navigate = useNavigate()
  // only departments somebody actually belongs to (real workspaces may not use departments at all)
  const usedDepts = useMemo(() => DEPARTMENTS.filter((d) => users.some((u) => u.department === d)), [users])
  const meId = useCore((s) => s.currentUserId)
  const now = useNow(30_000)
  const [q, setQ] = useState('')
  const [dept, setDept] = useState<Department | 'all'>('all')
  const [presence, setPresence] = useState<PresenceFilter>('all')
  const [view, setView] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('nexus:people-view') as ViewMode) || 'grid' } catch { return 'grid' }
  })
  const changeView = (v: ViewMode) => {
    setView(v)
    try { localStorage.setItem('nexus:people-view', v) } catch { /* noop */ }
  }

  const searched = useMemo(() => users.filter((u) => matchesUser(u, q)), [users, q])
  // Faceted counts: each facet reflects the search + the *other* facet's selection.
  const deptCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0 }
    searched.forEach((u) => {
      if (presence !== 'all' && u.presence !== presence) return
      c.all++
      c[u.department] = (c[u.department] ?? 0) + 1
    })
    return c
  }, [searched, presence])
  const filtered = useMemo(
    () =>
      searched
        .filter((u) => (dept === 'all' || u.department === dept) && (presence === 'all' || u.presence === presence))
        .sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0)),
    [searched, dept, presence, meId],
  )

  const presenceCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0 }
    searched.forEach((u) => {
      if (dept !== 'all' && u.department !== dept) return
      c.all++
      c[u.presence] = (c[u.presence] ?? 0) + 1
    })
    return c
  }, [searched, dept])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-sm">
          <Input icon={<Search />} placeholder="이름, 직책, 부서, 스킬로 검색…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs<PresenceFilter>
            size="sm"
            value={presence}
            onChange={setPresence}
            items={[
              { value: 'all', label: '전체', count: presenceCounts.all },
              ...(['online', 'away', 'dnd', 'offline'] as Presence[]).map((p) => ({
                value: p,
                label: (
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', PRESENCE_COLOR[p])} />
                    {PRESENCE_LABEL[p]}
                  </span>
                ),
                count: presenceCounts[p] ?? 0,
              })),
            ]}
          />
          <Tabs<ViewMode>
            size="sm"
            value={view}
            onChange={changeView}
            items={[
              { value: 'grid', label: '', icon: <LayoutGrid /> },
              { value: 'list', label: '', icon: <List /> },
            ]}
          />
        </div>
      </div>

      {usedDepts.length > 0 && <div className="flex flex-wrap gap-2">
        <Chip active={dept === 'all'} onClick={() => setDept('all')} count={deptCounts.all}>전체</Chip>
        {usedDepts.map((d) => (
          <Chip key={d} active={dept === d} onClick={() => setDept(dept === d ? 'all' : d)} color={DEPT_META[d].color} count={deptCounts[d] ?? 0}>
            {DEPT_META[d].emoji} {d}
          </Chip>
        ))}
      </div>}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="조건에 맞는 구성원이 없어요"
          description="검색어나 필터를 바꿔보세요."
          action={<Button size="sm" onClick={() => { setQ(''); setDept('all'); setPresence('all') }}>필터 초기화</Button>}
        />
      ) : view === 'grid' ? (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((u, i) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(i, 12) * 0.03 } }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <ProfileCard user={u} now={now} isMe={u.id === meId} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <MemberList users={filtered} now={now} meId={meId} />
      )}

      {users.length <= 1 && !q && (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-8 text-center sm:flex-row sm:text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow-sm"><UserPlus className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-fg">아직 혼자예요 👋</div>
            <div className="mt-0.5 text-[13px] text-muted">동료를 초대하면 여기에서 프로필, 근무 시간대, 상태를 한눈에 볼 수 있어요.</div>
          </div>
          <Button variant="primary" leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => navigate('/settings/members')}>동료 초대하기</Button>
        </div>
      )}
    </div>
  )
}

function MemberList({ users, now, meId }: { users: User[]; now: Date; meId: string }) {
  const qa = useQuickActions()
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="hidden gap-4 border-b border-line/10 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-subtle md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_100px_172px_88px] xl:grid-cols-[minmax(200px,2fr)_minmax(0,1.2fr)_100px_minmax(0,1.4fr)_172px_88px]">
        <span>이름</span><span>직책</span><span>부서</span><span className="hidden xl:block">상태</span><span>현지 시각</span><span />
      </div>
      <AnimatePresence initial={false}>
        {users.map((u, i) => (
          <motion.div
            key={u.id}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 14) * 0.02 } }}
            exit={{ opacity: 0 }}
            onClick={() => qa.profile(u)}
            className="group grid cursor-pointer grid-cols-[1fr_auto] items-center gap-4 border-b border-line/[0.06] px-5 py-3 transition-colors last:border-0 hover:bg-accent/[0.05] md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_100px_172px_88px] xl:grid-cols-[minmax(200px,2fr)_minmax(0,1.2fr)_100px_minmax(0,1.4fr)_172px_88px]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar user={u} size="md" showPresence />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-fg">{u.name}</span>
                  {u.id === meId && <span className="rounded bg-accent/20 px-1 text-[10px] font-bold text-accent">나</span>}
                </div>
                <div className="truncate text-xs text-subtle">{u.email}</div>
              </div>
            </div>
            <span className="hidden truncate text-[13px] text-muted md:block">{u.title || <span className="text-subtle">—</span>}</span>
            <span className="hidden md:block"><DeptBadge department={u.department} /></span>
            <span className="hidden truncate text-[13px] text-muted xl:block">{u.statusEmoji} {u.statusText ?? <span className="text-subtle">—</span>}</span>
            <span className="hidden md:block"><LocalTime user={u} now={now} /></span>
            <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
              <Tooltip content="메시지"><Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); qa.message(u) }}><MessageSquare className="h-4 w-4" /></Button></Tooltip>
              <Tooltip content="통화"><Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); qa.call(u) }}><Phone className="h-4 w-4" /></Button></Tooltip>
              <ChevronRight className="h-4 w-4 text-subtle" />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
