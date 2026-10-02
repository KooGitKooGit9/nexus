import { useState } from 'react'
import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, Undo2, MessageSquare, Clock, Copy, Sparkles } from 'lucide-react'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { Avatar, Badge, Button, Drawer } from '@/components/ui'
import { toast, useCore, useUI } from '@/store/core'
import { useApprovals } from '../store'
import { KIND_META, isPendingOn } from '../meta'
import type { ApprovalRequest } from '../types'
import { ApprovalDocument } from './ApprovalDocument'
import { ApprovalLine, STEP_LABEL } from './ApprovalLine'
import { KindIcon, StatusBadge } from './bits'
import { DecisionModal, type Decision } from './DecisionModal'

function celebrate() {
  const defaults = { zIndex: 9999, spread: 70, startVelocity: 45, ticks: 220, colors: ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#dc2626'] }
  confetti({ ...defaults, particleCount: 90, origin: { x: 0.62, y: 0.35 }, angle: 120 })
  confetti({ ...defaults, particleCount: 90, origin: { x: 0.98, y: 0.35 }, angle: 60 })
  setTimeout(() => confetti({ ...defaults, particleCount: 60, spread: 120, origin: { x: 0.8, y: 0.2 }, scalar: 1.1 }), 260)
}

function Timeline({ r }: { r: ApprovalRequest }) {
  const users = useCore((s) => s.users)
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? ''
  const events = [
    { id: 'draft', userId: r.requesterId, label: '기안 상신', at: r.createdAt, tone: 'neutral' as const, comment: undefined as string | undefined },
    ...r.steps.map((s, i) => ({
      id: `s${i}`,
      userId: s.approverId,
      label: `${i + 1}차 결재 · ${r.status === 'cancelled' && s.status !== 'approved' ? '취소됨' : STEP_LABEL[s.status]}`,
      at: s.decidedAt,
      tone: s.status === 'approved' ? ('success' as const) : s.status === 'rejected' ? ('danger' as const) : s.status === 'pending' && r.status === 'pending' ? ('info' as const) : ('neutral' as const),
      comment: s.comment,
    })),
    ...(r.status === 'cancelled' ? [{ id: 'cancel', userId: r.requesterId, label: '기안 회수', at: r.completedAt, tone: 'neutral' as const, comment: undefined as string | undefined }] : []),
  ]
  return (
    <div className="relative space-y-4 pl-1">
      <div className="absolute bottom-3 left-[17px] top-3 w-px bg-line/10" />
      {events.map((e, i) => (
        <motion.div key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="relative flex gap-3">
          <div className="relative z-[1]">
            <Avatar userId={e.userId} size="sm" className={cn(!e.at && e.tone === 'neutral' && 'opacity-40 grayscale')} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <span className="font-semibold text-fg">{name(e.userId)}</span>
              <Badge tone={e.tone}>{e.label}</Badge>
              {e.at && <span className="text-[11px] text-subtle" title={formatDate(e.at, 'yyyy.MM.dd HH:mm')}>{timeAgo(e.at)}</span>}
            </div>
            {e.comment && (
              <div className={cn('mt-1.5 inline-block max-w-full rounded-2xl rounded-tl-md border px-3 py-2 text-[13px] leading-relaxed', e.tone === 'danger' ? 'border-danger/20 bg-danger/[0.07] text-fg' : 'border-line/10 bg-line/[0.04] text-fg/90')}>
                {e.comment}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export function RequestDrawer({ request, onClose }: { request: ApprovalRequest | null; onClose: () => void }) {
  const me = useCore((s) => s.currentUserId)
  const approve = useApprovals((s) => s.approve)
  const reject = useApprovals((s) => s.reject)
  const cancel = useApprovals((s) => s.cancel)
  const [decision, setDecision] = useState<Decision | null>(null)
  const requester = useCore((s) => s.users.find((u) => u.id === request?.requesterId))

  const r = request
  const canDecide = !!r && isPendingOn(r, me)
  const canCancel = !!r && r.requesterId === me && r.status === 'pending'

  const confirm = (comment: string) => {
    if (!r || !decision) return
    const who = requester?.name ?? '기안자'
    if (decision === 'approve') {
      const res = approve(r.id, comment)
      if (res === 'completed') {
        setTimeout(celebrate, 450)
        toast('최종 승인 완료 🎉', { variant: 'success', emoji: '✅', description: `${who}님에게 “${r.title}” 최종 승인 알림을 보냈어요`, actorId: r.requesterId })
      } else if (res === 'advanced') {
        const nextIdx = r.steps.findIndex((s) => s.status === 'pending') + 1
        const next = useCore.getState().users.find((u) => u.id === r.steps[nextIdx]?.approverId)
        toast('승인했어요', { variant: 'success', emoji: '🖋️', description: `${who}님에게 알림 · 다음 결재자 ${next?.name ?? ''}님에게 전달됐어요` })
      }
    } else if (decision === 'reject') {
      reject(r.id, comment)
      toast('반려했어요', { variant: 'warning', emoji: '↩️', description: `${who}님에게 반려 사유와 함께 알림을 보냈어요` })
    } else {
      cancel(r.id)
      toast('결재를 회수했어요', { emoji: '📥', description: '결재선에서 문서가 회수되었어요' })
    }
    setDecision(null)
  }

  const copyLink = () => {
    if (!r) return
    void navigator.clipboard?.writeText(`${location.origin}/approvals?id=${r.id}`)
    toast('문서 링크를 복사했어요', { emoji: '🔗' })
  }

  return (
    <>
      <Drawer
        open={!!r}
        onClose={() => { if (!decision) onClose() }}
        width={760}
        title={
          r && (
            <div className="flex min-w-0 items-center gap-3">
              <KindIcon kind={r.kind} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-[15px]">{r.title}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-[11px] font-normal text-subtle">{KIND_META[r.kind].label} · {r.docNo}</div>
              </div>
            </div>
          )
        }
        footer={
          r && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" leftIcon={<Copy className="h-3.5 w-3.5" />} onClick={copyLink}>링크 복사</Button>
              <Button variant="ghost" size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => useUI.getState().askAI(`결재 문서 "${r.title}" (${KIND_META[r.kind].label}${r.amount ? `, ${r.amount.toLocaleString('ko-KR')}원` : ''}) 내용을 검토하고 승인 시 고려할 점을 알려줘`)}>AI 검토</Button>
              <div className="ml-auto flex items-center gap-2">
                {canCancel && <Button variant="outline" size="sm" leftIcon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setDecision('cancel')}>회수</Button>}
                {canDecide && (
                  <>
                    <Button variant="outline" className="border-danger/40 text-danger hover:border-danger hover:bg-danger/10" leftIcon={<X className="h-4 w-4" />} onClick={() => setDecision('reject')}>반려</Button>
                    <Button variant="success" leftIcon={<Check className="h-4 w-4" />} onClick={() => setDecision('approve')} className="px-6">승인</Button>
                  </>
                )}
              </div>
            </div>
          )
        }
      >
        {r && (
          <div className="space-y-6 p-5">
            <AnimatePresence>
              {canDecide && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: -24 }} className="flex items-center gap-3 rounded-2xl border border-info/25 bg-info/[0.08] px-4 py-3">
                  <span className="relative flex h-2.5 w-2.5"><span className="absolute inset-0 rounded-full bg-info animate-pulse-ring" /><span className="relative h-2.5 w-2.5 rounded-full bg-info" /></span>
                  <div className="text-[13px] text-fg"><b>회원님의 결재 차례예요.</b> <span className="text-muted">문서를 검토하고 승인 또는 반려해 주세요.</span></div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/10 bg-line/[0.025] px-4 py-3">
              <div className="flex items-center gap-2 text-[12px] text-muted"><Clock className="h-3.5 w-3.5" />결재선</div>
              <ApprovalLine request={r} size="md" />
            </div>

            <ApprovalDocument key={r.id} r={r} />

            <div>
              <div className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-fg"><MessageSquare className="h-4 w-4 text-accent" />결재 의견 · 이력</div>
              <Timeline r={r} />
            </div>
          </div>
        )}
      </Drawer>
      <DecisionModal decision={decision} docTitle={r?.title} onClose={() => setDecision(null)} onConfirm={confirm} />
    </>
  )
}
