export type ApprovalKind = 'leave' | 'expense' | 'purchase' | 'travel' | 'access' | 'general'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface ApprovalStep {
  approverId: string
  status: 'waiting' | 'pending' | 'approved' | 'rejected'
  comment?: string
  decidedAt?: string
}

export type LeaveType = 'annual' | 'half_am' | 'half_pm' | 'sick' | 'family'

export interface LineItem {
  id: string
  name: string
  /** category (expense) */
  category?: string
  qty?: number
  /** unit price for purchase, amount for expense (KRW) */
  amount: number
}

export interface ApprovalRequest {
  id: string
  kind: ApprovalKind
  title: string
  requesterId: string
  createdAt: string
  status: ApprovalStatus
  steps: ApprovalStep[] // sequential approval chain
  amount?: number // KRW
  startDate?: string
  endDate?: string
  details?: string
  attachments?: string[]

  /* ───── optional, owned by approvals feature ───── */
  /** 문서번호, e.g. "AUR-2026-1042" */
  docNo?: string
  /** 참조자 */
  ccIds?: string[]
  leaveType?: LeaveType
  /** leave day count (0.5 for half day) */
  days?: number
  items?: LineItem[]
  vendor?: string
  destination?: string
  purpose?: string
  /** access request */
  system?: string
  accessLevel?: string
  urgent?: boolean
  completedAt?: string
}
