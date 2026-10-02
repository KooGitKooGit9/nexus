import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-line/15 bg-line/[0.06] px-1.5 font-mono text-[10px] font-medium text-muted', className)}>{children}</kbd>
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      {icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-3xl bg-accent-gradient blur-2xl opacity-40" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl glass text-accent [&>svg]:h-7 [&>svg]:w-7 animate-float">{icon}</div>
        </div>
      )}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Consistent page header used at the top of every feature page. */
export function PageHeader({ icon, title, subtitle, actions, className, children }: { icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-4 mb-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
          {icon && (
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-accent-gradient blur-lg opacity-50" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow-sm [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-fg break-keep [overflow-wrap:anywhere]">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted break-keep [overflow-wrap:anywhere]">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function Progress({ value, className, tone = 'accent', size = 'md' }: { value: number; className?: string; tone?: 'accent' | 'success' | 'warning' | 'danger'; size?: 'sm' | 'md' }) {
  const bg = { accent: 'bg-accent-gradient', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[tone]
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-line/10', size === 'sm' ? 'h-1.5' : 'h-2', className)}>
      <motion.div className={cn('h-full rounded-full', bg)} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  )
}

export function ProgressRing({ value, size = 56, stroke = 6, children, className }: { value: number; size?: number; stroke?: number; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gid = `pr-${size}-${stroke}`
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" />
            <stop offset="100%" stopColor="rgb(var(--accent-2))" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-line/10" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke={`url(#${gid})`} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (Math.max(0, Math.min(100, value)) / 100) * c }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">{children}</div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg', className)} />
}

export function Divider({ label, className }: { label?: ReactNode; className?: string }) {
  if (!label) return <div className={cn('h-px bg-line/10', className)} />
  return (
    <div className={cn('flex items-center gap-3 text-[11px] font-medium text-subtle', className)}>
      <div className="h-px flex-1 bg-line/10" />
      {label}
      <div className="h-px flex-1 bg-line/10" />
    </div>
  )
}

/** Fade/slide-in wrapper for staggered lists & page sections. */
export function FadeIn({ children, delay = 0, className, y = 12 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  )
}
