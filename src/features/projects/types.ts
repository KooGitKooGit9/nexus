export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type Priority = 'urgent' | 'high' | 'medium' | 'low'

export interface Sprint {
  name: string
  startDate: string
  endDate: string
  goal?: string
}

export interface Project {
  id: string
  key: string // e.g. "NX"
  name: string
  description?: string
  emoji: string
  color: string // hex
  leadId: string
  memberIds: string[]
  startDate: string
  endDate: string
  archived?: boolean
  /** Current sprint (optional) */
  sprint?: Sprint
  /** Next task number to assign (optional; derived from tasks when missing) */
  nextNumber?: number
  createdAt?: string
}

export interface Subtask { id: string; title: string; done: boolean }
export interface TaskComment { id: string; userId: string; text: string; createdAt: string }

export interface TaskActivity {
  id: string
  userId: string
  /** Human readable, e.g. "상태를 진행 중으로 변경했습니다" */
  text: string
  createdAt: string
}

export interface Task {
  id: string
  number: number // displayed as `${project.key}-${number}`
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
  assigneeIds: string[]
  reporterId: string
  labels: string[]
  startDate?: string
  dueDate?: string
  estimate?: number // story points
  subtasks: Subtask[]
  comments: TaskComment[]
  createdAt: string
  updatedAt: string
  completedAt?: string
  order: number // ordering within a status column
  activity?: TaskActivity[]
}

export type ViewMode = 'board' | 'list' | 'timeline' | 'insights'
export type GroupBy = 'status' | 'priority' | 'assignee' | 'label' | 'none'

export interface TaskFilters {
  search: string
  assigneeIds: string[]
  priorities: Priority[]
  labels: string[]
  mineOnly: boolean
  groupBy: GroupBy
}
