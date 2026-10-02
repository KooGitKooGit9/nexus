import { useId, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Progress ring with a custom two-stop gradient and soft glow. */
export function Ring({
  value, size = 56, stroke = 6, from = 'rgb(var(--accent))', to = 'rgb(var(--accent-2))', glow = true, children, className, track = 'stroke-line/10',
}: { value: number; size?: number; stroke?: number; from?: string; to?: string; glow?: boolean; children?: ReactNode; className?: string; track?: string }) {
  const id = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <defs>
          <linearGradient id={`rg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          {glow && (
            <filter id={`rf-${id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={stroke / 2.2} />
            </filter>
          )}
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className={cn('fill-none', track)} />
        {glow && v > 0 && (
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke={`url(#rg-${id})`} strokeLinecap="round" opacity={0.55}
            filter={`url(#rf-${id})`} strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (v / 100) * c }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke={`url(#rg-${id})`} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export const STATUS_GRADIENT: Record<string, [string, string]> = {
  on_track: ['#34d399', '#22d3ee'],
  at_risk: ['#fbbf24', '#fb923c'],
  off_track: ['#fb7185', '#f43f5e'],
  done: ['#a78bfa', '#f472b6'],
}
