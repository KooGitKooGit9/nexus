/**
 * Workflow execution engine — workflows really run.
 *
 * - `runWorkflow()` walks the graph from the trigger, substituting `{{vars}}` from the trigger payload,
 *   evaluating conditions, waiting real delays and performing real actions (messages as Nexus Bot,
 *   tasks, approvals, docs, notifications, HTTP requests, AI summaries). `mode: 'dry'` is a sandbox:
 *   same path & evaluation, no side effects (the editor's "테스트 실행").
 * - `startWorkflowEngine()` (once, from the app shell) wires the triggers:
 *     · event triggers (메시지 수신 · 태스크 상태 변경 · 결재 요청/승인) fire on the *acting* client —
 *       the browser where the change happened — never on every receiver;
 *     · time triggers (스케줄 cron · 일정 시작) are evaluated on the sync leader only, with a
 *       per-occurrence dedupe key stored on the run so a leader hand-over can't double-fire.
 * - Only enabled workflows react to triggers. Every real run is appended to the workflow's 실행 기록.
 */
import type { Edge } from '@xyflow/react'
import { getCurrentUserId, getUser, notify } from '@/store/core'
import { notifyUser } from '@/lib/inbox'
import { isServerMode, isSyncLeader, useSyncStatus } from '@/lib/sync'
import { formatDate, sleep, uid } from '@/lib/utils'
import { useMessenger } from '@/features/messenger/store'
import type { Message } from '@/features/messenger/types'
import { useProjects, getTaskKey } from '@/features/projects/store'
import { STATUS_META } from '@/features/projects/constants'
import type { Priority, Task } from '@/features/projects/types'
import { useApprovals } from '@/features/approvals/store'
import type { ApprovalKind, ApprovalRequest } from '@/features/approvals/types'
import { useCalendar } from '@/features/calendar/store'
import type { CalEvent } from '@/features/calendar/types'
import { getDef } from './catalog'
import { useWorkflows } from './store'
import { asEngine, flags } from './localActor'
import type { ConditionRule, FlowNode, Workflow, WorkflowRun, WorkflowRunStep } from './types'
import { isDemoWorkspace } from '@/lib/workspace'

export type Payload = Record<string, string>
export type RunMode = 'dry' | 'live'

/* ───────────────────────── helpers ───────────────────────── */

const str = (v: unknown, f = '') => (typeof v === 'string' && v.trim() ? v : f)
const trunc = (t: string, n = 60) => (t.length > n ? t.slice(0, n) + '…' : t)
const nameOf = (id?: string | null) => (id ? getUser(id)?.name ?? '' : '')
const UNIT_MS: Record<string, number> = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }
const UNIT_LABEL: Record<string, string> = { minutes: '분', hours: '시간', days: '일' }

/** Replace `{{key}}` with payload values. Unknown keys → '' (live) or ‹key› (dry, so gaps are visible). */
export function fillTemplate(text: string, payload: Payload, mode: RunMode = 'live'): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, k: string) => payload[k] ?? (mode === 'dry' ? `‹${k}›` : ''))
}

const OP_LABEL: Record<ConditionRule['op'], string> = { eq: '=', neq: '≠', contains: '포함', gt: '>', lt: '<', exists: '존재' }
const num = (v: string) => (/^-?[\d,.]+$/.test(v.trim()) ? Number(v.replace(/,/g, '')) : NaN)

/** Same semantics as the condition builder: AND/OR of rules; non-numeric gt/lt comparisons pass. */
export function evaluateCondition(node: FlowNode, payload: Payload): { pass: boolean; trace: string[] } {
  const rules = ((node.data.config.rules as ConditionRule[] | undefined) ?? []).filter((r) => r.field?.trim())
  if (!rules.length) return { pass: true, trace: ['조건이 비어 있어 항상 참으로 처리'] }
  const results = rules.map((r) => {
    const field = r.field.replace(/^\{\{|\}\}$/g, '').trim()
    const raw = payload[field]
    const actual = raw ?? ''
    const want = fillTemplate(r.value ?? '', payload).trim()
    let ok: boolean
    switch (r.op) {
      case 'exists': ok = raw !== undefined && raw !== ''; break
      case 'eq': ok = actual.trim() === want; break
      case 'neq': ok = actual.trim() !== want; break
      case 'contains': ok = actual.toLowerCase().includes(want.toLowerCase()); break
      case 'gt':
      case 'lt': {
        const a = num(actual)
        const b = num(want)
        ok = Number.isNaN(a) || Number.isNaN(b) ? true : r.op === 'gt' ? a > b : a < b
        break
      }
    }
    const shown = raw === undefined ? '(값 없음)' : `"${trunc(raw, 40)}"`
    return { ok, text: `${field} ${OP_LABEL[r.op]}${r.op === 'exists' ? '' : ` ${want}`} → ${ok ? '참' : '거짓'} (값 ${shown})` }
  })
  const any = node.data.config.match === 'any'
  return { pass: any ? results.some((r) => r.ok) : results.every((r) => r.ok), trace: results.map((r) => r.text) }
}

/* ───────────────────────── 5-field cron ───────────────────────── */

function cronField(spec: string, v: number, min: number, max: number): boolean {
  return spec.split(',').some((part) => {
    const [range, stepStr] = part.split('/')
    const step = stepStr ? Math.max(1, Number(stepStr)) : 1
    let lo: number
    let hi: number
    if (range === '*') { lo = min; hi = max }
    else if (range.includes('-')) { [lo, hi] = range.split('-').map(Number) }
    else { lo = Number(range); hi = stepStr ? max : lo }
    if (Number.isNaN(lo) || Number.isNaN(hi) || v < lo || v > hi) return false
    return (v - lo) % step === 0
  })
}

