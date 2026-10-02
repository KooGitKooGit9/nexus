export interface KeyResultCheckIn {
  id: string
  at: string // ISO
  value: number
  userId: string
  note?: string
}

export interface KeyResult {
  id: string
  title: string
  current: number
  target: number
  unit: string // '%', '건', '억원', ...
  ownerId: string
  /** starting value (defaults to 0) — progress = (current-start)/(target-start) */
  start?: number
  /** check-in history (newest last) */
  history?: KeyResultCheckIn[]
}

export interface Objective {
  id: string
  title: string
  quarter: string // '2026 Q4'
  ownerId: string
  team: string
  keyResults: KeyResult[]
  status: 'on_track' | 'at_risk' | 'off_track' | 'done'
  parentId?: string // company objective alignment
  description?: string
  emoji?: string
  createdAt?: string
  updatedAt?: string
}

export type AnnouncementCategory = '전사공지' | '인사' | '제품' | '이벤트' | 'IT'

export interface Announcement {
  id: string
  title: string
  body: string // markdown
  authorId: string
  createdAt: string
  pinned?: boolean
  category: AnnouncementCategory
  reactions: Record<string, string[]>
  readBy: string[]
  cover?: string // CSS gradient
  /** emoji shown on the cover */
  emoji?: string
}
