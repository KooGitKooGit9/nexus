import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCore } from '@/store/core'
import { useProjects } from './store'
import { useProjectPrefs } from './prefs'
import type { Task, TaskFilters, Project } from './types'
import { taskKey } from './constants'

export function applyFilters(tasks: Task[], f: TaskFilters, me: string, projects: Project[]): Task[] {
  const q = f.search.trim().toLowerCase()
  return tasks.filter((t) => {
    if (f.mineOnly && !t.assigneeIds.includes(me)) return false
    if (f.assigneeIds.length && !t.assigneeIds.some((a) => f.assigneeIds.includes(a))) return false
    if (f.priorities.length && !f.priorities.includes(t.priority)) return false
    if (f.labels.length && !t.labels.some((l) => f.labels.includes(l))) return false
    if (q && !t.title.toLowerCase().includes(q) && !taskKey(t, projects).toLowerCase().includes(q) && !t.labels.some((l) => l.toLowerCase().includes(q))) return false
    return true
  })
}

/** Tasks of a project with the filter bar applied. */
export function useFilteredTasks(projectId: string | undefined): Task[] {
  const tasks = useProjects((s) => s.tasks)
  const projects = useProjects((s) => s.projects)
  const filters = useProjectPrefs((s) => s.filters)
  const me = useCore((s) => s.currentUserId)
  return useMemo(
    () => applyFilters(projectId ? tasks.filter((t) => t.projectId === projectId) : tasks, filters, me, projects),
    [tasks, projects, filters, me, projectId],
  )
}

/** `?task=<id>` & `?new=1` helpers. */
export function useTaskParams() {
  const [params, setParams] = useSearchParams()
  const taskId = params.get('task')
  const isNew = params.get('new') === '1'
  const openTask = useCallback(
    (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('task', id); return n }),
    [setParams],
  )
  const closeTask = useCallback(
    () => setParams((p) => { const n = new URLSearchParams(p); n.delete('task'); return n }),
    [setParams],
  )
  const openNew = useCallback(
    () => setParams((p) => { const n = new URLSearchParams(p); n.set('new', '1'); return n }),
    [setParams],
  )
  const closeNew = useCallback(
    () => setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n }),
    [setParams],
  )
  return { taskId, isNew, openTask, closeTask, openNew, closeNew }
}