export function cronMatches(expr: string, d: Date): boolean {
  const p = expr.trim().split(/\s+/)
  if (p.length !== 5) return false
  const [m, h, dom, mon, dow] = p
  if (!cronField(m, d.getMinutes(), 0, 59) || !cronField(h, d.getHours(), 0, 23) || !cronField(mon, d.getMonth() + 1, 1, 12)) return false
  const domOk = cronField(dom, d.getDate(), 1, 31)
  const wd = d.getDay()
  const dowOk = cronField(dow, wd, 0, 7) || (wd === 0 && cronField(dow, 7, 0, 7))
  // classic cron: when both day fields are restricted, either may match
  return dom !== '*' && dow !== '*' ? domOk || dowOk : domOk && dowOk
}

/** Next time (within ~8 days) a cron expression fires — for UI hints. */
export function nextCronRun(expr: string, from = new Date()): Date | null {
  const d = new Date(from)
  d.setSeconds(0, 0)
  for (let i = 1; i <= 8 * 24 * 60; i++) {
    d.setMinutes(d.getMinutes() + 1)
    if (cronMatches(expr, d)) return new Date(d)
  }
  return null
}

/* ───────────────────────── payload builders ───────────────────────── */

function basePayload(wf: Pick<Workflow, 'name' | 'ownerId'>, actorId?: string): Payload {
  const now = new Date()
  const actor = actorId ?? getCurrentUserId()
  return {
    'workflow.name': wf.name,
    'workflow.owner': nameOf(wf.ownerId),
    'now.date': now.toLocaleDateString('ko-KR'),
    'now.weekday': now.toLocaleDateString('ko-KR', { weekday: 'long' }),
    'now.time': formatDate(now, 'HH:mm'),
    'user.name': nameOf(getCurrentUserId()),
    'actor.id': actor,
    'actor.name': nameOf(actor),
  }
}

function dueLabel(iso?: string) {
  if (!iso) return '마감일 없음'
  const d = new Date(iso)
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  const day = days === 0 ? '오늘' : days === 1 ? '내일' : days === -1 ? '어제' : formatDate(d, 'M월 d일')
  return `${day} ${formatDate(d, 'HH:mm')}`
}

export function taskPayload(t: Task): Payload {
  const p = useProjects.getState().projects.find((x) => x.id === t.projectId)
  return {
    'task.id': t.id,
    'task.title': t.title,
    'task.key': getTaskKey(t),
    'task.status': t.status,
    'task.statusLabel': STATUS_META[t.status]?.label ?? t.status,
    'task.priority': t.priority,
    'task.assignee': t.assigneeIds.map(nameOf).filter(Boolean).join(', ') || '미지정',
    'task.assigneeId': t.assigneeIds[0] ?? '',
    'task.dueDate': dueLabel(t.dueDate),
    'task.dueHours': t.dueDate ? String(Math.round((new Date(t.dueDate).getTime() - Date.now()) / 3_600_000)) : '',
    'task.project': p?.name ?? '',
    'task.link': `/projects/${t.projectId}?task=${t.id}`,
  }
}

function messagePayload(m: Message): Payload {
  const ch = useMessenger.getState().channels.find((c) => c.id === m.channelId)
  return {
    'message.id': m.id,
    'message.text': m.text,
    'message.author': nameOf(m.userId),
    'message.authorId': m.userId,
    'channel.name': ch?.name || '다이렉트 메시지',
    'channel.id': m.channelId,
    'message.link': `/messages/${m.channelId}`,
  }
}

function approvalPayload(r: ApprovalRequest): Payload {
  return {
    'approval.id': r.id,
    'approval.title': r.title,
    'approval.kind': r.kind,
    'approval.requester': nameOf(r.requesterId),
    'approval.requesterId': r.requesterId,
    'approval.amount': r.amount !== undefined ? r.amount.toLocaleString('ko-KR') : '',
    'approval.status': r.status,
    'approval.docNo': r.docNo ?? '',
    'approval.link': `/approvals?id=${r.id}`,
  }
}

function eventPayload(e: CalEvent): Payload {
  return {
    'event.id': e.id,
    'event.title': e.title,
    'event.start': formatDate(e.start, 'M월 d일 HH:mm'),
    'event.attendees': e.attendeeIds.map(nameOf).filter(Boolean).join(', '),
    'event.location': e.location ?? (e.videoLink ? '화상 회의' : ''),
    'event.link': `/calendar?event=${e.id}`,
  }
}

const STATIC_SAMPLE: Payload = {
  'form.name': '신유진', 'form.email': 'yujin@example.com', 'form.company': '스텔라커머스', 'form.message': '결제 페이지가 열리지 않아요. 오늘 오후 프로모션 전에 확인 부탁드립니다.',
  'body.service': 'api-gateway', 'body.severity': 'critical', body: '{"service":"api-gateway","severity":"critical"}',
}

