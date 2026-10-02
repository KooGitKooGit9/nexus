import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, MoreHorizontal, Trash2, PanelRightOpen, MessageSquarePlus } from 'lucide-react'
import { Avatar, Badge, Card, Menu, Progress, Tooltip, type MenuItem } from '@/components/ui'
import { toast, useUser } from '@/store/core'
import { cn, timeAgo } from '@/lib/utils'
import type { KeyResult, Objective } from '../types'
import { STATUS_META, STATUS_ORDER, formatNum, krProgress, objectiveProgress, progressTone } from '../lib'
import { useGoals } from '../store'
import { Ring, STATUS_GRADIENT } from './Ring'
import { ConfirmDialog } from './ConfirmDialog'

export function StatusBadge({ status, onChange }: { status: Objective['status']; onChange?: (s: Objective['status']) => void }) {
  const m = STATUS_META[status]
  const badge = (
    <Badge tone={m.tone} dot className={cn(onChange && 'cursor-pointer hover:brightness-125')}>
      {m.label}
      {onChange && <ChevronDown className="h-3 w-3 -mr-0.5 opacity-70" />}
    </Badge>
  )
  if (!onChange) return badge
  const items: MenuItem[] = STATUS_ORDER.map((s) => ({ label: STATUS_META[s].label, icon: <span className="text-xs">{STATUS_META[s].emoji}</span>, onClick: () => onChange(s) }))
  return <Menu trigger={badge} items={items} placement="bottom-start" className="min-w-[140px]" />
}

export function KeyResultRow({ kr, onClick, compact }: { kr: KeyResult; onClick?: () => void; compact?: boolean }) {
  const p = krProgress(kr)
  const owner = useUser(kr.ownerId)
  return (
    <button
      onClick={onClick}
      className="group/kr w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-line/[0.05] focus-ring"
    >
      <div className="flex items-center gap-2.5">
        <Tooltip content={owner?.name ?? '나간 멤버'}>
          <Avatar userId={kr.ownerId} size="xs" />
        </Tooltip>
        <span className="min-w-0 flex-1 truncate text-[13px] text-fg/90 group-hover/kr:text-fg">{kr.title}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          <span className="font-semibold text-fg">{formatNum(kr.current)}</span>
          <span className="text-subtle"> / {formatNum(kr.target)}{kr.unit}</span>
        </span>
        <span className={cn('w-10 shrink-0 text-right text-xs font-semibold tabular-nums', p >= 100 ? 'text-success' : 'text-fg/80')}>{p}%</span>
      </div>
      <div className={cn('mt-2 flex items-center gap-2', compact ? 'pl-0' : 'pl-[30px]')}>
        <Progress value={p} size="sm" tone={progressTone(p) === 'accent' ? 'accent' : progressTone(p)} />
        <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition group-hover/kr:opacity-100" />
      </div>
    </button>
  )
}

interface ObjectiveCardProps {
  objective: Objective
  company?: boolean
  highlighted?: boolean
  onKrClick: (objectiveId: string, krId: string) => void
  onOpen?: (id: string) => void
  childCount?: number
}

export function ObjectiveCard({ objective: o, company, highlighted, onKrClick, onOpen, childCount }: ObjectiveCardProps) {
  const p = objectiveProgress(o)
  const owner = useUser(o.ownerId)
  const setStatus = useGoals((s) => s.setObjectiveStatus)
  const del = useGoals((s) => s.deleteObjective)
  const [from, to] = STATUS_GRADIENT[o.status]
  const checkins = o.keyResults.reduce((a, k) => a + (k.history?.length ?? 0), 0)
  const [confirmDel, setConfirmDel] = useState(false)
  const childTotal = useGoals((s) => s.objectives.filter((x) => x.parentId === o.id).length)

  return (
    <motion.div layout id={`obj-${o.id}`} initial={false} animate={highlighted ? { scale: [1, 1.015, 1] } : {}} transition={{ duration: 0.6 }}>
      <Card
        spotlight
        padded={false}
        className={cn(
          'transition-shadow',
          company && 'gradient-border',
          highlighted && 'ring-2 ring-accent/60 shadow-glow',
        )}
      >
        {company && <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-20" style={{ background: `radial-gradient(circle, ${from}, transparent 70%)` }} />}
        <div className="relative flex items-start gap-4 p-5 pb-3">
          <div className={cn('flex shrink-0 items-center justify-center rounded-2xl bg-line/[0.06] border border-line/10', company ? 'h-12 w-12 text-2xl' : 'h-10 w-10 text-xl')}>
            {o.emoji ?? '🎯'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={company ? 'accent' : 'cyan'}>{company ? '회사 목표' : o.team}</Badge>
              <StatusBadge status={o.status} onChange={(s) => setStatus(o.id, s)} />
              {childCount ? <Badge tone="neutral">하위 목표 {childCount}</Badge> : null}
            </div>
            <button onClick={() => onOpen?.(o.id)} className="text-left">
              <h3 className={cn('font-semibold leading-snug text-fg hover:underline decoration-line/30 underline-offset-4', company ? 'text-[17px]' : 'text-[15px]')}>{o.title}</h3>
            </button>
            {o.description && company && <p className="mt-1 line-clamp-1 text-[13px] text-muted">{o.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <Avatar userId={o.ownerId} size="xs" />
              <span>{owner?.name ?? '나간 멤버'}</span>
              <span className="text-subtle">·</span>
              <span className="text-subtle">체크인 {checkins}회</span>
              {o.updatedAt && (
                <>
                  <span className="text-subtle">·</span>
                  <span className="text-subtle">{timeAgo(o.updatedAt)} 업데이트</span>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <Ring value={p} size={company ? 68 : 56} stroke={company ? 7 : 6} from={from} to={to}>
              <span className={cn('font-display font-bold tabular-nums', company ? 'text-base' : 'text-sm')}>{p}%</span>
            </Ring>
            <Menu
              trigger={<button aria-label="목표 메뉴" className="rounded-lg p-1 text-subtle hover:bg-line/10 hover:text-fg"><MoreHorizontal className="h-4 w-4" /></button>}
              items={[
                { label: '상세 보기', icon: <PanelRightOpen />, onClick: () => onOpen?.(o.id) },
                { divider: true, label: '' },
                { label: '목표 삭제', icon: <Trash2 />, danger: true, onClick: () => setConfirmDel(true) },
              ]}
            />
          </div>
        </div>
        <div className="relative px-2 pb-3">
          {o.keyResults.map((k) => (
            <KeyResultRow key={k.id} kr={k} onClick={() => onKrClick(o.id, k.id)} />
          ))}
          {!o.keyResults.length && <p className="px-3 py-2 text-xs text-subtle">핵심 결과가 없습니다.</p>}
        </div>
      </Card>
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="목표를 삭제할까요?"
        description={
          <>
            “{o.title}” 목표와 핵심 결과 {o.keyResults.length}개, 체크인 기록이 모두 삭제돼요.
            {childTotal > 0 && ` 정렬된 팀 목표 ${childTotal}개는 연결이 해제됩니다.`}
          </>
        }
        onConfirm={() => {
          del(o.id)
          toast('목표가 삭제되었습니다', { description: o.title, emoji: '🗑️' })
        }}
      />
    </motion.div>
  )
}
