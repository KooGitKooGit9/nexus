import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId, getUser, useCore } from '@/store/core'
import { notifyMembers, mentionedUserIds } from '@/app/notifyMembers'
import type { Priority, Project, Task, TaskActivity, TaskStatus } from './types'
import { PRIORITY_META, STATUS_META, josa } from './constants'
import { SEED_PROJECTS, SEED_TASKS } from './seed'

export interface NewTaskInput {
  projectId: string
  title: string
  description?: string
  status?: TaskStatus
  priority?: Priority
  assigneeIds?: string[]
  labels?: string[]
  startDate?: string
  dueDate?: string
  estimate?: number
}

export interface NewProjectInput {
  name: string
  key: string
  emoji: string
  color: string
  description?: string
  leadId?: string
  memberIds?: string[]
  startDate?: string
  endDate?: string
}

export type TaskPatch = Partial<Omit<Task, 'id' | 'number' | 'createdAt'>>

interface ProjectsState {
  projects: Project[]
  tasks: Task[]

  createTask: (input: NewTaskInput) => Task
  updateTask: (id: string, patch: TaskPatch) => void
  /** Move a task to `status` at position `index` within that project's status column. */
  moveTask: (id: string, status: TaskStatus, index: number) => void
  deleteTask: (id: string) => void
  bulkUpdate: (ids: string[], patch: TaskPatch) => void
  bulkDelete: (ids: string[]) => void

