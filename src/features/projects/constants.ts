import { differenceInCalendarDays, isBefore, startOfDay } from 'date-fns'
import type { Priority, Project, Task, TaskStatus } from './types'

export const STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done']

export const STATUS_META: Record<TaskStatus, { label: string; color: string; text: string; bg: string; dot: string }> = {
  backlog: { label: '백로그', color: '#94a3b8', text: 'text-slate-400', bg: 'bg-slate-400/15', dot: 'bg-slate-400' },
  todo: { label: '할 일', color: '#60a5fa', text: 'text-blue-400', bg: 'bg-blue-400/15', dot: 'bg-blue-400' },
  in_progress: { label: '진행 중', color: '#fbbf24', text: 'text-amber-400', bg: 'bg-amber-400/15', dot: 'bg-amber-400' },
  review: { label: '리뷰', color: '#a78bfa', text: 'text-violet-400', bg: 'bg-violet-400/15', dot: 'bg-violet-400' },
  done: { label: '완료', color: '#34d399', text: 'text-emerald-400', bg: 'bg-emerald-400/15', dot: 'bg-emerald-400' },
}

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

export const PRIORITY_META: Record<Priority, { label: string; color: string; text: string; rank: number }> = {
  urgent: { label: '긴급', color: '#f43f5e', text: 'text-rose-500', rank: 0 },
  high: { label: '높음', color: '#fb923c', text: 'text-orange-400', rank: 1 },
  medium: { label: '보통', color: '#facc15', text: 'text-yellow-400', rank: 2 },
  low: { label: '낮음', color: '#94a3b8', text: 'text-slate-400', rank: 3 },
}

export const LABEL_COLORS: Record<string, string> = {
  프론트엔드: '#22d3ee',
  백엔드: '#8b5cf6',
  디자인: '#f472b6',
  버그: '#f43f5e',
  기능: '#34d399',
  개선: '#60a5fa',
  리서치: '#fbbf24',
  인프라: '#a3e635',
  문서: '#c084fc',
  보안: '#fb923c',
  마케팅: '#f9a8d4',
  'AI/ML': '#2dd4bf',
  성능: '#facc15',
  모바일: '#38bdf8',
}
export const ALL_LABELS = Object.keys(LABEL_COLORS)

export function labelColor(label: string): string {
  if (LABEL_COLORS[label]) return LABEL_COLORS[label]
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0
  return ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'][h % 6]
}

export const WIP_LIMIT = 6

export const PROJECT_COLORS = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185', '#a3e635']
export const PROJECT_EMOJIS = ['🚀', '📱', '🤖', '🎨', '🛠️', '⚡️', '🌈', '🧭', '🔥', '💎', '🛰️', '🌱', '📈', '🧪', '🎯', '🪐']

export function taskKey(task: Pick<Task, 'number' | 'projectId'>, projects: Project[] | Project | undefined): string {
  const p = Array.isArray(projects) ? projects.find((x) => x.id === task.projectId) : projects
  return `${p?.key ?? 'T'}-${task.number}`
}

export function isOverdue(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate || task.status === 'done') return false
  return isBefore(new Date(task.dueDate), startOfDay(new Date()))
}

export type DueBucket = 'overdue' | 'today' | 'week' | 'later'
export const DUE_BUCKET_META: Record<DueBucket, { label: string; tone: string; emoji: string }> = {
  overdue: { label: '지연됨', tone: 'text-danger', emoji: '🔥' },
  today: { label: '오늘', tone: 'text-warning', emoji: '☀️' },
  week: { label: '이번 주', tone: 'text-accent-2', emoji: '📅' },
  later: { label: '나중에', tone: 'text-muted', emoji: '🌙' },
}

export function dueBucket(task: Pick<Task, 'dueDate' | 'status'>): DueBucket {
  if (!task.dueDate) return 'later'
  const diff = differenceInCalendarDays(new Date(task.dueDate), new Date())
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7) return 'week'
  return 'later'
}

export function dueLabel(iso: string): string {
  const diff = differenceInCalendarDays(new Date(iso), new Date())
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'
  if (diff < 0) return `${-diff}일 지남`
  if (diff < 7) return `${diff}일 후`
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function projectProgress(tasks: Task[]): number {
  if (!tasks.length) return 0
  return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100)
}

/** Converts "#rrggbb" to "r g b" so it can be used with rgba(). */
export function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/**
 * Readable text color derived from a bright brand/status color: blends it with the `fg` token so
 * pale hues (amber, lime, yellow) stay legible on light surfaces while keeping their tint in dark mode.
 */
export function ink(hex: string, amount = 72): string {
  return `color-mix(in srgb, ${hex} ${amount}%, rgb(var(--fg)))`
}

/** Picks the right Korean particle for `word`: josa('완료', '으로') → '완료로', josa('진행 중', '으로') → '진행 중으로'. */
export function josa(word: string, kind: '으로' | '을' | '이' | '은'): string {
  const ch = word.trim().charCodeAt(word.trim().length - 1)
  const pairs = { 으로: ['으로', '로', '(으)로'], 을: ['을', '를', '을(를)'], 이: ['이', '가', '이(가)'], 은: ['은', '는', '은(는)'] } as const
  const [withB, withoutB, unknown] = pairs[kind]
  if (!(ch >= 0xac00 && ch <= 0xd7a3)) return word + unknown
  const jong = (ch - 0xac00) % 28
  if (kind === '으로') return word + (jong === 0 || jong === 8 ? withoutB : withB) // ㄹ받침 → 로
  return word + (jong === 0 ? withoutB : withB)
}
