import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Briefcase, Cake, Clock, Copy, Heart, Mail, MapPin, MessageSquare, Pencil, Phone, Sparkles, UserX, Users, Video, CalendarDays, FolderKanban, ChevronRight,
} from 'lucide-react'
import { Page } from '@/app/Page'
import { Avatar, Button, Card, CardHeader, EmptyState, PRESENCE_LABEL, PresenceDot, Tooltip, useLiveUsers } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import type { User } from '@/store/types'
import { cn, formatDate, gradientFor } from '@/lib/utils'
import { useProjects } from '@/features/projects/store'
import { deptMeta, directReports, localTimeLabel, tenureLabel, tzShortName, useNow, LEAVE_LABEL, leaveCovers } from '../lib'
import { usePeople } from '../store'
import { useAllLeaves } from '../leaves'
import { DEPT_TEXT_CLS, DeptBadge, deptVar, useQuickActions } from '../components/common'
import { KudosCard } from '../components/KudosCard'
import { WorkHoursTimeline } from '../components/WorkHoursTimeline'
import { EditProfileModal } from '../components/EditProfileModal'
import { GiveKudosModal } from '../components/GiveKudosModal'
import { joinMeta } from '@/features/people/format'

export function ProfilePage({ userId }: { userId: string }) {
  const users = useLiveUsers()
  const meId = useCore((s) => s.currentUserId)
  const navigate = useNavigate()
  const user = users.find((u) => u.id === userId)
  const me = users.find((u) => u.id === meId)

  if (!user) {
    return (
      <Page>
        <EmptyState
          icon={<UserX />}
          title="구성원을 찾을 수 없어요"
          description="퇴사했거나 존재하지 않는 프로필입니다."
          action={<Button onClick={() => navigate('/people')} leftIcon={<ArrowLeft className="h-4 w-4" />}>구성원 목록으로</Button>}
        />
      </Page>
    )
  }
  // our own member record can be briefly missing (just joined / server still upserting) — wait for it
  if (!me) return null
  return <Profile key={user.id} user={user} me={me} users={users} />
}

