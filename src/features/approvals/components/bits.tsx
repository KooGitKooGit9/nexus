import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { KIND_META, STATUS_META } from '../meta'
import type { ApprovalKind, ApprovalStatus } from '../types'

export function KindIcon({ kind, size = 'md', className }: { kind: ApprovalKind; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const m = KIND_META[kind]
  const Icon = m.icon
  const sz = {
    sm: 'h-7 w-7 rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5',
    md: 'h-10 w-10 rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]',
    lg: 'h-12 w-12 rounded-2xl [&>svg]:h-5 [&>svg]:w-5',
    xl: 'h-16 w-16 rounded-[22px] [&>svg]:h-7 [&>svg]:w-7',
  }[size]
  return (
    <div className={cn('relative flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-md', m.gradient, sz, className)}>
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/30 to-transparent" />
      <Icon className="relative" />
    </div>
  )
}

export function StatusBadge({ status, className }: { status: ApprovalStatus; className?: string }) {
  const m = STATUS_META[status]
  return <Badge tone={m.tone} dot className={className}>{m.label}</Badge>
}

/**
 * Red ink seal (도장). Animates like being stamped onto paper.
 * `animate=false` renders it static (e.g. in thumbnails).
 */
export function Seal({ text, sub, variant = 'approve', size = 60, delay = 0, animate = true }: { text: string; sub?: string; variant?: 'approve' | 'reject' | 'draft'; size?: number; delay?: number; animate?: boolean }) {
  const fid = useId().replace(/:/g, '')
  const color = variant === 'reject' ? '#b91c1c' : variant === 'draft' ? '#c2410c' : '#dc2626'
  const rot = variant === 'reject' ? 8 : variant === 'draft' ? -4 : -12
  const seal = (
    <svg width={size} height={size} viewBox="0 0 100 100" className="overflow-visible">
      <defs>
        <filter id={`ink-${fid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={text.length * 7} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.3" result="mask" />
          <feComposite in="SourceGraphic" in2="mask" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#ink-${fid})`} fill="none" stroke={color}>
        {variant === 'reject' ? (
          <>
            <rect x="8" y="8" width="84" height="84" rx="10" strokeWidth="6" />
            <rect x="17" y="17" width="66" height="66" rx="5" strokeWidth="2" />
          </>
        ) : (
          <>
            <circle cx="50" cy="50" r="44" strokeWidth="6" />
            <circle cx="50" cy="50" r="35" strokeWidth="2" />
          </>
        )}
        <text x="50" y={sub ? 52 : 59} textAnchor="middle" fill={color} stroke="none" fontSize={text.length > 2 ? 21 : 27} fontWeight={900} fontFamily="'Nanum Myeongjo', 'Batang', serif" letterSpacing={text.length > 2 ? 0 : 2}>
          {text}
        </text>
        {sub && (
          <text x="50" y="70" textAnchor="middle" fill={color} stroke="none" fontSize="11" fontWeight={700} fontFamily="ui-monospace, monospace">
            {sub}
          </text>
        )}
      </g>
    </svg>
  )
  if (!animate) return <div style={{ transform: `rotate(${rot}deg)`, opacity: 0.9 }}>{seal}</div>
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* ink splash ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${color}` }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1.7], opacity: [0, 0.5, 0] }}
        transition={{ delay: delay + 0.22, duration: 0.6, ease: 'easeOut' }}
      />
      <motion.div
        initial={{ scale: 2.6, opacity: 0, rotate: rot - 28, filter: 'blur(3px)' }}
        animate={{ scale: [2.6, 0.88, 1.04, 1], opacity: [0, 1, 0.92, 0.9], rotate: rot, filter: 'blur(0px)' }}
        transition={{ delay, duration: 0.55, times: [0, 0.45, 0.75, 1], ease: 'easeOut' }}
        style={{ mixBlendMode: 'normal' }}
      >
        {seal}
      </motion.div>
    </div>
  )
}
