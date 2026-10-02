import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BarChart3, ChevronDown, Columns3, GanttChartSquare, List, MoreHorizontal, Plus, Sparkles, Archive, ArchiveRestore, FolderSearch, Palette, Check } from 'lucide-react'
import { AvatarStack, Button, EmptyState, Kbd, Menu, Popover, Tabs } from '@/components/ui'
import { toast, useUI } from '@/store/core'
import { formatDate } from '@/lib/utils'
import type { ViewMode } from '../types'
import { PROJECT_COLORS, STATUS_META, STATUSES, hexA, ink, isOverdue, projectProgress } from '../constants'
import { useProjects } from '../store'
import { useProjectPrefs } from '../prefs'
import { useFilteredTasks, useTaskParams } from '../hooks'
import { FiltersBar } from '../components/FiltersBar'
import { SprintWidget } from '../components/SprintWidget'
import { Board } from './Board'
import { ListView } from './List'
import { Timeline } from './Timeline'
import { Insights } from './Insights'

export function ProjectView({ projectId }: { projectId: string }) {
  const project = useProjects((s) => s.projects.find((p) => p.id === projectId))
  const projects = useProjects((s) => s.projects)
  const allTasks = useProjects((s) => s.tasks)
  const updateProject = useProjects((s) => s.updateProject)
  const view = useProjectPrefs((s) => s.views[projectId] ?? 'board')
  const setView = useProjectPrefs((s) => s.setView)
  const groupBy = useProjectPrefs((s) => s.filters.groupBy)
  const tasks = useFilteredTasks(projectId)
  const { openNew } = useTaskParams()
  const navigate = useNavigate()
  const projectTasks = useMemo(() => allTasks.filter((t) => t.projectId === projectId), [allTasks, projectId])

  if (!project)
    return (
      <EmptyState
        className="h-full"
        icon={<FolderSearch />}
        title="프로젝트를 찾을 수 없어요"
        description="삭제되었거나 주소가 잘못되었을 수 있습니다."
        action={<Button variant="primary" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/projects')}>프로젝트 목록으로</Button>}
      />
    )

  const pct = projectProgress(projectTasks)
  const overdue = projectTasks.filter(isOverdue).length

  const askAI = () => {
    const counts = STATUSES.map((s) => `${STATUS_META[s].label} ${projectTasks.filter((t) => t.status === s).length}`).join(', ')
    useUI.getState().askAI(`"${project.name}" 프로젝트 현황을 요약하고 리스크를 알려줘.\n진행률 ${pct}%, 상태별: ${counts}, 지연 ${overdue}건, 목표일 ${formatDate(project.endDate, 'M월 d일')}.`)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden [container-type:inline-size]">
      {/* ambient project glow */}
      <div className="pointer-events-none absolute -top-24 left-1/3 h-56 w-[min(40rem,60%)] rounded-full opacity-25 blur-3xl" style={{ background: project.color }} />

      <div className="relative shrink-0 px-6 pb-4 pt-6 [@container(min-width:1000px)]:px-8">
        <div className="mb-3 flex items-center gap-1.5 text-[12.5px] text-subtle">
          <Link to="/projects" className="transition hover:text-fg">프로젝트</Link>
          <span>/</span>
          <Menu
            placement="bottom-start"
            trigger={<button className="flex items-center gap-1 rounded-md px-1 py-0.5 text-muted transition hover:bg-line/[0.06] hover:text-fg">{project.emoji} {project.name}<ChevronDown className="h-3 w-3" /></button>}
            items={projects.filter((p) => !p.archived).map((p) => ({ label: `${p.emoji} ${p.name}`, icon: p.id === projectId ? <Check /> : undefined, onClick: () => navigate(`/projects/${p.id}`) }))}
          />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 basis-[320px] items-center gap-4">
            <motion.div
              initial={{ scale: 0.7, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
              style={{ background: hexA(project.color, 0.16), boxShadow: `inset 0 0 0 1px ${hexA(project.color, 0.4)}, 0 12px 32px -8px ${hexA(project.color, 0.8)}` }}
            >
              {project.emoji}
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <h1 className="truncate font-display text-2xl font-bold tracking-tight text-fg">{project.name}</h1>
                <span className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold" style={{ background: hexA(project.color, 0.15), color: ink(project.color) }}>{project.key}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                <span className="min-w-0 max-w-[460px] truncate" title={project.description}>{project.description}</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line/10"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: project.color }} /></span>
                  <span className="tabular-nums">{pct}%</span>
                </span>
                {overdue > 0 && <span className="text-danger">지연 {overdue}</span>}
              </div>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2.5 [@container(min-width:700px)]:gap-3">
            <div className="hidden w-[300px] [@container(min-width:1100px)]:block"><SprintWidget project={project} tasks={allTasks} compact /></div>
            <AvatarStack userIds={project.memberIds} size="sm" max={5} />
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openNew}>
              새 태스크 <Kbd className="ml-1 border-white/20 bg-white/10 text-white">C</Kbd>
            </Button>
            <Popover placement="bottom-end" className="w-56" trigger={({ toggle }) => <Button size="icon" variant="secondary" onClick={toggle}><MoreHorizontal className="h-4 w-4" /></Button>}>
              {(close) => (
                <div className="flex flex-col">
                  <button onClick={() => { askAI(); close() }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-fg/90 hover:bg-line/[0.07]"><Sparkles className="h-4 w-4 text-accent" />AI 현황 요약</button>
                  <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-subtle"><Palette className="mr-1 inline h-3 w-3" />프로젝트 컬러</div>
                  <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
                    {PROJECT_COLORS.map((c) => (
                      <button key={c} onClick={() => updateProject(project.id, { color: c })} className="h-5 w-5 rounded-full transition hover:scale-110" style={{ background: c, boxShadow: project.color === c ? `0 0 0 2px rgb(var(--surface)), 0 0 0 3.5px ${c}` : undefined }} />
                    ))}
                  </div>
                  <div className="my-1 h-px bg-line/10" />
                  {project.archived ? (
                    <button
                      onClick={() => { updateProject(project.id, { archived: false }); close(); toast('프로젝트를 복원했습니다', { description: project.name, variant: 'success' }) }}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-fg/90 hover:bg-line/[0.07]"
                    >
                      <ArchiveRestore className="h-4 w-4" />보관 해제
                    </button>
                  ) : (
                    <button
                      onClick={() => { updateProject(project.id, { archived: true }); close(); toast('프로젝트를 보관했습니다', { description: `${project.name} · 프로젝트 목록의 '보관됨'에서 복원할 수 있어요` }); navigate('/projects') }}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-danger hover:bg-danger/10"
                    >
                      <Archive className="h-4 w-4" />프로젝트 보관
                    </button>
                  )}
                </div>
              )}
            </Popover>
          </div>
        </div>

        {project.archived && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-fg">
            <Archive className="h-4 w-4 shrink-0 text-warning" />
            <span className="min-w-0 flex-1">보관된 프로젝트입니다. 프로젝트 목록에서는 '보관됨' 필터에서만 보여요.</span>
            <Button size="xs" variant="secondary" leftIcon={<ArchiveRestore className="h-3.5 w-3.5" />} onClick={() => { updateProject(project.id, { archived: false }); toast('프로젝트를 복원했습니다', { description: project.name, variant: 'success' }) }}>보관 해제</Button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Tabs<ViewMode>
            className="max-w-full overflow-x-auto scrollbar-none"
            value={view}
            onChange={(v) => setView(projectId, v)}
            items={[
              { value: 'board', label: '보드', icon: <Columns3 /> },
              { value: 'list', label: '리스트', icon: <List />, count: tasks.length },
              { value: 'timeline', label: '타임라인', icon: <GanttChartSquare /> },
              { value: 'insights', label: '인사이트', icon: <BarChart3 /> },
            ]}
          />
          <div className="hidden h-6 w-px bg-line/10 [@container(min-width:1100px)]:block" />
          {/* own full-width row below the view switcher on narrow panes; inline on wide ones */}
          <div className="min-w-0 basis-full [@container(min-width:1100px)]:flex-1 [@container(min-width:1100px)]:basis-0">
            <FiltersBar memberIds={project.memberIds} showGroupBy={view === 'list'} />
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={view === 'board' || view === 'timeline' ? 'absolute inset-0' : 'absolute inset-0 overflow-y-auto pt-1'}
          >
            {view === 'board' && <Board project={project} tasks={tasks} />}
            {view === 'list' && <ListView project={project} tasks={tasks} groupBy={groupBy} />}
            {view === 'timeline' && <Timeline project={project} tasks={tasks} />}
            {view === 'insights' && <Insights project={project} tasks={tasks} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