  addSubtask: (taskId: string, title: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  updateSubtask: (taskId: string, subtaskId: string, title: string) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void

  addComment: (taskId: string, text: string) => void
  deleteComment: (taskId: string, commentId: string) => void

  createProject: (input: NewProjectInput) => Project
  updateProject: (id: string, patch: Partial<Omit<Project, 'id'>>) => void
}

const now = () => new Date().toISOString()

function act(text: string): TaskActivity {
  return { id: uid('act'), userId: getCurrentUserId(), text, createdAt: now() }
}

/** Builds human-readable activity entries for a patch. */
function describe(before: Task, patch: TaskPatch): TaskActivity[] {
  const out: TaskActivity[] = []
  if (patch.status && patch.status !== before.status) out.push(act(`상태를 ${josa(STATUS_META[patch.status].label, '으로')} 변경했습니다`))
  if (patch.priority && patch.priority !== before.priority) out.push(act(`우선순위를 ${josa(PRIORITY_META[patch.priority].label, '으로')} 변경했습니다`))
  if (patch.title !== undefined && patch.title !== before.title) out.push(act('제목을 수정했습니다'))
  if (patch.description !== undefined && patch.description !== before.description) out.push(act('설명을 수정했습니다'))
  if (patch.assigneeIds) {
    const added = patch.assigneeIds.filter((x) => !before.assigneeIds.includes(x))
    const removed = before.assigneeIds.filter((x) => !patch.assigneeIds!.includes(x))
    if (added.length) out.push(act(`${added.map((a) => getUser(a)?.name ?? '알 수 없음').join(', ')}님을 담당자로 추가했습니다`))
    if (removed.length) out.push(act(`${removed.map((a) => getUser(a)?.name ?? '알 수 없음').join(', ')}님을 담당자에서 제외했습니다`))
  }
  if (patch.labels && patch.labels.join() !== before.labels.join()) out.push(act('라벨을 변경했습니다'))
  if ((patch.dueDate !== undefined || 'dueDate' in patch) && patch.dueDate !== before.dueDate) out.push(act(patch.dueDate ? '마감일을 변경했습니다' : '마감일을 제거했습니다'))
  if (patch.startDate !== undefined && patch.startDate !== before.startDate) out.push(act('시작일을 변경했습니다'))
  if (patch.estimate !== undefined && patch.estimate !== before.estimate) out.push(act(`추정치를 ${patch.estimate}pt로 설정했습니다`))
  if (patch.projectId && patch.projectId !== before.projectId) out.push(act('프로젝트를 이동했습니다'))
  return out
}

function keyOf(projects: Project[], t: Task) {
  return `${projects.find((p) => p.id === t.projectId)?.key ?? 'T'}-${t.number}`
}

/** Newly-added assignees (other than the actor) get a notification in their own browser. */
function notifyIfAssignedToMe(projects: Project[], before: string[], after: string[], task: Task) {
  const added = after.filter((id) => !before.includes(id))
  if (!added.length) return
  const me = getCurrentUserId()
  notifyMembers(added, {
    type: 'task',
    title: `${getUser(me)?.name ?? '누군가'}님이 태스크를 할당했습니다`,
    body: `${keyOf(projects, task)} ${task.title}`,
    link: `/projects/${task.projectId}?task=${task.id}`,
    actorId: me,
  })
}

/** Applies status side-effects (completedAt). */
function withStatus(t: Task, status: TaskStatus | undefined): Partial<Task> {
  if (!status || status === t.status) return {}
  return { completedAt: status === 'done' ? now() : undefined }
}

export const useProjects = create<ProjectsState>()(
  persisted<ProjectsState>(
    'projects',
    (set, get) => ({
      projects: SEED_PROJECTS,
      tasks: SEED_TASKS,

      createTask: (input) => {
        const { projects, tasks } = get()
        const project = projects.find((p) => p.id === input.projectId)
        const number = project?.nextNumber ?? Math.max(0, ...tasks.filter((t) => t.projectId === input.projectId).map((t) => t.number)) + 1
        const status = input.status ?? 'todo'
        const col = tasks.filter((t) => t.projectId === input.projectId && t.status === status)
        const me = getCurrentUserId()
        const task: Task = {
          id: uid('t'),
          number,
          projectId: input.projectId,
          title: input.title.trim() || '제목 없음',
          description: input.description,
          status,
          priority: input.priority ?? 'medium',
          assigneeIds: input.assigneeIds ?? [],
          reporterId: me,
          labels: input.labels ?? [],
          startDate: input.startDate,
          dueDate: input.dueDate,
          estimate: input.estimate,
          subtasks: [],
          comments: [],
          createdAt: now(),
          updatedAt: now(),
          completedAt: status === 'done' ? now() : undefined,
          order: col.length ? Math.max(...col.map((t) => t.order)) + 1000 : 0,
          activity: [act('태스크를 생성했습니다')],
        }
        set((s) => ({
          tasks: [...s.tasks, task],
          projects: s.projects.map((p) => (p.id === input.projectId ? { ...p, nextNumber: number + 1 } : p)),
        }))
        notifyIfAssignedToMe(projects, [], task.assigneeIds, task)
        return task
      },

      updateTask: (id, patch) => {
        const { tasks, projects } = get()
        const before = tasks.find((t) => t.id === id)
        if (!before) return
        const entries = describe(before, patch)
        let next: Task = { ...before, ...patch, ...withStatus(before, patch.status), updatedAt: now(), activity: [...(before.activity ?? []), ...entries] }
        // Moving to another project: take a fresh number there (keys must stay unique) and append to its column.
        const target = patch.projectId && patch.projectId !== before.projectId ? projects.find((p) => p.id === patch.projectId) : undefined
        if (target) {
          const siblings = tasks.filter((t) => t.projectId === target.id)
          const number = target.nextNumber ?? Math.max(0, ...siblings.map((t) => t.number)) + 1
          const col = siblings.filter((t) => t.status === next.status)
          next = { ...next, number, order: col.length ? Math.max(...col.map((t) => t.order)) + 1000 : 0 }
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === id ? next : t)),
            projects: s.projects.map((p) => (p.id === target.id ? { ...p, nextNumber: number + 1 } : p)),
          }))
        } else set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? next : t)) }))
        if (patch.assigneeIds) notifyIfAssignedToMe(get().projects, before.assigneeIds, patch.assigneeIds, next)
      },

      moveTask: (id, status, index) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return
        const column = get()
          .tasks.filter((t) => t.projectId === task.projectId && t.status === status && t.id !== id)
          .sort((a, b) => a.order - b.order)
        const i = Math.max(0, Math.min(index, column.length))
        const statusChanged = status !== task.status
        const moved: Task = {
          ...task,
          status,
          ...withStatus(task, status),
          updatedAt: statusChanged ? now() : task.updatedAt,
          activity: statusChanged ? [...(task.activity ?? []), act(`상태를 ${josa(STATUS_META[status].label, '으로')} 변경했습니다`)] : task.activity,
        }
        column.splice(i, 0, moved)
        const orders = new Map(column.map((t, idx) => [t.id, idx * 1000]))
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...moved, order: orders.get(id)! } : orders.has(t.id) ? { ...t, order: orders.get(t.id)! } : t)),
        }))
      },

      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      bulkUpdate: (ids, patch) => {
        const set_ = new Set(ids)
        const befores = get().tasks.filter((t) => set_.has(t.id))
        set((s) => ({
          tasks: s.tasks.map((t) =>
            set_.has(t.id) ? { ...t, ...patch, ...withStatus(t, patch.status), updatedAt: now(), activity: [...(t.activity ?? []), ...describe(t, patch)] } : t,
          ),
        }))
        if (patch.assigneeIds) {
          const projects = get().projects
          const byUser = new Map<string, Task[]>()
          for (const b of befores) for (const id of patch.assigneeIds) if (!b.assigneeIds.includes(id)) byUser.set(id, [...(byUser.get(id) ?? []), b])
          for (const [uid_, list] of byUser) {
            if (list.length === 1) notifyIfAssignedToMe(projects, list[0].assigneeIds, patch.assigneeIds, list[0])
            else
              notifyMembers([uid_], {
                type: 'task',
                title: `${getUser(getCurrentUserId())?.name ?? '누군가'}님이 태스크 ${list.length}개를 할당했습니다`,
                body: list.map((t) => keyOf(projects, t)).join(', '),
                link: `/projects/${list[0].projectId}`,
              })
          }
        }
      },

      bulkDelete: (ids) => {
        const s_ = new Set(ids)
        set((s) => ({ tasks: s.tasks.filter((t) => !s_.has(t.id)) }))
      },

      addSubtask: (taskId, title) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: uid('st'), title, done: false }], updatedAt: now(), activity: [...(t.activity ?? []), act(`하위 작업 "${title}"${josa(title, '을').slice(title.length)} 추가했습니다`)] } : t,
          ),
        })),
      toggleSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            const sub = t.subtasks.find((x) => x.id === subtaskId)
            return {
              ...t,
              subtasks: t.subtasks.map((x) => (x.id === subtaskId ? { ...x, done: !x.done } : x)),
              updatedAt: now(),
              activity: sub && !sub.done ? [...(t.activity ?? []), act(`하위 작업 "${sub.title}"${josa(sub.title, '을').slice(sub.title.length)} 완료했습니다`)] : t.activity,
            }
          }),
        })),
      updateSubtask: (taskId, subtaskId, title) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: t.subtasks.map((x) => (x.id === subtaskId ? { ...x, title } : x)) } : t)) })),
      deleteSubtask: (taskId, subtaskId) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: t.subtasks.filter((x) => x.id !== subtaskId) } : t)) })),

      addComment: (taskId, text) => {
        const me = getCurrentUserId()
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, comments: [...t.comments, { id: uid('cm'), userId: me, text, createdAt: now() }], updatedAt: now() }
              : t,
          ),
        }))
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        const key = keyOf(get().projects, task)
        const link = `/projects/${task.projectId}?task=${task.id}`
        const myName = getUser(me)?.name ?? '누군가'
        const mentioned = mentionedUserIds(text, useCore.getState().users)
        const snippet = text.length > 80 ? text.slice(0, 80) + '…' : text
        notifyMembers(mentioned, { type: 'mention', title: `${myName}님이 ${key} 댓글에서 회원님을 멘션했습니다`, body: snippet, link })
        notifyMembers(
          [...task.assigneeIds, task.reporterId].filter((id) => !mentioned.includes(id)),
          { type: 'task', title: `${myName}님이 ${key}에 댓글을 남겼습니다`, body: snippet, link },
        )
      },
      deleteComment: (taskId, commentId) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) } : t)) })),

      createProject: (input) => {
        const me = getCurrentUserId()
        const start = input.startDate ?? now()
        const end = input.endDate ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 42).toISOString()
        const project: Project = {
          id: uid('p'),
          key: input.key.toUpperCase().slice(0, 5),
          name: input.name.trim(),
          description: input.description,
          emoji: input.emoji,
          color: input.color,
          leadId: input.leadId ?? me,
          memberIds: Array.from(new Set([input.leadId ?? me, ...(input.memberIds ?? [])])),
          startDate: start,
          endDate: end,
          nextNumber: 1,
          createdAt: now(),
          sprint: { name: '스프린트 1', startDate: start, endDate: new Date(new Date(start).getTime() + 1000 * 60 * 60 * 24 * 14).toISOString() },
        }
        set((s) => ({ projects: [...s.projects, project] }))
        return project
      },
      updateProject: (id, patch) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    }),
    {
      version: 3,
      // Earlier skeleton persisted empty arrays — reseed on upgrade.
      migrate: (persistedState, version) => {
        const st = (persistedState ?? {}) as Partial<ProjectsState>
        if (version < 2 || !st.projects?.length) return { ...st, projects: SEED_PROJECTS, tasks: SEED_TASKS } as ProjectsState
        // v3: activity texts used hedged particles ("완료(으)로") — rewrite with the correct josa.
        if (version < 3 && st.tasks)
          st.tasks = st.tasks.map((t) => ({
            ...t,
            activity: t.activity?.map((a) => ({
              ...a,
              text: a.text
                .replace(/(진행 중|할 일|백로그|리뷰|완료|긴급|높음|보통|낮음)\(으\)로/g, (_, w: string) => josa(w, '으로'))
                .replace(/"([^"]+)"을\(를\)/g, (_, w: string) => `"${w}"${josa(w, '을').slice(w.length)}`),
            })),
          }))
        return st as ProjectsState
      },
    },
  ),
)
syncAcrossTabs(useProjects)

/* ───────────── Helpers ───────────── */

export function getTaskKey(task: Task): string {
  return keyOf(useProjects.getState().projects, task)
}
