import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Copy, MoreHorizontal, Pencil, Trash2, Play } from 'lucide-react'
import { cn, gradientFor, timeAgo } from '@/lib/utils'
import { Avatar, Button, Card, Menu, Modal, Switch, Tooltip } from '@/components/ui'
import { toast } from '@/store/core'
import { TEMPLATES } from '../templates'
import { dailyRunCounts, runsSince, useWorkflows, WEEK_MS } from '../store'
import { previewKinds } from '../graph'
import type { FlowNode, Workflow } from '../types'
import { MiniFlow, RunSparkline, RunStatusDot } from './bits'
import { describeCron, getDef } from '../catalog'
import { particle } from '@/features/approvals/meta'

export function WorkflowCard({ wf, index }: { wf: Workflow; index: number }) {
  const navigate = useNavigate()
  const toggle = useWorkflows((s) => s.toggleEnabled)
  const duplicate = useWorkflows((s) => s.duplicateWorkflow)
  const remove = useWorkflows((s) => s.deleteWorkflow)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const nodes = wf.nodes as FlowNode[]
  const kinds = useMemo(() => previewKinds(nodes, wf.edges, 6), [nodes, wf.edges])
  const daily = useMemo(() => dailyRunCounts(wf, 14), [wf])
  const weekRuns = useMemo(() => runsSince(wf, WEEK_MS).length, [wf])
  const last = wf.runs[0]
  const trigger = nodes.find((n) => n.type === 'trigger')
  const triggerDef = trigger ? getDef(trigger.data.kind) : null
  const gradient = TEMPLATES.find((t) => t.id === wf.templateId)?.gradient ?? gradientFor(wf.id)

  const onToggle = (v: boolean) => {
    toggle(wf.id, v)
    const isSchedule = trigger?.data.kind === 'schedule'
    toast(v ? `"${wf.name}" 활성화됨` : `"${wf.name}" 비활성화됨`, {
      variant: v ? 'success' : 'default',
      emoji: v ? '⚡' : '⏸️',
      description: v
        ? isSchedule
          ? `다음 실행: ${describeCron(String(trigger?.data.config.cron ?? ''))}`
          : `${triggerDef?.label ?? '트리거'} 이벤트를 기다리는 중이에요`
        : '더 이상 자동으로 실행되지 않아요',
    })
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <Card hover spotlight padded={false} className={cn('group cursor-pointer', !wf.enabled && 'opacity-[0.82]')} onClick={() => navigate(`/workflows/${wf.id}`)}>
        <div className={cn('pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-gradient-to-br blur-3xl transition-opacity duration-500', gradient, wf.enabled ? 'opacity-25 group-hover:opacity-40' : 'opacity-10')} />
        <div className="relative p-5">
          <div className="flex items-start gap-3.5">
            <div className={cn('relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow-lg', gradient)}>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent" />
              <span className="relative drop-shadow">{wf.emoji}</span>
              {wf.enabled && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface">
                  <span className="absolute h-2 w-2 rounded-full bg-success animate-pulse-ring" />
                  <span className="relative h-2 w-2 rounded-full bg-success" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[15px] font-semibold text-fg">{wf.name}</h3>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{wf.description || '설명이 없습니다'}</p>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Tooltip content={wf.enabled ? '비활성화' : '활성화'}>
                <Switch checked={wf.enabled} onChange={onToggle} size="sm" />
              </Tooltip>
              <Menu
                trigger={<Button variant="ghost" size="icon-sm" className="opacity-60 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>}
                items={[
                  { label: '편집', icon: <Pencil />, onClick: () => navigate(`/workflows/${wf.id}`) },
                  { label: '테스트 실행', icon: <Play />, onClick: () => navigate(`/workflows/${wf.id}?run=1`) },
                  { label: '복제', icon: <Copy />, onClick: () => { duplicate(wf.id); toast('워크플로우를 복제했어요', { emoji: '📋', variant: 'success', description: `"${wf.name} (사본)" · 비활성 상태로 만들어졌어요` }) } },
                  { divider: true, label: '' },
                  { label: '삭제', icon: <Trash2 />, danger: true, onClick: () => setConfirmDelete(true) },
                ]}
              />
              <Modal
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                size="sm"
                title="워크플로우 삭제"
                description={<><span className="font-medium text-fg">"{wf.name}"</span>{particle(wf.name, '을/를')} 삭제할까요? 실행 기록 {wf.runs.length}건도 함께 삭제되며 되돌릴 수 없어요.</>}
                footer={
                  <>
                    <Button variant="ghost" onClick={() => setConfirmDelete(false)}>취소</Button>
                    <Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => { setConfirmDelete(false); remove(wf.id); toast(`"${wf.name}" 삭제됨`, { emoji: '🗑️' }) }}>삭제</Button>
                  </>
                }
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line/[0.07] bg-line/[0.03] px-3 py-2.5">
            <MiniFlow kinds={kinds} />
            <span className="shrink-0 text-[11px] text-subtle">{wf.nodes.length}단계</span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <RunStatusDot status={last?.status} />
                {last ? (
                  <span className="truncate text-muted">
                    <span className={cn('font-medium', last.status === 'failed' ? 'text-danger' : 'text-fg/90')}>{last.status === 'failed' ? '실패' : last.status === 'running' ? '실행 중' : '성공'}</span>
                    {' · '}
                    {timeAgo(last.startedAt)}
                  </span>
                ) : (
                  <span className="text-subtle">아직 실행 기록 없음</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-subtle">
                <Avatar userId={wf.ownerId} size="xs" />
                {triggerDef && <span className="truncate">{triggerDef.label} 트리거</span>}
              </div>
            </div>
            <div className="w-32 shrink-0">
              <RunSparkline data={daily} />
              <div className="mt-1 text-right text-[10px] text-subtle">이번 주 <span className="font-semibold text-muted">{weekRuns}</span>회 실행</div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
