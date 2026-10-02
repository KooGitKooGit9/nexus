import { useCore } from '@/store/core'

/** Animated aurora gradient blobs + grid + noise behind the whole app. */
export function AuroraBackground() {
  const reduce = useCore((s) => s.reduceMotion)
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden noise">
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div
        className={`absolute -top-[30%] -left-[10%] h-[70vh] w-[70vw] rounded-full blur-[120px] ${reduce ? '' : 'animate-aurora-1'}`}
        style={{ background: 'radial-gradient(circle, rgb(var(--accent) / var(--aurora-opacity)), transparent 65%)' }}
      />
      <div
        className={`absolute -top-[20%] right-[-15%] h-[60vh] w-[55vw] rounded-full blur-[120px] ${reduce ? '' : 'animate-aurora-2'}`}
        style={{ background: 'radial-gradient(circle, rgb(var(--accent-2) / calc(var(--aurora-opacity) * 0.7)), transparent 65%)' }}
      />
      <div
        className={`absolute bottom-[-30%] left-[30%] h-[60vh] w-[50vw] rounded-full blur-[140px] ${reduce ? '' : 'animate-aurora-1'}`}
        style={{ background: 'radial-gradient(circle, rgb(var(--accent-3) / calc(var(--aurora-opacity) * 0.45)), transparent 65%)', animationDelay: '-7s' }}
      />
    </div>
  )
}
