import {
  MessageSquare, ListChecks, CalendarClock, Stamp, Clock, Webhook, ClipboardList,
  GitBranch, Send, ListPlus, Mail, FileSignature, FileText, Globe, Sparkles, Timer, BellRing,
  type LucideIcon,
} from 'lucide-react'
import type { ConditionRule, NodeCategory } from './types'

export type FieldType = 'text' | 'textarea' | 'template' | 'select' | 'number' | 'cron' | 'conditions' | 'user' | 'channel' | 'project'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  options?: { value: string; label: string }[]
  hint?: string
  /** project field: include "모든 프로젝트" */
  allowAll?: boolean
}

export interface NodeDef {
  kind: string
  category: NodeCategory
  label: string
  description: string
  icon: LucideIcon
  /** raw hex used for glows / minimap */
  color: string
  /** tailwind gradient for icon tile */
  gradient: string
  fields: FieldDef[]
  defaults: Record<string, unknown>
  /** variables this node exposes to later steps (triggers mostly) */
  outputs?: string[]
  summary: (c: Record<string, unknown>) => string
}

export const CHANNELS = ['general', 'engineering', 'product', 'design', 'sales', 'marketing', 'incidents', 'people', 'random']

export const CATEGORY_META: Record<NodeCategory, { label: string; glyph: string; color: string; /** theme-aware text color (readable in light mode) */ text: string }> = {
  trigger: { label: '트리거', glyph: '⚡', color: '#a78bfa', text: 'text-violet-600 dark:text-violet-400' },
  condition: { label: '조건', glyph: '◇', color: '#fbbf24', text: 'text-amber-600 dark:text-amber-400' },
  action: { label: '액션', glyph: '▶', color: '#22d3ee', text: 'text-cyan-700 dark:text-cyan-400' },
  delay: { label: '지연', glyph: '⏱', color: '#f472b6', text: 'text-pink-600 dark:text-pink-400' },
}

const s = (v: unknown, fallback = '') => (typeof v === 'string' && v.trim() ? v : fallback)
const trunc = (t: string, n = 38) => (t.length > n ? t.slice(0, n) + '…' : t)

const OPS: Record<ConditionRule['op'], string> = { eq: '=', neq: '≠', contains: '포함', gt: '>', lt: '<', exists: '존재' }
export const OP_OPTIONS = (Object.keys(OPS) as ConditionRule['op'][]).map((k) => ({
  value: k,
  label: { eq: '같음 (=)', neq: '같지 않음 (≠)', contains: '포함', gt: '보다 큼 (>)', lt: '보다 작음 (<)', exists: '값이 있음' }[k],
}))

const CRON_FIELD = /^(\*|\d{1,2}(-\d{1,2})?(,\d{1,2}(-\d{1,2})?)*)(\/\d{1,2})?$/

/** Loose 5-field cron syntax check (minute hour day-of-month month day-of-week). */
export function isValidCron(expr: string): boolean {
  const p = expr.trim().split(/\s+/)
  return p.length === 5 && p.every((f) => CRON_FIELD.test(f))
}

