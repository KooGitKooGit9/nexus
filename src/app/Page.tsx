import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Standard scrollable page container. Full-bleed apps (messenger, whiteboard, calendar)
 * can skip this and fill the parent (`h-full`) themselves.
 */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className={cn('mx-auto w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-7', wide ? 'max-w-[1700px]' : 'max-w-[1400px]', className)}>{children}</div>
    </div>
  )
}
