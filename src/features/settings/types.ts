import type { NotificationType } from '@/store/types'

export type Density = 'compact' | 'comfortable' | 'spacious'

export interface Session {
  id: string
  kind: 'desktop' | 'mobile' | 'tablet'
  device: string
  os: string
  browser: string
  location: string
  ip: string
  lastActive: string
  current?: boolean
}

export type AuditCategory = 'auth' | 'member' | 'security' | 'data' | 'integration'

export interface AuditEntry {
  id: string
  actorId: string
  category: AuditCategory
  action: string
  target: string
  ip: string
  at: string
}

export interface IntegrationState {
  connected: boolean
  connectedAt?: string
  account?: string
}

export interface DndSchedule {
  enabled: boolean
  from: string // 'HH:mm'
  to: string // 'HH:mm'
  days: number[] // 0=일 ... 6=토
}

export type NotifPrefs = Record<NotificationType, boolean>
