import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn, gradientFor, initials } from '@/lib/utils'

/** Gradient initials bubble (no store lookups — pure presentational for the marketing mockups). */
export function Face({ name, size = 28, className, ring }: { name: string; size?: number; className?: string; ring?: boolean }) {
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white', gradientFor(name), ring && 'ring-2 ring-surface', className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

/** Section wrapper with eyebrow + title + lead, revealed on scroll. */
export function Section({ id, eyebrow, title, lead, children, className, center = true }: { id?: string; eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; children?: ReactNode; className?: string; center?: boolean }) {
  return (
    <section id={id} className={cn('relative scroll-mt-20 px-4 py-20 sm:px-6 md:py-28', className)}>
      <div className="mx-auto max-w-6xl">
        <Reveal className={cn('max-w-3xl', center && 'mx-auto text-center')}>
          {eyebrow && (
            <div className={cn('mb-4 inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[12px] font-semibold text-accent [&>svg]:h-3.5 [&>svg]:w-3.5')}>{eyebrow}</div>
          )}
          <h2 className="font-display text-[30px] font-bold leading-[1.15] tracking-tight break-keep sm:text-4xl md:text-[44px]">{title}</h2>
          {lead && <p className="mt-4 text-[16px] leading-relaxed text-muted break-keep md:text-[17px]">{lead}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  )
}

export function Reveal({ children, className, delay = 0, y = 18 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-current animate-typing-dot motion-reduce:animate-none" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  )
}
