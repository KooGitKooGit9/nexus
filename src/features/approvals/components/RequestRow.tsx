import { motion } from 'framer-motion'
import { CalendarDays, Paperclip, Flame, ChevronRight, MessageSquare } from 'lucide-react'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { Avatar, Badge } from '@/components/ui'
import { useCore } from '@/store/core'
import { KIND_META, LEAVE_LABEL, isPendingOn, won } from '../meta'
import type { ApprovalRequest } from '../types'
import { ApprovalLine } from './ApprovalLine'
import { KindIcon, StatusBadge } from './bits'

export function dateRange(r: ApprovalRequest) {
  if (!r.startDate) return null
  const s = formatDate(r.startDate, 'M/d (EEE)')
  if (!r.endDate || formatDate(r.startDate) === formatDate(r.endDate)) return s
  return `${s} ~ ${formatDate(r.endDate, 'M/d (EEE)')}`
}

export function RequestRow({ r, index, onOpen }: { r: ApprovalRequest; index: number; onOpen: () => void }) {
  const me = useCore((s) => s.currentUserId)
  const requester = useCore((s) => s.users.find((u) => u.id === r.requesterId))
  const mine = isPendingOn(r, me)
  const m = KIND_META[r.kind]
  const range = dateRange(r)
  const comments = r.steps.filter((s) => s.comment).length

  return (
    <motion.button
      type="button"
      layout
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ delay: Math.min(index, 10) * 0.035, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group glass relative flex w-full items-center gap-4 overflow-hidden rounded-2xl px-4 py-3.5 text-left transition-all',
        'hover:-translate-y-px hover:border-accent/30 hover:shadow-glow-sm focus-ring',
        mine && 'border-info/30',
      )}
    >
      {mine && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-info to-accent" />}
      <KindIcon kind={r.kind} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-[11px] font-semibold', m.text)}>{m.label}{r.leaveType ? ` · ${LEAVE_LABEL[r.leaveType]}` : ''}</span>
          {r.urgent && r.status === 'pending' && <Badge tone="danger" icon={<Flame className="h-3 w-3" />}>긴급</Badge>}
          {mine && <Badge tone="info">내 결재 차례</Badge>}
        </div>
        <div className="mt-0.5 truncate text-[14.5px] font-semibold text-fg group-hover:text-fg">{r.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5"><Avatar userId={r.requesterId} size="xs" />{requester?.name}<span className="text-subtle">· {requester?.department}</span></span>
          <span className="font-mono text-[11px] text-subtle">{r.docNo}</span>
          <span className="text-subtle">{timeAgo(r.createdAt)}</span>
          {!!r.attachments?.length && <span className="flex items-center gap-0.5 text-subtle"><Paperclip className="h-3 w-3" />{r.attachments.length}</span>}
          {comments > 0 && <span className="flex items-center gap-0.5 text-subtle"><MessageSquare className="h-3 w-3" />{comments}</span>}
        </div>
      </div>

      <div className="hidden w-44 shrink-0 flex-col items-end gap-1 text-right md:flex">
        {r.amount !== undefined && <span className="font-display text-[15px] font-semibold tabular-nums text-fg">{won(r.amount)}</span>}
        {range && <span className="flex items-center gap-1 text-[11.5px] text-muted"><CalendarDays className="h-3 w-3" />{range}</span>}
        {r.days !== undefined && r.kind === 'leave' && <span className="text-[11px] text-subtle">{r.days}일</span>}
      </div>

      <div className="hidden shrink-0 lg:block">
        <ApprovalLine request={r} size="sm" />
      </div>

      <div className="flex w-16 shrink-0 justify-end">
        <StatusBadge status={r.status} />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-fg" />
    </motion.button>
  )
}
