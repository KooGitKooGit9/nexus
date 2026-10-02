import { memo, type CSSProperties, type HTMLAttributes } from 'react'
import { MessageSquare, ListChecks } from 'lucide-react'
import { AvatarStack } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Project, Task } from '../types'
import { PRIORITY_META, hexA, isOverdue } from '../constants'
import { DueChip, LabelChip, PriorityIcon, StatusIcon } from './atoms'

interface TaskCardProps extends HTMLAttributes<HTMLDivElement> {
  task: Task
  project?: Project
  overlay?: boolean
  dragging?: boolean
  style?: CSSProperties
}

export const TaskCard = memo(function TaskCard({ task, project, overlay, dragging, className, style, ...rest }: TaskCardProps) {
  const key = `${project?.key ?? 'T'}-${task.number}`
  const subDone = task.subtasks.filter((s) => s.done).length
  const subTotal = task.subtasks.length
  const overdue = isOverdue(task)
  const done = task.status === 'done'
  const accent = project?.color ?? '#8b5cf6'
  return (
    <div
      {...rest}
      style={{
        ...style,
        ...(overlay ? { boxShadow: `0 0 0 1px ${hexA(accent, 0.55)}, 0 24px 48px -12px ${hexA(accent, 0.55)}, 0 0 40px -6px ${hexA(accent, 0.45)}` } : {}),
      }}
      className={cn(
        'group relative cursor-grab select-none rounded-xl border p-3 text-left transition-[border-color,box-shadow,transform,opacity] duration-200 active:cursor-grabbing',
        'border-line/[0.08] bg-surface/80 backdrop-blur-xl shadow-card',
        !overlay && 'hover:-translate-y-[1px] hover:border-accent/30 hover:shadow-[0_12px_30px_-14px_rgb(var(--accent)/0.55)]',
        dragging && 'opacity-30 border-dashed border-accent/40 bg-accent/5 shadow-none',
        overlay && 'cursor-grabbing bg-surface',
        className,
      )}
    >
      {task.priority === 'urgent' && !done && (
        <span className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: PRIORITY_META.urgent.color, boxShadow: `0 0 10px ${PRIORITY_META.urgent.color}` }} />
      )}
      <div className="flex items-center gap-1.5 text-[11px] text-subtle">
        <StatusIcon status={task.status} size={12} />
        <span className="font-mono tracking-tight">{key}</span>
        <span className="ml-auto flex items-center" title={`우선순위: ${PRIORITY_META[task.priority].label}`}>
          <PriorityIcon priority={task.priority} size={13} className="text-fg" />
        </span>
      </div>
      <p className={cn('mt-1.5 text-[13.5px] font-medium leading-snug text-fg line-clamp-2', done && 'text-muted line-through decoration-line/30')}>{task.title}</p>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => <LabelChip key={l} label={l} />)}
          {task.labels.length > 3 && <span className="text-[10px] text-subtle">+{task.labels.length - 3}</span>}
        </div>
      )}

      {subTotal > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line/10">
            <div className="h-full rounded-full bg-accent-gradient transition-all" style={{ width: `${(subDone / subTotal) * 100}%` }} />
          </div>
          <span className="flex items-center gap-1 text-[10.5px] text-subtle"><ListChecks className="h-3 w-3" />{subDone}/{subTotal}</span>
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <DueChip dueDate={task.dueDate} status={task.status} className={overdue ? 'animate-none' : ''} />
        {task.comments.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10.5px] text-subtle"><MessageSquare className="h-3 w-3" />{task.comments.length}</span>
        )}
        {task.estimate !== undefined && <span className="rounded-md bg-line/[0.05] px-1.5 py-[3px] font-mono text-[10px] leading-none text-subtle">{task.estimate}pt</span>}
        <div className="ml-auto">{task.assigneeIds.length > 0 && <AvatarStack userIds={task.assigneeIds} size="xs" max={3} />}</div>
      </div>
    </div>
  )
})
