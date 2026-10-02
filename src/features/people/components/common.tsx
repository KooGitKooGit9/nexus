import { Moon, Sun } from 'lucide-react'
import type { Department, User } from '@/store/types'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { useUI } from '@/store/core'
import { DEPT_META, isLocalNight, localTimeIn, tzDayShift, tzDiffHours } from '../lib'

/** Text color for a department hex: darkened in light mode (amber/lime/cyan are unreadable on white), raw in dark. */
export const DEPT_TEXT_CLS = '[color:color-mix(in_srgb,var(--dc)_62%,black)] dark:[color:var(--dc)]'
export const deptVar = (color: string) => ({ '--dc': color }) as React.CSSProperties

export function DeptBadge({ department, className, size = 'sm' }: { department: Department; className?: string; size?: 'sm' | 'md' }) {
  const meta = DEPT_META[department]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        DEPT_TEXT_CLS,
        className,
      )}
      style={{ ...deptVar(meta.color), borderColor: `${meta.color}40`, background: `${meta.color}18` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
      {department}
    </span>
  )
}

/** "오후 3:24" in the user's timezone + relative offset if different from viewer. */
export function LocalTime({ user, now, className, showIcon = true }: { user: User; now: Date; className?: string; showIcon?: boolean }) {
  const diff = tzDiffHours(user.timezone, now)
  const night = isLocalNight(user.timezone, now)
  const shift = tzDayShift(user.timezone, now)
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted', className)}>
      {showIcon && (night ? <Moon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" /> : <Sun className="h-3.5 w-3.5 text-amber-500 dark:text-amber-300" />)}
      <span className="tabular-nums">{shift !== 0 && <span className="mr-0.5 text-subtle">{shift < 0 ? '어제' : '내일'}</span>}{localTimeIn(user.timezone, now)}</span>
      {diff !== 0 && (
        <span className="whitespace-nowrap rounded-md bg-line/[0.07] px-1.5 py-px text-[10px] text-subtle">
          {diff > 0 ? '+' : ''}
          {diff}시간
        </span>
      )}
    </span>
  )
}

export function useQuickActions() {
  const navigate = useNavigate()
  return {
    message: (u: User) => navigate(`/messages?dm=${u.id}`),
    call: (u: User, video = false) => useUI.getState().startCall({ title: u.name, participantIds: [u.id], video }),
    profile: (u: User) => navigate(`/people/${u.id}`),
  }
}

export function Chip({ active, onClick, children, color, count }: { active?: boolean; onClick?: () => void; children: React.ReactNode; color?: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
        active ? cn('border-transparent text-white shadow-glow-sm', !color && 'bg-accent-gradient') :'border-line/10 bg-line/[0.03] text-muted hover:text-fg hover:border-line/20',
      )}
      style={active ? { background: color ? `linear-gradient(135deg, ${color}, ${color}bb)` : undefined } : undefined}
    >
      {!active && color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      <span>{children}</span>
      {count !== undefined && (
        <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/20' : 'bg-line/10 text-subtle')}>{count}</span>
      )}
    </button>
  )
}
