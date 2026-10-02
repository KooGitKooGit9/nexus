import { useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ChevronRight, Trash2, UserPlus, X, Flag, CircleDot, MessageSquare } from 'lucide-react'
import { Avatar, AvatarStack, Checkbox } from '@/components/ui'
import { useCore, toast } from '@/store/core'
import { cn, timeAgo } from '@/lib/utils'
import type { GroupBy, Priority, Project, Task, TaskStatus } from '../types'
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, josa, labelColor } from '../constants'
import { useProjects } from '../store'
import { useTaskParams } from '../hooks'
import { activeFilterCount, useProjectPrefs } from '../prefs'
import { NoResults } from '../components/NoResults'
import { AssigneePicker, DueChip, LabelChip, PriorityIcon, PriorityPicker, StatusIcon, StatusPicker } from '../components/atoms'

type SortKey = 'key' | 'title' | 'status' | 'priority' | 'assignee' | 'due' | 'estimate' | 'updated'
const STATUS_RANK: Record<TaskStatus, number> = { in_progress: 0, review: 1, todo: 2, backlog: 3, done: 4 }

interface Group { id: string; label: ReactNode; color?: string; tasks: Task[] }

function useGroups(tasks: Task[], groupBy: GroupBy): Group[] {
  const users = useCore((s) => s.users)
  return useMemo(() => {
    if (groupBy === 'status') return STATUSES.map((s) => ({ id: s, label: <><StatusIcon status={s} />{STATUS_META[s].label}</>, color: STATUS_META[s].color, tasks: tasks.filter((t) => t.status === s) }))
    if (groupBy === 'priority') return PRIORITIES.map((p) => ({ id: p, label: <><PriorityIcon priority={p} className="text-fg" />{PRIORITY_META[p].label}</>, color: PRIORITY_META[p].color, tasks: tasks.filter((t) => t.priority === p) }))
    if (groupBy === 'assignee') {
      const ids = Array.from(new Set(tasks.flatMap((t) => t.assigneeIds)))
      const groups: Group[] = ids.map((id) => ({ id, label: <><Avatar userId={id} size="xs" />{users.find((u) => u.id === id)?.name ?? id}</>, tasks: tasks.filter((t) => t.assigneeIds.includes(id)) }))
      groups.sort((a, b) => b.tasks.length - a.tasks.length)
      const none = tasks.filter((t) => !t.assigneeIds.length)
      if (none.length) groups.push({ id: '_none', label: '담당자 없음', tasks: none })
      return groups
    }
    if (groupBy === 'label') {
      const labels = Array.from(new Set(tasks.flatMap((t) => t.labels)))
      const groups: Group[] = labels.map((l) => ({ id: l, label: <><span className="h-2 w-2 rounded-full" style={{ background: labelColor(l) }} />{l}</>, color: labelColor(l), tasks: tasks.filter((t) => t.labels.includes(l)) }))
      groups.sort((a, b) => b.tasks.length - a.tasks.length)
      const none = tasks.filter((t) => !t.labels.length)
      if (none.length) groups.push({ id: '_none', label: '라벨 없음', tasks: none })
      return groups
    }
    return [{ id: 'all', label: '전체 태스크', tasks }]
  }, [tasks, groupBy, users])
}

