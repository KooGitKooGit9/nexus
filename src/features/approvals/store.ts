import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId, getUser, notify } from '@/store/core'
import { isUserOnline } from '@/lib/sync'
import { notifyMembers } from '@/app/notifyMembers'
import { particle } from './meta'
import { seedApprovals } from './seed'
import type { ApprovalRequest } from './types'

export type NewRequestInput = Omit<ApprovalRequest, 'id' | 'createdAt' | 'status' | 'steps' | 'docNo' | 'requesterId'> & {
  approverIds: string[]
}

interface ApprovalsState {
  requests: ApprovalRequest[]
  /** running doc number counter */
  nextDocNo: number

  createRequest: (input: NewRequestInput) => string
  approve: (id: string, comment?: string) => 'advanced' | 'completed' | null
  reject: (id: string, comment?: string) => boolean
  cancel: (id: string) => boolean
}

const now = () => new Date().toISOString()

/** Pending "first approver reacts" demo timers, keyed by request id — cleared when the request is decided/cancelled. */
const autoTimers = new Map<string, ReturnType<typeof setTimeout>>()
function clearAutoTimer(id: string) {
  const t = autoTimers.get(id)
  if (t !== undefined) {
    clearTimeout(t)
    autoTimers.delete(id)
  }
}

const link = (id: string) => `/approvals?id=${id}`
const nameOf = (id?: string) => getUser(id)?.name ?? ''

/** Tell the requester (and the next approver, if any) about a decision. `actorId` = who decided. */
function announceDecision(r: ApprovalRequest, actorId: string, decision: 'approved' | 'rejected', comment?: string) {
  const actor = nameOf(actorId) || '결재자'
  const nextStep = r.steps.find((s) => s.status === 'pending')
  const n = {
    type: 'approval' as const,
    title:
      decision === 'rejected'
        ? `${actor}님이 "${r.title}"${particle(r.title, '을/를')} 반려했습니다`
        : r.status === 'approved'
          ? `"${r.title}" 최종 승인되었습니다 🎉`
          : `${actor}님이 "${r.title}"${particle(r.title, '을/를')} 승인했습니다`,
    body: comment?.trim() || (decision === 'approved' && nextStep ? `다음 결재자: ${nameOf(nextStep.approverId)}` : r.docNo),
    link: link(r.id),
    actorId,
  }
  if (r.requesterId === getCurrentUserId()) {
    if (actorId !== r.requesterId) notify(n)
  } else notifyMembers([r.requesterId], n)
  if (decision === 'approved' && nextStep)
    notifyMembers([nextStep.approverId], {
      type: 'approval',
      title: `새 결재 요청: ${r.title}`,
      body: `${nameOf(r.requesterId)} · ${r.docNo ?? ''} · ${actor}님 승인 후 회원님 차례입니다`,
      link: link(r.id),
      actorId,
    })
}

