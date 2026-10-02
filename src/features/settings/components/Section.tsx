import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Glass card grouping related settings. */
export function SettingsSection({ title, description, icon, action, children, className, delay = 0 }: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('glass rounded-3xl p-6', className)}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</div>}
          <div>
            <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  )
}

/** Label/description on the left, control on the right. */
export function SettingRow({ label, description, children, icon, className }: { label: ReactNode; description?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-6 border-t border-line/[0.07] py-3.5 first:border-t-0 first:pt-0 last:pb-0', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-line/[0.06] text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</div>}
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-fg">{label}</div>
          {description && <div className="mt-0.5 text-[12px] text-muted">{description}</div>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