function Th({ k, sort, onSort, children, className }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; children: ReactNode; className?: string }) {
  return (
    <button onClick={() => onSort(k)} className={cn('group/th flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wider transition', sort.key === k ? 'text-fg' : 'text-subtle hover:text-muted', className)}>
      {children}
      <span className={cn('transition', sort.key === k ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-50')}>
        {sort.key === k && sort.dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
      </span>
    </button>
  )
}

export function ListView({ project, tasks, groupBy }: { project: Project; tasks: Task[]; groupBy: GroupBy }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'priority', dir: 1 })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const users = useCore((s) => s.users)
  const filtered = useProjectPrefs((s) => activeFilterCount(s.filters) > 0)

  const sorted = useMemo(() => {
    const name = (t: Task) => users.find((u) => u.id === t.assigneeIds[0])?.name ?? '힣'
    const val = (t: Task): string | number => {
      switch (sort.key) {
        case 'key': return t.number
        case 'title': return t.title
        case 'status': return STATUS_RANK[t.status]
        case 'priority': return PRIORITY_META[t.priority].rank
        case 'assignee': return name(t)
        case 'due': return t.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER
        case 'estimate': return t.estimate ?? -1
        case 'updated': return -new Date(t.updatedAt).getTime()
      }
    }
    return [...tasks].sort((a, b) => {
      const va = val(a), vb = val(b)
      const c = typeof va === 'string' ? va.localeCompare(vb as string, 'ko') : (va as number) - (vb as number)
      return c * sort.dir || a.number - b.number
    })
  }, [tasks, sort, users])

  const groups = useGroups(sorted, groupBy)
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allIds = tasks.map((t) => t.id)
  const allSelected = selected.size > 0 && allIds.every((id) => selected.has(id))

  if (!tasks.length) return <NoResults icon={<CircleDot />} title={filtered ? '조건에 맞는 태스크가 없어요' : '아직 태스크가 없어요'} />

  // Columns adapt to the project view's container width (pt / updated hide, priority becomes icon-only).
  // NOTE: Tailwind sorts arbitrary variants alphabetically ("1100px" < "860px"), so the mid breakpoint is
  // bounded with max-width — otherwise it would override the wide 9-column template.
  const grid = 'grid items-center gap-3 grid-cols-[28px_70px_minmax(140px,1fr)_104px_32px_92px_92px] [@container(min-width:860px)_and_(max-width:1099px)]:grid-cols-[28px_76px_minmax(180px,1fr)_110px_96px_100px_100px] [@container(min-width:1100px)]:grid-cols-[28px_76px_minmax(220px,1fr)_120px_96px_110px_100px_56px_84px]'

  return (
    <div className="px-6 pb-28 [@container(min-width:1000px)]:px-8">
      <div className="glass overflow-x-auto rounded-2xl">
        <div className="min-w-[680px]">
          <div className={cn(grid, 'sticky top-0 z-10 border-b border-line/[0.08] bg-surface/80 px-4 py-2.5 backdrop-blur-xl')}>
            <Checkbox checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(allIds))} />
            <Th sort={sort} onSort={toggleSort} k="key">키</Th>
            <Th sort={sort} onSort={toggleSort} k="title">제목</Th>
            <Th sort={sort} onSort={toggleSort} k="status">상태</Th>
            <Th sort={sort} onSort={toggleSort} k="priority"><span className="hidden [@container(min-width:860px)]:inline">우선순위</span><span className="[@container(min-width:860px)]:hidden" title="우선순위">P</span></Th>
            <Th sort={sort} onSort={toggleSort} k="assignee">담당자</Th>
            <Th sort={sort} onSort={toggleSort} k="due">마감일</Th>
            <Th sort={sort} onSort={toggleSort} k="estimate" className="hidden [@container(min-width:1100px)]:flex">pt</Th>
            <Th sort={sort} onSort={toggleSort} k="updated" className="hidden [@container(min-width:1100px)]:flex">업데이트</Th>
          </div>
          {groups.map((g) => {
            // empty status groups are useful as structure, but just noise while filtering
            if (!g.tasks.length && (groupBy !== 'status' || filtered)) return null
            const isCollapsed = collapsed.has(g.id)
            return (
              <div key={g.id}>
                {groupBy !== 'none' && (
                  <button
                    onClick={() => setCollapsed((s) => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })}
                    className="flex w-full items-center gap-2 border-b border-line/[0.06] bg-line/[0.025] px-4 py-2 text-left text-[13px] font-semibold text-fg transition hover:bg-line/[0.05]"
                  >
                    <motion.span animate={{ rotate: isCollapsed ? 0 : 90 }} className="text-subtle"><ChevronRight className="h-3.5 w-3.5" /></motion.span>
                    <span className="flex items-center gap-2">{g.label}</span>
                    <span className="text-[11px] font-medium text-subtle tabular-nums">{g.tasks.length}</span>
                    {g.color && <span className="ml-2 h-px flex-1" style={{ background: `linear-gradient(90deg, ${g.color}55, transparent)` }} />}
                  </button>
                )}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                      {g.tasks.map((t) => (
                        <Row key={`${g.id}-${t.id}`} task={t} project={project} grid={grid} selected={selected.has(t.id)} onToggle={() => toggle(t.id)} />
                      ))}
                      {!g.tasks.length && <div className="px-14 py-3 text-xs text-subtle">태스크 없음</div>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
      <BulkBar project={project} ids={[...selected].filter((id) => allIds.includes(id))} onClear={() => setSelected(new Set())} />
    </div>
  )
}

function Row({ task, project, grid, selected, onToggle }: { task: Task; project: Project; grid: string; selected: boolean; onToggle: () => void }) {
  const updateTask = useProjects((s) => s.updateTask)
  const { openTask } = useTaskParams()
  return (
    <div
      onClick={() => openTask(task.id)}
      className={cn(grid, 'group cursor-pointer border-b border-line/[0.05] px-4 py-2 text-[13px] transition-colors', selected ? 'bg-accent/[0.08]' : 'hover:bg-line/[0.035]')}
    >
      <span onClick={(e) => e.stopPropagation()} className={cn('transition', selected ? 'opacity-100' : 'opacity-40 group-hover:opacity-100')}>
        <Checkbox checked={selected} onChange={onToggle} />
      </span>
      <span className="font-mono text-[11.5px] text-subtle">{project.key}-{task.number}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('truncate font-medium text-fg', task.status === 'done' && 'text-muted line-through decoration-line/30')}>{task.title}</span>
        <div className="hidden shrink-0 gap-1 [@container(min-width:1200px)]:flex">{task.labels.slice(0, 2).map((l) => <LabelChip key={l} label={l} />)}</div>
        {task.comments.length > 0 && <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-subtle"><MessageSquare className="h-3 w-3" />{task.comments.length}</span>}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <StatusPicker value={task.status} onChange={(status) => updateTask(task.id, { status })} trigger={({ toggle }) => (
          <button onClick={toggle} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] transition hover:bg-line/[0.07]">
            <StatusIcon status={task.status} />{STATUS_META[task.status].label}
          </button>
        )} />
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <PriorityPicker value={task.priority} onChange={(priority) => updateTask(task.id, { priority })} trigger={({ toggle }) => (
          <button onClick={toggle} title={`우선순위: ${PRIORITY_META[task.priority].label}`} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] transition hover:bg-line/[0.07]">
            <PriorityIcon priority={task.priority} className="text-fg" /><span className="hidden [@container(min-width:860px)]:inline">{PRIORITY_META[task.priority].label}</span>
          </button>
        )} />
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <AssigneePicker value={task.assigneeIds} candidateIds={project.memberIds} onChange={(assigneeIds) => updateTask(task.id, { assigneeIds })} trigger={({ toggle }) => (
          <button onClick={toggle} className="flex min-h-[28px] items-center rounded-md px-1 transition hover:bg-line/[0.07]">
            {task.assigneeIds.length ? <AvatarStack userIds={task.assigneeIds} size="xs" max={3} /> : <span className="text-[12px] text-subtle">미지정</span>}
          </button>
        )} />
      </div>
      <div>{task.dueDate ? <DueChip dueDate={task.dueDate} status={task.status} /> : <span className="text-subtle">—</span>}</div>
      <span className="hidden font-mono text-[12px] text-muted [@container(min-width:1100px)]:block">{task.estimate ?? '—'}</span>
      <span className="hidden truncate text-[11.5px] text-subtle [@container(min-width:1100px)]:block">{timeAgo(task.updatedAt)}</span>
    </div>
  )
}