/** Realistic sample payload for a trigger, built from current workspace data where possible. */
export function samplePayload(wf: Pick<Workflow, 'name' | 'ownerId'>, trigger: FlowNode | undefined): Payload {
  const p: Payload = { ...basePayload(wf), ...STATIC_SAMPLE }
  const kind = trigger?.data.kind
  const c = trigger?.data.config ?? {}
  if (kind === 'message_received') {
    const ch = resolveChannel(str(c.channel, 'general'))
    const msgs = useMessenger.getState().messages.filter((m) => (!ch || m.channelId === ch.id) && !m.threadId && m.kind !== 'system' && !m.deleted && m.userId !== 'u_bot')
    const m = msgs[msgs.length - 1]
    if (m) Object.assign(p, messagePayload(m))
    else Object.assign(p, { 'message.text': 'api-gateway 에러율이 급증했어요', 'message.author': isDemoWorkspace() ? '윤태현' : '동료', 'channel.name': ch?.name ?? 'general' })
    if (str(c.keyword)) p['message.text'] = `${str(c.keyword).split(',')[0].trim()} — ${p['message.text']}`
  } else if (kind === 'task_status' || kind === 'schedule') {
    const tasks = useProjects.getState().tasks.filter((t) => t.status !== 'done')
    const t = [...tasks].sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'))[0]
    if (t) Object.assign(p, taskPayload(t), kind === 'task_status' && str(c.to) ? { 'task.status': str(c.to) } : {})
  } else if (kind === 'approval_requested') {
    const r = useApprovals.getState().requests[0]
    if (r) Object.assign(p, approvalPayload(r), str(c.event) && c.event !== 'submitted' ? { 'approval.status': str(c.event) } : {})
  } else if (kind === 'event_start') {
    const now = Date.now()
    const e = useCalendar.getState().events.filter((x) => x.type !== 'holiday' && new Date(x.start).getTime() > now).sort((a, b) => a.start.localeCompare(b.start))[0]
    if (e) Object.assign(p, eventPayload(e))
  }
  return p
}

/* ───────────────────────── resolvers ───────────────────────── */

function resolveChannel(name: string) {
  const chans = useMessenger.getState().channels.filter((c) => c.kind !== 'dm')
  const n = name.replace(/^#/, '').trim().toLowerCase()
  return chans.find((c) => c.name.toLowerCase() === n) ?? chans.find((c) => c.id === n || c.id === `c_${n}`) ?? chans.find((c) => c.name.toLowerCase().startsWith(n))
}

function resolveProject(v: string) {
  const ps = useProjects.getState().projects.filter((p) => !p.archived)
  const n = v.trim().toLowerCase()
  return ps.find((p) => p.id === v) ?? ps.find((p) => p.id === `p_${n}` || p.key.toLowerCase() === n) ?? ps.find((p) => p.name.toLowerCase().includes(n)) ?? ps[0]
}

function projectMatches(cfg: string, projectId: string) {
  if (!cfg || cfg === 'all') return true
  return resolveProject(cfg)?.id === projectId
}

/** user field: '' → workflow owner, '$actor' → whoever caused the event, else a user id. */
function resolveUser(v: unknown, wf: Pick<Workflow, 'ownerId'>, payload: Payload) {
  const s = str(v)
  if (!s) return wf.ownerId
  if (s === '$actor') return payload['actor.id'] || wf.ownerId
  return s
}

/* ───────────────────────── actions ───────────────────────── */

interface Ctx {
  wf: Pick<Workflow, 'id' | 'name' | 'ownerId'>
  payload: Payload
  mode: RunMode
}

async function withTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function extractiveSummary(text: string, style: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (style === 'classify') {
    return /긴급|장애|에러|오류|먹통|안\s?돼|안\s?열|(열리|되|작동하|접속되|로그인되)지\s?않|실패|down|critical|urgent|outage|asap|즉시/i.test(clean) ? '긴급' : /문의|요청|확인|부탁/.test(clean) ? '보통' : '낮음'
  }
  const sentences = clean.split(/(?<=[.!?。…])\s+|\s*[\n•·-]\s+/).map((x) => x.trim()).filter((x) => x.length > 1)
  if (!sentences.length) return clean ? trunc(clean, 120) : '(요약할 내용이 없어요)'
  if (style === 'tldr') return trunc(sentences[0], 120)
  const top = sentences.slice(0, 3).map((x) => `• ${trunc(x, 90)}`)
  return style === 'report' ? `요약\n${top.join('\n')}` : top.join('\n')
}

const STYLE_PROMPT: Record<string, string> = {
  bullets: '다음 내용을 한국어 3줄 불릿(• )으로 간결하게 요약하세요. 불릿 외의 말은 쓰지 마세요.',
  tldr: '다음 내용을 한국어 한 문장으로 요약하세요.',
  classify: '다음 내용의 긴급도를 "긴급", "보통", "낮음" 중 하나의 단어로만 답하세요.',
  report: '다음 내용을 한국어로 짧은 리포트(제목 한 줄 + 핵심 3~4줄)로 정리하세요.',
}

async function aiSummary(input: string, style: string): Promise<{ text: string; via: 'ai' | 'local' }> {
  if (useSyncStatus.getState().aiEnabled && input.trim()) {
    try {
      const res = await withTimeout(
        '/api/ai/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${STYLE_PROMPT[style] ?? STYLE_PROMPT.bullets}\n\n---\n${input.slice(0, 12_000)}` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
          }),
        },
        25_000,
      )
      if (res.ok) {
        const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
        if (text) return { text: style === 'classify' ? (text.match(/긴급|보통|낮음/)?.[0] ?? text) : text, via: 'ai' }
      }
    } catch { /* fall through to the local summary */ }
  }
  return { text: extractiveSummary(input, style), via: 'local' }
}

