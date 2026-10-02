/**
 * Nexus AI tools — Gemini function declarations + executors that run against the REAL workspace
 * stores (the same actions the feature UIs call, so sync/notifications behave identically).
 *
 * Every executor returns compact JSON for the model (`result`) and, for writes, an action card for
 * the chat (`card`) with a deep link and — where feasible — an undo spec.
 */
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useCore, getUser, getCurrentUserId } from '@/store/core'
import { COMPANY } from '@/store/seed-users'
import type { Presence, User } from '@/store/types'
import { useInbox } from '@/lib/inbox'
import { isUserOnline } from '@/lib/sync'
import { notifyMembers } from '@/app/notifyMembers'
import { useMessenger, isTimelineMessage } from '@/features/messenger/store'
import { channelTitle } from '@/features/messenger/lib'
import { respondTo } from '@/features/messenger/simulator'
import type { Channel } from '@/features/messenger/types'
import { useProjects, getTaskKey, type TaskPatch } from '@/features/projects/store'
import { STATUS_META as TASK_STATUS, PRIORITY_META } from '@/features/projects/constants'
import type { Priority, Project, Task, TaskStatus } from '@/features/projects/types'
import { useCalendar, findFreeSlots, userConflict } from '@/features/calendar/store'
import { generateMeetLink } from '@/features/calendar/utils'
import type { CalEvent, RsvpStatus } from '@/features/calendar/types'
import { useDocs } from '@/features/docs/store'
import type { Doc } from '@/features/docs/types'
import { useFiles } from '@/features/files/store'
import { useGoals } from '@/features/goals/store'
import { objectiveProgress, krProgress } from '@/features/goals/lib'
import type { AnnouncementCategory } from '@/features/goals/types'
import { useApprovals } from '@/features/approvals/store'
import { KIND_META, STATUS_META as APV_STATUS, isPendingOn, leaveDays } from '@/features/approvals/meta'
import type { ApprovalKind, ApprovalRequest, LeaveType } from '@/features/approvals/types'
import { usePeople } from '@/features/people/store'
import { KUDOS_BADGES } from '@/features/people/lib'
import type { KudosBadge } from '@/features/people/types'
import { searchAll } from '../palette/catalog'
import type { FunctionDeclaration, Schema } from './gemini'
import { clip, endOfLocalDay, isAllowedPath, parseTaskKey, parseWhen, resolveNamed, resolvePeople, resolvePerson, startOfLocalDay, type Resolved } from './schema'
import type { PromptContext } from './prompt'

/* ───────────── types ───────────── */

export type Args = Record<string, unknown>

export type UndoSpec =
  | { kind: 'message'; id: string }
  | { kind: 'task'; id: string }
  | { kind: 'task_patch'; id: string; before: Record<string, unknown> }
  | { kind: 'comment'; taskId: string; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'event_patch'; id: string; before: Record<string, unknown> }
  | { kind: 'event_restore'; event: CalEvent }
  | { kind: 'rsvp'; id: string; before: RsvpStatus | null }
  | { kind: 'doc'; id: string }
  | { kind: 'doc_content'; id: string; before: string }
  | { kind: 'announcement'; id: string }
  | { kind: 'approval'; id: string }
  | { kind: 'kudos'; id: string }
  | { kind: 'status'; emoji: string | null; text: string | null; presence: Presence }

export interface ActionCardData {
  tool: string
  emoji: string
  title: string
  detail?: string
  /** quoted content (message text, doc excerpt…) */
  quote?: string
  href?: string
  linkLabel?: string
  warning?: string
  undo?: UndoSpec
  undone?: boolean
}

export interface ToolOutput {
  result: Record<string, unknown>
  card?: ActionCardData
}

export interface ToolCtx {
  navigate: (path: string) => void
}

/** What the "보내기 전 확인" card shows for an outbound tool. */
export interface ConfirmPreview {
  title: string
  emoji: string
  target: string
  /** editable body; written back to `args[textKey]` */
  text: string
  textKey: string
  userIds?: string[]
}

export interface ToolDef {
  decl: FunctionDeclaration
  emoji: string
  write?: boolean
  /** DM / post / announcement / approval decision — gated by "보내기 전 확인" */
  outbound?: boolean
  label: (a: Args) => string
  preview?: (a: Args) => ConfirmPreview
  run: (a: Args, ctx: ToolCtx) => ToolOutput
}

/* ───────────── helpers ───────────── */

const me = () => getCurrentUserId()
const users = () => useCore.getState().users
const nameOf = (id?: string | null) => getUser(id)?.name ?? '알 수 없음'
const names = (ids: string[]) => ids.map(nameOf).join(', ')
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])
const when = (iso: string | Date) => format(new Date(iso), 'M/d(EEE) HH:mm', { locale: ko })
const day = (iso: string | Date) => format(new Date(iso), 'M/d(EEE)', { locale: ko })
const given = (u?: User) => (u && /^[가-힣]{3}$/.test(u.name) ? u.name.slice(1) : u?.name ?? '')

class ToolError extends Error {}
const fail = (msg: string): never => { throw new ToolError(msg) }
const must = <T,>(r: Resolved<T>): T => (r.ok ? r.value : fail(r.error))

function person(ref: string): User {
  return must(resolvePerson(ref, users(), me()))
}
function peopleOf(refs: string[]): User[] {
  return must(resolvePeople(refs, users(), me()))
}

/** notifyMembers, unless the feature store already notified that person about the same thing just now. */
function notifyOnce(userIds: string[], n: Parameters<typeof notifyMembers>[1]) {
  const since = Date.now() - 5000
  const inbox = useInbox.getState().items
  const fresh = userIds.filter((id) => !inbox.some((i) => i.userId === id && i.link === n.link && i.type === n.type && +new Date(i.createdAt) >= since))
  notifyMembers(fresh, n)
}

/* channels */
const visibleChannels = () =>
  useMessenger.getState().channels.filter((c) => !c.archived && (c.kind === 'public' || c.memberIds.includes(me())))

function channelRef(ref: string): Channel {
  const all = visibleChannels()
  const r = ref.trim()
  const byId = all.find((c) => c.id === r)
  if (byId) return byId
  const named = all.filter((c) => c.kind === 'public' || c.kind === 'private')
  const hit = resolveNamed(r, named, (c) => [c.name], '채널')
  if (hit.ok) return hit.value
  // a person's name → our DM with them
  const p = resolvePerson(r, users(), me())
  if (p.ok) {
    const key = [me(), p.value.id].sort().join(',')
    const dm = all.find((c) => c.kind === 'dm' && [...c.memberIds].sort().join(',') === key)
    if (dm) return dm
    return fail(`${p.value.name}님과의 DM 대화가 아직 없습니다`)
  }
  return fail(hit.error)
}
const channelLink = (c: Channel) => `/messages/${c.id}`
const chLabel = (c: Channel) => (c.kind === 'dm' || c.kind === 'group' ? `DM: ${channelTitle(c)}` : `#${c.name}`)

/* projects / tasks */
function projectRef(ref: string): Project {
  const ps = useProjects.getState().projects.filter((p) => !p.archived)
  const r = ref.trim()
  const byKey = ps.find((p) => p.key.toLowerCase() === r.toLowerCase())
  if (byKey) return byKey
  return must(resolveNamed(r, ps, (p) => [p.name, p.key], '프로젝트'))
}
function taskRef(ref: string): Task {
  const { tasks, projects } = useProjects.getState()
  const r = ref.trim()
  const byId = tasks.find((t) => t.id === r)
  if (byId) return byId
  const k = parseTaskKey(r)
  if (k) {
    const p = projects.find((x) => x.key.toUpperCase() === k.key)
    const t = p && tasks.find((x) => x.projectId === p.id && x.number === k.number)
    if (t) return t
    return fail(`태스크 ${r}를 찾지 못했습니다`)
  }
  return must(resolveNamed(r, tasks.filter((t) => t.status !== 'done'), (t) => [t.title], '태스크'))
}
const taskLink = (t: Task) => `/projects/${t.projectId}?task=${t.id}`
function taskBrief(t: Task) {
  const p = useProjects.getState().projects.find((x) => x.id === t.projectId)
  return {
    id: t.id,
    key: getTaskKey(t),
    title: t.title,
    status: TASK_STATUS[t.status].label,
    priority: PRIORITY_META[t.priority].label,
    assignees: names(t.assigneeIds),
    due: t.dueDate ? day(t.dueDate) : null,
    overdue: !!t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date(),
    project: p ? `${p.emoji} ${p.name}` : undefined,
    link: taskLink(t),
  }
}

/* events */
function eventRef(ref: string): CalEvent {
  const evs = useCalendar.getState().events.filter((e) => e.type !== 'holiday')
  const r = ref.trim()
  const byId = evs.find((e) => e.id === r)
  if (byId) return byId
  // prefer upcoming events of mine with that title
  const mine = evs.filter((e) => e.attendeeIds.includes(me()) && new Date(e.end) >= new Date(Date.now() - 86400000)).sort((a, b) => +new Date(a.start) - +new Date(b.start))
  return must(resolveNamed(r, mine.length ? mine : evs, (e) => [e.title], '일정'))
}
const eventLink = (e: CalEvent) => `/calendar?event=${e.id}`
function eventBrief(e: CalEvent) {
  return {
    id: e.id,
    title: e.title,
    when: e.allDay ? `${day(e.start)} 종일` : `${when(e.start)} – ${format(new Date(e.end), 'HH:mm')}`,
    start: e.start,
    end: e.end,
    type: e.type,
    location: e.location || undefined,
    video: !!e.videoLink || undefined,
    organizer: nameOf(e.organizerId),
    attendees: e.attendeeIds.length <= 8 ? names(e.attendeeIds) : `${names(e.attendeeIds.slice(0, 8))} 외 ${e.attendeeIds.length - 8}명`,
    myRsvp: e.rsvp?.[me()],
    link: eventLink(e),
  }
}

