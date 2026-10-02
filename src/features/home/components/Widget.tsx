import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

/** Bento-grid widget shell: staggered fade-in, spotlight card, header with gradient icon. */
export function Widget({
  title, subtitle, icon, action, children, className, delay = 0, gradient = 'from-violet-500 to-fuchsia-500', bodyClassName,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  delay?: number
  gradient?: string
}) {
  return (
    <motion.div
      className={cn('min-w-0', className)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card spotlight padded={false} className="flex h-full flex-col transition-[border-color] duration-300 hover:border-line/15">
        <div className="relative flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md [&>svg]:h-3.5 [&>svg]:w-3.5', gradient)}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-semibold text-fg">{title}</h3>
              {subtitle && <p className="truncate text-[11px] text-subtle">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
        <div className={cn('relative flex-1 px-5 pb-5', bodyClassName)}>{children}</div>
      </Card>
    </motion.div>
  )
}

export function WidgetLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-line/[0.06] hover:text-fg">
      {children}
    </button>
  )
}

export function MiniEmpty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 py-6 text-center">
      <div className="text-3xl animate-float">{emoji}</div>
      <div className="text-[13px] font-medium text-fg/90">{title}</div>
      {children && <div className="text-xs text-subtle">{children}</div>}
    </div>
  )
}
