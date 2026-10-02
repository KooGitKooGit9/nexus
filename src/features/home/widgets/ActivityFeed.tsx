import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, FileText, Megaphone, MessageSquare, FileSignature, Target, Radio } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { useCore } from '@/store/core'
import { BOT_USER } from '@/store/seed-users'
import { cn, timeAgo } from '@/lib/utils'
import { useProjects } from '@/features/projects/store'
import { useDocs } from '@/features/docs/store'
import { useMessenger } from '@/features/messenger/store'
import { useApprovals } from '@/features/approvals/store'
import { useGoals } from '@/features/goals/store'
import { formatNum } from '@/features/goals/lib'
import { Widget, MiniEmpty } from '../components/Widget'

interface Item { id: string; at: string; actorId: string; icon: ReactNode; tone: string; text: ReactNode; detail?: ReactNode; href: string }

const snippet = (t: string) => t.replace(/```[\s\S]*?```/g, '[코드]').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90)

const B = ({ children }: { children: ReactNode }) => <span className="font-medium text-fg">{children}</span>

export function ActivityFeed({ className, delay }: { className?: string; delay?: number }) {
  const navigate = useNavigate()
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const tasks = useProjects((s) => s.tasks)
  const projects = useProjects((s) => s.projects)
  const docs = useDocs((s) => s.docs)
  const messages = useMessenger((s) => s.messages)
  const channels = useMessenger((s) => s.channels)
  const requests = useApprovals((s) => s.requests)
  const objectives = useGoals((s) => s.objectives)
  const announcements = useGoals((s) => s.announcements)

  const items = useMemo(() => {
    const name = (id: string) => users.find((u) => u.id === id)?.name ?? '누군가'
    const out: Item[] = []
    const cutoff = Date.now() - 14 * 864e5

    for (const t of tasks ?? []) {
      if (t.status === 'done' && t.completedAt) {
        const key = projects?.find((p) => p.id === t.projectId)?.key ?? 'NX'
        const actor = t.assigneeIds[0] ?? t.reporterId
        out.push({ id: `t-${t.id}`, at: t.completedAt, actorId: actor, icon: <CheckCircle2 />, tone: 'from-emerald-400 to-teal-600', href: `/projects/${t.projectId}?task=${t.id}`, text: <><B>{name(actor)}</B>님이 태스크를 완료했어요</>, detail: <><span className="font-mono text-[11px] text-subtle">{key}-{t.number}</span> {t.title}</> })
      }
    }
    for (const d of docs ?? []) {
      out.push({ id: `d-${d.id}`, at: d.updatedAt, actorId: d.lastEditedBy, icon: <FileText />, tone: 'from-amber-400 to-orange-600', href: `/docs/${d.id}`, text: <><B>{name(d.lastEditedBy)}</B>님이 문서를 편집했어요</>, detail: <>{d.emoji} {d.title}</> })
    }
    const recentMsgs = [...(messages ?? [])]
      .filter((m) => !m.threadId && !m.deleted && !m.scheduledFor && m.kind !== 'system' && m.userId !== BOT_USER.id && users.some((u) => u.id === m.userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const seenCh = new Set<string>()
    for (const m of recentMsgs) {
      const c = channels?.find((x) => x.id === m.channelId)
      if (!c || c.kind === 'dm' || c.kind === 'group' || seenCh.has(c.id)) continue
      if (c.kind === 'private' && !c.memberIds.includes(me)) continue
      seenCh.add(c.id)
      out.push({ id: `m-${m.id}`, at: m.createdAt, actorId: m.userId, icon: <MessageSquare />, tone: 'from-violet-500 to-fuchsia-500', href: `/messages/${c.id}`, text: <><B>{name(m.userId)}</B>님이 <B>#{c.name}</B>에 메시지를 남겼어요</>, detail: snippet(m.text) })
      if (seenCh.size >= 4) break
    }
    for (const r of requests ?? []) {
      out.push({ id: `r-${r.id}`, at: r.createdAt, actorId: r.requesterId, icon: <FileSignature />, tone: 'from-pink-500 to-rose-600', href: `/approvals?id=${r.id}`, text: <><B>{name(r.requesterId)}</B>님이 결재를 요청했어요</>, detail: r.title })
      for (const s of r.steps) {
        if (s.decidedAt && (s.status === 'approved' || s.status === 'rejected')) {
          out.push({ id: `rs-${r.id}-${s.approverId}`, at: s.decidedAt, actorId: s.approverId, icon: <FileSignature />, tone: s.status === 'approved' ? 'from-emerald-400 to-teal-600' : 'from-rose-500 to-red-600', href: `/approvals?id=${r.id}`, text: <><B>{name(s.approverId)}</B>님이 결재를 {s.status === 'approved' ? '승인' : '반려'}했어요</>, detail: r.title })
        }
      }
    }
    for (const o of objectives) {
      for (const k of o.keyResults) {
        const last = k.history?.[k.history.length - 1]
        if (last) out.push({ id: `k-${last.id}`, at: last.at, actorId: last.userId, icon: <Target />, tone: 'from-sky-400 to-indigo-500', href: `/goals?quarter=${encodeURIComponent(o.quarter)}&id=${o.id}`, text: <><B>{name(last.userId)}</B>님이 핵심 결과를 체크인했어요</>, detail: <>{k.title} → <span className="font-semibold text-fg">{formatNum(last.value)}{k.unit}</span></> })
      }
    }
    for (const a of announcements) {
      out.push({ id: `a-${a.id}`, at: a.createdAt, actorId: a.authorId, icon: <Megaphone />, tone: 'from-indigo-500 to-purple-600', href: `/announcements?id=${a.id}`, text: <><B>{name(a.authorId)}</B>님이 공지를 게시했어요</>, detail: <>{a.emoji} {a.title}</> })
    }

    return out
      .filter((i) => new Date(i.at).getTime() > cutoff && new Date(i.at).getTime() <= Date.now() + 60_000)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10)
  }, [users, me, tasks, projects, docs, messages, channels, requests, objectives, announcements])

  return (
    <Widget
      className={className}
      delay={delay}
      title="최근 활동"
      subtitle="워크스페이스 전체의 최신 업데이트"
      icon={<Radio />}
      gradient="from-cyan-400 to-blue-600"
      action={
        <span className="flex items-center gap-1.5 text-[11px] text-success">
          <span className="relative flex h-2 w-2"><span className="absolute inset-0 rounded-full bg-success animate-pulse-ring" /><span className="h-2 w-2 rounded-full bg-success" /></span>
          실시간
        </span>
      }
    >
      {items.length === 0 ? (
        <MiniEmpty emoji="🌙" title="아직 활동이 없어요" />
      ) : (
        <ol className="relative grid gap-x-6 md:grid-cols-2">
          {items.map((it, i) => (
            <motion.li
              key={it.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (delay ?? 0) + 0.15 + i * 0.03 }}
            >
              <button onClick={() => navigate(it.href)} className="group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-line/[0.04]">
                <div className="relative shrink-0">
                  <Avatar userId={it.actorId} size="sm" />
                  <span className={cn('absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-md bg-gradient-to-br text-white ring-2 ring-surface [&>svg]:h-2.5 [&>svg]:w-2.5', it.tone)}>{it.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <div className="min-w-0 flex-1 truncate text-[12.5px] leading-snug text-muted">{it.text}</div>
                    <span className="shrink-0 text-[11px] text-subtle">{timeAgo(it.at)}</span>
                  </div>
                  {it.detail && <div className="mt-0.5 truncate text-[12px] text-fg/80 group-hover:text-fg">{it.detail}</div>}
                </div>
              </button>
            </motion.li>
          ))}
        </ol>
      )}
    </Widget>
  )
}