/* docs */
function docRef(ref: string): Doc {
  return must(resolveNamed(ref, useDocs.getState().docs, (d) => [d.title || '제목 없음'], '문서'))
}

/* approvals */
function approvalRef(ref: string): ApprovalRequest {
  const rs = useApprovals.getState().requests
  const r = ref.trim()
  const hit = rs.find((x) => x.id === r || x.docNo === r)
  if (hit) return hit
  return must(resolveNamed(r, rs.filter((x) => x.status === 'pending'), (x) => [x.title], '결재 문서'))
}
function approvalBrief(r: ApprovalRequest) {
  const cur = r.steps.find((s) => s.status === 'pending')
  return {
    id: r.id,
    docNo: r.docNo,
    kind: KIND_META[r.kind].label,
    title: r.title,
    requester: nameOf(r.requesterId),
    status: APV_STATUS[r.status].label,
    amount: r.amount ? `₩${r.amount.toLocaleString('ko-KR')}` : undefined,
    period: r.startDate ? `${day(r.startDate)}${r.endDate && r.endDate !== r.startDate ? ` ~ ${day(r.endDate)}` : ''}` : undefined,
    currentApprover: cur ? nameOf(cur.approverId) : undefined,
    waitingOnMe: isPendingOn(r, me()),
    createdAt: day(r.createdAt),
    link: `/approvals?id=${r.id}`,
  }
}

function managerChain(userId: string, depth: number): string[] {
  const out: string[] = []
  let cur = getUser(userId)?.managerId
  while (cur && out.length < depth && !out.includes(cur)) {
    out.push(cur)
    cur = getUser(cur)?.managerId
  }
  return out
}

/* ───────────── schema shorthands ───────────── */

const S = (description: string, extra: Partial<Schema> = {}): Schema => ({ type: 'STRING', description, ...extra })
const N = (description: string): Schema => ({ type: 'INTEGER', description })
const B = (description: string): Schema => ({ type: 'BOOLEAN', description })
const A = (description: string, items: Schema = { type: 'STRING' }): Schema => ({ type: 'ARRAY', description, items })
// Gemini rejects OBJECT schemas with empty `properties` — parameterless tools omit `parameters` instead.
const O = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'OBJECT', properties, ...(required.length ? { required } : {}) })

const PERSON = '사용자 id(u_…) 또는 이름'
const STATUS_ENUM: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done']
const PRIORITY_ENUM: Priority[] = ['urgent', 'high', 'medium', 'low']
const CATEGORIES: AnnouncementCategory[] = ['전사공지', '인사', '제품', '이벤트', 'IT']
const KINDS: ApprovalKind[] = ['leave', 'expense', 'purchase', 'travel', 'access', 'general']
const BADGES = Object.keys(KUDOS_BADGES) as KudosBadge[]

/* ───────────── READ tools ───────────── */

