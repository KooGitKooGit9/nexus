import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderPlus, KanbanSquare, Plus, Layers, ListTodo, CalendarClock, AlertTriangle, Timer } from 'lucide-react'
import { Page } from '@/app/Page'
import { Button, FadeIn, Kbd, PageHeader } from '@/components/ui'
import { useCore } from '@/store/core'
import { cn } from '@/lib/utils'
import { dueBucket, isOverdue } from '../constants'
import { useProjects } from '../store'
import { useTaskParams } from '../hooks'
import { ProjectCard } from '../components/ProjectCard'
import { MyTasks } from '../components/MyTasks'
import { SprintWidget } from '../components/SprintWidget'
import { CreateProjectModal } from '../components/CreateProjectModal'

function Stat({ icon, label, value, tone, delay }: { icon: ReactNode; label: string; value: number; tone: string; delay: number }) {
  return (
    <FadeIn delay={delay}>
      <div className="glass group relative h-full min-w-0 overflow-hidden rounded-2xl px-4 py-3.5">
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl transition group-hover:opacity-60" style={{ background: tone }} />
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&>svg]:h-4 [&>svg]:w-4" style={{ background: `${tone}22`, color: tone }}>{icon}</div>
          <div className="min-w-0">
            <div className="font-display text-2xl font-bold leading-none text-fg tabular-nums">{value}</div>
            <div className="mt-1 truncate text-[11.5px] text-muted" title={label}>{label}</div>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

type ProjectFilter = 'all' | 'mine' | 'archived'

export function Overview() {
  const projects = useProjects((s) => s.projects)
  const tasks = useProjects((s) => s.tasks)
  const me = useCore((s) => s.currentUserId)
  const navigate = useNavigate()
  const { openNew } = useTaskParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState<ProjectFilter>('all')

  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)
  const view: ProjectFilter = filter === 'archived' && !archived.length ? 'all' : filter
  const filterOptions: ProjectFilter[] = archived.length ? ['all', 'mine', 'archived'] : ['all', 'mine']
  const shown = view === 'mine' ? active.filter((p) => p.memberIds.includes(me) || p.leadId === me) : view === 'archived' ? archived : active
  const stats = useMemo(() => {
    // archived projects don't count toward the live workload numbers
    const live = new Set(projects.filter((p) => !p.archived).map((p) => p.id))
    const liveTasks = tasks.filter((t) => live.has(t.projectId))
    const mine = liveTasks.filter((t) => t.assigneeIds.includes(me) && t.status !== 'done')
    return {
      open: mine.length,
      week: mine.filter((t) => ['today', 'week'].includes(dueBucket(t))).length,
      overdue: liveTasks.filter((t) => isOverdue(t)).length,
      unfinished: liveTasks.filter((t) => t.status !== 'done').length,
    }
  }, [tasks, projects, me])

  return (
    <Page wide>
      {/* Container queries keep the layout correct regardless of sidebar state / pane width. */}
      <div className="[container-type:inline-size]">
      <PageHeader
        icon={<KanbanSquare />}
        title="프로젝트"
        subtitle={<span className="whitespace-normal">오로라랩스의 프로젝트 {active.length}개 · 미완료 태스크 {stats.unfinished}개</span>}
        actions={
          <>
            <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={openNew}>
              새 태스크 <Kbd className="ml-1">C</Kbd>
            </Button>
            <Button variant="primary" leftIcon={<FolderPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>새 프로젝트</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 [@container(min-width:360px)]:grid-cols-2 [@container(min-width:880px)]:grid-cols-4">
        <Stat icon={<Layers />} label="활성 프로젝트" value={active.length} tone="#8b5cf6" delay={0} />
        <Stat icon={<ListTodo />} label="내 열린 작업" value={stats.open} tone="#22d3ee" delay={0.05} />
        <Stat icon={<CalendarClock />} label="이번 주 마감 (내 작업)" value={stats.week} tone="#fbbf24" delay={0.1} />
        <Stat icon={<AlertTriangle />} label="전체 지연 태스크" value={stats.overdue} tone="#f43f5e" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 gap-6 [@container(min-width:1180px)]:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 [container-type:inline-size]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-fg">{view === 'archived' ? '보관된 프로젝트' : view === 'mine' ? '내가 참여한 프로젝트' : '모든 프로젝트'}</h2>
            <div className="flex rounded-lg border border-line/10 bg-line/[0.03] p-0.5 text-[12px]">
              {filterOptions.map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn('whitespace-nowrap rounded-md px-2.5 py-1 transition', view === f ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg')}>
                  {f === 'all' ? '전체' : f === 'mine' ? '내가 참여한' : `보관됨 ${archived.length}`}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 [@container(min-width:760px)]:grid-cols-2">
            {shown.map((p, i) => (
              <ProjectCard key={p.id} project={p} tasks={tasks.filter((t) => t.projectId === p.id)} onOpen={() => navigate(`/projects/${p.id}`)} index={i} />
            ))}
            {view !== 'archived' && <FadeIn delay={shown.length * 0.06}>
              <button
                onClick={() => setCreateOpen(true)}
                className="group flex h-full min-h-[120px] w-full [@container(min-width:760px)]:min-h-[230px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line/15 text-muted transition hover:border-accent/50 hover:bg-accent/[0.04] hover:text-fg"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-line/[0.05] transition group-hover:scale-110 group-hover:bg-accent-gradient group-hover:text-white group-hover:shadow-glow">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium">새 프로젝트 만들기</span>
              </button>
            </FadeIn>}
          </div>
        </div>

        {/* Side panel: its own column on wide screens, stacked below (2-up when room) on narrow ones */}
        <div className="min-w-0 [container-type:inline-size]">
        <div className="grid grid-cols-1 items-start gap-6 [@container(min-width:760px)]:grid-cols-2">
          <FadeIn delay={0.1} className="min-w-0"><MyTasks /></FadeIn>
          <FadeIn delay={0.2} className="min-w-0">
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-fg"><Timer className="h-4 w-4 text-accent" />진행 중인 스프린트</h2>
              <div className="space-y-2.5">
                {active.filter((p) => p.sprint).map((p) => (
                  <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="block w-full text-left transition hover:-translate-y-0.5">
                    <SprintWidget project={p} tasks={tasks} compact />
                  </button>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
        </div>
      </div>
      </div>

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </Page>
  )
}