/** Execute one action node. Returns the step message; throws on failure. */
async function performAction(node: FlowNode, ctx: Ctx): Promise<string> {
  const c = node.data.config
  const { wf, payload, mode } = ctx
  const live = mode === 'live'
  const fill = (v: unknown, f = '') => fillTemplate(str(v, f), payload, mode)
  const tag = live ? '' : ' (테스트: 실제로 실행하지 않음)'

  switch (node.data.kind) {
    case 'send_message': {
      const ch = resolveChannel(str(c.channel, 'general'))
      if (!ch) throw new Error(`#${str(c.channel, 'general')} 채널을 찾을 수 없어요`)
      const text = fill(c.message).trim()
      if (!text) throw new Error('보낼 메시지 내용이 비어 있어요')
      if (live) asEngine(() => useMessenger.getState().sendMessage({ channelId: ch.id, userId: 'u_bot', text, meta: { workflowId: wf.id, workflowName: wf.name } }))
      return `#${ch.name}에 Nexus Bot으로 전송${tag}: "${trunc(text, 70)}"`
    }
    case 'create_task': {
      const project = resolveProject(str(c.project, 'p_nexus'))
      if (!project) throw new Error('태스크를 만들 프로젝트가 없어요')
      const title = fill(c.title, '자동 생성 태스크').trim() || '자동 생성 태스크'
      const assignee = resolveUser(c.assignee, wf, payload)
      const priority = (['urgent', 'high', 'medium', 'low'].includes(str(c.priority)) ? str(c.priority) : 'medium') as Priority
      if (live) {
        const t = asEngine(() =>
          useProjects.getState().createTask({ projectId: project.id, title, priority, assigneeIds: assignee ? [assignee] : [], description: `> 🤖 자동화 **${wf.name}** 에서 생성된 태스크입니다.` }),
        )
        payload['task.key'] = getTaskKey(t)
        payload['task.link'] = `/projects/${t.projectId}?task=${t.id}`
        return `${project.key}-${t.number} "${trunc(title)}" 생성 → ${nameOf(assignee) || '미지정'}`
      }
      return `"${trunc(title)}" 태스크 생성${tag} → ${project.name} · ${nameOf(assignee) || '미지정'}`
    }
    case 'send_email': {
      const to = fill(c.to).trim()
      const subject = fill(c.subject, '(제목 없음)')
      if (!to) throw new Error('받는 사람이 비어 있어요')
      if (live) {
        const n = isDemoWorkspace()
          ? { type: 'workflow' as const, title: `📧 [데모] 이메일 발송 기록: ${trunc(subject, 40)}`, body: `받는 사람 ${to} · 실제 메일 서버가 없어 발송되지 않았어요`, link: `/workflows/${wf.id}` }
          : { type: 'workflow' as const, title: `📧 이메일 단계 기록: ${trunc(subject, 40)}`, body: `받는 사람 ${to} · 이메일 발송은 곧 제공돼요. 지금은 기록만 남겨요`, link: `/workflows/${wf.id}` }
        if (wf.ownerId === getCurrentUserId()) notify(n)
        else notifyUser(wf.ownerId, { ...n, actorId: 'u_bot' })
      }
      return isDemoWorkspace()
        ? `[데모] 이메일 → ${to} · "${trunc(subject, 40)}" — 메일 서버가 없어 실제 발송 대신 기록만 남겨요`
        : `이메일 → ${to} · "${trunc(subject, 40)}" — 이메일 발송은 곧 제공돼요 (지금은 기록만 남겨요)`
    }
    case 'request_approval': {
      const title = fill(c.title, '자동 상신 문서').trim() || '자동 상신 문서'
      const approver = resolveUser(c.approver, wf, payload)
      const kind = (['general', 'purchase', 'access', 'expense', 'leave', 'travel'].includes(str(c.approvalKind)) ? str(c.approvalKind) : 'general') as ApprovalKind
      if (live) {
        const id = asEngine(() =>
          useApprovals.getState().createRequest({ kind, title, approverIds: [approver], details: `자동화 "${wf.name}"에 의해 상신된 문서입니다.` }),
        )
        payload['approval.link'] = `/approvals?id=${id}`
      }
      return `결재 문서 "${trunc(title)}" 상신${tag} → 결재자 ${nameOf(approver)}`
    }
    case 'create_doc': {
      const title = fill(c.title, '자동 생성 문서').trim() || '자동 생성 문서'
      const tplId = str(c.template, 'blank')
      if (live) {
        const [{ useDocs }, { TEMPLATES }] = await Promise.all([import('@/features/docs/store'), import('@/features/docs/templates')])
        const tpl = TEMPLATES.find((t) => t.id === tplId)
        const folder = str(c.folder)
        const intro = `> 🤖 자동화 **${wf.name}** 에서 ${formatDate(new Date(), 'M월 d일 HH:mm')}에 생성됨${folder ? ` · ${folder}` : ''}\n\n`
        const extra = payload['ai.summary'] ? `## 요약\n${payload['ai.summary']}\n\n` : ''
        const doc = asEngine(() =>
          useDocs.getState().createDoc({ title, emoji: tpl?.emoji ?? '🤖', cover: tpl?.cover, content: intro + extra + (tpl ? tpl.content() : '') }),
        )
        payload['doc.link'] = `/docs/${doc.id}`
        return `문서 "${trunc(title)}" 생성${tpl ? ` (템플릿: ${tpl.title})` : ''}`
      }
      return `문서 "${trunc(title)}" 생성${tag}`
    }
    case 'http_request': {
      const method = str(c.method, 'POST').toUpperCase()
      const url = fill(c.url).trim()
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) throw new Error('URL이 올바르지 않아요 (http:// 또는 https://로 시작)')
      if (!live && method !== 'GET') return `${method} ${trunc(url, 50)} — 테스트 모드라 요청을 보내지 않았어요`
      const rawBody = fill(c.body).trim()
      let headers: Record<string, string> | undefined
      if (rawBody && method !== 'GET' && method !== 'HEAD') {
        try { JSON.parse(rawBody); headers = { 'Content-Type': 'application/json' } } catch { headers = { 'Content-Type': 'text/plain;charset=utf-8' } }
      }
      const t0 = performance.now()
      let res: Response
      try {
        res = await withTimeout(url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : rawBody || undefined }, 10_000)
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError'
        throw new Error(aborted ? `${method} ${trunc(url, 50)} — 10초 안에 응답이 없어 중단했어요` : `${method} ${trunc(url, 50)} — 네트워크 오류 또는 CORS로 요청이 차단됐어요`)
      }
      const ms = Math.round(performance.now() - t0)
      const text = await res.text().catch(() => '')
      payload['http.status'] = String(res.status)
      payload['http.body'] = text.slice(0, 4000)
      payload.body = payload['http.body']
      try {
        const j = JSON.parse(text) as unknown
        if (j && typeof j === 'object' && !Array.isArray(j))
          for (const [k, v] of Object.entries(j as Record<string, unknown>)) if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) payload[`http.body.${k}`] = String(v)
      } catch { /* not JSON */ }
      if (!res.ok) throw new Error(`${method} ${trunc(url, 50)} → ${res.status} ${res.statusText || ''} (${ms}ms)`.trim())
      return `${method} ${trunc(url, 50)} → ${res.status} ${res.statusText || 'OK'} (${ms}ms)`
    }
    case 'ai_summary': {
      const style = str(c.style, 'bullets')
      const input = fill(c.input).trim() || payload['message.text'] || payload['form.message'] || payload['http.body'] || payload.body || ''
      const { text, via } = await aiSummary(input, style)
      payload['ai.summary'] = text
      return `${via === 'ai' ? `Nexus AI (${useSyncStatus.getState().aiModel || 'Gemini'})` : '로컬 요약 (AI 키 미설정)'}: "${trunc(text.replace(/\n/g, ' '), 80)}"`
    }
    case 'notify': {
      const to = resolveUser(c.user, wf, payload)
      const title = fill(c.title, `${wf.name} 알림`).trim() || `${wf.name} 알림`
      const body = fill(c.body).trim() || undefined
      const link = payload['task.link'] || payload['approval.link'] || payload['doc.link'] || payload['event.link'] || payload['message.link'] || `/workflows/${wf.id}`
      if (live) {
        const n = { type: 'workflow' as const, title, body, link, actorId: 'u_bot' }
        if (to === getCurrentUserId()) notify(n)
        else notifyUser(to, n)
      }
      return `${nameOf(to)}님에게 알림${tag}: "${trunc(title, 50)}"`
    }
    default:
      return '완료'
  }
}