const READ: ToolDef[] = [
  {
    decl: {
      name: 'search_workspace',
      description: '워크스페이스 전체(메시지, 채널, 태스크, 프로젝트, 문서, 파일, 일정, 결재, OKR, 공지, 구성원, 워크플로우, 화이트보드)를 키워드로 검색합니다.',
      parameters: O({ query: S('검색어'), limit: N('최대 결과 수 (기본 12)') }, ['query']),
    },
    emoji: '🔎',
    label: (a) => `🔎 "${clip(str(a.query), 20)}" 검색 중`,
    run: (a) => {
      const hits = searchAll(str(a.query)).slice(0, Math.min(30, Number(a.limit) || 12))
      return { result: { count: hits.length, results: hits.map((h) => ({ group: h.group, title: h.title, subtitle: h.subtitle, link: h.href })) } }
    },
  },
  {
    decl: {
      name: 'get_schedule',
      description: '캘린더 일정을 조회합니다. 기본은 사용자 본인의 오늘 일정입니다.',
      parameters: O({
        from: S('시작 (ISO 8601 또는 YYYY-MM-DD). 기본: 오늘'),
        to: S('끝 (ISO 8601 또는 YYYY-MM-DD, 그 날 끝까지 포함). 기본: from과 같은 날'),
        user: S(`누구의 일정인지 (${PERSON}). 기본: 본인`),
      }),
    },
    emoji: '📅',
    label: (a) => {
      if (!a.user) return '📅 일정 확인 중'
      const r = resolvePerson(str(a.user), users(), me())
      return `📅 ${r.ok ? r.value.name : str(a.user)}님 일정 확인 중`
    },
    run: (a) => {
      const who = a.user ? person(str(a.user)) : getUser(me())!
      const from = parseWhen(str(a.from)) ?? new Date()
      const toRaw = str(a.to)
      const to = toRaw ? (/^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? endOfLocalDay(parseWhen(toRaw)!) : parseWhen(toRaw) ?? endOfLocalDay(from)) : endOfLocalDay(from)
      const start = /^\d{4}-\d{2}-\d{2}$/.test(str(a.from)) || !a.from ? startOfLocalDay(from) : from
      const evs = useCalendar
        .getState()
        .events.filter((e) => (e.attendeeIds.includes(who.id) || e.organizerId === who.id || e.type === 'holiday') && new Date(e.end) >= start && new Date(e.start) <= to)
        .sort((x, y) => +new Date(x.start) - +new Date(y.start))
      return { result: { person: who.name, range: `${when(start)} ~ ${when(to)}`, count: evs.length, events: evs.slice(0, 40).map(eventBrief) } }
    },
  },
  {
    decl: {
      name: 'find_free_time',
      description: '여러 사람이 모두 비어 있는 회의 가능 시간(평일 9–18시, 점심 제외)을 찾습니다. 사용자 본인은 자동 포함됩니다.',
      parameters: O({
        attendees: A(`참석자 (${PERSON}) 목록`),
        durationMin: N('회의 길이(분)'),
        days: N('오늘부터 며칠 안에서 찾을지 (기본 7)'),
        from: S('이 시점 이후부터 찾기 (ISO 8601 또는 YYYY-MM-DD). 기본: 지금'),
      }, ['durationMin']),
    },
    emoji: '🕐',
    label: () => '🕐 모두 가능한 시간 찾는 중',
    run: (a) => {
      const ppl = peopleOf(strs(a.attendees))
      const ids = Array.from(new Set([me(), ...ppl.map((u) => u.id)]))
      const from = parseWhen(str(a.from)) ?? undefined
      const slots = findFreeSlots(useCalendar.getState().events, { attendeeIds: ids, durationMin: Math.max(10, Number(a.durationMin) || 30), days: Number(a.days) || 7, from, limit: 6 })
      return {
        result: {
          attendees: names(ids),
          slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), label: `${when(s.start)} – ${format(s.end, 'HH:mm')}` })),
          note: slots.length ? undefined : '조건 안에서 모두 비는 시간이 없습니다. 기간을 늘리거나 참석자를 줄여보세요.',
        },
      }
    },
  },
  {
    decl: {
      name: 'list_tasks',
      description: '프로젝트 태스크 목록을 조회합니다. 조건을 생략하면 사용자 본인에게 할당된 미완료 태스크입니다.',
      parameters: O({
        assignee: S(`담당자 (${PERSON}), "all"이면 담당자 무관`),
        status: S('상태 필터. open = 완료 제외(기본)', { enum: ['open', 'all', ...STATUS_ENUM] }),
        project: S('프로젝트 id, key(예: NX) 또는 이름'),
        due: S('마감 필터', { enum: ['any', 'overdue', 'today', 'this_week', 'none'] }),
        query: S('제목/설명 키워드'),
        limit: N('최대 개수 (기본 25)'),
      }),
    },
    emoji: '✅',
    label: () => '✅ 태스크 확인 중',
    run: (a) => {
      const project = a.project ? projectRef(str(a.project)) : null
      const assignee = str(a.assignee)
      const who = assignee && assignee !== 'all' ? person(assignee) : !assignee && !project ? getUser(me())! : null
      const status = str(a.status) || 'open'
      const due = str(a.due) || 'any'
      const q = str(a.query).toLowerCase()
      const now = new Date()
      const eod = endOfLocalDay(now)
      const eow = endOfLocalDay(new Date(now.getTime() + ((7 - now.getDay()) % 7) * 86400000))
      let list = useProjects.getState().tasks.filter((t) => {
        if (project && t.projectId !== project.id) return false
        if (who && !t.assigneeIds.includes(who.id)) return false
        if (status === 'open' ? t.status === 'done' : status !== 'all' && t.status !== status) return false
        if (q && !`${t.title} ${t.description ?? ''} ${t.labels.join(' ')}`.toLowerCase().includes(q)) return false
        const d = t.dueDate ? new Date(t.dueDate) : null
        if (due === 'none' && d) return false
        if (due === 'overdue' && !(d && d < now && t.status !== 'done')) return false
        if (due === 'today' && !(d && d <= eod)) return false
        if (due === 'this_week' && !(d && d <= eow)) return false
        return true
      })
      list = list.sort((x, y) => PRIORITY_META[x.priority].rank - PRIORITY_META[y.priority].rank || (x.dueDate ?? '9999').localeCompare(y.dueDate ?? '9999'))
      return {
        result: {
          filter: { assignee: who?.name ?? '전체', project: project?.name, status, due },
          total: list.length,
          tasks: list.slice(0, Math.min(60, Number(a.limit) || 25)).map(taskBrief),
        },
      }
    },
  },
  {
    decl: {
      name: 'get_task',
      description: '태스크 하나의 상세(설명, 하위 작업, 최근 댓글, 활동)를 조회합니다.',
      parameters: O({ task: S('태스크 키(예: NX-12), id 또는 제목') }, ['task']),
    },
    emoji: '🗂️',
    label: (a) => `🗂️ ${clip(str(a.task), 18)} 확인 중`,
    run: (a) => {
      const t = taskRef(str(a.task))
      return {
        result: {
          ...taskBrief(t),
          description: clip(t.description, 2000) || undefined,
          labels: t.labels,
          reporter: nameOf(t.reporterId),
          estimate: t.estimate,
          subtasks: t.subtasks.map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`),
          comments: t.comments.slice(-6).map((c) => ({ by: nameOf(c.userId), text: clip(c.text, 300), at: when(c.createdAt) })),
          recentActivity: (t.activity ?? []).slice(-5).map((x) => `${nameOf(x.userId)} ${x.text} (${when(x.createdAt)})`),
        },
      }
    },
  },
  {
    decl: {
      name: 'get_channel_messages',
      description: '채널 또는 DM의 최근 메시지를 읽습니다(요약·확인용).',
      parameters: O({
        channel: S('채널 이름(#제외 가능), 채널 id, 또는 DM 상대 이름'),
        limit: N('최대 메시지 수 (기본 30, 최대 80)'),
        sinceHours: N('최근 몇 시간 이내만'),
      }, ['channel']),
    },
    emoji: '💬',
    label: (a) => `💬 ${str(a.channel).startsWith('#') ? str(a.channel) : `#${str(a.channel)}`} 대화 읽는 중`,
    run: (a) => {
      const ch = channelRef(str(a.channel))
      if (ch.kind === 'private' && !ch.memberIds.includes(me())) fail('참여하지 않은 비공개 채널입니다')
      const since = a.sinceHours ? Date.now() - Number(a.sinceHours) * 3600_000 : 0
      const all = useMessenger.getState().messages
      const msgs = all
        .filter((m) => m.channelId === ch.id && isTimelineMessage(m) && m.kind !== 'system' && +new Date(m.createdAt) >= since)
        .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
        .slice(-Math.min(80, Number(a.limit) || 30))
      return {
        result: {
          channel: chLabel(ch),
          topic: ch.topic,
          link: channelLink(ch),
          count: msgs.length,
          messages: msgs.map((m) => {
            const replies = all.filter((r) => r.threadId === m.id).length
            return {
              id: m.id,
              from: nameOf(m.userId),
              at: when(m.createdAt),
              text: clip(m.text || (m.kind ? `[${m.kind}]` : ''), 500) || (m.attachments?.length ? `[첨부 ${m.attachments.map((x) => x.name).join(', ')}]` : ''),
              ...(replies ? { replies } : {}),
              ...(m.pinned ? { pinned: true } : {}),
            }
          }),
        },
      }
    },
  },
  {
    decl: { name: 'list_channels', description: '사용자가 볼 수 있는 채널과 DM 목록(안 읽은 수 포함)을 조회합니다.', parameters: O({ includeDMs: B('DM도 포함할지 (기본 true)') }) },
    emoji: '#️⃣',
    label: () => '#️⃣ 채널 목록 확인 중',
    run: (a) => {
      const ms = useMessenger.getState()
      const list = visibleChannels().filter((c) => !c.isApp && (a.includeDMs !== false || (c.kind !== 'dm' && c.kind !== 'group')))
      return {
        result: {
          channels: list.map((c) => {
            const u = ms.unreadFor(c.id)
            return { id: c.id, name: chLabel(c), kind: c.kind, joined: c.memberIds.includes(me()), members: c.memberIds.length, topic: c.topic, unread: u.count || undefined, mentions: u.mentions || undefined, link: channelLink(c) }
          }),
        },
      }
    },
  },
  {
    decl: {
      name: 'list_people',
      description: '구성원 목록(직함, 부서, 상태, 위치)을 조회합니다.',
      parameters: O({ query: S('이름/직함/스킬 키워드'), department: S('부서', { enum: ['경영', '제품', '엔지니어링', '디자인', '마케팅', '영업', '피플팀'] }) }),
    },
    emoji: '👥',
    label: () => '👥 구성원 확인 중',
    run: (a) => {
      const q = str(a.query).toLowerCase()
      const list = users().filter((u) => (!a.department || u.department === a.department) && (!q || `${u.name} ${u.nameEn} ${u.title} ${u.skills.join(' ')} ${u.department}`.toLowerCase().includes(q)))
      return {
        result: {
          people: list.map((u) => ({ id: u.id, name: u.name, title: u.title, department: u.department, presence: u.presence, online: isUserOnline(u.id) || undefined, status: u.statusText ? `${u.statusEmoji ?? ''} ${u.statusText}`.trim() : undefined, location: u.location, link: `/people/${u.id}` })),
        },
      }
    },
  },
  {
    decl: { name: 'get_person', description: '구성원 한 명의 프로필, 매니저/팀원, 오늘 일정, 진행 중 태스크 수를 조회합니다.', parameters: O({ person: S(PERSON) }, ['person']) },
    emoji: '👤',
    label: (a) => `👤 ${clip(str(a.person), 12)}님 정보 확인 중`,
    run: (a) => {
      const u = person(str(a.person))
      const today0 = startOfLocalDay(new Date())
      const today1 = endOfLocalDay(new Date())
      const evs = useCalendar.getState().events.filter((e) => e.attendeeIds.includes(u.id) && e.type !== 'holiday' && new Date(e.end) >= today0 && new Date(e.start) <= today1)
      const open = useProjects.getState().tasks.filter((t) => t.assigneeIds.includes(u.id) && t.status !== 'done').length
      return {
        result: {
          id: u.id, name: u.name, nameEn: u.nameEn, title: u.title, department: u.department, email: u.email, phone: u.phone, location: u.location, timezone: u.timezone,
          presence: u.presence, online: isUserOnline(u.id), status: u.statusText ? `${u.statusEmoji ?? ''} ${u.statusText}`.trim() : undefined,
          manager: u.managerId ? nameOf(u.managerId) : undefined,
          reports: users().filter((x) => x.managerId === u.id).map((x) => x.name),
          skills: u.skills, joinedAt: u.joinedAt, bio: u.bio,
          todayEvents: evs.map((e) => `${e.allDay ? '종일' : format(new Date(e.start), 'HH:mm')} ${e.title}`),
          openTasks: open,
          link: `/people/${u.id}`,
        },
      }
    },
  },
  {
    decl: { name: 'get_doc', description: '문서 본문(마크다운)을 읽습니다. 요약·인용할 때 사용하세요.', parameters: O({ doc: S('문서 id 또는 제목') }, ['doc']) },
    emoji: '📄',
    label: (a) => `📄 "${clip(str(a.doc), 18)}" 읽는 중`,
    run: (a) => {
      const d = docRef(str(a.doc))
      const docs = useDocs.getState().docs
      return {
        result: {
          id: d.id, title: d.title || '제목 없음', emoji: d.emoji, author: nameOf(d.authorId), lastEditedBy: nameOf(d.lastEditedBy), updatedAt: when(d.updatedAt), tags: d.tags,
          parent: d.parentId ? docs.find((x) => x.id === d.parentId)?.title : undefined,
          children: docs.filter((x) => x.parentId === d.id).map((x) => x.title),
          content: d.content.length > 7000 ? d.content.slice(0, 7000) + '\n…(이하 생략)' : d.content,
          link: `/docs/${d.id}`,
        },
      }
    },
  },
  {
    decl: { name: 'list_docs', description: '문서 목록을 조회합니다. query가 있으면 제목·태그·본문에서 찾고, 없으면 최근 수정순입니다.', parameters: O({ query: S('키워드'), limit: N('최대 개수 (기본 15)') }) },
    emoji: '📚',
    label: () => '📚 문서 찾는 중',
    run: (a) => {
      const q = str(a.query).toLowerCase()
      const docs = useDocs.getState().docs
        .filter((d) => !q || `${d.title} ${(d.tags ?? []).join(' ')} ${d.content}`.toLowerCase().includes(q))
        .sort((x, y) => {
          if (q) {
            const tx = x.title.toLowerCase().includes(q) ? 0 : 1
            const ty = y.title.toLowerCase().includes(q) ? 0 : 1
            if (tx !== ty) return tx - ty
          }
          return y.updatedAt.localeCompare(x.updatedAt)
        })
      return { result: { total: docs.length, docs: docs.slice(0, Math.min(40, Number(a.limit) || 15)).map((d) => ({ id: d.id, title: `${d.emoji} ${d.title || '제목 없음'}`, updatedAt: when(d.updatedAt), by: nameOf(d.lastEditedBy), excerpt: clip(d.content.replace(/[#>*`|\-]/g, ' '), 120), link: `/docs/${d.id}` })) } }
    },
  },
  {
    decl: {
      name: 'list_approvals',
      description: '전자결재 문서를 조회합니다. inbox = 내가 결재할 차례인 문서, mine = 내가 올린 문서, all = 나와 관련된 모든 문서.',
      parameters: O({ box: S('결재함', { enum: ['inbox', 'mine', 'all'] }), status: S('상태 필터', { enum: ['pending', 'approved', 'rejected', 'cancelled', 'any'] }) }, ['box']),
    },
    emoji: '🖋️',
    label: (a) => (a.box === 'inbox' ? '🖋️ 결재함 확인 중' : '🖋️ 결재 문서 확인 중'),
    run: (a) => {
      const m = me()
      const box = str(a.box) || 'inbox'
      const status = str(a.status) || 'any'
      const rs = useApprovals.getState().requests.filter((r) => {
        if (box === 'inbox' && !isPendingOn(r, m)) return false
        if (box === 'mine' && r.requesterId !== m) return false
        if (box === 'all' && r.requesterId !== m && !r.steps.some((s) => s.approverId === m) && !r.ccIds?.includes(m)) return false
        return status === 'any' || r.status === status
      })
      return { result: { box, total: rs.length, approvals: rs.slice(0, 30).map((r) => ({ ...approvalBrief(r), details: clip(r.details, 200) || undefined })) } }
    },
  },
  {
    decl: { name: 'get_okrs', description: 'OKR(목표와 핵심결과) 진척도를 조회합니다.', parameters: O({ quarter: S('분기, 예: "2026 Q4". 기본: 현재 분기'), owner: S(`소유자 (${PERSON})`) }) },
    emoji: '🎯',
    label: () => '🎯 OKR 진척도 확인 중',
    run: (a) => {
      const objs = useGoals.getState().objectives
      const now = new Date()
      const cur = `${now.getFullYear()} Q${Math.floor(now.getMonth() / 3) + 1}`
      const quarters = Array.from(new Set(objs.map((o) => o.quarter)))
      const q = str(a.quarter) || (quarters.includes(cur) ? cur : [...quarters].sort().pop() ?? cur)
      const owner = a.owner ? person(str(a.owner)) : null
      const list = objs.filter((o) => o.quarter === q && (!owner || o.ownerId === owner.id))
      return {
        result: {
          quarter: q,
          availableQuarters: quarters,
          objectives: list.map((o) => ({
            id: o.id, title: `${o.emoji ?? ''} ${o.title}`.trim(), team: o.team, owner: nameOf(o.ownerId), status: o.status, progress: `${Math.round(objectiveProgress(o))}%`,
            keyResults: o.keyResults.map((k) => ({ title: k.title, owner: nameOf(k.ownerId), current: `${k.current}${k.unit}`, target: `${k.target}${k.unit}`, progress: `${Math.round(krProgress(k))}%` })),
            link: `/goals?quarter=${encodeURIComponent(o.quarter)}&id=${o.id}`,
          })),
        },
      }
    },
  },
  {
    decl: { name: 'list_announcements', description: '최근 공지사항을 조회합니다.', parameters: O({ limit: N('최대 개수 (기본 8)'), unreadOnly: B('안 읽은 공지만') }) },
    emoji: '📣',
    label: () => '📣 공지 확인 중',
    run: (a) => {
      const m = me()
      const list = useGoals.getState().announcements
        .filter((x) => !a.unreadOnly || !x.readBy.includes(m))
        .sort((x, y) => Number(!!y.pinned) - Number(!!x.pinned) || y.createdAt.localeCompare(x.createdAt))
        .slice(0, Math.min(30, Number(a.limit) || 8))
      return { result: { announcements: list.map((x) => ({ id: x.id, title: x.title, category: x.category, author: nameOf(x.authorId), at: day(x.createdAt), pinned: x.pinned || undefined, read: x.readBy.includes(m), excerpt: clip(x.body.replace(/[#>*`]/g, ''), 220), link: `/announcements?id=${x.id}` })) } }
    },
  },
  {
    decl: { name: 'list_files', description: '드라이브 파일/폴더를 조회합니다.', parameters: O({ query: S('파일명 키워드'), limit: N('최대 개수 (기본 20)') }) },
    emoji: '🗂️',
    label: () => '🗂️ 드라이브 확인 중',
    run: (a) => {
      const q = str(a.query).toLowerCase()
      const files = useFiles.getState().files.filter((f) => !f.trashed && (!q || f.name.toLowerCase().includes(q) || (f.description ?? '').toLowerCase().includes(q))).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
      return {
        result: {
          total: files.length,
          files: files.slice(0, Math.min(50, Number(a.limit) || 20)).map((f) => ({ id: f.id, name: f.name, kind: f.kind, size: f.size, owner: nameOf(f.ownerId), updatedAt: day(f.updatedAt), link: f.kind === 'folder' ? `/files/${f.id}` : `/files/${f.parentId ?? ''}?file=${f.id}` })),
        },
      }
    },
  },
  {
    decl: { name: 'get_unread_summary', description: '안 읽은 메시지·멘션, 알림, 공지, 내 결재 대기, 오늘 마감/지연 태스크, 다음 일정을 한 번에 요약합니다. 브리핑에 사용하세요.' },
    emoji: '📬',
    label: () => '📬 새 소식 모으는 중',
    run: () => {
      const m = me()
      const ms = useMessenger.getState()
      const channels = visibleChannels()
        .filter((c) => c.memberIds.includes(m))
        .map((c) => ({ c, u: ms.unreadFor(c.id) }))
        .filter((x) => x.u.count > 0)
        .sort((x, y) => y.u.mentions - x.u.mentions || y.u.count - x.u.count)
      const notifs = useCore.getState().notifications.filter((n) => !n.read)
      const anns = useGoals.getState().announcements.filter((x) => !x.readBy.includes(m))
      const inbox = useApprovals.getState().requests.filter((r) => isPendingOn(r, m))
      const now = new Date()
      const eod = endOfLocalDay(now)
      const myTasks = useProjects.getState().tasks.filter((t) => t.assigneeIds.includes(m) && t.status !== 'done' && t.dueDate)
      const next = useCalendar.getState().events.filter((e) => e.attendeeIds.includes(m) && !e.allDay && e.type !== 'holiday' && new Date(e.start) >= now).sort((x, y) => +new Date(x.start) - +new Date(y.start)).slice(0, 3)
      return {
        result: {
          unreadChannels: channels.slice(0, 10).map((x) => ({ channel: chLabel(x.c), unread: x.u.count, mentions: x.u.mentions || undefined, link: channelLink(x.c) })),
          notifications: { unread: notifs.length, latest: notifs.slice(0, 5).map((n) => ({ title: n.title, body: clip(n.body, 80), link: n.link })) },
          unreadAnnouncements: anns.slice(0, 5).map((x) => ({ title: x.title, link: `/announcements?id=${x.id}` })),
          approvalsWaitingOnMe: inbox.slice(0, 6).map(approvalBrief),
          overdueTasks: myTasks.filter((t) => new Date(t.dueDate!) < now).map(taskBrief),
          dueToday: myTasks.filter((t) => new Date(t.dueDate!) >= now && new Date(t.dueDate!) <= eod).map(taskBrief),
          nextEvents: next.map(eventBrief),
        },
      }
    },
  },
]

/* ───────────── WRITE tools ───────────── */

function sendTo(channelId: string, text: string, threadId?: string) {
  const msg = useMessenger.getState().sendMessage({ channelId, text, threadId })
  try { respondTo(msg) } catch { /* simulator is best-effort */ }
  return msg
}

const WRITE: ToolDef[] = [
  {
    decl: {
      name: 'send_dm',
      description: '한 명 또는 여러 명에게 DM을 보냅니다(여러 명이면 그룹 DM). text는 사용자 본인이 직접 쓰는 것처럼 자연스럽게 작성하세요.',
      parameters: O({ recipients: A(`받는 사람 (${PERSON}) 목록`), text: S('보낼 메시지 본문 (마크다운 가능)') }, ['recipients', 'text']),
    },
    emoji: '💬',
    write: true,
    outbound: true,
    label: (a) => {
      const r = resolvePeople(strs(a.recipients), users(), me())
      return `💬 ${r.ok ? r.value.map((u) => u.name).join(', ') : strs(a.recipients).join(', ')}님에게 DM 전송`
    },
    preview: (a) => {
      const ppl = peopleOf(strs(a.recipients))
      return { title: 'DM 보내기', emoji: '💬', target: ppl.map((u) => u.name).join(', '), userIds: ppl.map((u) => u.id), text: str(a.text), textKey: 'text' }
    },
    run: (a) => {
      const ppl = peopleOf(strs(a.recipients)).filter((u) => u.id !== me())
      if (!ppl.length) fail('받는 사람이 없습니다 (본인에게는 보낼 수 없어요)')
      const text = str(a.text).trim() || fail('보낼 내용이 비어 있습니다')
      const ch = useMessenger.getState().openDM(ppl.map((u) => u.id))
      const msg = sendTo(ch.id, text)
      const who = ppl.map((u) => u.name).join(', ')
      return {
        result: { ok: true, sentTo: who, channelId: ch.id, messageId: msg.id, link: `/messages/${ch.id}?m=${msg.id}` },
        card: { tool: 'send_dm', emoji: '💬', title: `${who}님에게 DM을 보냈어요`, quote: text, href: `/messages/${ch.id}`, linkLabel: ppl.length > 1 ? '그룹 DM 열기' : 'DM 열기', undo: { kind: 'message', id: msg.id } },
      }
    },
  },
  {
    decl: {
      name: 'post_message',
      description: '채널에 메시지를 게시합니다. threadOf에 메시지 id를 주면 그 스레드에 답글로 답니다.',
      parameters: O({ channel: S('채널 이름(#제외 가능) 또는 id'), text: S('게시할 본문 (마크다운, @이름 멘션 가능)'), threadOf: S('답글을 달 메시지 id') }, ['channel', 'text']),
    },
    emoji: '📮',
    write: true,
    outbound: true,
    label: (a) => `📮 #${str(a.channel).replace(/^#/, '')}에 게시`,
    preview: (a) => {
      const ch = channelRef(str(a.channel))
      return { title: a.threadOf ? '스레드에 답글' : '채널에 게시', emoji: '📮', target: `${chLabel(ch)} · 멤버 ${ch.memberIds.length}명`, text: str(a.text), textKey: 'text' }
    },
    run: (a) => {
      const ch = channelRef(str(a.channel))
      const text = str(a.text).trim() || fail('게시할 내용이 비어 있습니다')
      let joined = false
      if (!ch.memberIds.includes(me())) {
        if (ch.kind !== 'public') fail('참여하지 않은 비공개 채널에는 게시할 수 없습니다')
        useMessenger.getState().joinChannel(ch.id)
        joined = true
      }
      let threadId: string | undefined
      if (a.threadOf) {
        const root = useMessenger.getState().messages.find((m) => m.id === str(a.threadOf) && m.channelId === ch.id)
        if (!root) fail('threadOf 메시지를 이 채널에서 찾지 못했습니다')
        threadId = root!.threadId ?? root!.id
      }
      const msg = sendTo(ch.id, text, threadId)
      const link = threadId ? `/messages/${ch.id}/thread/${threadId}?m=${msg.id}` : `/messages/${ch.id}?m=${msg.id}`
      return {
        result: { ok: true, channel: chLabel(ch), messageId: msg.id, joinedChannel: joined || undefined, link },
        card: { tool: 'post_message', emoji: '📮', title: `${chLabel(ch)}${threadId ? ' 스레드' : ''}에 게시했어요`, quote: text, href: link, linkLabel: '메시지 보기', undo: { kind: 'message', id: msg.id }, warning: joined ? '채널에 참여한 뒤 게시했어요' : undefined },
      }
    },
  },
  {
    decl: {
      name: 'create_announcement',
      description: '전사 공지를 등록하고 모든 구성원에게 알림을 보냅니다. 본문은 마크다운으로 정돈해서 작성하세요.',
      parameters: O({
        title: S('공지 제목'),
        body_markdown: S('공지 본문 (마크다운)'),
        category: S('분류', { enum: CATEGORIES }),
        pinned: B('상단 고정 여부'),
        emoji: S('커버 이모지 하나 (선택)'),
      }, ['title', 'body_markdown', 'category']),
    },
    emoji: '📣',
    write: true,
    outbound: true,
    label: (a) => `📣 공지 "${clip(str(a.title), 18)}" 등록`,
    preview: (a) => ({ title: '공지 등록', emoji: '📣', target: `${str(a.category) || '전사공지'} · 전 구성원에게 알림 · ${clip(str(a.title), 40)}`, text: str(a.body_markdown), textKey: 'body_markdown' }),
    run: (a) => {
      const title = str(a.title).trim() || fail('제목이 비어 있습니다')
      const body = str(a.body_markdown).trim() || fail('본문이 비어 있습니다')
      const category = (CATEGORIES.includes(str(a.category) as AnnouncementCategory) ? str(a.category) : '전사공지') as AnnouncementCategory
      const emoji = str(a.emoji).trim() ? Array.from(str(a.emoji).trim())[0] : undefined
      const id = useGoals.getState().addAnnouncement({ title, body, category, authorId: me(), pinned: !!a.pinned, ...(emoji ? { emoji } : {}) })
      const link = `/announcements?id=${id}`
      notifyOnce(users().map((u) => u.id), { type: 'system', title: `📣 새 공지: ${title}`, body: clip(body.replace(/[#>*`]/g, ''), 90), link })
      return {
        result: { ok: true, id, notified: users().length - 1, link },
        card: { tool: 'create_announcement', emoji: '📣', title: `공지 "${title}"를 등록했어요`, detail: `${category}${a.pinned ? ' · 상단 고정' : ''} · 구성원 ${users().length - 1}명에게 알림`, href: link, linkLabel: '공지 보기', undo: { kind: 'announcement', id } },
      }
    },
  },
  {
    decl: {
      name: 'create_task',
      description: '프로젝트에 태스크를 만듭니다.',
      parameters: O({
        project: S('프로젝트 id, key(예: NX) 또는 이름'),
        title: S('태스크 제목'),
        description: S('설명 (마크다운)'),
        assignees: A(`담당자 (${PERSON}) 목록`),
        priority: S('우선순위', { enum: PRIORITY_ENUM }),
        dueDate: S('마감일 (YYYY-MM-DD 또는 ISO 8601)'),
        labels: A('라벨 목록'),
        status: S('초기 상태 (기본 todo)', { enum: STATUS_ENUM }),
      }, ['project', 'title']),
    },
    emoji: '✅',
    write: true,
    label: (a) => `✅ 태스크 "${clip(str(a.title), 20)}" 생성`,
    run: (a) => {
      const p = projectRef(str(a.project))
      const assignees = peopleOf(strs(a.assignees)).map((u) => u.id)
      const dueRaw = str(a.dueDate)
      const due = dueRaw ? parseWhen(dueRaw) ?? fail('dueDate 형식이 올바르지 않습니다') : null
      if (due && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) due.setHours(18, 0, 0, 0)
      const t = useProjects.getState().createTask({
        projectId: p.id,
        title: str(a.title).trim(),
        description: str(a.description).trim() || undefined,
        assigneeIds: assignees,
        priority: (str(a.priority) as Priority) || 'medium',
        dueDate: due ? due.toISOString() : undefined,
        labels: strs(a.labels),
        status: (str(a.status) as TaskStatus) || 'todo',
      })
      const key = getTaskKey(t)
      notifyOnce(assignees, { type: 'task', title: `${nameOf(me())}님이 태스크를 할당했습니다`, body: `${key} ${t.title}`, link: taskLink(t) })
      return {
        result: { ok: true, ...taskBrief(t) },
        card: { tool: 'create_task', emoji: '✅', title: `${key} 태스크를 만들었어요`, detail: [t.title, assignees.length ? `담당 ${names(assignees)}` : '', t.dueDate ? `마감 ${day(t.dueDate)}` : '', PRIORITY_META[t.priority].label].filter(Boolean).join(' · '), href: taskLink(t), linkLabel: `${key} 열기`, undo: { kind: 'task', id: t.id } },
      }
    },
  },
  {
    decl: {
      name: 'update_task',
      description: '태스크의 상태, 담당자, 우선순위, 마감일, 제목, 설명을 바꿉니다. 바꿀 필드만 주세요.',
      parameters: O({
        task: S('태스크 키(예: NX-12), id 또는 제목'),
        status: S('새 상태', { enum: STATUS_ENUM }),
        assignees: A(`새 담당자 전체 목록 (${PERSON})`),
        addAssignees: A('기존 담당자에 추가할 사람'),
        priority: S('새 우선순위', { enum: PRIORITY_ENUM }),
        dueDate: S('새 마감일 (YYYY-MM-DD / ISO). "none"이면 마감일 제거'),
        title: S('새 제목'),
        description: S('새 설명'),
      }, ['task']),
    },
    emoji: '✏️',
    write: true,
    label: (a) => `✏️ ${clip(str(a.task), 18)} 수정`,
    run: (a) => {
      const t = taskRef(str(a.task))
      const patch: TaskPatch = {}
      if (a.status) patch.status = str(a.status) as TaskStatus
      if (a.priority) patch.priority = str(a.priority) as Priority
      if (a.title) patch.title = str(a.title).trim()
      if (a.description !== undefined) patch.description = str(a.description)
      if (a.assignees) patch.assigneeIds = peopleOf(strs(a.assignees)).map((u) => u.id)
      if (a.addAssignees) patch.assigneeIds = Array.from(new Set([...(patch.assigneeIds ?? t.assigneeIds), ...peopleOf(strs(a.addAssignees)).map((u) => u.id)]))
      if (a.dueDate) {
        const raw = str(a.dueDate)
        if (/^(none|null|없음)$/i.test(raw)) patch.dueDate = undefined
        else {
          const d = parseWhen(raw) ?? fail('dueDate 형식이 올바르지 않습니다')
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) d.setHours(18, 0, 0, 0)
          patch.dueDate = d.toISOString()
        }
      }
      const keys = Object.keys(patch) as (keyof TaskPatch)[]
      if (!keys.length) fail('바꿀 내용이 없습니다')
      const before: Record<string, unknown> = {}
      for (const k of keys) before[k] = (t as unknown as Record<string, unknown>)[k] ?? null
      useProjects.getState().updateTask(t.id, patch)
      const after = useProjects.getState().tasks.find((x) => x.id === t.id) ?? t
      const added = (patch.assigneeIds ?? []).filter((id) => !t.assigneeIds.includes(id))
      if (added.length) notifyOnce(added, { type: 'task', title: `${nameOf(me())}님이 태스크를 할당했습니다`, body: `${getTaskKey(after)} ${after.title}`, link: taskLink(after) })
      const changes = [
        patch.status && `상태 → ${TASK_STATUS[patch.status].label}`,
        patch.priority && `우선순위 → ${PRIORITY_META[patch.priority].label}`,
        patch.assigneeIds && `담당 → ${names(patch.assigneeIds) || '없음'}`,
        'dueDate' in patch && `마감 → ${patch.dueDate ? day(patch.dueDate) : '없음'}`,
        patch.title && '제목 변경',
        patch.description !== undefined && '설명 변경',
      ].filter(Boolean).join(' · ')
      return {
        result: { ok: true, changes, task: taskBrief(after) },
        card: { tool: 'update_task', emoji: '✏️', title: `${getTaskKey(after)} 태스크를 수정했어요`, detail: changes, href: taskLink(after), linkLabel: `${getTaskKey(after)} 열기`, undo: { kind: 'task_patch', id: t.id, before } },
      }
    },
  },
  {
    decl: { name: 'add_task_comment', description: '태스크에 댓글을 남깁니다(@이름 멘션 가능).', parameters: O({ task: S('태스크 키(예: NX-12), id 또는 제목'), text: S('댓글 내용') }, ['task', 'text']) },
    emoji: '💭',
    write: true,
    label: (a) => `💭 ${clip(str(a.task), 18)}에 댓글`,
    run: (a) => {
      const t = taskRef(str(a.task))
      const text = str(a.text).trim() || fail('댓글 내용이 비어 있습니다')
      useProjects.getState().addComment(t.id, text)
      const after = useProjects.getState().tasks.find((x) => x.id === t.id)
      const c = [...(after?.comments ?? [])].reverse().find((x) => x.userId === me() && x.text === text)
      return {
        result: { ok: true, task: getTaskKey(t), link: taskLink(t) },
        card: { tool: 'add_task_comment', emoji: '💭', title: `${getTaskKey(t)}에 댓글을 남겼어요`, quote: text, href: taskLink(t), linkLabel: '태스크 열기', undo: c ? { kind: 'comment', taskId: t.id, id: c.id } : undefined },
      }
    },
  },
  {
    decl: {
      name: 'create_event',
      description: '캘린더 일정(회의)을 만들고 참석자를 초대합니다. 참석자의 기존 일정과 겹치면 경고를 돌려줍니다.',
      parameters: O({
        title: S('일정 제목'),
        start: S('시작 (ISO 8601, +09:00)'),
        end: S('끝 (ISO 8601). 생략하면 durationMin 또는 30분'),
        durationMin: N('길이(분), end 대신 사용 가능'),
        attendees: A(`참석자 (${PERSON}) 목록 — 사용자 본인은 자동 포함`),
        location: S('장소 / 회의실'),
        video: B('화상회의 링크 생성 여부'),
        description: S('설명 / 아젠다'),
        type: S('종류 (기본 meeting)', { enum: ['meeting', 'focus', 'personal', 'deadline', 'ooo'] }),
        allDay: B('종일 일정 여부'),
      }, ['title', 'start']),
    },
    emoji: '📅',
    write: true,
    label: (a) => `📅 "${clip(str(a.title), 18)}" 일정 생성`,
    run: (a) => {
      const start = parseWhen(str(a.start)) ?? fail('start 형식이 올바르지 않습니다 (ISO 8601)')
      let end = a.end ? parseWhen(str(a.end)) ?? fail('end 형식이 올바르지 않습니다') : new Date(start.getTime() + (Number(a.durationMin) || 30) * 60_000)
      const allDay = !!a.allDay
      if (allDay) { start.setHours(0, 0, 0, 0); end = endOfLocalDay(a.end ? end : start) }
      if (end <= start) fail('끝 시간이 시작 시간보다 빠릅니다')
      const ppl = peopleOf(strs(a.attendees))
      const ids = Array.from(new Set([me(), ...ppl.map((u) => u.id)]))
      const events = useCalendar.getState().events
      const conflicts = allDay ? [] : ids.map((id) => ({ id, ev: userConflict(events, id, start, end) })).filter((x) => x.ev)
      const ev = useCalendar.getState().createEvent({
        title: str(a.title).trim(),
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: allDay || undefined,
        type: (str(a.type) as CalEvent['type']) || 'meeting',
        attendeeIds: ids,
        location: str(a.location).trim() || undefined,
        videoLink: a.video ? generateMeetLink() : undefined,
        description: str(a.description).trim() || undefined,
      })
      const label = allDay ? `${day(ev.start)} 종일` : `${when(ev.start)} – ${format(new Date(ev.end), 'HH:mm')}`
      notifyOnce(ids, { type: 'event', title: `${nameOf(me())}님이 "${ev.title}"에 초대했습니다`, body: label, link: eventLink(ev) })
      const warning = conflicts.length ? `겹치는 일정: ${conflicts.map((c) => `${nameOf(c.id)} — ${c.ev!.title} (${format(new Date(c.ev!.start), 'HH:mm')})`).join(', ')}` : undefined
      return {
        result: { ok: true, ...eventBrief(ev), conflicts: conflicts.map((c) => ({ person: nameOf(c.id), event: c.ev!.title, when: when(c.ev!.start) })) },
        card: { tool: 'create_event', emoji: '📅', title: `"${ev.title}" 일정을 만들었어요`, detail: `${label}${ids.length > 1 ? ` · ${names(ids)}` : ''}${ev.videoLink ? ' · 화상회의' : ev.location ? ` · ${ev.location}` : ''}`, href: eventLink(ev), linkLabel: '캘린더에서 보기', warning, undo: { kind: 'event', id: ev.id } },
      }
    },
  },
  {
    decl: {
      name: 'update_event',
      description: '일정을 변경합니다(시간, 제목, 참석자, 장소, 설명). 바꿀 필드만 주세요.',
      parameters: O({
        event: S('일정 id 또는 제목'),
        title: S('새 제목'),
        start: S('새 시작 (ISO 8601)'),
        end: S('새 끝 (ISO 8601). start만 바꾸면 길이는 유지'),
        attendees: A('새 참석자 전체 목록'),
        addAttendees: A('추가할 참석자'),
        location: S('새 장소'),
        description: S('새 설명'),
      }, ['event']),
    },
    emoji: '🗓️',
    write: true,
    label: (a) => `🗓️ "${clip(str(a.event), 18)}" 일정 변경`,
    run: (a) => {
      const ev = eventRef(str(a.event))
      const patch: Partial<CalEvent> = {}
      if (a.title) patch.title = str(a.title).trim()
      if (a.start) {
        const s = parseWhen(str(a.start)) ?? fail('start 형식이 올바르지 않습니다')
        const dur = +new Date(ev.end) - +new Date(ev.start)
        patch.start = s.toISOString()
        patch.end = new Date(s.getTime() + dur).toISOString()
      }
      if (a.end) patch.end = (parseWhen(str(a.end)) ?? fail('end 형식이 올바르지 않습니다')).toISOString()
      if (a.attendees) patch.attendeeIds = Array.from(new Set([ev.organizerId, ...peopleOf(strs(a.attendees)).map((u) => u.id)]))
      if (a.addAttendees) patch.attendeeIds = Array.from(new Set([...(patch.attendeeIds ?? ev.attendeeIds), ...peopleOf(strs(a.addAttendees)).map((u) => u.id)]))
      if (a.location !== undefined) patch.location = str(a.location) || undefined
      if (a.description !== undefined) patch.description = str(a.description) || undefined
      const keys = Object.keys(patch) as (keyof CalEvent)[]
      if (!keys.length) fail('바꿀 내용이 없습니다')
      if (patch.start && patch.end && new Date(patch.end) <= new Date(patch.start)) fail('끝 시간이 시작 시간보다 빠릅니다')
      const before: Record<string, unknown> = {}
      for (const k of keys) before[k] = (ev as unknown as Record<string, unknown>)[k] ?? null
      useCalendar.getState().updateEvent(ev.id, patch)
      const after = useCalendar.getState().events.find((e) => e.id === ev.id) ?? ev
      const timeChanged = !!(patch.start || patch.end)
      const conflicts = timeChanged ? after.attendeeIds.map((id) => ({ id, c: userConflict(useCalendar.getState().events, id, new Date(after.start), new Date(after.end), after.id) })).filter((x) => x.c) : []
      notifyOnce(after.attendeeIds, { type: 'event', title: `"${after.title}" 일정이 변경되었습니다`, body: `${when(after.start)} – ${format(new Date(after.end), 'HH:mm')}`, link: eventLink(after) })
      return {
        result: { ok: true, event: eventBrief(after), conflicts: conflicts.map((x) => ({ person: nameOf(x.id), event: x.c!.title })) },
        card: { tool: 'update_event', emoji: '🗓️', title: `"${after.title}" 일정을 변경했어요`, detail: `${when(after.start)} – ${format(new Date(after.end), 'HH:mm')}`, href: eventLink(after), linkLabel: '캘린더에서 보기', warning: conflicts.length ? `겹치는 일정: ${conflicts.map((x) => `${nameOf(x.id)} — ${x.c!.title}`).join(', ')}` : undefined, undo: { kind: 'event_patch', id: ev.id, before } },
      }
    },
  },
  {
    decl: { name: 'cancel_event', description: '내가 주최한 일정을 취소(삭제)하고 참석자에게 알립니다. 남이 주최한 일정은 rsvp_event로 불참 처리하세요.', parameters: O({ event: S('일정 id 또는 제목') }, ['event']) },
    emoji: '🗑️',
    write: true,
    label: (a) => `🗑️ "${clip(str(a.event), 18)}" 일정 취소`,
    run: (a) => {
      const ev = eventRef(str(a.event))
      if (ev.organizerId !== me()) fail(`${nameOf(ev.organizerId)}님이 주최한 일정이라 취소할 수 없습니다. rsvp_event로 불참 처리할 수 있어요.`)
      useCalendar.getState().deleteEvent(ev.id)
      notifyOnce(ev.attendeeIds, { type: 'event', title: `"${ev.title}" 일정이 취소되었습니다`, body: `${when(ev.start)} · ${nameOf(me())}님이 취소`, link: '/calendar' })
      return {
        result: { ok: true, cancelled: ev.title },
        card: { tool: 'cancel_event', emoji: '🗑️', title: `"${ev.title}" 일정을 취소했어요`, detail: when(ev.start), href: '/calendar', linkLabel: '캘린더 열기', undo: { kind: 'event_restore', event: ev } },
      }
    },
  },
  {
    decl: { name: 'rsvp_event', description: '일정 참석 여부를 응답합니다.', parameters: O({ event: S('일정 id 또는 제목'), response: S('응답', { enum: ['yes', 'no', 'maybe'] }) }, ['event', 'response']) },
    emoji: '🙋',
    write: true,
    label: (a) => `🙋 "${clip(str(a.event), 18)}" 참석 응답`,
    run: (a) => {
      const ev = eventRef(str(a.event))
      const status = str(a.response) as RsvpStatus
      const prev = ev.rsvp?.[me()] ?? null
      useCalendar.getState().setRsvp(ev.id, me(), status)
      const label = { yes: '참석', no: '불참', maybe: '미정' }[status]
      if (ev.organizerId !== me()) notifyOnce([ev.organizerId], { type: 'event', title: `${nameOf(me())}님이 "${ev.title}"에 ${label}으로 응답했습니다`, link: eventLink(ev) })
      return {
        result: { ok: true, event: ev.title, response: label },
        card: { tool: 'rsvp_event', emoji: '🙋', title: `"${ev.title}"에 ${label}으로 응답했어요`, detail: when(ev.start), href: eventLink(ev), linkLabel: '일정 보기', undo: { kind: 'rsvp', id: ev.id, before: prev } },
      }
    },
  },
  {
    decl: {
      name: 'create_doc',
      description: '새 문서를 만듭니다(회의록, PRD, 보고서 등). 본문은 잘 구조화된 마크다운으로 작성하세요.',
      parameters: O({ title: S('문서 제목'), markdown: S('본문 (마크다운)'), emoji: S('아이콘 이모지 하나'), parent: S('상위 문서 id 또는 제목 (선택)') }, ['title', 'markdown']),
    },
    emoji: '📝',
    write: true,
    label: (a) => `📝 문서 "${clip(str(a.title), 18)}" 작성`,
    run: (a) => {
      const parent = a.parent ? docRef(str(a.parent)) : null
      const emoji = str(a.emoji).trim() ? Array.from(str(a.emoji).trim())[0] : '📄'
      const d = useDocs.getState().createDoc({ title: str(a.title).trim(), content: str(a.markdown), emoji, parentId: parent?.id ?? null })
      return {
        result: { ok: true, id: d.id, title: d.title, link: `/docs/${d.id}` },
        card: { tool: 'create_doc', emoji: '📝', title: `문서 "${d.title}"를 만들었어요`, detail: parent ? `${parent.emoji} ${parent.title} 아래` : undefined, quote: clip(d.content.replace(/[#>*`|]/g, ''), 160), href: `/docs/${d.id}`, linkLabel: '문서 열기', undo: { kind: 'doc', id: d.id } },
      }
    },
  },
  {
    decl: { name: 'append_to_doc', description: '기존 문서 끝에 마크다운 내용을 덧붙입니다.', parameters: O({ doc: S('문서 id 또는 제목'), markdown: S('덧붙일 내용 (마크다운)') }, ['doc', 'markdown']) },
    emoji: '➕',
    write: true,
    label: (a) => `➕ "${clip(str(a.doc), 18)}"에 내용 추가`,
    run: (a) => {
      const d = docRef(str(a.doc))
      const add = str(a.markdown).trim() || fail('덧붙일 내용이 비어 있습니다')
      useDocs.getState().updateDoc(d.id, { content: `${d.content.replace(/\s+$/, '')}\n\n${add}\n` })
      return {
        result: { ok: true, id: d.id, link: `/docs/${d.id}` },
        card: { tool: 'append_to_doc', emoji: '➕', title: `"${d.title}"에 내용을 추가했어요`, quote: clip(add.replace(/[#>*`|]/g, ''), 160), href: `/docs/${d.id}`, linkLabel: '문서 열기', undo: { kind: 'doc_content', id: d.id, before: d.content } },
      }
    },
  },
  {
    decl: {
      name: 'create_approval',
      description: '전자결재를 상신합니다. 결재자를 생략하면 사용자의 매니저 라인(휴가는 1단계)으로 올립니다.',
      parameters: O({
        kind: S('문서 종류: leave 휴가, expense 경비, purchase 구매, travel 출장, access 권한, general 일반 기안', { enum: KINDS }),
        title: S('제목'),
        details: S('상세 내용 / 사유'),
        amount: N('금액(원) — 경비/구매/출장'),
        startDate: S('시작일 (YYYY-MM-DD) — 휴가/출장'),
        endDate: S('종료일 (YYYY-MM-DD)'),
        leaveType: S('휴가 종류', { enum: ['annual', 'half_am', 'half_pm', 'sick', 'family'] }),
        approvers: A(`결재자 순서대로 (${PERSON})`),
        urgent: B('긴급 여부'),
      }, ['kind', 'title']),
    },
    emoji: '🖋️',
    write: true,
    label: (a) => `🖋️ 결재 "${clip(str(a.title), 18)}" 상신`,
    run: (a) => {
      const kind = str(a.kind) as ApprovalKind
      const m = me()
      let approverIds = peopleOf(strs(a.approvers)).map((u) => u.id).filter((id) => id !== m)
      if (!approverIds.length) {
        const chain = managerChain(m, 2)
        approverIds = kind === 'access' ? Array.from(new Set([chain[0], 'u_cto'].filter((x): x is string => !!x && x !== m))) : chain.slice(0, kind === 'leave' ? 1 : 2)
      }
      if (!approverIds.length) fail('결재자를 정할 수 없습니다. approvers로 지정해 주세요.')
      const start = str(a.startDate) ? parseWhen(str(a.startDate)) : null
      const end = str(a.endDate) ? parseWhen(str(a.endDate)) : start
      if (kind === 'leave' && !start) fail('휴가는 startDate가 필요합니다')
      const leaveType = (str(a.leaveType) || (kind === 'leave' ? 'annual' : '')) as LeaveType | ''
      const startIso = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9).toISOString() : undefined
      const endIso = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 18).toISOString() : undefined
      const id = useApprovals.getState().createRequest({
        kind,
        title: str(a.title).trim(),
        details: str(a.details).trim() || undefined,
        amount: a.amount != null ? Number(a.amount) : undefined,
        startDate: startIso,
        endDate: endIso,
        approverIds,
        urgent: a.urgent ? true : undefined,
        ...(kind === 'leave' && leaveType ? { leaveType, days: leaveDays(leaveType, startIso, endIso) } : {}),
      })
      const r = useApprovals.getState().requests.find((x) => x.id === id)
      const link = `/approvals?id=${id}`
      notifyOnce([approverIds[0]], { type: 'approval', title: `새 결재 요청: ${str(a.title).trim()}`, body: `${nameOf(m)} · ${KIND_META[kind].label}`, link })
      return {
        result: { ok: true, ...(r ? approvalBrief(r) : { id }), approvers: names(approverIds) },
        card: { tool: 'create_approval', emoji: '🖋️', title: `결재 "${str(a.title).trim()}"를 상신했어요`, detail: `${KIND_META[kind].emoji} ${KIND_META[kind].label} · 결재선 ${names(approverIds)}${r?.docNo ? ` · ${r.docNo}` : ''}`, href: link, linkLabel: '결재 문서 보기', undo: { kind: 'approval', id } },
      }
    },
  },
  {
    decl: {
      name: 'decide_approval',
      description: '내 차례인 결재 문서를 승인 또는 반려합니다.',
      parameters: O({ approval: S('결재 문서 id, 문서번호 또는 제목'), decision: S('결정', { enum: ['approve', 'reject'] }), comment: S('의견') }, ['approval', 'decision']),
    },
    emoji: '✍️',
    write: true,
    outbound: true,
    label: (a) => `✍️ 결재 ${a.decision === 'reject' ? '반려' : '승인'}`,
    preview: (a) => {
      const r = approvalRef(str(a.approval))
      return { title: a.decision === 'reject' ? '결재 반려' : '결재 승인', emoji: a.decision === 'reject' ? '↩️' : '✍️', target: `${KIND_META[r.kind].emoji} ${r.title} · ${nameOf(r.requesterId)}`, text: str(a.comment), textKey: 'comment' }
    },
    run: (a) => {
      const r = approvalRef(str(a.approval))
      if (!isPendingOn(r, me())) fail(r.status !== 'pending' ? `이미 ${APV_STATUS[r.status].label} 상태인 문서입니다` : '지금은 내 결재 차례가 아닙니다')
      const comment = str(a.comment).trim() || undefined
      const approve = str(a.decision) !== 'reject'
      const link = `/approvals?id=${r.id}`
      let outcome = '반려'
      if (approve) {
        const res = useApprovals.getState().approve(r.id, comment)
        outcome = res === 'completed' ? '최종 승인' : '승인 (다음 결재자에게 전달)'
        const next = useApprovals.getState().requests.find((x) => x.id === r.id)?.steps.find((s) => s.status === 'pending')
        if (next) notifyOnce([next.approverId], { type: 'approval', title: `새 결재 요청: ${r.title}`, body: `${nameOf(r.requesterId)} · ${KIND_META[r.kind].label}`, link })
      } else {
        useApprovals.getState().reject(r.id, comment)
      }
      notifyOnce([r.requesterId], { type: 'approval', title: `${nameOf(me())}님이 "${r.title}"${approve ? '를 승인했습니다' : '를 반려했습니다'}`, body: comment ?? (approve ? outcome : '반려되었습니다'), link })
      return {
        result: { ok: true, outcome, title: r.title, link },
        card: { tool: 'decide_approval', emoji: approve ? '✍️' : '↩️', title: `"${r.title}" ${outcome}`, detail: `${KIND_META[r.kind].label} · 요청자 ${nameOf(r.requesterId)}`, quote: comment, href: link, linkLabel: '결재 문서 보기' },
      }
    },
  },
  {
    decl: {
      name: 'give_kudos',
      description: '동료에게 칭찬(Kudos)을 보냅니다.',
      parameters: O({ to: S(PERSON), badge: S('배지: collab 협업, impact 임팩트, challenge 도전, customer 고객집착, care 배려, growth 성장', { enum: BADGES }), message: S('칭찬 메시지') }, ['to', 'badge', 'message']),
    },
    emoji: '🎉',
    write: true,
    label: (a) => `🎉 ${clip(str(a.to), 10)}님에게 칭찬 보내기`,
    run: (a) => {
      const u = person(str(a.to))
      if (u.id === me()) fail('본인에게는 칭찬을 보낼 수 없습니다')
      const badge = str(a.badge) as KudosBadge
      const message = str(a.message).trim() || fail('메시지가 비어 있습니다')
      const k = usePeople.getState().giveKudos({ toId: u.id, badge, message })
      const b = KUDOS_BADGES[badge]
      notifyOnce([u.id], { type: 'system', title: `${nameOf(me())}님이 ${b.emoji} ${b.label} 칭찬을 보냈어요`, body: clip(message, 90), link: '/people?tab=kudos' })
      return {
        result: { ok: true, to: u.name, badge: b.label, link: '/people?tab=kudos' },
        card: { tool: 'give_kudos', emoji: b.emoji, title: `${u.name}님에게 ${b.label} 칭찬을 보냈어요`, quote: message, href: '/people?tab=kudos', linkLabel: '칭찬 보드', undo: { kind: 'kudos', id: k.id } },
      }
    },
  },
  {
    decl: {
      name: 'set_my_status',
      description: '사용자 본인의 상태 메시지/이모지와 접속 상태를 바꿉니다. 비우려면 text를 빈 문자열로.',
      parameters: O({ emoji: S('상태 이모지'), text: S('상태 메시지'), presence: S('접속 상태', { enum: ['online', 'away', 'dnd', 'offline'] }) }),
    },
    emoji: '🟢',
    write: true,
    label: () => '🟢 내 상태 변경',
    run: (a) => {
      const u = getUser(me())!
      const prev: UndoSpec = { kind: 'status', emoji: u.statusEmoji ?? null, text: u.statusText ?? null, presence: u.presence }
      const core = useCore.getState()
      if (a.text !== undefined || a.emoji !== undefined) {
        const text = a.text !== undefined ? str(a.text).trim() : u.statusText
        const emoji = a.emoji !== undefined ? str(a.emoji).trim() : u.statusEmoji
        core.setStatus(text ? emoji || '💬' : undefined, text || undefined)
      }
      if (a.presence) core.setPresence(str(a.presence) as Presence)
      const now = getUser(me())!
      const label = { online: '온라인', away: '자리 비움', dnd: '방해 금지', offline: '오프라인' }[now.presence]
      return {
        result: { ok: true, status: now.statusText ? `${now.statusEmoji ?? ''} ${now.statusText}`.trim() : '(없음)', presence: label },
        card: { tool: 'set_my_status', emoji: now.statusEmoji || '🟢', title: '내 상태를 바꿨어요', detail: `${now.statusText ? `${now.statusEmoji ?? ''} ${now.statusText} · ` : ''}${label}`, undo: prev },
      }
    },
  },
  {
    decl: { name: 'navigate', description: 'Nexus 화면을 이동합니다(예: 캘린더 열기, 특정 문서/태스크/채널로 이동).', parameters: O({ path: S('앱 내부 경로, 예: /calendar, /docs/doc_x, /messages/c_general, /projects/p_x?task=t_y') }, ['path']) },
    emoji: '🧭',
    label: (a) => `🧭 ${str(a.path)}로 이동`,
    run: (a, ctx) => {
      const path = str(a.path).trim()
      if (!isAllowedPath(path)) fail('허용되지 않은 경로입니다. /로 시작하는 앱 내부 경로를 쓰세요.')
      ctx.navigate(path)
      return { result: { ok: true, path } }
    },
  },
]

export const TOOLS: ToolDef[] = [...READ, ...WRITE]
const BY_NAME = new Map(TOOLS.map((t) => [t.decl.name, t]))
export const getTool = (name: string) => BY_NAME.get(name)
export const FUNCTION_DECLARATIONS: FunctionDeclaration[] = TOOLS.map((t) => t.decl)

/** Safe step label (labels may try to resolve names). */
export function stepLabel(name: string, args: Args): string {
  const t = getTool(name)
  if (!t) return `🔧 ${name}`
  try { return t.label(args) } catch { return `${t.emoji} ${name}` }
}

export function toolErrorMessage(err: unknown): string {
  if (err instanceof ToolError) return err.message
  return err instanceof Error ? `실행 중 오류: ${err.message}` : '실행 중 알 수 없는 오류'
}

/* ───────────── undo ───────────── */

const nullToUndef = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null ? undefined : v]))

/** Reverts a write. Returns a short Korean summary; throws if impossible. */
export function undoAction(u: UndoSpec): string {
  switch (u.kind) {
    case 'message': {
      const ms = useMessenger.getState()
      if (!ms.messages.some((m) => m.id === u.id)) throw new Error('메시지가 이미 없어요')
      ms.deleteMessage(u.id)
      return '메시지를 삭제했어요'
    }
    case 'task': {
      useProjects.getState().deleteTask(u.id)
      return '태스크를 삭제했어요'
    }
    case 'task_patch': {
      useProjects.getState().updateTask(u.id, nullToUndef(u.before) as TaskPatch)
      return '태스크를 원래대로 되돌렸어요'
    }
    case 'comment': {
      useProjects.getState().deleteComment(u.taskId, u.id)
      return '댓글을 삭제했어요'
    }
    case 'event': {
      useCalendar.getState().deleteEvent(u.id)
      return '일정을 삭제했어요'
    }
    case 'event_patch': {
      useCalendar.getState().updateEvent(u.id, nullToUndef(u.before) as Partial<CalEvent>)
      return '일정을 원래대로 되돌렸어요'
    }
    case 'event_restore': {
      const ev = u.event
      useCalendar.setState((s) => (s.events.some((e) => e.id === ev.id) ? s : { events: [...s.events, ev] }))
      return '일정을 복구했어요'
    }
    case 'rsvp': {
      const cal = useCalendar.getState()
      if (u.before) cal.setRsvp(u.id, me(), u.before)
      else cal.updateEvent(u.id, { rsvp: Object.fromEntries(Object.entries(cal.events.find((e) => e.id === u.id)?.rsvp ?? {}).filter(([k]) => k !== me())) })
      return '참석 응답을 되돌렸어요'
    }
    case 'doc': {
      useDocs.getState().deleteDoc(u.id)
      return '문서를 삭제했어요'
    }
    case 'doc_content': {
      useDocs.getState().updateDoc(u.id, { content: u.before })
      return '문서 내용을 되돌렸어요'
    }
    case 'announcement': {
      useGoals.getState().deleteAnnouncement(u.id)
      return '공지를 삭제했어요'
    }
    case 'approval': {
      if (!useApprovals.getState().cancel(u.id)) throw new Error('이미 처리된 결재라 회수할 수 없어요')
      return '결재를 회수했어요'
    }
    case 'kudos': {
      usePeople.setState((s) => ({ kudos: s.kudos.filter((k) => k.id !== u.id) }))
      return '칭찬을 취소했어요'
    }
    case 'status': {
      const core = useCore.getState()
      core.setStatus(u.emoji ?? undefined, u.text ?? undefined)
      core.setPresence(u.presence)
      return '상태를 되돌렸어요'
    }
  }
}

/* ───────────── prompt context ───────────── */

export function promptContext(confirmBeforeSend: boolean): PromptContext {
  const all = users()
  const m = me()
  const meU = all.find((u) => u.id === m) ?? all[0]
  const channels = useMessenger.getState().channels
    .filter((c) => !c.archived && !c.isApp && (c.kind === 'public' || (c.kind === 'private' && c.memberIds.includes(m))))
    .map((c) => ({ id: c.id, name: c.name, kind: c.kind, topic: c.topic, members: c.memberIds.length, joined: c.memberIds.includes(m) }))
  const projects = useProjects.getState().projects.filter((p) => !p.archived).map((p) => ({ id: p.id, key: p.key, name: p.name, emoji: p.emoji }))
  return {
    me: { ...meU, title: meU.title, department: meU.department },
    now: new Date(),
    company: COMPANY,
    users: all.map((u) => ({ id: u.id, name: u.name, nameEn: u.nameEn, title: u.title, department: u.department, statusText: u.statusText })),
    channels,
    projects,
    confirmBeforeSend,
  }
}

/** Used by the message-composer hint in the confirm card. */
export const greetName = (id: string) => given(getUser(id))
