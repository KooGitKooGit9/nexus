export type Presence = 'online' | 'away' | 'dnd' | 'offline'

export type Department = '경영' | '제품' | '엔지니어링' | '디자인' | '마케팅' | '영업' | '피플팀'

export interface User {
  id: string
  name: string
  nameEn: string
  title: string
  department: Department
  email: string
  phone: string
  location: string
  timezone: string
  managerId: string | null
  presence: Presence
  statusEmoji?: string
  statusText?: string
  bio?: string
  skills: string[]
  joinedAt: string
  birthday: string // MM-DD
  /** Accent gradient key override (optional). Avatar falls back to hash of id. */
  color?: string
}

export type NotificationType = 'mention' | 'message' | 'task' | 'approval' | 'event' | 'workflow' | 'system' | 'doc'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body?: string
  /** In-app route to open, e.g. "/messages/c_general" */
  link?: string
  actorId?: string
  createdAt: string
  read: boolean
}

export type ToastVariant = 'default' | 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  /** emoji shown in the toast bubble */
  emoji?: string
  actorId?: string
  duration?: number
}
