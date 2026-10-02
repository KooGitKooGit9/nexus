import { useMemo, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { ChevronRight, PartyPopper } from 'lucide-react'
import { useCore, toast } from '@/store/core'
import { cn } from '@/lib/utils'
import type { Task } from '../types'
import { DUE_BUCKET_META, dueBucket, hexA, ink, type DueBucket } from '../constants'
import { useProjects } from '../store'
import { DueChip, PriorityIcon, StatusIcon } from './atoms'

const ORDER: DueBucket[] = ['overdue', 'today', 'week', 'later']

export function MyTasks() {
  const tasks = useProjects((s) => s.tasks)
  const projects = useProjects((s) => s.projects)
  const updateTask = useProjects((s) => s.updateTask)
  const me = useCore((s) => s.currentUserId)
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState<Set<DueBucket>>(new Set(['later']))

  const groups = useMemo(() => {
    const mine = tasks
      .filter((t) => t.assigneeIds.includes(me) && t.status !== 'done')
      .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))
    const g: Record<DueBucket, Task[]> = { overdue: [], today: [], week: [], later: [] }
    mine.forEach((t) => g[dueBucket(t)].push(t))
    return g
  }, [tasks, me])
  const total = ORDER.reduce((s, b) => s + groups[b].length, 0)

  const complete = (e: MouseEvent, t: Task) => {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    confetti({ particleCount: 40, spread: 60, startVelocity: 22, scalar: 0.7, origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }, colors: ['#8b5cf6', '#22d3ee', '#34d399', '#f472b6'], zIndex: 9999 })
    updateTask(t.id, { status: 'done' })
    toast('완료했습니다 🎉', { description: t.title, variant: 'success' })
  }

  return (
    <div className="glass overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line/[0.06] px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-fg">내 작업</h3>
          <p className="mt-0.5 text-xs text-muted">모든 프로젝트에서 나에게 할당된 열린 작업 {total}개</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {ORDER.slice(0, 3).map((b) => groups[b].length > 0 && (
            <span key={b} className={cn('whitespace-nowrap rounded-md bg-line/[0.05] px-1.5 py-0.5 text-[10.5px] font-semibold', DUE_BUCKET_META[b].tone)}>{DUE_BUCKET_META[b].label} {groups[b].length}</span>
          ))}
        </div>
      </div>
      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
          <PartyPopper className="h-8 w-8 text-accent" /> 모든 작업을 끝냈어요!
        </div>
      ) : (
        <div className="max-h-[640px] overflow-y-auto p-2">
          {ORDER.map((b) => {
            const list = groups[b]
            if (!list.length) return null
            const isC = collapsed.has(b)
            return (
              <div key={b} className="mb-1">
                <button
                  onClick={() => setCollapsed((s) => { const n = new Set(s); n.has(b) ? n.delete(b) : n.add(b); return n })}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition hover:bg-line/[0.04]"
                >
                  <motion.span animate={{ rotate: isC ? 0 : 90 }} className="text-subtle"><ChevronRight className="h-3.5 w-3.5" /></motion.span>
                  <span>{DUE_BUCKET_META[b].emoji}</span>
                  <span className={DUE_BUCKET_META[b].tone}>{DUE_BUCKET_META[b].label}</span>
                  <span className="text-subtle tabular-nums">{list.length}</span>
                </button>
                <AnimatePresence initial={false}>
                  {!isC && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      {list.map((t) => {
                        const p = projects.find((x) => x.id === t.projectId)
                        return (
                          <motion.div
                            key={t.id}
                            layout
                            onClick={() => navigate(`/projects/${t.projectId}?task=${t.id}`)}
                            className="group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-line/[0.05]"
                          >
                            <button onClick={(e) => complete(e, t)} title="완료로 표시" className="relative shrink-0 rounded-full transition hover:scale-125">
                              <span className="group-hover:hidden"><StatusIcon status={t.status} size={15} /></span>
                              <span className="hidden group-hover:block"><StatusIcon status="done" size={15} className="opacity-70" /></span>
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-medium text-fg">{t.title}</div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
                                {p && (
                                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1 py-px" style={{ background: hexA(p.color, 0.12), color: ink(p.color) }}>
                                    {p.emoji} <span className="font-mono">{p.key}-{t.number}</span>
                                  </span>
                                )}
                                <span className="min-w-0 truncate">{p?.name}</span>
                              </div>
                            </div>
                            <PriorityIcon priority={t.priority} size={13} className="text-fg" />
                            <DueChip dueDate={t.dueDate} status={t.status} />
                          </motion.div>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
