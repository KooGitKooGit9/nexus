import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'pink' | 'cyan'

const tones: Record<Tone, string> = {
  neutral: 'bg-line/[0.06] text-muted border-line/10',
  accent: 'bg-accent/15 text-accent border-accent/25',
  success: 'bg-success/15 text-success border-success/25',
  warning: 'bg-warning/15 text-warning border-warning/25',
  danger: 'bg-danger/15 text-danger border-danger/25',
  info: 'bg-info/15 text-info border-info/25',
  pink: 'bg-accent-3/15 text-accent-3 border-accent-3/25',
  cyan: 'bg-accent-2/15 text-accent-2 border-accent-2/25',
}

export function Badge({ children, tone = 'neutral', className, dot, icon }: { children: ReactNode; tone?: Tone; className?: string; dot?: boolean; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  )
}

/** Small round counter (unread etc.) */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span className={cn('inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-accent-gradient px-1 text-[10px] font-bold text-white shadow-glow-sm', className)}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
