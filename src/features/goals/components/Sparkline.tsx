import { useId } from 'react'
import { motion } from 'framer-motion'

/** Tiny gradient-filled SVG sparkline. */
export function Sparkline({ values, width = 120, height = 36, color = 'rgb(var(--accent))', className }: { values: number[]; width?: number; height?: number; color?: string; className?: string }) {
  const id = useId().replace(/:/g, '')
  if (values.length < 2) return <div style={{ width, height }} className={className} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 3
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), pad + (1 - (v - min) / span) * (height - pad * 2)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${id})`} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
      <circle cx={last[0]} cy={last[1]} r={6} fill={color} opacity={0.25} />
    </svg>
  )
}
