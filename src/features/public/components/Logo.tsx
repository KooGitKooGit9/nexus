import { BRAND } from '@/config/brand'
import { cn } from '@/lib/utils'

/** Gradient "N" mark + wordmark. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-0 rounded-[30%] bg-accent-gradient opacity-60 blur-md" />
      <span
        className="relative flex h-full w-full items-center justify-center rounded-[30%] bg-accent-gradient-3 bg-[length:200%_200%] font-display font-bold text-white animate-gradient-x motion-reduce:animate-none"
        style={{ fontSize: size * 0.5 }}
      >
        N
      </span>
    </span>
  )
}

export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className="font-display text-lg font-bold tracking-tight text-fg">{BRAND.name}</span>
    </span>
  )
}
