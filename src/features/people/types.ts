export type WorkMode = 'office' | 'remote' | 'field' | 'leave'

export interface WorkSession {
  in: string // ISO
  out?: string // ISO
}

/** Current user's clock-in state for a single day. */
export interface ClockState {
  /** yyyy-MM-dd local */
  date: string
  sessions: WorkSession[]
  mode: Exclude<WorkMode, 'leave'>
}

export type LeaveType = 'annual' | 'half_am' | 'half_pm' | 'sick' | 'workshop'

export interface LeaveEntry {
  id: string
  userId: string
  type: LeaveType
  /** ISO dates (start of day) inclusive */
  start: string
  end: string
  note?: string
}

export interface LeaveBalance {
  annualTotal: number
  annualUsed: number
  halfTotal: number
  halfUsed: number
  sickTotal: number
  sickUsed: number
}

export type KudosBadge = 'collab' | 'impact' | 'challenge' | 'customer' | 'care' | 'growth'

export interface Kudos {
  id: string
  fromId: string
  toId: string
  badge: KudosBadge
  message: string
  createdAt: string
  /** emoji → userIds */
  reactions: Record<string, string[]>
}
