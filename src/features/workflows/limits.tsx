/**
 * Free plan: up to 5 workflows per workspace (LAUNCH.md plan table). Demo workspaces are never limited.
 * The check is client-side UX; the server enforces the real limit.
 */
import { create } from 'zustand'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { canAdminWorkspace, currentWorkspace } from '@/lib/workspace'
import { useWorkflows } from './store'

export const FREE_WORKFLOW_LIMIT = 5

export function workflowLimitReached(count = useWorkflows.getState().workflows.length): boolean {
  const ws = currentWorkspace()
  return ws.kind !== 'demo' && ws.plan === 'free' && count >= FREE_WORKFLOW_LIMIT
}

const usePlanLimitModal = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }))

/** Returns true (and shows the upgrade dialog) when a new workflow would exceed the plan. */
export function blockIfWorkflowLimit(): boolean {
  if (!workflowLimitReached()) return false
  usePlanLimitModal.getState().set(true)
  return true
}

export function WorkflowLimitModal() {
  const open = usePlanLimitModal((s) => s.open)
  const close = () => usePlanLimitModal.getState().set(false)
  const navigate = useNavigate()
  const admin = canAdminWorkspace()
  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" />워크플로우를 더 만들려면 업그레이드가 필요해요</span>}
      footer={
        <>
          <Button variant="ghost" onClick={close}>닫기</Button>
          <Button variant="primary" onClick={() => { close(); navigate('/settings/billing') }}>{admin ? '요금제 보기' : '요금제 확인하기'}</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">
        무료 플랜에서는 워크스페이스당 워크플로우를 최대 <b className="text-fg">{FREE_WORKFLOW_LIMIT}개</b>까지 만들 수 있어요.
        사용하지 않는 워크플로우를 삭제하거나, Pro 플랜으로 업그레이드하면 제한 없이 만들 수 있어요.
      </p>
      {!admin && <p className="mt-2 text-xs text-subtle">요금제 변경은 워크스페이스 소유자나 관리자만 할 수 있어요.</p>}
    </Modal>
  )
}
