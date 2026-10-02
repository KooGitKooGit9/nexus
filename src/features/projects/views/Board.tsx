import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, pointerWithin, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type DropAnimation, defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { AlertTriangle, Plus, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCurrentUserId, toast } from '@/store/core'
import type { Project, Task, TaskStatus } from '../types'
import { STATUSES, STATUS_META, WIP_LIMIT, hexA } from '../constants'
import { useProjects } from '../store'
import { useTaskParams } from '../hooks'
import { useProjectPrefs } from '../prefs'
import { TaskCard } from '../components/TaskCard'
import { StatusIcon } from '../components/atoms'

type Columns = Record<TaskStatus, string[]>
const COL_PREFIX = 'col:'

function buildColumns(tasks: Task[]): Columns {
  const cols: Columns = { backlog: [], todo: [], in_progress: [], review: [], done: [] }
  ;[...tasks].sort((a, b) => a.order - b.order).forEach((t) => cols[t.status].push(t.id))
  return cols
}

function findContainer(cols: Columns, id: string): TaskStatus | undefined {
  if (id.startsWith(COL_PREFIX)) return id.slice(COL_PREFIX.length) as TaskStatus
  return STATUSES.find((s) => cols[s].includes(id))
}

const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  if (within.length) {
    // prefer cards over the column droppable when the pointer is above a card
    const card = within.find((c) => !String(c.id).startsWith(COL_PREFIX))
    return card ? [card] : within
  }
  return closestCorners(args)
}

const dropAnimation: DropAnimation = {
  duration: 260,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.3' } } }),
}

function celebrate(x: number, y: number) {
  const colors = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24']
  confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin: { x, y }, colors, scalar: 0.9, ticks: 180, zIndex: 9999 })
  setTimeout(() => confetti({ particleCount: 45, spread: 110, startVelocity: 26, origin: { x, y: y - 0.05 }, colors, scalar: 0.7, zIndex: 9999 }), 140)
}

export function Board({ project, tasks }: { project: Project; tasks: Task[] }) {
  const moveTask = useProjects((s) => s.moveTask)
  const { openTask } = useTaskParams()
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const storeCols = useMemo(() => buildColumns(tasks), [tasks])
  const [dragCols, setDragCols] = useState<Columns | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const origin = useRef<TaskStatus | null>(null)
  const cols = dragCols ?? storeCols

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const cancel = () => { setDragCols(null); setActiveId(null); origin.current = null }

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    setActiveId(id)
    origin.current = findContainer(storeCols, id) ?? null
    setDragCols(storeCols)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const aId = String(active.id)
    const oId = String(over.id)
    // resolve containers against the latest state (several dragOver events can fire before a re-render)
    setDragCols((prev) => {
      if (!prev) return prev
      const from = findContainer(prev, aId)
      const to = findContainer(prev, oId)
      if (!from || !to || from === to) return prev
      const fromList = prev[from].filter((x) => x !== aId)
      const toList = [...prev[to]]
      const overIndex = toList.indexOf(oId)
      const insertAt = oId.startsWith(COL_PREFIX) || overIndex < 0 ? toList.length : overIndex
      toList.splice(insertAt, 0, aId)
      return { ...prev, [from]: fromList, [to]: toList }
    })
  }

  const finish = (e: DragEndEvent) => {
    // dropped outside every column → treat as cancel (don't commit the preview move)
    if (!e.over) { cancel(); return }
    const aId = String(e.active.id)
    let final = dragCols ?? storeCols
    const over = e.over ? String(e.over.id) : null
    const container = findContainer(final, aId)
    if (container && over) {
      const overContainer = findContainer(final, over)
      if (overContainer === container && !over.startsWith(COL_PREFIX)) {
        const list = final[container]
        const oldIndex = list.indexOf(aId)
        const newIndex = list.indexOf(over)
        if (oldIndex !== newIndex && newIndex >= 0) final = { ...final, [container]: arrayMove(list, oldIndex, newIndex) }
      }
    }
    if (container) {
      const visible = final[container]
      const p = visible.indexOf(aId)
      const full = useProjects
        .getState()
        .tasks.filter((t) => t.projectId === project.id && t.status === container && t.id !== aId)
        .sort((a, b) => a.order - b.order)
        .map((t) => t.id)
      let index = 0
      if (p + 1 < visible.length) index = Math.max(0, full.indexOf(visible[p + 1]))
      else if (p > 0) index = full.indexOf(visible[p - 1]) + 1
      const task = byId.get(aId)
      moveTask(aId, container, index)
      if (container === 'done' && origin.current !== 'done') {
        const r = e.active.rect.current.translated
        const x = r ? (r.left + r.width / 2) / window.innerWidth : 0.5
        const y = r ? (r.top + r.height / 2) / window.innerHeight : 0.5
        celebrate(x, y)
        toast('태스크 완료! 🎉', { description: `${project.key}-${task?.number} ${task?.title ?? ''}`, variant: 'success' })
      }
    }
    setDragCols(null)
    setActiveId(null)
    origin.current = null
  }

  const activeTask = activeId ? byId.get(activeId) : undefined
  const overContainer = activeId && dragCols ? findContainer(dragCols, activeId) : undefined

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={finish} onDragCancel={cancel}>
      <div className="flex h-full min-h-0 gap-3.5 overflow-x-auto px-6 pb-6 pt-1 [@container(min-width:1000px)]:px-8">
        {STATUSES.map((status, i) => (
          <Column
            key={status}
            status={status}
            ids={cols[status]}
            byId={byId}
            project={project}
            highlight={overContainer === status && origin.current !== status}
            onOpen={openTask}
            delay={i * 0.04}
          />
        ))}
      </div>
      {createPortal(<DragOverlay dropAnimation={dropAnimation} zIndex={95}>
        {activeTask ? (
          <motion.div initial={{ rotate: 0, scale: 1 }} animate={{ rotate: 2.5, scale: 1.04 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
            <TaskCard task={activeTask} project={project} overlay />
          </motion.div>
        ) : null}
      </DragOverlay>, document.body)}
    </DndContext>
  )
}

