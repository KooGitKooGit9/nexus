import { Fragment, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui'
import { getDef } from '../catalog'

/** Animated number that counts up from 0 when mounted / when value changes. */
export function CountUp({ value, duration = 1.3, decimals = 0, suffix, className }: { value: number; duration?: number; decimals?: number; suffix?: string; className?: string }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const startVal = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000))
      const eased = 1 - Math.pow(1 - p, 4)
      const v = startVal + (value - startVal) * eased
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return (
    <span className={cn('tabular-nums', className)}>
      {shown.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}

/** Gradient icon tile for a node kind. */
export function NodeIcon({ kind, size = 'md', className }: { kind: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const def = getDef(kind)
  const Icon = def.icon
  const sz = { xs: 'h-5 w-5 rounded-md [&>svg]:h-3 [&>svg]:w-3', sm: 'h-7 w-7 rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5', md: 'h-10 w-10 rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]', lg: 'h-12 w-12 rounded-2xl [&>svg]:h-5 [&>svg]:w-5' }[size]
  return (
    <div className={cn('relative flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm', def.gradient, sz, className)}>
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/25 to-transparent" />
      <Icon className="relative" />
    </div>
  )
}

/** Tiny chain of node icons — preview of a workflow's main path. */
export function MiniFlow({ kinds, className, size = 'xs' }: { kinds: string[]; className?: string; size?: 'xs' | 'sm' }) {
  return (
    <div className={cn('flex items-center', className)}>
      {kinds.map((k, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div className="relative mx-0.5 h-px w-3 overflow-hidden bg-line/15">
              <motion.div
                className="absolute inset-y-0 w-2 bg-gradient-to-r from-transparent via-accent to-transparent"
                initial={{ x: -8 }}
                animate={{ x: 14 }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'linear', repeatDelay: 1.4 }}
              />
            </div>
          )}
          <Tooltip content={getDef(k).label}>
            <NodeIcon kind={k} size={size} />
          </Tooltip>
        </Fragment>
      ))}
    </div>
  )
}

/** Bar sparkline (success + failed stacked). */
export function RunSparkline({ data, className, height = 28 }: { data: { total: number; failed: number }[]; className?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.total))
  const w = 100 / data.length
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }}>
      <defs>
        <linearGradient id="wf-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent-2))" />
          <stop offset="100%" stopColor="rgb(var(--accent))" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const h = d.total ? Math.max(2, (d.total / max) * (height - 2)) : 1.5
        const fh = d.total ? (d.failed / d.total) * h : 0
        return (
          <g key={i}>
            <rect x={i * w + w * 0.18} y={height - h} width={w * 0.64} height={h - fh} rx={1} fill={d.total ? 'url(#wf-spark)' : 'rgb(var(--line) / 0.12)'} opacity={d.total ? 0.55 + 0.45 * (i / data.length) : 1} />
            {fh > 0 && <rect x={i * w + w * 0.18} y={height - fh} width={w * 0.64} height={fh} rx={1} fill="rgb(var(--danger))" />}
          </g>
        )
      })}
    </svg>
  )
}

export function RunStatusDot({ status }: { status: 'success' | 'failed' | 'running' | undefined }) {
  const c = status === 'success' ? 'bg-success' : status === 'failed' ? 'bg-danger' : status === 'running' ? 'bg-info' : 'bg-subtle'
  return (
    <span className="relative inline-flex h-2 w-2">
      {status === 'running' && <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', c)} />}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', c)} />
    </span>
  )
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}초`
  return `${Math.floor(ms / 60_000)}분 ${Math.round((ms % 60_000) / 1000)}초`
}
