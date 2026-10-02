/**
 * Plan-limit helpers other features can use when the server answers `402 { error: 'PLAN_LIMIT', limit, message }`.
 *
 *   try { await api.createInvites(...) } catch (e) { if (handlePlanLimit(e)) return; ... }
 *
 * `handlePlanLimit` / `openUpgrade` open a global upgrade dialog — mount `<UpgradePromptHost />` once inside the
 * app router (e.g. in Layout). `<PlanLimitNotice />` is an inline banner for forms/panels.
 */
import { create } from 'zustand'
import { ApiError } from '@/lib/api'

export type LimitKind = 'members' | 'storage' | 'ai' | 'workflows'

export const LIMIT_LABEL: Record<LimitKind, string> = {
  members: '멤버 수',
  storage: '저장공간',
  ai: 'AI 사용량',
  workflows: '자동화 워크플로우 수',
}

interface UpgradePromptState {
  open: boolean
  limit?: LimitKind
  message?: string
  show: (p: { limit?: LimitKind; message?: string }) => void
  close: () => void
}

export const useUpgradePrompt = create<UpgradePromptState>((set) => ({
  open: false,
  show: ({ limit, message }) => set({ open: true, limit, message }),
  close: () => set({ open: false }),
}))

/** Open the upgrade dialog (optionally explaining which limit was hit). */
export function openUpgrade(opts: { limit?: LimitKind; message?: string } = {}) {
  useUpgradePrompt.getState().show(opts)
}

export function isPlanLimitError(e: unknown): e is ApiError {
  return e instanceof ApiError && (e.code === 'PLAN_LIMIT' || e.status === 402)
}

export function planLimitKind(e: unknown): LimitKind | undefined {
  if (!(e instanceof ApiError)) return undefined
  const l = e.data.limit
  return l === 'members' || l === 'storage' || l === 'ai' || l === 'workflows' ? l : undefined
}

/** If `e` is a PLAN_LIMIT error, open the upgrade dialog and return true. */
export function handlePlanLimit(e: unknown): boolean {
  if (!isPlanLimitError(e)) return false
  openUpgrade({ limit: planLimitKind(e), message: e.message })
  return true
}

export { PlanLimitNotice, UpgradePromptHost } from './components/PlanLimitNotice'
