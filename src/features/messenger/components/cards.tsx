import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  AlarmClock, BarChart3, Calendar, CheckCircle2, CircleDot, Clock, ExternalLink, GitBranch, GitMerge, GitPullRequest,
  Headphones, Loader2, MapPin, PhoneOff, ShieldAlert, Users, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCurrentUserId, getUser, toast, useCore, useUI } from '@/store/core'
import { Avatar, AvatarStack, Badge, Checkbox } from '@/components/ui'
import { useMessenger } from '../store'
import { joinHuddle } from '../actions'
import type { BotCard, EventMeta, HuddleMeta, Message, PollMeta, TaskMeta } from '../types'

const cardBase = 'mt-1.5 max-w-[520px] overflow-hidden rounded-2xl border border-line/10 bg-surface-2/50 backdrop-blur'

/* ───────────── Poll ───────────── */

export function PollCard({ message }: { message: Message }) {
  const meta = message.meta as unknown as PollMeta
  const vote = useMessenger((s) => s.votePoll)
  const me = useCore((s) => s.currentUserId)
  const total = meta.options.reduce((a, o) => a + o.voterIds.length, 0)
  const voters = new Set(meta.options.flatMap((o) => o.voterIds))
  const max = Math.max(1, ...meta.options.map((o) => o.voterIds.length))
  return (
    <div className={cn(cardBase, 'p-4')}>
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[14.5px] font-semibold leading-snug">{meta.question}</div>
          <div className="text-[11.5px] text-subtle">{meta.multi ? '복수 선택 가능' : '하나만 선택'} · 클릭해서 투표</div>
        </div>
      </div>
      <div className="space-y-2">
        {meta.options.map((o) => {
          const mine = o.voterIds.includes(me)
          const pct = total ? Math.round((o.voterIds.length / total) * 100) : 0
          const leading = o.voterIds.length === max && o.voterIds.length > 0
          return (
            <button
              key={o.id}
              onClick={() => vote(message.id, o.id)}
              className={cn(
                'group relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.99]',
                mine ? 'border-accent/50 bg-accent/[0.06]' : 'border-line/10 hover:border-accent/30 hover:bg-line/[0.03]',
              )}
            >
              <motion.span
                className={cn('absolute inset-y-0 left-0', mine ? 'bg-accent/20' : leading ? 'bg-accent-2/15' : 'bg-line/[0.07]')}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 160, damping: 22 }}
              />
              <span className="relative flex items-center gap-2.5">
                <span className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition', mine ? 'border-accent bg-accent text-white' : 'border-line/25 group-hover:border-accent/60')}>
                  {mine && <CheckCircle2 className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate text-[13.5px] font-medium">{o.label}</span>
                {o.voterIds.length > 0 && <AvatarStack userIds={o.voterIds} max={3} size="xs" />}
                <span className="w-10 text-right font-display text-[13px] font-semibold tabular-nums text-muted">{pct}%</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-subtle">
        <Users className="h-3.5 w-3.5" /> {voters.size}명 참여 · 총 {total}표
      </div>
    </div>
  )
}

/* ───────────── Task ───────────── */

export function TaskCard({ message }: { message: Message }) {
  const meta = message.meta as unknown as TaskMeta
  const updateMeta = useMessenger((s) => s.updateMeta)
  const assignee = useCore((s) => s.users.find((u) => u.id === meta.assigneeId))
  const overdue = meta.due && !meta.done && new Date(meta.due) < new Date()
  return (
    <div className={cn(cardBase, 'flex items-center gap-3 px-4 py-3')}>
      <Checkbox
        checked={meta.done}
        onChange={(v) => {
          updateMeta(message.id, { done: v })
          if (v) toast('태스크 완료!', { emoji: '✅', variant: 'success', description: meta.title })
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {meta.key && <span className="font-mono text-[11px] text-subtle">{meta.key}</span>}
          <span className={cn('truncate text-[14px] font-medium transition', meta.done && 'text-muted line-through')}>{meta.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-subtle">
          {assignee && (
            <span className="flex items-center gap-1">
              <Avatar user={assignee} size="xs" /> {assignee.name}
            </span>
          )}
          {meta.due && (
            <span className={cn('flex items-center gap-1', overdue && 'text-danger')}>
              <Clock className="h-3 w-3" /> {format(new Date(meta.due), 'M월 d일 (EEE)', { locale: ko })}
            </span>
          )}
        </div>
      </div>
      <Badge tone={meta.done ? 'success' : 'accent'} dot>{meta.done ? '완료' : '진행 중'}</Badge>
    </div>
  )
}

/* ───────────── Huddle ───────────── */

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m >= 60) return `${Math.floor(m / 60)}시간 ${m % 60}분`
  return m ? `${m}분 ${s ? `${s}초` : ''}`.trim() : `${s}초`
}

export function HuddleCard({ message }: { message: Message }) {
  const meta = message.meta as unknown as HuddleMeta
  const call = useUI((s) => s.call)
  const live = !meta.endedAt
  const inThis = call?.channelId === message.channelId
  return (
    <div className={cn(cardBase, 'flex items-center gap-3.5 px-4 py-3')}>
      <div className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', live ? 'bg-success/15 text-success' : 'bg-line/[0.07] text-muted')}>
        {live && <span className="absolute inset-0 rounded-2xl bg-success/30 animate-pulse-ring" />}
        {live ? <Headphones className="relative h-5 w-5" /> : <PhoneOff className="h-[18px] w-[18px]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{live ? '허들이 진행 중입니다' : '허들이 종료되었습니다'}</div>
        <div className="text-[12px] text-muted">
          {live ? `${meta.participantIds.length}명 참여 중` : `${fmtDuration(meta.durationSec ?? 0)} · ${meta.participantIds.length}명 참여`}
        </div>
      </div>
      <AvatarStack userIds={meta.participantIds} max={4} size="sm" />
      {live && !inThis && (
        <button
          onClick={() => joinHuddle(message.id)}
          className="rounded-xl bg-success px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgb(var(--success)/0.7)] transition hover:brightness-110"
        >
          참여하기
        </button>
      )}
      {live && inThis && <Badge tone="success" dot>참여 중</Badge>}
    </div>
  )
}

/* ───────────── Event ───────────── */

export function EventCard({ message }: { message: Message }) {
  const meta = message.meta as unknown as EventMeta & { rsvp?: string; rsvps?: Record<string, string> }
  const updateMeta = useMessenger((s) => s.updateMeta)
  const me = useCore((s) => s.currentUserId)
  // RSVPs are per person (the card is shared); `rsvp` is the legacy single-user field from seed data
  const mine = meta.rsvps?.[me] ?? (me === 'u_me' ? meta.rsvp : undefined)
  const going = Object.values(meta.rsvps ?? {}).filter((v) => v === 'yes').length
  const start = new Date(meta.start)
  const options = [
    { v: 'yes', label: '참석' },
    { v: 'maybe', label: '미정' },
    { v: 'no', label: '불참' },
  ]
  return (
    <div className={cn(cardBase, 'flex gap-3.5 p-4')}>
      <div className="flex h-14 w-14 shrink-0 flex-col overflow-hidden rounded-2xl border border-line/10 bg-surface text-center shadow-card">
        <div className="bg-danger/90 py-0.5 text-[10px] font-bold text-white">{format(start, 'M월', { locale: ko })}</div>
        <div className="flex flex-1 items-center justify-center font-display text-xl font-bold">{format(start, 'd')}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold">{meta.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(start, 'M월 d일 (EEE) a h:mm', { locale: ko })} – {format(new Date(meta.end), 'a h:mm', { locale: ko })}</span>
          {meta.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{meta.location}</span>}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AvatarStack userIds={meta.attendeeIds} max={5} size="xs" />
            {going > 0 && <span className="text-[11px] text-subtle">{going}명 참석</span>}
          </span>
          <div className="flex gap-1 rounded-xl bg-line/[0.05] p-0.5">
            {options.map((o) => (
              <button
                key={o.v}
                onClick={() => {
                  // read the latest RSVPs right before writing so other people's answers aren't overwritten
                  const latest = (useMessenger.getState().messages.find((x) => x.id === message.id)?.meta as { rsvps?: Record<string, string> } | undefined)?.rsvps ?? {}
                  updateMeta(message.id, { rsvps: { ...latest, [me]: o.v } })
                  toast(`"${meta.title}" ${o.label}으로 응답했어요`, { emoji: o.v === 'yes' ? '✅' : o.v === 'maybe' ? '🤔' : '🙅' })
                }}
                className={cn('rounded-lg px-2.5 py-1 text-[12px] font-medium transition', mine === o.v ? 'bg-accent-gradient text-white shadow-glow-sm' : 'text-muted hover:text-fg')}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────── Bot / integration cards ───────────── */

export function BotCardView({ card }: { card: BotCard }) {
  switch (card.card) {
    case 'deploy':
      return <DeployCard card={card} />
    case 'pr':
      return <PRCard card={card} />
    case 'incident':
      return <IncidentCard card={card} />
    case 'gif':
      return <GifCard card={card} />
    case 'reminder':
      return (
        <div className={cn(cardBase, 'flex items-center gap-3 px-4 py-3')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/15 text-warning"><AlarmClock className="h-[18px] w-[18px]" /></div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">{card.text}</div>
            <div className="text-[11.5px] text-subtle">{format(new Date(card.at), 'a h:mm', { locale: ko })} 리마인더</div>
          </div>
        </div>
      )
  }
}

function DeployCard({ card }: { card: Extract<BotCard, { card: 'deploy' }> }) {
  const ok = card.status === 'success'
  const fail = card.status === 'failed'
  return (
    <div className={cn(cardBase, 'relative pl-5 pr-4 py-3')}>
      <span className={cn('absolute inset-y-0 left-0 w-1', ok ? 'bg-success' : fail ? 'bg-danger' : 'bg-info')} />
      <div className="flex items-center gap-2.5">
        {ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : fail ? <XCircle className="h-5 w-5 text-danger" /> : <Loader2 className="h-5 w-5 animate-spin text-info" />}
        <div className="flex-1 text-[14px] font-semibold">
          <span className="font-mono">{card.service}</span> <span className="text-muted">→</span> {card.env}
        </div>
        <Badge tone={ok ? 'success' : fail ? 'danger' : 'info'}>{ok ? '성공' : fail ? '실패' : '진행 중'}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
        <div className="rounded-lg bg-line/[0.04] px-2.5 py-1.5"><div className="text-subtle">버전</div><div className="font-mono font-medium">{card.version}</div></div>
        <div className="rounded-lg bg-line/[0.04] px-2.5 py-1.5"><div className="text-subtle">커밋</div><div className="font-mono font-medium text-accent">{card.commit}</div></div>
        <div className="rounded-lg bg-line/[0.04] px-2.5 py-1.5"><div className="text-subtle">소요 시간</div><div className="font-medium">{fmtDuration(card.durationSec)}</div></div>
      </div>
    </div>
  )
}

function PRCard({ card }: { card: Extract<BotCard, { card: 'pr' }> }) {
  const author = getUser(card.authorId)
  const merged = card.status === 'merged'
  const total = card.additions + card.deletions
  const blocks = 5
  const addBlocks = Math.round((card.additions / Math.max(1, total)) * blocks)
  return (
    <div className={cn(cardBase, 'p-4')}>
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', merged ? 'bg-violet-500/15 text-violet-500' : 'bg-success/15 text-success')}>
          {merged ? <GitMerge className="h-[18px] w-[18px]" /> : <GitPullRequest className="h-[18px] w-[18px]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] text-subtle">{card.repo} <span className="font-mono">#{card.number}</span></div>
          <div className="text-[14.5px] font-semibold leading-snug hover:text-accent">{card.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
            <span className="flex items-center gap-1 rounded-md bg-info/10 px-1.5 py-0.5 font-mono text-info"><GitBranch className="h-3 w-3" />{card.branch}</span>
            <span className="font-mono text-success">+{card.additions.toLocaleString()}</span>
            <span className="font-mono text-danger">−{card.deletions.toLocaleString()}</span>
            <span className="flex gap-0.5">
              {Array.from({ length: blocks }).map((_, i) => (
                <span key={i} className={cn('h-2 w-2 rounded-[2px]', i < addBlocks ? 'bg-success' : 'bg-danger')} />
              ))}
            </span>
            {card.checks && (
              <span className={cn('flex items-center gap-1', card.checks === 'passing' ? 'text-success' : 'text-danger')}>
                {card.checks === 'passing' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {card.checks === 'passing' ? '체크 통과' : '체크 실패'}
              </span>
            )}
          </div>
        </div>
        <Badge tone={merged ? 'accent' : card.status === 'review' ? 'warning' : 'success'}>{merged ? 'Merged' : card.status === 'review' ? '리뷰 대기' : 'Open'}</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line/[0.07] pt-2.5">
        <span className="flex items-center gap-1.5 text-[12px] text-muted">{author && <Avatar user={author} size="xs" />}{author?.name ?? '나간 멤버'}</span>
        {!merged && (
          <button onClick={() => toast('리뷰어로 등록되었습니다', { emoji: '👀', description: `${card.repo}#${card.number}` })} className="flex items-center gap-1 rounded-lg border border-line/15 px-2.5 py-1 text-[12px] font-medium transition hover:border-accent/50 hover:text-accent">
            리뷰하기 <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

function IncidentCard({ card }: { card: Extract<BotCard, { card: 'incident' }> }) {
  const sev = { SEV1: 'bg-danger text-white', SEV2: 'bg-orange-500 text-white', SEV3: 'bg-warning text-black' }[card.severity]
  const statusLabel = { investigating: '조사 중', mitigated: '완화됨', resolved: '해결됨' }[card.status]
  const owner = getUser(card.ownerId)
  const active = card.status === 'investigating'
  return (
    <div className={cn(cardBase, 'relative p-4', active && 'border-danger/30 shadow-[0_0_0_1px_rgb(var(--danger)/0.15),0_12px_40px_-16px_rgb(var(--danger)/0.5)]')}>
      <div className="flex items-start gap-3">
        <div className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', active ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success')}>
          {active && <span className="absolute inset-0 rounded-xl bg-danger/25 animate-pulse-ring" />}
          <ShieldAlert className="relative h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('rounded-md px-1.5 py-0.5 text-[10.5px] font-bold', sev)}>{card.severity}</span>
            <span className="font-mono text-[11.5px] text-subtle">{card.service}</span>
          </div>
          <div className="mt-1 text-[14.5px] font-semibold">{card.title}</div>
          <div className="mt-2 flex items-center gap-3 text-[12px] text-muted">
            <span className={cn('flex items-center gap-1 font-medium', active ? 'text-danger' : 'text-success')}>
              <CircleDot className={cn('h-3 w-3', active && 'animate-pulse')} /> {statusLabel}
            </span>
            {owner && <span className="flex items-center gap-1">담당 <Avatar user={owner} size="xs" /> {owner.name}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function GifCard({ card }: { card: Extract<BotCard, { card: 'gif' }> }) {
  return (
    <div className={cn(cardBase, 'relative aspect-[16/9] w-[320px] max-w-full')}>
      <div className="absolute inset-0 bg-accent-gradient-3 bg-[length:300%_300%] animate-gradient-x" />
      <div className="absolute inset-0 dot-bg opacity-30" />
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-[72px]"
        animate={{ y: [0, -14, 0], rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {card.emoji}
      </motion.div>
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white">
        <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[12px] font-semibold backdrop-blur">/giphy {card.query}</span>
        <span className="text-[10px] font-black tracking-widest opacity-80">GIF</span>
      </div>
    </div>
  )
}

export function SystemLine({ message }: { message: Message }) {
  const u = getUser(message.userId)
  return (
    <span className="text-[13px] text-muted">
      <span className="font-medium text-fg/80">{u?.name ?? '나간 멤버'}</span>님이 {message.text}
    </span>
  )
}

