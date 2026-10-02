import { useMemo } from 'react'
import { useApprovals } from '@/features/approvals/store'
import { ANNUAL_LEAVE_TOTAL, usedLeave } from '@/features/approvals/meta'
import type { ApprovalRequest } from '@/features/approvals/types'
import { usePeople } from './store'
import type { LeaveEntry, LeaveType } from './types'

/** Map an approved 전자결재 leave request onto the people-module leave calendar. */
function fromApproval(r: ApprovalRequest): LeaveEntry | null {
  if (r.kind !== 'leave' || r.status !== 'approved' || !r.startDate) return null
  const type: LeaveType = r.leaveType === 'family' ? 'annual' : (r.leaveType ?? 'annual')
  return {
    id: `apv:${r.id}`,
    userId: r.requesterId,
    type,
    start: r.startDate,
    end: r.endDate ?? r.startDate,
    note: r.leaveType === 'family' ? '경조사' : r.details?.split('\n')[0]?.slice(0, 30) || undefined,
  }
}

/** People seed leaves + leave requests approved in 전자결재 (kept in sync automatically). */
export function useAllLeaves(): LeaveEntry[] {
  const leaves = usePeople((s) => s.leaves)
  const requests = useApprovals((s) => s.requests)
  return useMemo(() => {
    const extra = (requests ?? []).map(fromApproval).filter((x): x is LeaveEntry => !!x)
    return [...leaves, ...extra]
  }, [leaves, requests])
}

export interface LeaveSummary {
  annualTotal: number
  annualUsed: number
  annualPending: number
  halfTotal: number
  halfUsed: number
  sickTotal: number
  sickUsed: number
}

/** Leave balance for a user — annual usage uses the same rule as 전자결재 so both screens agree. */
export function useLeaveSummary(userId: string): LeaveSummary {
  const b = usePeople((s) => s.balance)
  const requests = useApprovals((s) => s.requests)
  return useMemo(() => {
    const mine = (requests ?? []).filter((r) => r.kind === 'leave' && r.requesterId === userId)
    const approved = mine.filter((r) => r.status === 'approved')
    const halves = approved.filter((r) => r.leaveType === 'half_am' || r.leaveType === 'half_pm').length
    const sick = approved.filter((r) => r.leaveType === 'sick').reduce((n, r) => n + (r.days ?? 1), 0)
    const pending = mine
      .filter((r) => r.status === 'pending' && r.leaveType !== 'sick' && r.leaveType !== 'family')
      .reduce((n, r) => n + (r.days ?? 0), 0)
    return {
      annualTotal: ANNUAL_LEAVE_TOTAL,
      annualUsed: usedLeave(requests ?? [], userId),
      annualPending: pending,
      halfTotal: b.halfTotal,
      halfUsed: b.halfUsed + halves,
      sickTotal: b.sickTotal,
      sickUsed: b.sickUsed + sick,
    }
  }, [b, requests, userId])
}