function describeTrigger(node: FlowNode, payload: Payload): string {
  switch (node.data.kind) {
    case 'message_received': return `#${payload['channel.name'] ?? ''} · ${payload['message.author'] ?? ''}: "${trunc(payload['message.text'] ?? '', 60)}"`
    case 'task_status': return `${payload['task.key'] ?? ''} "${trunc(payload['task.title'] ?? '', 40)}" → ${payload['task.statusLabel'] ?? payload['task.status'] ?? ''}`
    case 'approval_requested': return `"${trunc(payload['approval.title'] ?? '', 40)}" (${payload['approval.requester'] ?? ''}) · ${payload['approval.status'] ?? ''}`
    case 'event_start': return `"${payload['event.title'] ?? ''}" ${payload['event.start'] ?? ''}`
    case 'schedule': return `스케줄 ${str(node.data.config.cron)} · ${payload['now.date']} ${payload['now.time']}${payload['task.title'] ? ` · 대상 ${payload['task.key']} ${trunc(payload['task.title'], 30)}` : ''}`
    case 'webhook': return `${str(node.data.config.method, 'POST')} ${str(node.data.config.path)} ← ${trunc(payload.body ?? '{}', 70)}`
    case 'form_submitted': return `양식 제출 — ${payload['form.name'] ?? ''}${payload['form.company'] ? ` · ${payload['form.company']}` : ''}`
    default: return '트리거'
  }
}

/* ───────────────────────── executor ───────────────────────── */

export interface ExecHooks {
  onEdge?: (edge: Edge) => Promise<void> | void
  onNodeStart?: (node: FlowNode) => Promise<void> | void
  onNodeEnd?: (node: FlowNode, step: WorkflowRunStep, extra: { trace?: string[]; branch?: 'true' | 'false'; branchHasEdge?: boolean }) => Promise<void> | void
  onWait?: (node: FlowNode, ms: number, until: Date) => void
  isCancelled?: () => boolean
}

export interface ExecOptions {
  mode: RunMode
  payload: Payload
  /** human label shown in 실행 기록 */
  trigger: string
  manual?: boolean
  key?: string
  hooks?: ExecHooks
  /** default true */
  record?: boolean
}

export interface ExecResult {
  ok: boolean
  runId?: string
  steps: WorkflowRunStep[]
  executed: number
  durationMs: number
  error?: string
  skipped: string[]
  unreachable: string[]
}

type Graph = Pick<Workflow, 'id' | 'name' | 'ownerId'> & { nodes: FlowNode[]; edges: Edge[] }

