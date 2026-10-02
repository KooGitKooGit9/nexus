import { useRef, type HTMLAttributes, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  /** Mouse-following radial spotlight glow — use on hero/feature cards */
  spotlight?: boolean
  padded?: boolean
}

export function Card({ hover, spotlight, padded = true, className, children, onMouseMove, ...props }: CardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (spotlight && ref.current) {
      const r = ref.current.getBoundingClientRect()
      ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`)
      ref.current.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    onMouseMove?.(e)
  }
  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={cn('glass relative rounded-2xl overflow-hidden', padded && 'p-5', hover && 'card-hover', spotlight && 'group/spot', className)}
      {...props}
    >
      {spotlight && (
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
          style={{ background: 'radial-gradient(420px circle at var(--mx) var(--my), rgb(var(--accent) / 0.14), transparent 45%)' }}
        />
      )}
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, icon, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-[15px] text-fg truncate">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}
