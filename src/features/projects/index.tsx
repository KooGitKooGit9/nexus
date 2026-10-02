import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTaskParams } from './hooks'
import { useProjects } from './store'
import { Overview } from './views/Overview'
import { ProjectView } from './views/ProjectView'
import { TaskDrawer } from './components/TaskDrawer'
import { CreateTaskModal } from './components/CreateTaskModal'

/** `c` opens the create-task modal while on any projects page. */
function useCreateHotkey(open: () => void, disabled: boolean) {
  useEffect(() => {
    let gAt = 0 // ignore the `g c` (go to calendar) chord handled by the shell
    if (disabled) return // e.g. a task drawer is open
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'g') { gAt = Date.now(); return }
      if (Date.now() - gAt < 1000) return
      // 'ㅊ' = the C key while the Korean IME is active
      if ((e.key.toLowerCase() !== 'c' && e.key !== 'ㅊ') || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat || e.isComposing) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      open()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, disabled])
}

export default function ProjectsPage() {
  const params = useParams()
  const projectId = (params['*'] ?? '').split('/')[0] || undefined
  const { isNew, openNew, closeNew, taskId } = useTaskParams()
  // a stale/invalid `?task=` (deleted task) shouldn't disable the shortcut
  const drawerOpen = useProjects((s) => !!taskId && s.tasks.some((t) => t.id === taskId))
  useCreateHotkey(openNew, drawerOpen || isNew)

  return (
    <>
      {projectId ? <ProjectView key={projectId} projectId={projectId} /> : <Overview />}
      <TaskDrawer />
      <CreateTaskModal open={isNew} onClose={closeNew} defaultProjectId={projectId} />
    </>
  )
}
