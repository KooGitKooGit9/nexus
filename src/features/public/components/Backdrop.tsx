import { cn } from '@/lib/utils'

/** Aurora blobs + grid + noise for public pages (CSS animations stop under prefers-reduced-motion). */
export function Backdrop({ reduce, className, intensity = 1 }: { reduce?: boolean; className?: string; intensity?: number }) {
  const anim = (c: string) => (reduce ? '' : `${c} motion-reduce:animate-none`)
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden noise', className)}>
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_70%)]" />
      <div
        className={cn('absolute -left-[15%] -top-[25%] h-[80vh] w-[75vw] rounded-full blur-[120px]', anim('animate-aurora-1'))}
        style={{ background: `radial-gradient(circle, rgb(var(--accent) / calc(var(--aurora-opacity) * ${intensity})), transparent 65%)` }}
      />
      <div
        className={cn('absolute -right-[20%] -top-[15%] h-[70vh] w-[60vw] rounded-full blur-[120px]', anim('animate-aurora-2'))}
        style={{ background: `radial-gradient(circle, rgb(var(--accent-2) / calc(var(--aurora-opacity) * ${0.7 * intensity})), transparent 65%)` }}
      />
      <div
        className={cn('absolute left-[25%] top-[35%] h-[60vh] w-[55vw] rounded-full blur-[140px]', anim('animate-aurora-1'))}
        style={{ background: `radial-gradient(circle, rgb(var(--accent-3) / calc(var(--aurora-opacity) * ${0.4 * intensity})), transparent 65%)`, animationDelay: '-7s' }}
      />
    </div>
  )
}
