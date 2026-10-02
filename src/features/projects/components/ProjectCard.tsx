import { useRef, type MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { differenceInCalendarDays } from 'date-fns'
import { CalendarDays, AlertTriangle, Crown } from 'lucide-react'
import { Avatar, AvatarStack } from '@/components/ui'
import { getUser } from '@/store/core'
import { cn, formatDate } from '@/lib/utils'
import type { Project, Task } from '../types'
import { STATUSES, STATUS_META, hexA, ink, isOverdue, projectProgress } from '../constants'

export function ColorRing({ value, color, size = 54, stroke = 5, children }: { value: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ filter: `drop-shadow(0 0 6px ${hexA(color, 0.55)})` }}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className="stroke-line/10" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke={color} strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (Math.max(0, Math.min(100, value)) / 100) * c }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function ProjectCard({ project, tasks, onOpen, index = 0 }: { project: Project; tasks: Task[]; onOpen: () => void; index?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const pct = projectProgress(tasks)
  const overdue = tasks.filter(isOverdue).length
  const daysLeft = differenceInCalendarDays(new Date(project.endDate), new Date())
  const total = tasks.length || 1
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = ref.current!.getBoundingClientRect()
    ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`)
    ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      onMouseMove={onMove}
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-3xl border border-line/[0.08] bg-surface/55 p-5 backdrop-blur-xl transition-[border-color,box-shadow] duration-300"
      style={{ boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.04), 0 18px 40px -24px ${hexA(project.color, 0.6)}` }}
    >
      {/* glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-80" style={{ background: project.color }} />
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(380px circle at var(--mx) var(--my), ${hexA(project.color, 0.14)}, transparent 45%)` }} />
      <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ boxShadow: `inset 0 0 0 1px ${hexA(project.color, 0.45)}` }} />

      <div className="relative flex items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ background: hexA(project.color, 0.16), boxShadow: `inset 0 0 0 1px ${hexA(project.color, 0.35)}, 0 8px 24px -8px ${hexA(project.color, 0.8)}` }}>
          {project.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold" style={{ color: ink(project.color) }}>{project.key}</span>
            {overdue > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger"><AlertTriangle className="h-2.5 w-2.5" />지연 {overdue}</span>
            )}
          </div>
          <h3 className="mt-0.5 truncate text-[16px] font-bold tracking-tight text-fg">{project.name}</h3>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{project.description}</p>
        </div>
        <ColorRing value={pct} color={project.color}>
          <span className="font-display text-[13px] font-bold text-fg tabular-nums">{pct}<span className="text-[9px] text-subtle">%</span></span>
        </ColorRing>
      </div>

      <div className="relative mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-subtle">
          <span>{tasks.filter((t) => t.status === 'done').length}/{tasks.length} 완료</span>
          <span className="flex gap-2.5">
            {STATUSES.filter((s) => s !== 'done').map((s) => {
              const n = tasks.filter((t) => t.status === s).length
              return n ? <span key={s} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[s].color }} />{n}</span> : null
            })}
          </span>
        </div>
        <div className="flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-line/10">
          {STATUSES.map((s, i) => {
            const n = tasks.filter((t) => t.status === s).length
            if (!n) return null
            return (
              <motion.span
                key={s}
                title={`${STATUS_META[s].label} ${n}`}
                initial={{ width: 0 }}
                animate={{ width: `${(n / total) * 100}%` }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="h-full"
                style={{ background: STATUS_META[s].color }}
              />
            )
          })}
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line/[0.06] pt-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative">
            <Avatar userId={project.leadId} size="sm" />
            <Crown className="absolute -right-1 -top-1.5 h-3 w-3 text-warning drop-shadow" />
          </div>
          <div className="min-w-0 text-[11.5px] leading-tight">
            <div className="truncate whitespace-nowrap font-medium text-fg">{getUser(project.leadId)?.name}</div>
            <div className="text-subtle">리드</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <AvatarStack userIds={project.memberIds.filter((m) => m !== project.leadId)} size="xs" max={4} />
          <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium', daysLeft < 0 ? 'bg-danger/15 text-danger' : daysLeft <= 14 ? 'bg-warning/15 text-warning' : 'bg-line/[0.06] text-muted')}>
            <CalendarDays className="h-3 w-3" />
            {formatDate(project.endDate, 'M.d')} · {daysLeft < 0 ? `${-daysLeft}일 초과` : `D-${daysLeft}`}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