function Column({ status, ids, byId, project, highlight, onOpen, delay }: { status: TaskStatus; ids: string[]; byId: Map<string, Task>; project: Project; highlight: boolean; onOpen: (id: string) => void; delay: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: COL_PREFIX + status })
  const meta = STATUS_META[status]
  const [adding, setAdding] = useState(false)
  const points = ids.reduce((s, id) => s + (byId.get(id)?.estimate ?? 0), 0)
  const overWip = status === 'in_progress' && ids.length > WIP_LIMIT
  const lit = highlight || isOver

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative flex h-full w-[272px] shrink-0 flex-col rounded-2xl border transition-all duration-300 [@container(min-width:1000px)]:w-[300px]',
        lit ? 'border-transparent' : 'border-line/[0.06] bg-line/[0.025]',
      )}
      style={lit ? { background: hexA(meta.color, 0.07), boxShadow: `0 0 0 1px ${hexA(meta.color, 0.45)}, 0 0 36px -8px ${hexA(meta.color, 0.5)}` } : undefined}
    >
      <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <StatusIcon status={status} size={15} />
        <span className="text-[13px] font-semibold text-fg">{meta.label}</span>
        <span className="rounded-full bg-line/[0.07] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-muted">{ids.length}</span>
        {points > 0 && <span className="text-[10.5px] text-subtle tabular-nums">{points}pt</span>}
        {status === 'in_progress' && (
          <span
            title={`WIP 제한 ${WIP_LIMIT}`}
            className={cn('ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', overWip ? 'bg-warning/15 text-warning' : 'text-subtle')}
          >
            {overWip && <AlertTriangle className="h-3 w-3" />}
            WIP {ids.length}/{WIP_LIMIT}
          </span>
        )}
        <button onClick={() => setAdding(true)} className="ml-auto rounded-md p-1 text-subtle transition hover:bg-line/10 hover:text-fg" title="태스크 추가">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mx-3.5 mb-2 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />

      <div ref={setNodeRef} className="flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const t = byId.get(id)
            return t ? <SortableCard key={id} task={t} project={project} onOpen={onOpen} /> : null
          })}
        </SortableContext>
        {ids.length === 0 && !adding && (
          <div className={cn('flex flex-1 min-h-[90px] items-center justify-center rounded-xl border border-dashed text-xs text-subtle transition', lit ? 'border-transparent' : 'border-line/10')}>
            여기로 드래그하세요
          </div>
        )}
        <QuickAdd status={status} projectId={project.id} open={adding} setOpen={setAdding} />
      </div>
    </motion.div>
  )
}

function SortableCard({ task, project, onOpen }: { task: Task; project: Project; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners}>
      <TaskCard task={task} project={project} dragging={isDragging} onClick={() => onOpen(task.id)} />
    </div>
  )
}

function QuickAdd({ status, projectId, open, setOpen }: { status: TaskStatus; projectId: string; open: boolean; setOpen: (v: boolean) => void }) {
  const createTask = useProjects((s) => s.createTask)
  const [title, setTitle] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (!title.trim()) return
    // Respect the active person filter so the new card doesn't vanish right after creation.
    const f = useProjectPrefs.getState().filters
    const assigneeIds = f.mineOnly ? [getCurrentUserId()] : f.assigneeIds.length === 1 ? [...f.assigneeIds] : undefined
    createTask({ projectId, title, status, assigneeIds })
    setTitle('')
    ref.current?.focus()
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      {open ? (
        <motion.div key="form" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="rounded-xl border border-accent/40 bg-surface/90 p-2.5 shadow-glow-sm">
          <textarea
            ref={ref}
            autoFocus
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
              if (e.key === 'Escape') { setOpen(false); setTitle('') }
            }}
            onBlur={() => { if (!title.trim()) setOpen(false) }}
            placeholder="무엇을 해야 하나요?"
            className="w-full resize-none bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle"
          />
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-subtle">
            <span>Esc 로 닫기</span>
            <button onMouseDown={(e) => e.preventDefault()} onClick={submit} className="inline-flex items-center gap-1 rounded-md bg-accent-gradient px-2 py-1 font-medium text-white">
              추가 <CornerDownLeft className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.button
          key="btn"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12.5px] text-subtle transition hover:bg-line/[0.05] hover:text-fg"
        >
          <Plus className="h-3.5 w-3.5" /> 태스크 추가
        </motion.button>
      )}
    </AnimatePresence>
  )
}
