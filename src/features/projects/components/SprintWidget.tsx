import { differenceInCalendarDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import { Timer, Target } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Project, Task } from '../types'
import { STATUS_META, hexA } from '../constants'

/** Tasks considered part of the project's current sprint. */
export function sprintTasks(project: Project, tasks: Task[]): Task[] {
  const sp = project.sprint
  if (!sp) return []
  const range = { start: startOfDay(new Date(sp.startDate)), end: endOfDay(new Date(sp.endDate)) }
  return tasks.filter((t) => {
    if (t.projectId !== project.id || t.status === 'backlog') return false
    if (t.status === 'in_progress' || t.status === 'review') return true
    if (t.status === 'done') return !!t.completedAt && isWithinInterval(new Date(t.completedAt), range)
    return !!t.dueDate && new Date(t.dueDate) <= range.end
  })
}

export function SprintWidget({ project, tasks, compact }: { project: Project; tasks: Task[]; compact?: boolean }) {
  const sp = project.sprint
  if (!sp) return null
  const st = sprintTasks(project, tasks)
  const total = st.reduce((s, t) => s + (t.estimate ?? 1), 0)
  const done = st.filter((t) => t.status === 'done').reduce((s, t) => s + (t.estimate ?? 1), 0)
  const pct = total ? Math.round((done / total) * 100) : 0
  const daysTotal = Math.max(1, differenceInCalendarDays(new Date(sp.endDate), new Date(sp.startDate)))
  const rawLeft = differenceInCalendarDays(new Date(sp.endDate), new Date())
  const daysLeft = Math.max(0, rawLeft)
  const elapsedPct = Math.min(100, Math.round(((daysTotal - daysLeft) / daysTotal) * 100))
  const behind = elapsedPct - pct > 15
  const segments = (['done', 'review', 'in_progress', 'todo'] as const).map((s) => ({ s, pts: st.filter((t) => t.status === s).reduce((a, t) => a + (t.estimate ?? 1), 0) }))

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl border border-line/[0.08] bg-surface/50 backdrop-blur-xl', compact ? 'px-3.5 py-2.5' : 'p-4')}
      style={{ boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.04), 0 0 40px -20px ${hexA(project.color, 0.8)}` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ background: hexA(project.color, 0.25) }} />
      <div className="relative flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: hexA(project.color, 0.16), color: project.color }}>
          {compact ? <span className="text-base">{project.emoji}</span> : <Timer className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-fg">{sp.name}</span>
            <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold', daysLeft <= 2 ? 'bg-danger/15 text-danger' : 'bg-line/[0.06] text-muted')}>
              {rawLeft < 0 ? '종료됨' : daysLeft === 0 ? '오늘 종료' : `D-${daysLeft}`}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-subtle">
            {compact && <span className="text-muted">{project.name} · </span>}
            {formatDate(sp.startDate, 'M.d')} – {formatDate(sp.endDate, 'M.d')} · {done}/{total}pt
            {behind && <span className="ml-1.5 text-warning">· 일정보다 뒤처짐</span>}
          </div>
        </div>
        <div className="shrink-0 font-display text-xl font-bold tabular-nums text-fg">{pct}<span className="text-xs text-subtle">%</span></div>
      </div>
      <div className="relative mt-3 flex h-1.5 overflow-hidden rounded-full bg-line/10">
        {segments.map(({ s, pts }, i) =>
          pts > 0 ? (
            <motion.div
              key={s}
              initial={{ width: 0 }}
              animate={{ width: `${(pts / Math.max(total, 1)) * 100}%` }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="h-full border-r-2 border-surface/80 last:border-r-0"
              style={{ background: STATUS_META[s].color, opacity: s === 'done' ? 1 : 0.55 }}
            />
          ) : null,
        )}
        <div className="absolute inset-y-0 w-0.5 bg-fg/70" style={{ left: `${elapsedPct}%` }} title={`경과 ${elapsedPct}%`} />
      </div>
      {!compact && sp.goal && (
        <div className="relative mt-3 flex items-start gap-1.5 text-[12px] text-muted">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          {sp.goal}
        </div>
      )}
    </div>
  )
}