function Profile({ user, me, users }: { user: User; me: User; users: User[] }) {
  const navigate = useNavigate()
  const qa = useQuickActions()
  const now = useNow(30_000)
  const isMe = user.id === me.id
  const [editOpen, setEditOpen] = useState(false)
  const [kudosOpen, setKudosOpen] = useState(false)
  const kudos = usePeople((s) => s.kudos)
  const leaves = useAllLeaves()
  const projects = useProjects((s) => s.projects)

  const manager = users.find((u) => u.id === user.managerId)
  const reports = directReports(users, user.id)
  const peers = user.managerId ? users.filter((u) => u.managerId === user.managerId && u.id !== user.id) : []
  const received = useMemo(() => kudos.filter((k) => k.toId === user.id), [kudos, user.id])
  const myProjects = useMemo(() => (projects ?? []).filter((p) => !p.archived && (p.leadId === user.id || p.memberIds.includes(user.id))), [projects, user.id])
  const leaveToday = leaves.find((l) => l.userId === user.id && leaveCovers(l, now))
  const upcomingLeave = leaves.filter((l) => l.userId === user.id && new Date(l.end) >= now).sort((a, b) => a.start.localeCompare(b.start))[0]
  const meta = deptMeta(user.department)
  const grad = gradientFor(user.color ?? user.id)

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    toast(`${label}을(를) 복사했어요`, { emoji: '📋', description: text })
  }

  return (
    <Page>
      <button onClick={() => navigate('/people')} className="mb-4 flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> 구성원
      </button>

      {/* ───── Cover + identity ───── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass relative overflow-hidden rounded-3xl">
        <div className="relative h-44 overflow-hidden sm:h-52">
          <div className={cn('absolute inset-0 bg-gradient-to-br', grad)} />
          <div className="absolute -left-16 top-0 h-64 w-64 rounded-full bg-white/25 blur-3xl animate-aurora-1" />
          <div className="absolute -right-10 -top-20 h-72 w-72 rounded-full blur-3xl animate-aurora-2" style={{ background: meta.color, opacity: 0.6 }} />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <Clock className="h-3.5 w-3.5" /> 현지 {localTimeLabel(user.timezone, now)} · {tzShortName(user.timezone, now)}
          </div>
        </div>

        <div className="relative px-6 pb-6 sm:px-8">
          {/* Only the avatar overlaps the banner; name/title always sit on the card surface below it. */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
              <div className="relative -mt-16 w-fit shrink-0">
                <div className={cn('absolute inset-0 rounded-full bg-gradient-to-br blur-2xl opacity-70', grad)} />
                <div className="relative rounded-full bg-surface p-1.5 shadow-float">
                  <Avatar user={user} size="2xl" />
                  <PresenceDot presence={user.presence} className="absolute bottom-3 right-3 h-6 w-6 ring-4" />
                </div>
              </div>
              <div className="min-w-0 sm:pt-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-fg">{user.name}</h1>
                  {user.nameEn && user.nameEn !== user.name && <span className="text-sm text-subtle">{user.nameEn}</span>}
                  {isMe && <span className="self-center rounded-full bg-accent-gradient px-2 py-0.5 text-[10px] font-bold text-white">나</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  {user.title && <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{user.title}</span>}
                  <DeptBadge department={user.department} size="md" />
                  <span className="text-xs text-subtle">· {PRESENCE_LABEL[user.presence]}</span>
                </div>
                {(user.statusEmoji || user.statusText || leaveToday) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {(user.statusEmoji || user.statusText) && (
                      <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-line/10 bg-line/[0.05] px-3 py-1 text-sm text-fg/90">
                        {user.statusEmoji && <span>{user.statusEmoji}</span>}
                        {user.statusText && <span className="truncate">{user.statusText}</span>}
                      </div>
                    )}
                    {leaveToday && (
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/15 px-3 py-1 text-xs font-medium text-pink-600 dark:text-pink-400">
                        🌴 오늘 {LEAVE_LABEL[leaveToday.type]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 lg:pt-4">
              {isMe ? (
                <Button variant="primary" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>프로필 편집</Button>
              ) : (
                <>
                  <Button variant="primary" leftIcon={<MessageSquare className="h-4 w-4" />} onClick={() => qa.message(user)}>메시지</Button>
                  <Tooltip content="음성 통화"><Button size="icon" onClick={() => qa.call(user)}><Phone className="h-4 w-4" /></Button></Tooltip>
                  <Tooltip content="영상 통화"><Button size="icon" onClick={() => qa.call(user, true)}><Video className="h-4 w-4" /></Button></Tooltip>
                  <Tooltip content="칭찬하기"><Button size="icon" onClick={() => setKudosOpen(true)}><Heart className="h-4 w-4 text-pink-400" /></Button></Tooltip>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ───── Body ───── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Card>
            <CardHeader title="연락처" />
            <div className="space-y-1">
              <InfoRow icon={<Mail />} label="이메일" value={user.email} onCopy={() => copy(user.email, '이메일')} />
              <InfoRow icon={<Phone />} label="전화" value={user.phone} onCopy={user.phone ? () => copy(user.phone, '전화번호') : undefined} />
              <InfoRow icon={<MapPin />} label="근무지" value={user.location} />
              <InfoRow icon={<Clock />} label="현지 시각" value={`${localTimeLabel(user.timezone, now)} (${tzShortName(user.timezone, now)})`} />
            </div>
          </Card>

          <Card>
            <CardHeader title="조직" icon={<Users className="h-4 w-4" />} />
            {manager && (
              <div className="mb-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">매니저</div>
                <PersonRow user={manager} />
              </div>
            )}
            {reports.length > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">팀원 {reports.length}명</div>
                <div className="space-y-0.5">{reports.map((r) => <PersonRow key={r.id} user={r} />)}</div>
              </div>
            )}
            {peers.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">같은 팀 동료</div>
                <div className="flex flex-wrap gap-1.5">
                  {peers.map((p) => (
                    <Tooltip key={p.id} content={joinMeta(p.name, p.title)}>
                      <button onClick={() => navigate(`/people/${p.id}`)} className="transition hover:scale-110"><Avatar user={p} size="sm" showPresence /></button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
            {!manager && reports.length === 0 && <p className="text-xs text-subtle">조직 정보가 없습니다.</p>}
          </Card>

          <Card>
            <CardHeader title="스킬" icon={<Sparkles className="h-4 w-4" />} />
            <div className="flex flex-wrap gap-1.5">
              {user.skills?.length ? user.skills.map((s, i) => (
                <motion.span
                  key={s}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', DEPT_TEXT_CLS)}
                  style={{ ...deptVar(meta.color), borderColor: `${meta.color}40`, background: `${meta.color}14` }}
                >
                  {s}
                </motion.span>
              )) : <span className="text-xs text-subtle">등록된 스킬이 없어요</span>}
            </div>
          </Card>

          <Card>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-subtle"><CalendarDays className="h-3 w-3" />입사일</div>
                <div className="mt-0.5 font-medium text-fg">{validDate(user.joinedAt) ? formatDate(user.joinedAt) : <span className="text-subtle">—</span>}</div>
                {tenureLabel(user.joinedAt) && <div className="text-[11px] text-muted">{tenureLabel(user.joinedAt)}째</div>}
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] text-subtle"><Cake className="h-3 w-3" />생일</div>
                <div className="mt-0.5 font-medium text-fg">{/^\d{2}-\d{2}$/.test(user.birthday ?? '') ? `${Number(user.birthday.slice(0, 2))}월 ${Number(user.birthday.slice(3))}일` : <span className="text-subtle">—</span>}</div>
                {!!user.birthday && user.birthday === formatDate(now, 'MM-dd') && <div className="text-[11px] text-pink-600 dark:text-pink-400">🎂 오늘 생일이에요!</div>}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="소개" />
            <p className="text-[15px] leading-relaxed text-fg/90">
              {user.bio || <span className="text-subtle">{isMe ? '아직 소개가 없어요. 프로필 편집에서 자신을 소개해 보세요!' : '아직 소개가 없어요.'}</span>}
            </p>
            {upcomingLeave && !leaveToday && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-pink-500/10 px-3 py-2 text-xs text-pink-600 dark:text-pink-300">
                🌴 {formatDate(upcomingLeave.start, 'M월 d일 (EEE)')} {LEAVE_LABEL[upcomingLeave.type]} 예정{upcomingLeave.note && ` · ${upcomingLeave.note}`}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="근무 시간" subtitle="내 시간대 기준 24시간 타임라인" icon={<Clock className="h-4 w-4" />} />
            <WorkHoursTimeline user={user} me={me} now={now} />
          </Card>

          <Card>
            <CardHeader title="함께하는 프로젝트" icon={<FolderKanban className="h-4 w-4" />} subtitle={myProjects.length ? `${myProjects.length}개 프로젝트` : undefined} />
            {myProjects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line/15 py-6 text-center text-xs text-subtle">참여 중인 프로젝트가 없어요</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {myProjects.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="group flex items-center gap-3 rounded-xl border border-line/10 bg-line/[0.03] p-3 text-left transition hover:border-accent/40 hover:bg-accent/[0.05]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: `${p.color}25`, boxShadow: `inset 0 0 0 1px ${p.color}40` }}>{p.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-fg">{p.name}</span>
                        {p.leadId === user.id && <span className="rounded bg-amber-400/15 px-1 text-[9px] font-bold text-amber-600 dark:text-amber-400">리드</span>}
                      </div>
                      <div className="truncate text-[11px] text-subtle">{p.key} · 멤버 {p.memberIds.length}명</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-fg" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="받은 칭찬"
              icon={<Heart className="h-4 w-4" />}
              subtitle={`총 ${received.length}개`}
              action={!isMe && <Button size="xs" variant="outline" leftIcon={<Heart className="h-3 w-3" />} onClick={() => setKudosOpen(true)}>칭찬하기</Button>}
            />
            {received.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line/15 py-6 text-center text-xs text-subtle">아직 받은 칭찬이 없어요 — 첫 칭찬을 보내보세요!</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {received.slice(0, 4).map((k) => <KudosCard key={k.id} kudos={k} compact />)}
              </div>
            )}
          </Card>
        </div>
      </div>

      {isMe && <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} user={user} />}
      <GiveKudosModal open={kudosOpen} onClose={() => setKudosOpen(false)} defaultToId={user.id} />
    </Page>
  )
}

const validDate = (v: string | undefined) => !!v && !Number.isNaN(new Date(v).getTime())

function InfoRow({ icon, label, value, onCopy }: { icon: React.ReactNode; label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-line/[0.04]">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-line/[0.06] text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-subtle">{label}</div>
        <div className="truncate text-[13px] text-fg">{value || <span className="text-subtle">미입력</span>}</div>
      </div>
      {onCopy && (
        <button onClick={onCopy} className="rounded-lg p-1.5 text-subtle opacity-0 transition hover:bg-line/10 hover:text-fg group-hover:opacity-100">
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function PersonRow({ user }: { user: User }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(`/people/${user.id}`)} className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-line/[0.05]">
      <Avatar user={user} size="sm" showPresence />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-fg">{user.name}</div>
        {user.title && <div className="truncate text-[11px] text-subtle">{user.title}</div>}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-subtle opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}
