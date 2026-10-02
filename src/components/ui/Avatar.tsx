import { useMemo } from 'react'
import { cn, gradientFor, initials } from '@/lib/utils'
import { useCore, useUser } from '@/store/core'
import type { Presence, User } from '@/store/types'
import { Bot } from 'lucide-react'
import { useSyncStatus } from '@/lib/sync'

/* ───────────── live presence (server mode) ─────────────
 * With the backend running, a member's dot reflects whether they really have Nexus open:
 * connected → their chosen status (online/away/dnd), disconnected after being seen this session →
 * offline. Members who never connected keep their seeded (simulated) status so the demo stays alive. */
const seenOnline = new Set<string>(useSyncStatus.getState().online)
useSyncStatus.subscribe((s) => s.online.forEach((id) => seenOnline.add(id)))

export function livePresence(u: Pick<User, 'id' | 'presence'>): Presence {
  const s = useSyncStatus.getState()
  if (s.mode !== 'server' || u.id === 'u_bot') return u.presence
  if (s.online.includes(u.id)) return u.presence === 'offline' ? 'online' : u.presence
  if (seenOnline.has(u.id)) return 'offline'
  return u.presence
}

/** Hook version of `livePresence` — re-renders when the member connects / disconnects. */
export function useLivePresence(u: Pick<User, 'id' | 'presence'> | undefined): Presence {
  const id = u?.id ?? ''
  // subscribe to the bits that matter for this user
  useSyncStatus((s) => `${s.mode}:${s.online.includes(id)}`)
  return u ? livePresence(u) : 'offline'
}

/** Workspace members with `presence` resolved live (see `livePresence`). */
export function useLiveUsers(): User[] {
  const users = useCore((s) => s.users)
  const online = useSyncStatus((s) => s.online)
  const mode = useSyncStatus((s) => s.mode)
  return useMemo(() => {
    if (mode !== 'server') return users
    return users.map((u) => {
      const p = livePresence(u)
      return p === u.presence ? u : { ...u, presence: p }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, online, mode])
}

/** Is this member connected right now (server mode)? */
export function useIsLive(userId: string | undefined): boolean {
  return useSyncStatus((s) => s.mode === 'server' && !!userId && s.online.includes(userId))
}

const sizeMap = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
  '2xl': 'h-28 w-28 text-4xl',
} as const

const dotSize = { xs: 'h-1.5 w-1.5', sm: 'h-2.5 w-2.5', md: 'h-3 w-3', lg: 'h-3.5 w-3.5', xl: 'h-5 w-5', '2xl': 'h-6 w-6' } as const

export const PRESENCE_COLOR: Record<Presence, string> = {
  online: 'bg-emerald-400',
  away: 'bg-amber-400',
  dnd: 'bg-rose-500',
  offline: 'bg-zinc-500',
}
export const PRESENCE_LABEL: Record<Presence, string> = { online: '온라인', away: '자리 비움', dnd: '방해 금지', offline: '오프라인' }

export function PresenceDot({ presence, className }: { presence: Presence; className?: string }) {
  return (
    <span className={cn('relative inline-flex rounded-full ring-2 ring-surface', PRESENCE_COLOR[presence], className)}>
      {presence === 'online' && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-ring" />}
    </span>
  )
}

interface AvatarProps {
  /** Either pass a user object or a userId */
  user?: User
  userId?: string
  size?: keyof typeof sizeMap
  showPresence?: boolean
  ring?: boolean
  className?: string
  /** square-ish rounded (for channels/workspaces) */
  square?: boolean
}

export function Avatar({ user, userId, size = 'md', showPresence, ring, className, square }: AvatarProps) {
  const fromStore = useUser(userId)
  const u = user ?? fromStore
  const presence = useLivePresence(u)
  if (!u) return <div title="나간 멤버" className={cn('flex shrink-0 items-center justify-center rounded-full bg-surface-3 text-subtle', sizeMap[size], className)}>?</div>
  const isBot = u.id === 'u_bot'
  return (
    <div className={cn('relative shrink-0', className)} title={u.name}>
      <div
        className={cn(
          'flex items-center justify-center font-semibold text-white bg-gradient-to-br select-none',
          square ? 'rounded-[30%]' : 'rounded-full',
          sizeMap[size],
          isBot ? 'from-slate-700 to-slate-900' : gradientFor(u.color ?? u.id),
          ring && 'ring-2 ring-bg',
        )}
      >
        {isBot ? <Bot className="h-1/2 w-1/2" /> : initials(u.name)}
      </div>
      {showPresence && (
        <PresenceDot presence={presence} className={cn('absolute -bottom-0.5 -right-0.5', dotSize[size])} />
      )}
    </div>
  )
}

export function AvatarStack({ userIds, max = 4, size = 'sm', className }: { userIds: string[]; max?: number; size?: keyof typeof sizeMap; className?: string }) {
  const shown = userIds.slice(0, max)
  const extra = userIds.length - shown.length
  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {shown.map((id) => (
        <Avatar key={id} userId={id} size={size} ring />
      ))}
      {extra > 0 && (
        <div className={cn('flex items-center justify-center rounded-full bg-surface-3 text-muted font-semibold ring-2 ring-bg', sizeMap[size])}>
          +{extra}
        </div>
      )}
    </div>
  )
}
