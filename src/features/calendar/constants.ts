import { Coffee, Flag, PartyPopper, Plane, Target, Users, type LucideIcon } from 'lucide-react'
import { hashIndex } from '@/lib/utils'
import { getUser } from '@/store/core'
import type { EventType } from './types'

export const HOUR_H = 52 // px per hour in the time grid
export const SNAP_MIN = 15

export interface TypeMeta {
  label: string
  color: string
  emoji: string
  icon: LucideIcon
}

export const TYPE_META: Record<EventType, TypeMeta> = {
  meeting: { label: '회의', color: '#8b5cf6', emoji: '👥', icon: Users },
  focus: { label: '집중', color: '#06b6d4', emoji: '🎯', icon: Target },
  personal: { label: '개인', color: '#ec4899', emoji: '🌿', icon: Coffee },
  deadline: { label: '마감', color: '#f59e0b', emoji: '⏰', icon: Flag },
  holiday: { label: '휴일', color: '#f43f5e', emoji: '🎌', icon: PartyPopper },
  ooo: { label: '부재', color: '#10b981', emoji: '🌴', icon: Plane },
}

export const EVENT_TYPES = Object.keys(TYPE_META) as EventType[]
/** Types a user can create (holidays are system-generated). */
export const CREATABLE_TYPES: EventType[] = ['meeting', 'focus', 'personal', 'deadline', 'ooo']

export interface Room {
  id: string
  name: string
  capacity: number
  floor: string
  emoji: string
  perks: string
}

export const ROOMS: Room[] = [
  { id: 'orion', name: 'Orion', capacity: 10, floor: '12F', emoji: '🌌', perks: '85" 디스플레이 · 화상 장비' },
  { id: 'lyra', name: 'Lyra', capacity: 6, floor: '12F', emoji: '🎼', perks: '화이트보드 · 화상 장비' },
  { id: 'vega', name: 'Vega', capacity: 4, floor: '11F', emoji: '✨', perks: '포커스 룸 · 방음' },
  { id: 'nova', name: 'Nova', capacity: 30, floor: '15F 라운지', emoji: '💫', perks: '타운홀 · 무대 · 마이크' },
]

export const roomById = (id?: string) => ROOMS.find((r) => r.id === id)

/** Hex for the `from-*` color of each entry in utils GRADIENTS (same order). */
const GRADIENT_HEX = ['#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#ec4899', '#6366f1', '#38bdf8', '#a3e635']

/** Solid color matching a user's avatar gradient. */
export function userColor(userId: string): string {
  const u = getUser(userId)
  return GRADIENT_HEX[hashIndex(u?.color ?? userId, GRADIENT_HEX.length)]
}

/** Swatches for the custom event color picker. */
export const COLOR_SWATCHES = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899']

/** "#rrggbb" + alpha → rgba() */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
