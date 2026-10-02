import { useNavigate } from 'react-router-dom'
import { ArrowRight, Gauge, Sparkles } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { useWorkspace } from '@/lib/workspace'
import { planById } from '@/config/brand'
import { cn } from '@/lib/utils'
import { LIMIT_LABEL, useUpgradePrompt, type LimitKind } from '../billing'

/** Inline "you hit a plan limit" banner with an upgrade link. Must render inside the app router. */
export function PlanLimitNotice({ limit, message, className, compact }: { limit?: LimitKind; message?: string; className?: string; compact?: boolean }) {
  const navigate = useNavigate()
  const ws = useWorkspace()
  const plan = planById(ws.plan)
  return (
    <div role="status" className={cn('flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] px-4 py-3', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm"><Gauge className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 text-[13px]">
        <div className="font-semibold text-fg">{limit ? `${LIMIT_LABEL[limit]} 한도에 도달했어요` : '요금제 한도에 도달했어요'}</div>
        {!compact && <div className="mt-0.5 text-muted break-keep">{message ?? `현재 ${plan.name} 플랜이에요. 상위 플랜으로 올리면 한도가 늘어나요.`}</div>}
      </div>
      <Button size="sm" variant="primary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => navigate('/settings/billing')}>요금제 보기</Button>
    </div>
  )
}

/** Global upgrade dialog driven by `openUpgrade()` / `handlePlanLimit()`. Mount once inside the router. */
export function UpgradePromptHost() {
  const { open, limit, message, close } = useUpgradePrompt()
  const navigate = useNavigate()
  const ws = useWorkspace()
  const plan = planById(ws.plan)
  const admin = ws.role === 'owner' || ws.role === 'admin'
  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" />{limit ? `${LIMIT_LABEL[limit]} 한도에 도달했어요` : '더 큰 요금제가 필요해요'}</span>}
      description={message}
      footer={
        <>
          <Button variant="ghost" onClick={close}>닫기</Button>
          <Button variant="primary" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => { close(); navigate('/settings/billing') }}>
            {admin ? '요금제 비교하기' : '요금제 보기'}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-muted break-keep">
        지금 워크스페이스는 <b className="text-fg">{plan.name}</b> 플랜이에요. Pro와 Business는 14일 무료 체험으로 먼저 써 볼 수 있어요.
        {!admin && ' 요금제 변경은 워크스페이스 소유자나 관리자에게 요청해 주세요.'}
      </p>
    </Modal>
  )
}