function BulkBar({ project, ids, onClear }: { project: Project; ids: string[]; onClear: () => void }) {
  const bulkUpdate = useProjects((s) => s.bulkUpdate)
  const bulkDelete = useProjects((s) => s.bulkDelete)
  const [confirm, setConfirm] = useState(false)
  const apply = (patch: Parameters<typeof bulkUpdate>[1], msg: string) => {
    bulkUpdate(ids, patch)
    toast(msg, { description: `${ids.length}개 태스크에 적용했습니다`, variant: 'success' })
  }
  const btn = 'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-fg/90 transition hover:bg-line/10'
  return createPortal(
    <AnimatePresence>
      {ids.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 80, opacity: 0, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="fixed bottom-6 left-1/2 z-[60] flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto whitespace-nowrap rounded-2xl p-1.5 glass-strong shadow-float scrollbar-none"
          style={{ boxShadow: '0 0 0 1px rgb(var(--accent) / 0.3), 0 20px 50px -12px rgb(var(--accent) / 0.45)' }}
        >
          <span className="flex items-center gap-2 pl-2.5 pr-2 text-[13px] font-semibold text-fg">
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-accent-gradient px-1.5 text-[12px] text-white shadow-glow-sm">{ids.length}</span>
            개 선택됨
          </span>
          <span className="mx-1 h-5 w-px bg-line/15" />
          <StatusPicker value="todo" placement="top-start" onChange={(status: TaskStatus) => apply({ status }, `상태를 ${josa(STATUS_META[status].label, '으로')} 변경했습니다`)} trigger={({ toggle }) => (
            <button onClick={toggle} className={btn}><CircleDot className="h-3.5 w-3.5" />상태</button>
          )} />
          <PriorityPicker value="medium" placement="top-start" onChange={(priority: Priority) => apply({ priority }, `우선순위를 ${josa(PRIORITY_META[priority].label, '으로')} 변경했습니다`)} trigger={({ toggle }) => (
            <button onClick={toggle} className={btn}><Flag className="h-3.5 w-3.5" />우선순위</button>
          )} />
          <AssigneePicker single value={[]} candidateIds={project.memberIds} placement="top-start" onChange={(assigneeIds) => apply({ assigneeIds }, '담당자를 변경했습니다')} trigger={({ toggle }) => (
            <button onClick={toggle} className={btn}><UserPlus className="h-3.5 w-3.5" />담당자</button>
          )} />
          <button
            onClick={() => {
              if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 2500); return }
              bulkDelete(ids); onClear(); setConfirm(false)
              toast(`${ids.length}개 태스크를 삭제했습니다`, { variant: 'warning' })
            }}
            className={cn(btn, 'text-danger hover:bg-danger/10', confirm && 'bg-danger/15')}
          >
            <Trash2 className="h-3.5 w-3.5" />{confirm ? '한 번 더 눌러 삭제' : '삭제'}
          </button>
          <span className="mx-1 h-5 w-px bg-line/15" />
          <button onClick={onClear} className="rounded-lg p-1.5 text-subtle transition hover:bg-line/10 hover:text-fg" title="선택 해제"><X className="h-4 w-4" /></button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
