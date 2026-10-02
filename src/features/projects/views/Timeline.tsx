import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { CalendarClock, Crosshair } from 'lucide-react'
import { Avatar, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { toast } from '@/store/core'
import type { Project, Task, TaskStatus } from '../types'
import { STATUSES, STATUS_META, hexA, isOverdue } from '../constants'
import { useProjects } from '../store'
import { useTaskParams } from '../hooks'
import { NoResults } from '../components/NoResults'
import { PriorityIcon, StatusIcon } from '../components/atoms'

const DAY_W = 40
const DAYS = 42
const LEFT_W = 280
const LEFT_W_NARROW = 190
const ROW_H = 44

type Mode = 'move' | 'start' | 'end'
interface Drag { id: string; mode: Mode; x0: number; s0: number; e0: number; ds: number; de: number; moved: boolean }

function span(t: Task, origin: Date): { s: number; e: number } | null {
  if (!t.startDate && !t.dueDate) return null
  const due = t.dueDate ? startOfDay(new Date(t.dueDate)) : null
  const start = t.startDate ? startOfDay(new Date(t.startDate)) : due ? addDays(due, -Math.max(0, Math.round((t.estimate ?? 2) / 2))) : null
  const s = differenceInCalendarDays(start!, origin)
  const e = due ? differenceInCalendarDays(due, origin) : s + 1
  return { s, e: Math.max(s, e) }
}

function shiftIso(iso: string | undefined, days: number, fallback: Date, hour: number) {
  const base = iso ? new Date(iso) : (() => { const d = new Date(fallback); d.setHours(hour, 0, 0, 0); return d })()
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function Timeline({ project, tasks }: { project: Project; tasks: Task[] }) {
  const updateTask = useProjects((s) => s.updateTask)
  const { openTask } = useTaskParams()
  const scroller = useRef<HTMLDivElement>(null)
  const today = startOfDay(new Date())
  const origin = useMemo(() => startOfWeek(addDays(startOfDay(new Date()), -14), { weekStartsOn: 1 }), [])
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(origin, i)), [origin])
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  // Narrow panes: slimmer sticky task column so more of the chart is visible.
  const [leftW, setLeftW] = useState(LEFT_W)
  useEffect(() => {
    const el = scroller.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setLeftW(entry.contentRect.width < 720 ? LEFT_W_NARROW : LEFT_W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [tasks.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const rank: Record<TaskStatus, number> = { in_progress: 0, review: 1, todo: 2, backlog: 3, done: 4 }
    return tasks
      .map((t) => ({ t, sp: span(t, origin) }))
      .filter((r): r is { t: Task; sp: { s: number; e: number } } => !!r.sp)
      .sort((a, b) => rank[a.t.status] - rank[b.t.status] || a.sp.s - b.sp.s)
  }, [tasks, origin])
  const undated = tasks.length - rows.length

  const scrollToToday = (smooth = true) => {
    const x = differenceInCalendarDays(today, origin) * DAY_W - 3 * DAY_W
    scroller.current?.scrollTo({ left: Math.max(0, x), behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => { scrollToToday(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const delta = Math.round((e.clientX - d.x0) / DAY_W)
      let ds = 0, de = 0
      if (d.mode === 'move') { ds = delta; de = delta }
      if (d.mode === 'start') ds = Math.min(delta, d.e0 - d.s0)
      if (d.mode === 'end') de = Math.max(delta, d.s0 - d.e0)
      if (ds !== d.ds || de !== d.de || (!d.moved && Math.abs(e.clientX - d.x0) > 3)) setDrag({ ...d, ds, de, moved: d.moved || Math.abs(e.clientX - d.x0) > 3 })
    }
    const onUp = () => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      if (!d.moved) { openTask(d.id); return }
      if (!d.ds && !d.de) return
      const t = useProjects.getState().tasks.find((x) => x.id === d.id)
      if (!t) return
      const startFallback = addDays(origin, d.s0)
      const dueFallback = addDays(origin, d.e0)
      updateTask(d.id, {
        startDate: shiftIso(t.startDate, d.ds, startFallback, 9),
        dueDate: shiftIso(t.dueDate, d.de, dueFallback, 18),
      })
      const newDue = addDays(origin, d.e0 + d.de)
      toast('일정을 변경했습니다', { description: `${project.key}-${t.number} · 마감 ${format(newDue, 'M월 d일 (EEE)', { locale: ko })}`, variant: 'success' })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [drag?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (e: ReactPointerEvent, t: Task, sp: { s: number; e: number }, mode: Mode) => {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ id: t.id, mode, x0: e.clientX, s0: sp.s, e0: sp.e, ds: 0, de: 0, moved: false })
  }

  if (!tasks.length) return <NoResults icon={<CalendarClock />} title="표시할 태스크가 없어요" />

  const nowX = (differenceInCalendarDays(today, origin) + (Date.now() - today.getTime()) / 86_400_000) * DAY_W
  const months = days.reduce<{ label: string; start: number; len: number }[]>((acc, d, i) => {
    const label = format(d, 'yyyy년 M월', { locale: ko })
    if (acc.length && acc[acc.length - 1].label === label) acc[acc.length - 1].len++
    else acc.push({ label, start: i, len: 1 })
    return acc
  }, [])
  const gridW = DAYS * DAY_W

  return (
    <div className="flex h-full min-h-0 flex-col px-6 pb-6 [@container(min-width:1000px)]:px-8">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtle">
        <span className="min-w-0">막대를 드래그해 일정을 옮기고, 양 끝을 끌어 기간을 조정하세요.</span>
        {undated > 0 && <span className="whitespace-nowrap rounded-md bg-line/[0.06] px-2 py-0.5">날짜 미정 {undated}개 숨김</span>}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5 whitespace-nowrap"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[s].color }} />{STATUS_META[s].label}</span>
          ))}
          <Button size="xs" variant="secondary" leftIcon={<Crosshair className="h-3.5 w-3.5" />} onClick={() => scrollToToday()}>오늘</Button>
        </div>
      </div>
      <div ref={scroller} className={cn('glass relative min-h-0 flex-1 overflow-auto rounded-2xl', drag && 'select-none')}>
        <div className="relative" style={{ width: leftW + gridW }}>
          {/* Header */}
          <div className="sticky top-0 z-30 flex border-b border-line/[0.08] bg-surface/85 backdrop-blur-xl">
            <div className="sticky left-0 z-10 flex shrink-0 items-end border-r border-line/[0.08] bg-surface/95 px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle" style={{ width: leftW }}>
              태스크 · {rows.length}
            </div>
            <div style={{ width: gridW }}>
              <div className="relative h-6 border-b border-line/[0.05]">
                {months.map((m) => (
                  <div key={m.label} className="absolute top-0 flex h-full items-center border-l border-line/[0.08] px-2 text-[11px] font-semibold text-muted" style={{ left: m.start * DAY_W, width: m.len * DAY_W }}>
                    <span className="sticky" style={{ left: leftW + 8 }}>{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex">
                {days.map((d) => {
                  const isT = isSameDay(d, today)
                  const wk = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <div key={d.toISOString()} className={cn('flex shrink-0 flex-col items-center py-1.5 text-[10px]', wk ? 'text-subtle/70' : 'text-subtle', d.getDay() === 1 && 'border-l border-line/[0.08]')} style={{ width: DAY_W }}>
                      <span>{format(d, 'EEEEE', { locale: ko })}</span>
                      <span className={cn('mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold', isT ? 'bg-accent-gradient text-white shadow-glow-sm' : 'text-muted')}>{format(d, 'd')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative">
            {/* weekend shading + week lines */}
            <div className="pointer-events-none absolute inset-y-0 flex" style={{ left: leftW, width: gridW }}>
              {days.map((d) => (
                <div key={d.toISOString()} className={cn('h-full shrink-0', (d.getDay() === 0 || d.getDay() === 6) && 'bg-line/[0.035]', d.getDay() === 1 && 'border-l border-line/[0.06]')} style={{ width: DAY_W }} />
              ))}
            </div>
            {/* today line */}
            <div className="pointer-events-none absolute inset-y-0 z-20" style={{ left: leftW + nowX }}>
              <div className="h-full w-px bg-accent-3" style={{ boxShadow: '0 0 12px rgb(var(--accent-3))' }} />
              <div className="absolute -left-[4px] top-0 h-2 w-2 rounded-full bg-accent-3" style={{ boxShadow: '0 0 10px rgb(var(--accent-3))' }} />
            </div>

            {rows.map(({ t, sp }, i) => {
              const active = drag?.id === t.id
              const s = sp.s + (active ? drag!.ds : 0)
              const e = sp.e + (active ? drag!.de : 0)
              const left = s * DAY_W
              const width = (e - s + 1) * DAY_W
              const color = STATUS_META[t.status].color
              const overdue = isOverdue(t)
              return (
                <div key={t.id} className="group/row relative flex border-b border-line/[0.04] hover:bg-line/[0.025]" style={{ height: ROW_H }}>
                  <button
                    onClick={() => openTask(t.id)}
                    className="sticky left-0 z-10 flex min-w-0 shrink-0 items-center gap-2 border-r border-line/[0.08] bg-surface/90 px-3 text-left backdrop-blur-xl transition group-hover/row:bg-surface sm:px-4"
                    style={{ width: leftW }}
                    title={t.title}
                  >
                    <StatusIcon status={t.status} />
                    <span className={cn('shrink-0 font-mono text-[10.5px] text-subtle', leftW < LEFT_W && 'hidden')}>{project.key}-{t.number}</span>
                    <span className={cn('min-w-0 truncate text-[13px] text-fg', t.status === 'done' && 'text-muted line-through decoration-line/30')}>{t.title}</span>
                    <PriorityIcon priority={t.priority} size={12} className="ml-auto text-fg" />
                  </button>
                  <div className="relative overflow-hidden" style={{ width: gridW }}>
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0.6 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ delay: Math.min(i * 0.015, 0.4), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      onPointerDown={(ev) => begin(ev, t, sp, 'move')}
                      className={cn(
                        'group/bar absolute top-2 flex h-7 origin-left cursor-grab touch-none items-center gap-1.5 overflow-hidden rounded-lg pl-1 pr-2 text-[11.5px] font-medium text-white transition-shadow',
                        active && 'cursor-grabbing z-10',
                      )}
                      style={{
                        left: left + 2,
                        width: Math.max(width - 4, 22),
                        background: `linear-gradient(90deg, ${hexA(color, t.status === 'done' ? 0.45 : 0.9)}, ${hexA(color, t.status === 'done' ? 0.3 : 0.65)})`,
                        boxShadow: active
                          ? `0 0 0 1.5px ${color}, 0 10px 28px -6px ${hexA(color, 0.7)}`
                          : overdue ? '0 0 0 1.5px rgb(var(--danger)), 0 0 16px -2px rgb(var(--danger) / 0.6)' : `0 4px 14px -6px ${hexA(color, 0.6)}`,
                      }}
                      title={`${t.title}${t.dueDate ? ` · 마감 ${format(new Date(t.dueDate), 'M/d')}` : ''}`}
                    >
                      <span onPointerDown={(ev) => begin(ev, t, sp, 'start')} className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize opacity-0 transition group-hover/bar:opacity-100">
                        <span className="absolute left-0.5 top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-white/80" />
                      </span>
                      {t.assigneeIds[0] && <Avatar userId={t.assigneeIds[0]} size="xs" className="shrink-0 [&>div]:ring-1 [&>div]:ring-white/40" />}
                      {active && drag!.moved ? (
                        <span className="truncate font-mono text-[11px]">{format(addDays(origin, s), 'M/d')} → {format(addDays(origin, e), 'M/d')}</span>
                      ) : width > 70 && <span className="truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">{t.title}</span>}
                      <span onPointerDown={(ev) => begin(ev, t, sp, 'end')} className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize opacity-0 transition group-hover/bar:opacity-100">
                        <span className="absolute right-0.5 top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-white/80" />
                      </span>
                    </motion.div>
                  </div>
                </div>
              )
            })}
            {!rows.length && <div className="py-16 text-center text-sm text-subtle" style={{ paddingLeft: leftW }}>날짜가 지정된 태스크가 없어요</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