export function describeCron(expr: string): string {
  if (!isValidCron(expr)) return expr.trim() || '스케줄 미설정'
  const [m, h, dom, mon, dow] = expr.trim().split(/\s+/)
  const dowLabel: Record<string, string> = { '*': '매일', '1-5': '평일', '0,6': '주말', '6,0': '주말', '1': '매주 월요일', '2': '매주 화요일', '3': '매주 수요일', '4': '매주 목요일', '5': '매주 금요일', '0': '매주 일요일', '7': '매주 일요일', '6': '매주 토요일' }
  let day = dowLabel[dow] ?? `요일(${dow})`
  if (dom !== '*' && /^\d+$/.test(dom)) day = `${mon !== '*' && /^\d+$/.test(mon) ? `매년 ${mon}월` : '매월'} ${dom}일`
  if (h === '*' && m.startsWith('*/')) return `${m.slice(2)}분마다`
  if (h.startsWith('*/') && /^\d+$/.test(m)) return `${h.slice(2)}시간마다 ${Number(m) ? `${m}분` : '정각'}`
  if (h === '*') return /^\d+$/.test(m) ? `매시 ${m}분` : expr.trim()
  if (!/^\d+$/.test(h) || !/^\d+$/.test(m)) return `${day} · ${expr.trim()}`
  const hh = Number(h)
  const ap = hh < 12 ? '오전' : '오후'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${day} ${ap} ${h12}:${m.padStart(2, '0')}`
}

export const NODE_DEFS: NodeDef[] = [
  /* ───── Triggers ───── */
  {
    kind: 'message_received', category: 'trigger', label: '메시지 수신', description: '채널에 새 메시지가 올라오면',
    icon: MessageSquare, color: '#a78bfa', gradient: 'from-violet-500 to-fuchsia-500',
    fields: [
      { key: 'channel', label: '채널', type: 'channel' },
      { key: 'keyword', label: '키워드 (선택)', type: 'text', placeholder: '예: 장애, 긴급' },
    ],
    defaults: { channel: 'general', keyword: '' },
    outputs: ['message.text', 'message.author', 'channel.name', 'message.link'],
    summary: (c) => `#${s(c.channel, 'general')}${s(c.keyword) ? ` · "${s(c.keyword)}" 포함` : ''}`,
  },
  {
    kind: 'task_status', category: 'trigger', label: '태스크 상태 변경', description: '태스크 상태가 바뀌면',
    icon: ListChecks, color: '#a78bfa', gradient: 'from-indigo-500 to-violet-600',
    fields: [
      { key: 'project', label: '프로젝트', type: 'project', allowAll: true },
      { key: 'to', label: '변경된 상태', type: 'select', options: [{ value: 'todo', label: '할 일' }, { value: 'in_progress', label: '진행 중' }, { value: 'review', label: '리뷰' }, { value: 'done', label: '완료' }, { value: 'backlog', label: '백로그' }] },
    ],
    defaults: { project: 'all', to: 'done' },
    outputs: ['task.title', 'task.key', 'task.assignee', 'task.dueDate', 'task.status', 'task.project'],
    summary: (c) => `→ ${({ todo: '할 일', in_progress: '진행 중', review: '리뷰', done: '완료', backlog: '백로그', blocked: '막힘' } as Record<string, string>)[s(c.to, 'done')] ?? s(c.to)} 상태`,
  },
  {
    kind: 'event_start', category: 'trigger', label: '일정 시작', description: '캘린더 일정이 시작되기 전',
    icon: CalendarClock, color: '#a78bfa', gradient: 'from-sky-400 to-indigo-500',
    fields: [
      { key: 'calendar', label: '캘린더', type: 'select', options: [{ value: 'team', label: '팀 캘린더' }, { value: 'me', label: '내 캘린더' }, { value: 'company', label: '전사 일정' }] },
      { key: 'before', label: '시작 몇 분 전', type: 'number' },
    ],
    defaults: { calendar: 'team', before: 10 },
    outputs: ['event.title', 'event.start', 'event.attendees', 'event.location'],
    summary: (c) => `시작 ${Number(c.before ?? 10)}분 전`,
  },
  {
    kind: 'approval_requested', category: 'trigger', label: '결재 요청', description: '새 결재 문서가 상신되면',
    icon: Stamp, color: '#a78bfa', gradient: 'from-pink-500 to-rose-600',
    fields: [
      { key: 'approvalKind', label: '문서 종류', type: 'select', options: [{ value: 'all', label: '전체' }, { value: 'leave', label: '휴가' }, { value: 'expense', label: '경비' }, { value: 'purchase', label: '구매' }, { value: 'travel', label: '출장' }, { value: 'access', label: '권한' }] },
      { key: 'event', label: '이벤트', type: 'select', options: [{ value: 'submitted', label: '상신됨' }, { value: 'approved', label: '최종 승인됨' }, { value: 'rejected', label: '반려됨' }] },
    ],
    defaults: { approvalKind: 'all', event: 'submitted' },
    outputs: ['approval.title', 'approval.requester', 'approval.amount', 'approval.status', 'approval.docNo'],
    summary: (c) => `${({ all: '전체', leave: '휴가', expense: '경비', purchase: '구매', travel: '출장', access: '권한' } as Record<string, string>)[s(c.approvalKind, 'all')]} · ${({ submitted: '상신됨', approved: '승인됨', rejected: '반려됨' } as Record<string, string>)[s(c.event, 'submitted')]}`,
  },
  {
    kind: 'schedule', category: 'trigger', label: '스케줄', description: '정해진 시간마다 (cron)',
    icon: Clock, color: '#a78bfa', gradient: 'from-amber-400 to-orange-600',
    fields: [{ key: 'cron', label: 'Cron 표현식', type: 'cron', placeholder: '0 9 * * 1-5', hint: '분 시 일 월 요일 · 이후 단계에서 {{task.*}}를 쓰면 마감 24시간 이내 태스크마다 한 번씩 실행돼요' }],
    defaults: { cron: '0 9 * * 1-5' },
    outputs: ['now.date', 'now.weekday', 'now.time'],
    summary: (c) => describeCron(s(c.cron, '0 9 * * 1-5')),
  },
  {
    kind: 'webhook', category: 'trigger', label: '웹훅', description: '외부 서비스가 URL을 호출하면 (외부 수신은 곧 제공 · 지금은 \'지금 실행\'으로 페이로드 입력)',
    icon: Webhook, color: '#a78bfa', gradient: 'from-slate-500 to-zinc-700',
    fields: [
      { key: 'path', label: '엔드포인트 경로', type: 'text', placeholder: '/hooks/incident' },
      { key: 'method', label: 'HTTP 메서드', type: 'select', options: [{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }, { value: 'PUT', label: 'PUT' }] },
    ],
    defaults: { path: '/hooks/new', method: 'POST' },
    outputs: ['body', 'body.severity', 'body.service'],
    summary: (c) => `${s(c.method, 'POST')} ${s(c.path, '/hooks/new')}`,
  },
  {
    kind: 'form_submitted', category: 'trigger', label: '양식 제출', description: '폼이 제출되면 (지금 실행으로 직접 제출)',
    icon: ClipboardList, color: '#a78bfa', gradient: 'from-emerald-400 to-teal-600',
    fields: [{ key: 'form', label: '양식', type: 'select', options: [{ value: 'contact', label: '고객 문의' }, { value: 'onboarding', label: '입사자 정보' }, { value: 'feedback', label: '제품 피드백' }, { value: 'it', label: 'IT 지원 요청' }] }],
    defaults: { form: 'contact' },
    outputs: ['form.name', 'form.email', 'form.message', 'form.company'],
    summary: (c) => `"${({ contact: '고객 문의', onboarding: '입사자 정보', feedback: '제품 피드백', it: 'IT 지원 요청' } as Record<string, string>)[s(c.form, 'contact')]}" 양식`,
  },

  /* ───── Condition ───── */
  {
    kind: 'if_else', category: 'condition', label: '조건 분기', description: '조건에 따라 참/거짓으로 분기',
    icon: GitBranch, color: '#fbbf24', gradient: 'from-amber-400 to-yellow-600',
    fields: [
      { key: 'match', label: '일치 방식', type: 'select', options: [{ value: 'all', label: '모든 조건 충족 (AND)' }, { value: 'any', label: '하나라도 충족 (OR)' }] },
      { key: 'rules', label: '조건', type: 'conditions' },
    ],
    defaults: { match: 'all', rules: [{ id: 'r1', field: '', op: 'eq', value: '' }] },
    summary: (c) => {
      const rules = (c.rules as ConditionRule[] | undefined) ?? []
      const first = rules.find((r) => r.field)
      if (!first) return '조건을 설정하세요'
      const t = `${first.field} ${OPS[first.op]} ${first.op === 'exists' ? '' : first.value}`.trim()
      return trunc(rules.length > 1 ? `${t} 외 ${rules.length - 1}개` : t)
    },
  },

  /* ───── Actions ───── */
  {
    kind: 'send_message', category: 'action', label: '메시지 보내기', description: '채널 또는 DM으로 메시지 전송',
    icon: Send, color: '#22d3ee', gradient: 'from-cyan-400 to-blue-600',
    fields: [
      { key: 'channel', label: '채널', type: 'channel' },
      { key: 'message', label: '메시지 템플릿', type: 'template', placeholder: '안녕하세요 {{task.assignee}}님!' },
    ],
    defaults: { channel: 'general', message: '' },
    summary: (c) => `#${s(c.channel, 'general')} · ${trunc(s(c.message, '메시지 내용 없음'), 26)}`,
  },
  {
    kind: 'create_task', category: 'action', label: '태스크 생성', description: '프로젝트에 새 태스크 추가',
    icon: ListPlus, color: '#22d3ee', gradient: 'from-blue-500 to-indigo-600',
    fields: [
      { key: 'project', label: '프로젝트', type: 'project' },
      { key: 'title', label: '태스크 제목', type: 'template', placeholder: '{{form.company}} 문의 응대' },
      { key: 'assignee', label: '담당자', type: 'user' },
      { key: 'priority', label: '우선순위', type: 'select', options: [{ value: 'urgent', label: '긴급' }, { value: 'high', label: '높음' }, { value: 'medium', label: '보통' }, { value: 'low', label: '낮음' }] },
    ],
    defaults: { project: 'p_nexus', title: '', assignee: '', priority: 'medium' },
    summary: (c) => trunc(s(c.title, '제목 없음')),
  },
  {
    kind: 'send_email', category: 'action', label: '이메일 발송', description: '이메일 전송 (곧 제공 · 지금은 발송 기록 + 알림만 남겨요)',
    icon: Mail, color: '#22d3ee', gradient: 'from-rose-400 to-pink-600',
    fields: [
      { key: 'to', label: '받는 사람', type: 'text', placeholder: '{{form.email}}' },
      { key: 'subject', label: '제목', type: 'template' },
      { key: 'body', label: '본문', type: 'template' },
    ],
    defaults: { to: '', subject: '', body: '' },
    summary: (c) => `${trunc(s(c.to, '수신자 미지정'), 20)} · ${trunc(s(c.subject, '제목 없음'), 18)}`,
  },
  {
    kind: 'request_approval', category: 'action', label: '결재 요청', description: '전자결재 문서 자동 상신',
    icon: FileSignature, color: '#22d3ee', gradient: 'from-fuchsia-500 to-purple-600',
    fields: [
      { key: 'approvalKind', label: '문서 종류', type: 'select', options: [{ value: 'general', label: '일반' }, { value: 'purchase', label: '구매' }, { value: 'access', label: '권한' }, { value: 'expense', label: '경비' }] },
      { key: 'title', label: '문서 제목', type: 'template' },
      { key: 'approver', label: '결재자', type: 'user' },
    ],
    defaults: { approvalKind: 'general', title: '', approver: '' },
    summary: (c) => trunc(s(c.title, '문서 제목 없음')),
  },
  {
    kind: 'create_doc', category: 'action', label: '문서 생성', description: '템플릿으로 새 문서 작성',
    icon: FileText, color: '#22d3ee', gradient: 'from-teal-400 to-emerald-600',
    fields: [
      { key: 'title', label: '문서 제목', type: 'template' },
      { key: 'template', label: '템플릿', type: 'select', options: [{ value: 'blank', label: '빈 문서' }, { value: 'weekly', label: '주간 리포트' }, { value: 'onboarding', label: '온보딩 체크리스트' }, { value: 'postmortem', label: '포스트모템' }] },
      { key: 'folder', label: '저장 위치', type: 'text', placeholder: '팀 위키 / 리포트' },
    ],
    defaults: { title: '', template: 'blank', folder: '' },
    summary: (c) => trunc(s(c.title, '제목 없음')),
  },
  {
    kind: 'http_request', category: 'action', label: 'HTTP 요청', description: '외부 API 호출',
    icon: Globe, color: '#22d3ee', gradient: 'from-zinc-500 to-slate-700',
    fields: [
      { key: 'method', label: '메서드', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m })) },
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/v1/…' },
      { key: 'body', label: 'Body (JSON)', type: 'template' },
    ],
    defaults: { method: 'POST', url: '', body: '' },
    outputs: ['http.status', 'http.body'],
    summary: (c) => `${s(c.method, 'POST')} ${trunc(s(c.url, 'URL 미지정').replace(/^https?:\/\//, ''), 28)}`,
  },
  {
    kind: 'ai_summary', category: 'action', label: 'AI 요약', description: 'Nexus AI로 텍스트 요약/분류',
    icon: Sparkles, color: '#22d3ee', gradient: 'from-violet-500 via-fuchsia-500 to-cyan-400',
    fields: [
      { key: 'input', label: '입력', type: 'template', placeholder: '{{message.text}}' },
      { key: 'style', label: '스타일', type: 'select', options: [{ value: 'bullets', label: '3줄 불릿 요약' }, { value: 'tldr', label: '한 문장 TL;DR' }, { value: 'classify', label: '긴급도 분류' }, { value: 'report', label: '리포트 형식' }] },
    ],
    defaults: { input: '', style: 'bullets' },
    outputs: ['ai.summary'],
    summary: (c) => ({ bullets: '3줄 불릿 요약', tldr: '한 문장 TL;DR', classify: '긴급도 분류', report: '리포트 형식' } as Record<string, string>)[s(c.style, 'bullets')] ?? '',
  },

  {
    kind: 'notify', category: 'action', label: '알림 보내기', description: '구성원의 알림함(🔔)으로 알림 전송',
    icon: BellRing, color: '#22d3ee', gradient: 'from-amber-400 to-orange-600',
    fields: [
      { key: 'user', label: '받는 사람', type: 'user' },
      { key: 'title', label: '제목', type: 'template', placeholder: '"{{task.title}}" 확인이 필요해요' },
      { key: 'body', label: '내용', type: 'template' },
    ],
    defaults: { user: '', title: '', body: '' },
    summary: (c) => trunc(s(c.title, '알림 제목 없음')),
  },

  /* ───── Delay ───── */
  {
    kind: 'delay', category: 'delay', label: '지연', description: '일정 시간 대기 후 계속',
    icon: Timer, color: '#f472b6', gradient: 'from-pink-400 to-rose-500',
    fields: [
      { key: 'amount', label: '대기 시간', type: 'number' },
      { key: 'unit', label: '단위', type: 'select', options: [{ value: 'minutes', label: '분' }, { value: 'hours', label: '시간' }, { value: 'days', label: '일' }] },
    ],
    defaults: { amount: 1, unit: 'hours' },
    summary: (c) => `${Number(c.amount ?? 1)}${({ minutes: '분', hours: '시간', days: '일' } as Record<string, string>)[s(c.unit, 'hours')]} 후 계속`,
  },
]

export const NODE_DEF_MAP: Record<string, NodeDef> = Object.fromEntries(NODE_DEFS.map((d) => [d.kind, d]))

export function getDef(kind: string): NodeDef {
  return NODE_DEF_MAP[kind] ?? NODE_DEFS[0]
}

/** Variables shown as {{chips}} in template fields. */
export const COMMON_VARIABLES = ['workflow.name', 'now.date', 'now.time', 'user.name', 'actor.name']