export async function runWorkflow(wf: Graph, opts: ExecOptions): Promise<ExecResult> {
  const { mode, hooks = {} } = opts
  const payload: Payload = { ...basePayload(wf), ...opts.payload }
  const record = opts.record !== false
  const t0 = performance.now()
  const startedAt = new Date().toISOString()
  const steps: WorkflowRunStep[] = []
  const at = () => Math.round(performance.now() - t0)
  const nodes = wf.nodes
  const edges = wf.edges
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const start = nodes.find((n) => n.type === 'trigger')

  const visited = new Set<string>()
  let skipped: string[] = []
  let unreachable: string[] = []
  let runId: string | undefined
  if (record) {
    runId = useWorkflows.getState().addRun(wf.id, {
      startedAt, durationMs: 0, status: 'running', trigger: opts.trigger, manual: opts.manual || undefined, mode, actorId: getCurrentUserId(), key: opts.key, steps: [],
    })
  }
  const finish = (ok: boolean, error?: string): ExecResult => {
    const durationMs = at()
    if (record && runId) useWorkflows.getState().updateRun(wf.id, runId, { status: ok ? 'success' : 'failed', durationMs, steps: [...steps], waitUntil: undefined })
    return { ok, runId, steps, executed: visited.size, durationMs, error, skipped, unreachable }
  }

  if (!start) {
    steps.push({ nodeId: '', label: '트리거', status: 'failed', at: 0, message: '트리거 노드가 없어요' })
    return finish(false, '트리거 노드가 없어요')
  }

  const queue: { id: string; via?: Edge }[] = [{ id: start.id }]
  let failure: string | undefined
  while (queue.length && !failure) {
    if (hooks.isCancelled?.()) {
      steps.push({ nodeId: '', label: '실행 취소', status: 'skipped', at: at(), message: '사용자가 실행을 취소했어요' })
      return { ...finish(false, 'cancelled'), error: 'cancelled' }
    }
    const { id, via } = queue.shift()!
    if (visited.has(id)) continue
    const node = byId.get(id)
    if (!node) continue
    visited.add(id)
    if (via) await hooks.onEdge?.(via)
    await hooks.onNodeStart?.(node)
    const def = getDef(node.data.kind)
    const label = node.data.title || def.label
    let outs = edges.filter((e) => e.source === id)
    let message = ''
    let status: WorkflowRunStep['status'] = 'success'
    const extra: { trace?: string[]; branch?: 'true' | 'false'; branchHasEdge?: boolean } = {}
    try {
      if (def.category === 'trigger') {
        message = describeTrigger(node, payload)
      } else if (def.category === 'condition') {
        const ev = evaluateCondition(node, payload)
        const branch = ev.pass ? 'true' : 'false'
        outs = outs.filter((e) => (e.sourceHandle ?? 'true') === branch)
        extra.trace = ev.trace
        extra.branch = branch
        extra.branchHasEdge = outs.length > 0
        message = `${ev.pass ? '참' : '거짓'} 분기`
      } else if (def.category === 'delay') {
        const amount = Math.max(0, Number(node.data.config.amount ?? 1))
        const unit = str(node.data.config.unit, 'hours')
        const ms = amount * (UNIT_MS[unit] ?? UNIT_MS.hours)
        if (mode === 'live' && ms > 0) {
          const until = new Date(Date.now() + ms)
          hooks.onWait?.(node, ms, until)
          if (record && runId) useWorkflows.getState().updateRun(wf.id, runId, { waitUntil: until.toISOString(), steps: [...steps] })
          // long waits in chunks (setTimeout overflows past ~24.8 days)
          for (let left = ms; left > 0; left -= 3_600_000) await sleep(Math.min(left, 3_600_000))
          message = `${amount}${UNIT_LABEL[unit] ?? ''} 대기 완료`
        } else {
          message = `${amount}${UNIT_LABEL[unit] ?? ''} 대기 — 테스트 모드에서는 즉시 통과`
        }
      } else {
        message = await performAction(node, { wf, payload, mode })
      }
    } catch (e) {
      status = 'failed'
      message = e instanceof Error ? e.message : String(e)
      failure = message
    }
    const step: WorkflowRunStep = { nodeId: node.id, label, status, at: at(), message }
    steps.push(step)
    await hooks.onNodeEnd?.(node, step, extra)
    if (status === 'failed') break
    outs.forEach((e) => queue.push({ id: e.target, via: e }))
  }

  // nodes that didn't run: on an unchosen branch / after a failure vs. not connected at all
  const reach = new Set<string>([start.id])
  const stack = [start.id]
  while (stack.length) {
    const id = stack.pop()!
    edges.filter((e) => e.source === id).forEach((e) => { if (!reach.has(e.target)) { reach.add(e.target); stack.push(e.target) } })
  }
  const notRun = nodes.filter((n) => !visited.has(n.id))
  skipped = notRun.filter((n) => reach.has(n.id)).map((n) => n.id)
  unreachable = notRun.filter((n) => !reach.has(n.id)).map((n) => n.id)
  for (const nid of [...skipped, ...unreachable]) {
    const n = byId.get(nid)!
    steps.push({ nodeId: nid, label: n.data.title || getDef(n.data.kind).label, status: 'skipped', at: at(), message: unreachable.includes(nid) ? '연결되지 않음' : failure ? '이전 단계 실패' : '분기 미선택' })
  }
  return finish(!failure, failure)
}

/* ───────────────────────── triggers ───────────────────────── */

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const recentFires = new Map<string, number[]>()

