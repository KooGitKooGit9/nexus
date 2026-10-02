import { useId, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface TabItem<T extends string> { value: T; label: ReactNode; icon?: ReactNode; count?: number }

/** Segmented control with an animated sliding pill. */
export function Tabs<T extends string>({ items, value, onChange, className, size = 'md' }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  const id = useId()
  return (
    <div className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto scrollbar-none rounded-xl bg-line/[0.05] border border-line/[0.08] p-1', className)}>
      {items.map((it) => {
        const active = it.value === value
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            className={cn('relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]', active ? 'text-fg' : 'text-muted hover:text-fg')}
          >
            {active && (
              <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-lg bg-surface shadow-card border border-line/10" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            <span className="relative flex items-center gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5">
              {it.icon}
              {it.label}
              {it.count !== undefined && <span className="text-[10px] text-subtle">{it.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Underline-style tabs for page sections. */
export function UnderlineTabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-5 border-b border-line/10', className)}>
      {items.map((it) => {
        const active = it.value === value
        return (
          <button key={it.value} onClick={() => onChange(it.value)} className={cn('relative flex items-center gap-1.5 pb-2.5 pt-1 text-sm font-medium transition-colors [&>svg]:h-4 [&>svg]:w-4', active ? 'text-fg' : 'text-muted hover:text-fg')}>
            {it.icon}
            {it.label}
            {it.count !== undefined && <span className="rounded-full bg-line/10 px-1.5 text-[10px]">{it.count}</span>}
            {active && <motion.span layoutId={`utab-${id}`} className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-accent-gradient" />}
          </button>
        )
      })}
    </div>
  )
}
