import type { ReactNode } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { Backdrop } from './Backdrop'
import { useReduce, useThemeSync } from '../lib'

/**
 * Full-screen centered card over the aurora. Router-independent (plain <a> links) so it also works for the
 * invite / onboarding screens that App.tsx renders outside any router.
 */
export function AuthShell({
  children,
  title,
  subtitle,
  footer,
  width = 'md',
  aside,
  topRight,
}: {
  children: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
  /** optional decorative column on wide screens */
  aside?: ReactNode
  topRight?: ReactNode
}) {
  useThemeSync()
  const reduce = useReduce()
  const max = { sm: 'max-w-sm', md: 'max-w-[440px]', lg: 'max-w-xl' }[width]
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative isolate h-full overflow-y-auto overflow-x-hidden">
        <Backdrop reduce={reduce} className="fixed" />
        <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 sm:px-6">
          <div className="flex h-16 shrink-0 items-center justify-between gap-3">
            <a href="/" className="focus-ring rounded-xl" aria-label="홈으로">
              <Logo />
            </a>
            <div className="flex items-center gap-1.5">
              {topRight}
              <ThemeToggle />
            </div>
          </div>
          <div className={cn('flex flex-1 items-center justify-center gap-12 py-8', aside && 'lg:justify-between')}>
            {aside && <div className="hidden max-w-md flex-1 lg:block">{aside}</div>}
            <motion.main
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={cn('w-full', max)}
            >
              <div className="glass-strong rounded-[28px] p-6 shadow-float sm:p-8">
                {(title || subtitle) && (
                  <div className="mb-6">
                    {title && <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight break-keep">{title}</h1>}
                    {subtitle && <p className="mt-1.5 text-[14px] leading-relaxed text-muted break-keep">{subtitle}</p>}
                  </div>
                )}
                {children}
              </div>
              {footer && <div className="mt-5 text-center text-[13.5px] text-muted">{footer}</div>}
            </motion.main>
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}
