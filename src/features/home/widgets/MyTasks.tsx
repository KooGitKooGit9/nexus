import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { differenceInCalendarDays } from 'date-fns'
import { CheckSquare, Flame, ArrowUp, Minus, ArrowDown } from 'lucide-react'
import { Checkbox, Tabs } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { cn } from '@/lib/utils'
import { useProjects } from '@/features/projects/store'
import type { Priority, Task } from '@/features/projects/types'
import { burstConfetti, originFromEl } from '@/features/goals/lib'
import { isDueSoon, isOverdue, myOpenTasks } from '../lib'
import { MiniEmpty, Widget } from '../components/Widget'

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const PRIORITY_ICON: Record<Priority, { icon: React.ReactNode; cls: string; label: string }> = {
  urgent: { icon: <Flame className="h-3.5 w-3.5" />, cls: 'text-danger', label: '긴급' },
  high: { icon: <ArrowUp className="h-3.5 w-3.5" />, cls: 'text-warning', label: '높음' },
  medium: { icon: <Minus className="h-3.5 w-3.5" />, cls: 'text-info', label: '보통' },
  low: { icon: <ArrowDown className="h-3.5 w-3.5" />, cls: 'text-subtle', label: '낮음' },
}

function dueLabel(t: Task, now: Date): { text: string; cls: string } | null {
  if (!t.dueDate) return null
  const d = differenceInCalendarDays(new Date(t.dueDate), now)
  if (d < 0) return { text: `${-d}일 지연`, cls: 'text-danger bg-danger/10 border-danger/25' }
  if (d === 0) return { text: '오늘', cls: 'text-warning bg-warning/10 border-warning/25' }
  if (d === 1) return { text: '내일', cls: 'text-accent-2 bg-accent-2/10 border-accent-2/25' }
  return { text: `${d}일 후`, cls: 'text-muted bg-line/[0.04] border-line/10' }
}

/** Marks a task done via the projects store (sets completedAt + activity log). */
function completeTask(id: string) {
  useProjects.getState().updateTask(id, { status: 'done' })
}

type Filter = 'all' | 'soon' | 'overdue'

export function MyTasks({ className, delay }: { className?: string; delay?: number }) {
  const navigate = useNavigate()
  const tasks = useProjects((s) => s.tasks)
  const projects = useProjects((s) => s.projects)
  const me = useCore((s) => s.currentUserId)
  const [filter, setFilter] = useState<Filter>('all')
  const [completing, setCompleting] = useState<string[]>([])
  const now = new Date()

  const open = useMemo(() => {
    const list = myOpenTasks(tasks ?? [], me)
    return list.sort((a, b) => {
      const oa = isOverdue(a) ? 0 : 1
      const ob = isOverdue(b) ? 0 : 1
      if (oa !== ob) return oa - ob
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      if (da !== db) return da - db
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    })
  }, [tasks, me])

  const overdue = open.filter((t) => isOverdue(t))
  const dueSoon = open.filter((t) => isDueSoon(t, now))
  const filtered = filter === 'overdue' ? overdue : filter === 'soon' ? dueSoon : open
  const shown = filtered.slice(0, 7)
  const doneToday = (tasks ?? []).filter((t) => t.assigneeIds.includes(me) && t.status === 'done' && t.completedAt && differenceInCalendarDays(new Date(t.completedAt), now) === 0).length

  const check = (t: Task, el: Element | null) => {
    setCompleting((c) => [...c, t.id])
    burstConfetti(originFromEl(el))
    setTimeout(() => {
      completeTask(t.id)
      setCompleting((c) => c.filter((x) => x !== t.id))
      toast('태스크 완료! 🎉', { description: t.title, variant: 'success', emoji: '✅' })
    }, 550)
  }

  const keyOf = (t: Task) => projects?.find((p) => p.id === t.projectId)?.key ?? 'NX'

  return (
    <Widget
      className={className}
      delay={delay}
      title="내 할 일"
      subtitle={`진행 중 ${open.length}개 · 오늘 완료 ${doneToday}개`}
      icon={<CheckSquare />}
      gradient="from-cyan-400 to-blue-600"
      action={
        <Tabs<Filter>
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: '전체', count: open.length },
            { value: 'soon', label: '임박', count: dueSoon.length },
            { value: 'overdue', label: '지연', count: overdue.length },
          ]}
        />
      }
    >
      {shown.length === 0 ? (
        <MiniEmpty emoji={open.length ? '🎯' : '🏝️'} title={!open.length ? '모든 할 일을 끝냈어요!' : filter === 'overdue' ? '지연된 태스크가 없어요 👏' : filter === 'soon' ? '오늘·내일 마감인 태스크가 없어요' : '해당하는 태스크가 없어요'}>
          <button className="text-accent hover:underline" onClick={() => navigate('/projects?new=1')}>새 태스크 만들기</button>
        </MiniEmpty>
      ) : (
        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {shown.map((t) => (
              <TaskRow key={t.id} t={t} k={keyOf(t)} now={now} done={completing.includes(t.id)} onCheck={check} onOpen={() => navigate(`/projects/${t.projectId}?task=${t.id}`)} />
            ))}
          </AnimatePresence>
          {filtered.length > shown.length && (
            <li>
              <button onClick={() => navigate('/projects')} className="w-full rounded-lg py-1.5 text-center text-[11px] text-subtle hover:bg-line/[0.04] hover:text-fg">
                +{filtered.length - shown.length}개 더 보기
              </button>
            </li>
          )}
        </ul>
      )}
    </Widget>
  )
}

function TaskRow({ t, k, now, done, onCheck, onOpen }: { t: Task; k: string; now: Date; done: boolean; onCheck: (t: Task, el: Element | null) => void; onOpen: () => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const due = dueLabel(t, now)
  const pr = PRIORITY_ICON[t.priority]
  const overdue = isOverdue(t, now)
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: done ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, x: 24, height: 0, transition: { duration: 0.3 } }}
      onClick={onOpen}
      className={cn('group flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-line/[0.04]', overdue && 'bg-danger/[0.04]')}
    >
      <span ref={ref} onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={done} onChange={() => !done && onCheck(t, ref.current)} />
      </span>
      <span className={cn('shrink-0', pr.cls)} title={pr.label}>{pr.icon}</span>
      <span className="shrink-0 font-mono text-[10px] text-subtle">{k}-{t.number}</span>
      <span className={cn('min-w-0 flex-1 truncate text-[13px] transition', done ? 'text-subtle line-through' : overdue ? 'text-danger' : 'text-fg/90 group-hover:text-fg')}>{t.title}</span>
      {due && <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium', due.cls)}>{due.text}</span>}
    </motion.li>
  )
}