function rateOk(wfId: string) {
  const now = Date.now()
  const list = (recentFires.get(wfId) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (list.length >= RATE_MAX) return false
  list.push(now)
  recentFires.set(wfId, list)
  return true
}

const triggerOf = (w: Workflow) => (w.nodes as FlowNode[]).find((n) => n.type === 'trigger')
const usesTaskVars = (w: Workflow) => JSON.stringify(w.nodes).includes('{{task.') || JSON.stringify(w.nodes).includes('"task.')

/** Run every enabled workflow whose trigger is `kind` and whose config passes `match`. */
function fire(kind: string, match: (cfg: Record<string, unknown>, wf: Workflow) => boolean, payload: Payload, label: string, key?: (wf: Workflow) => string) {
  for (const wf of useWorkflows.getState().workflows) {
    if (!wf.enabled) continue
    const trig = triggerOf(wf)
    if (!trig || trig.data.kind !== kind) continue
    let ok = false
    try { ok = match(trig.data.config, wf) } catch { ok = false }
    if (!ok) continue
    const k = key?.(wf)
    if (k && wf.runs.some((r) => r.key === k)) continue
    if (!rateOk(wf.id)) continue
    void runWorkflow({ ...wf, nodes: wf.nodes as FlowNode[] }, { mode: 'live', payload, trigger: label, key: k }).catch((e) => console.error('[workflow]', wf.name, e))
  }
}

/** Was this store change made in this browser (not applied from another client)? */
function isLocalChange() {
  if (flags.remoteDepth > 0 || flags.engineActing > 0) return false
  // offline demo: other tabs' changes arrive via storage rehydration — only the visible tab reacts
  if (!isServerMode() && typeof document !== 'undefined' && document.visibilityState !== 'visible') return false
  return true
}

type AnyStore = { setState: (...args: never[]) => unknown }
/** Mark changes applied through `store.setState` (realtime sync uses it; feature actions use their own `set`). */
function tagRemote(store: AnyStore) {
  const s = store as unknown as { setState: (...a: unknown[]) => unknown; __wfTagged?: boolean }
  if (s.__wfTagged) return
  const orig = s.setState
  s.setState = (...args: unknown[]) => {
    flags.remoteDepth++
    try { return orig(...args) } finally { flags.remoteDepth-- }
  }
  s.__wfTagged = true
}

let started = false

export function startWorkflowEngine(): () => void {
  if (started || typeof window === 'undefined') return () => {}
  started = true
  ;[useMessenger, useProjects, useApprovals].forEach((s) => tagRemote(s as unknown as AnyStore))
  const unsubs: (() => void)[] = []

  /* 메시지 수신 */
  const seenMsgs = new Set(useMessenger.getState().messages.map((m) => m.id))
  unsubs.push(
    useMessenger.subscribe((s, prev) => {
      if (s.messages === prev.messages) return
      const fresh: Message[] = []
      for (const m of s.messages) if (!seenMsgs.has(m.id)) { seenMsgs.add(m.id); fresh.push(m) }
      if (!fresh.length || !isLocalChange()) return
      for (const m of fresh) {
        if (m.userId === 'u_bot' || m.kind === 'system' || m.deleted || m.scheduledFor) continue
        if (Date.now() - new Date(m.createdAt).getTime() > 120_000) continue
        const p = messagePayload(m)
        fire(
          'message_received',
          (cfg) => {
            const ch = resolveChannel(str(cfg.channel, 'general'))
            if (!ch || ch.id !== m.channelId) return false
            const kws = str(cfg.keyword).split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
            return !kws.length || kws.some((k) => m.text.toLowerCase().includes(k))
          },
          { ...p, 'actor.id': m.userId, 'actor.name': nameOf(m.userId) },
          `메시지 수신 · #${p['channel.name']} · ${p['message.author']}`,
        )
      }
    }),
  )

  /* 태스크 상태 변경 */
  const taskStatus = new Map(useProjects.getState().tasks.map((t) => [t.id, t.status]))
  unsubs.push(
    useProjects.subscribe((s, prev) => {
      if (s.tasks === prev.tasks) return
      const changed: Task[] = []
      for (const t of s.tasks) {
        const before = taskStatus.get(t.id)
        taskStatus.set(t.id, t.status)
        if (before !== undefined && before !== t.status) changed.push(t)
      }
      if (!changed.length || !isLocalChange()) return
      for (const t of changed) {
        const actor = t.activity?.[t.activity.length - 1]?.userId ?? getCurrentUserId()
        fire(
          'task_status',
          (cfg) => str(cfg.to, 'done') === t.status && projectMatches(str(cfg.project, 'all'), t.projectId),
          { ...taskPayload(t), 'actor.id': actor, 'actor.name': nameOf(actor) },
          `태스크 상태 변경 · ${getTaskKey(t)} → ${STATUS_META[t.status]?.label ?? t.status}`,
        )
      }
    }),
  )

  /* 결재 요청 / 승인 / 반려 */
  const apvStatus = new Map(useApprovals.getState().requests.map((r) => [r.id, r.status]))
  unsubs.push(
    useApprovals.subscribe((s, prev) => {
      if (s.requests === prev.requests) return
      const events: { r: ApprovalRequest; ev: 'submitted' | 'approved' | 'rejected' }[] = []
      for (const r of s.requests) {
        const before = apvStatus.get(r.id)
        apvStatus.set(r.id, r.status)
        if (before === undefined) {
          if (r.status === 'pending' && Date.now() - new Date(r.createdAt).getTime() < 120_000) events.push({ r, ev: 'submitted' })
        } else if (before !== r.status && (r.status === 'approved' || r.status === 'rejected')) events.push({ r, ev: r.status })
      }
      if (!events.length || !isLocalChange()) return
      for (const { r, ev } of events) {
        const decided = [...r.steps].reverse().find((st) => st.decidedAt)
        const actor = ev === 'submitted' ? r.requesterId : decided?.approverId ?? getCurrentUserId()
        fire(
          'approval_requested',
          (cfg) => str(cfg.event, 'submitted') === ev && (str(cfg.approvalKind, 'all') === 'all' || cfg.approvalKind === r.kind),
          { ...approvalPayload(r), 'actor.id': actor, 'actor.name': nameOf(actor) },
          `결재 ${ev === 'submitted' ? '상신' : ev === 'approved' ? '승인' : '반려'} · ${r.title}`,
        )
      }
    }),
  )

  /* 스케줄(cron) · 일정 시작 — sync leader only, evaluated every minute / 30s */
  let lastMinute = ''
  const tick = () => {
    if (!isSyncLeader()) return
    const now = new Date()
    const minuteKey = formatDate(now, "yyyy-MM-dd'T'HH:mm")
    if (minuteKey !== lastMinute) {
      lastMinute = minuteKey
      for (const wf of useWorkflows.getState().workflows) {
        if (!wf.enabled) continue
        const trig = triggerOf(wf)
        if (trig?.data.kind !== 'schedule') continue
        const cron = str(trig.data.config.cron)
        if (!cron || !cronMatches(cron, now)) continue
        const key = `cron:${minuteKey}`
        if (wf.runs.some((r) => r.key === key || r.key?.startsWith(key + ':'))) continue
        const label = `스케줄 · ${formatDate(now, 'M월 d일 HH:mm')}`
        if (usesTaskVars(wf)) {
          // fan out: one run per open task due within 24h
          const due = useProjects
            .getState()
            .tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate).getTime() - now.getTime() < 86_400_000 && new Date(t.dueDate).getTime() > now.getTime() - 86_400_000)
            .slice(0, 10)
          if (!due.length) {
            useWorkflows.getState().addRun(wf.id, { startedAt: now.toISOString(), durationMs: 0, status: 'success', trigger: `${label} · 대상 태스크 없음`, mode: 'live', key, actorId: getCurrentUserId(), steps: [{ nodeId: trig.id, label: getDef('schedule').label, status: 'success', at: 0, message: '마감 24시간 이내 태스크가 없어 실행할 단계가 없어요' }] })
            continue
          }
          due.forEach((t) => {
            if (!rateOk(wf.id)) return
            void runWorkflow({ ...wf, nodes: wf.nodes as FlowNode[] }, { mode: 'live', payload: taskPayload(t), trigger: `${label} · ${getTaskKey(t)}`, key: `${key}:${t.id}` })
          })
        } else if (rateOk(wf.id)) {
          void runWorkflow({ ...wf, nodes: wf.nodes as FlowNode[] }, { mode: 'live', payload: {}, trigger: label, key })
        }
      }
    }
    // 일정 시작 N분 전
    const nowMs = now.getTime()
    for (const wf of useWorkflows.getState().workflows) {
      if (!wf.enabled) continue
      const trig = triggerOf(wf)
      if (trig?.data.kind !== 'event_start') continue
      const before = Math.max(0, Number(trig.data.config.before ?? 10)) * 60_000
      const scope = str(trig.data.config.calendar, 'team')
      for (const ev of useCalendar.getState().events) {
        if (ev.allDay || ev.type === 'holiday') continue
        const start = new Date(ev.start).getTime()
        const fireAt = start - before
        if (nowMs < fireAt || nowMs >= start || nowMs - fireAt > 10 * 60_000) continue
        const involvesOwner = ev.organizerId === wf.ownerId || ev.attendeeIds.includes(wf.ownerId)
        if (scope === 'me' ? !involvesOwner : scope === 'team' ? ev.type !== 'meeting' : ev.type === 'personal') continue
        const key = `ev:${ev.id}@${ev.start}`
        if (wf.runs.some((r) => r.key === key) || !rateOk(wf.id)) continue
        void runWorkflow({ ...wf, nodes: wf.nodes as FlowNode[] }, { mode: 'live', payload: eventPayload(ev), trigger: `일정 시작 · ${ev.title}`, key })
      }
    }
  }
  // Runs interrupted by a closed tab (e.g. during a long Delay) would stay "실행 중" forever — close them out.
  const sweepStale = () => {
    if (!isSyncLeader()) return
    const now = Date.now()
    for (const wf of useWorkflows.getState().workflows) {
      for (const r of wf.runs) {
        if (r.status !== 'running') continue
        const deadline = r.waitUntil ? new Date(r.waitUntil).getTime() + 10 * 60_000 : new Date(r.startedAt).getTime() + 15 * 60_000
        if (now > deadline)
          useWorkflows.getState().updateRun(wf.id, r.id, {
            status: 'failed',
            waitUntil: undefined,
            steps: [...(r.steps ?? []), { nodeId: '', label: '실행 중단', status: 'failed', at: now - new Date(r.startedAt).getTime(), message: '실행하던 브라우저가 닫혀 중단됐어요' }],
          })
      }
    }
  }
  const iv = window.setInterval(tick, 15_000)
  const sv = window.setInterval(sweepStale, 5 * 60_000)
  setTimeout(() => { tick(); sweepStale() }, 3_000)

  return () => {
    unsubs.forEach((u) => u())
    clearInterval(iv)
    clearInterval(sv)
    started = false
  }
}

/** Fake but clearly-labelled endpoint for webhook triggers (no inbound HTTP in this demo). */
export function demoWebhookUrl(wfId: string, path: string) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${location.origin}/api/hooks/${wfId}${p}`
}

export const newRunId = () => uid('run')
export type { WorkflowRun }