export const useApprovals = create<ApprovalsState>()(
  persisted<ApprovalsState>(
    'approvals',
    (set, get) => ({
      requests: seedApprovals(),
      nextDocNo: 1049,

      createRequest: ({ approverIds, ...input }) => {
        const me = getCurrentUserId()
        const id = uid('apv')
        const docNo = `AUR-${new Date().getFullYear()}-${get().nextDocNo}`
        const req: ApprovalRequest = {
          ...input,
          id,
          docNo,
          requesterId: me,
          createdAt: now(),
          status: 'pending',
          steps: approverIds.map((a, i) => ({ approverId: a, status: i === 0 ? 'pending' : 'waiting' })),
        }
        set((s) => ({ requests: [req, ...s.requests], nextDocNo: s.nextDocNo + 1 }))

        const first = approverIds[0]
        notifyMembers([first], {
          type: 'approval',
          title: `새 결재 요청: ${req.title}`,
          body: `${nameOf(me)} · ${docNo}${req.urgent ? ' · 긴급' : ''}`,
          link: link(id),
        })
        notifyMembers((req.ccIds ?? []).filter((c) => !approverIds.includes(c)), {
          type: 'approval',
          title: `결재 참조: ${req.title}`,
          body: `${nameOf(me)}님이 회원님을 참조자로 지정했습니다`,
          link: link(id),
        })

        // Demo liveliness: a *simulated* first approver reacts a few seconds later — never when that
        // person is a real member who is online right now (they decide themselves).
        if (first && first !== me && !isUserOnline(first)) {
          autoTimers.set(id, setTimeout(() => {
            autoTimers.delete(id)
            const cur = get().requests.find((r) => r.id === id)
            if (!cur || cur.status !== 'pending' || cur.steps[0]?.status !== 'pending' || isUserOnline(first)) return
            set((s) => ({
              requests: s.requests.map((r) => {
                if (r.id !== id) return r
                const steps = r.steps.map((st, i) =>
                  i === 0 ? { ...st, status: 'approved' as const, decidedAt: now(), comment: '확인했습니다. 승인합니다 👍' } : i === 1 ? { ...st, status: 'pending' as const } : st,
                )
                const done = steps.length === 1
                return { ...r, steps, status: done ? 'approved' : 'pending', ...(done ? { completedAt: now() } : {}) }
              }),
            }))
            const updated = get().requests.find((r) => r.id === id)
            if (updated) announceDecision(updated, first, 'approved', '확인했습니다. 승인합니다 👍')
          }, 9000))
        }
        return id
      },

      approve: (id, comment) => {
        const r = get().requests.find((x) => x.id === id)
        if (!r || r.status !== 'pending') return null
        const idx = r.steps.findIndex((s) => s.status === 'pending')
        if (idx < 0) return null
        clearAutoTimer(id)
        const isLast = idx === r.steps.length - 1
        const steps = r.steps.map((s, i) =>
          i === idx ? { ...s, status: 'approved' as const, decidedAt: now(), comment: comment?.trim() || undefined } : i === idx + 1 ? { ...s, status: 'pending' as const } : s,
        )
        const next: ApprovalRequest = { ...r, steps, status: isLast ? 'approved' : 'pending', ...(isLast ? { completedAt: now() } : {}) }
        set((s) => ({ requests: s.requests.map((x) => (x.id === id ? next : x)) }))
        announceDecision(next, getCurrentUserId(), 'approved', comment)
        return isLast ? 'completed' : 'advanced'
      },

      reject: (id, comment) => {
        const r = get().requests.find((x) => x.id === id)
        if (!r || r.status !== 'pending') return false
        const idx = r.steps.findIndex((s) => s.status === 'pending')
        if (idx < 0) return false
        clearAutoTimer(id)
        const steps = r.steps.map((s, i) => (i === idx ? { ...s, status: 'rejected' as const, decidedAt: now(), comment: comment?.trim() || undefined } : s))
        const next: ApprovalRequest = { ...r, steps, status: 'rejected', completedAt: now() }
        set((s) => ({ requests: s.requests.map((x) => (x.id === id ? next : x)) }))
        announceDecision(next, getCurrentUserId(), 'rejected', comment)
        return true
      },

      cancel: (id) => {
        const r = get().requests.find((x) => x.id === id)
        if (!r || r.status !== 'pending') return false
        clearAutoTimer(id)
        const pendingOn = r.steps.find((st) => st.status === 'pending')?.approverId
        notifyMembers([pendingOn], { type: 'approval', title: `결재 회수: ${r.title}`, body: `${nameOf(r.requesterId)}님이 문서를 회수했습니다`, link: link(id) })
        set((s) => ({
          requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'cancelled', completedAt: now(), steps: x.steps.map((st) => (st.status === 'pending' ? { ...st, status: 'waiting' as const } : st)) } : x)),
        }))
        return true
      },
    }),
    {
      version: 2,
      // v1 was the empty skeleton → reseed
      migrate: () => ({ requests: seedApprovals(), nextDocNo: 1049 }) as unknown as ApprovalsState,
    },
  ),
)
syncAcrossTabs(useApprovals)

