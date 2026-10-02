import type { Edge } from '@xyflow/react'
import { gedge, gnode } from './graph'
import type { FlowNode } from './types'

export interface WorkflowTemplate {
  id: string
  name: string
  emoji: string
  description: string
  tag: string
  gradient: string
  /** Rough "time saved per run" in minutes (for card copy) */
  saves: number
  build: () => { nodes: FlowNode[]; edges: Edge[] }
}

export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl_onboarding',
    name: '신규 입사자 온보딩',
    emoji: '🚀',
    description: '입사자 정보 양식이 제출되면 체크리스트 문서, 환영 메시지, 장비 준비 태스크를 자동으로 만들어요.',
    tag: 'HR',
    gradient: 'from-violet-500 to-fuchsia-500',
    saves: 45,
    build: () => ({
      nodes: [
        gnode('t1', 'form_submitted', 0, 0, { form: 'onboarding' }),
        gnode('a1', 'create_doc', 0, 1, { title: '{{form.name}}님 온보딩 체크리스트', template: 'onboarding', folder: '피플팀 / 온보딩' }),
        gnode('a2', 'send_message', 0, 2, { channel: 'general', message: '🎉 {{form.name}}님이 우리 팀에 합류했어요! 따뜻하게 맞아주세요 👋' }),
        gnode('a3', 'create_task', 0, 3, { project: 'nexus', title: '{{form.name}}님 노트북 · 계정 세팅', assignee: 'u_devops', priority: 'high' }),
        gnode('d1', 'delay', 0, 4, { amount: 1, unit: 'days' }),
        gnode('a4', 'send_email', 0, 5, { to: '{{form.email}}', subject: '첫 출근을 환영합니다 🌌', body: '{{form.name}}님, 첫날 일정과 버디를 안내드려요.' }),
      ],
      edges: [gedge('t1', 'a1'), gedge('a1', 'a2'), gedge('a2', 'a3'), gedge('a3', 'd1'), gedge('d1', 'a4')],
    }),
  },
  {
    id: 'tpl_approval_slack',
    name: '결재 승인 시 슬랙 알림',
    emoji: '🔔',
    description: '결재가 최종 승인되면 금액에 따라 경영지원 채널 또는 요청자에게 알림을 보내요.',
    tag: '전자결재',
    gradient: 'from-pink-500 to-rose-600',
    saves: 8,
    build: () => ({
      nodes: [
        gnode('t1', 'approval_requested', 0, 0, { approvalKind: 'all', event: 'approved' }),
        gnode('c1', 'if_else', 0, 1, { match: 'all', rules: [{ id: 'r1', field: 'approval.amount', op: 'gt', value: '1000000' }] }, '고액 결재?'),
        gnode('a1', 'send_message', -0.6, 2, { channel: 'general', message: '💸 {{approval.requester}}님의 "{{approval.title}}" ({{approval.amount}}원) 승인 완료' }),
        gnode('a2', 'send_email', -0.6, 3, { to: 'finance@example.com', subject: '[지급 요청] {{approval.title}}', body: '승인된 결재 건의 지급을 요청드립니다.' }),
        gnode('a3', 'send_message', 0.6, 2, { channel: 'general', message: '✅ {{approval.title}} 결재가 승인되었어요.' }),
      ],
      edges: [gedge('t1', 'c1'), gedge('c1', 'a1', 'true'), gedge('a1', 'a2'), gedge('c1', 'a3', 'false')],
    }),
  },
  {
    id: 'tpl_deadline',
    name: '마감 임박 태스크 리마인드',
    emoji: '⏰',
    description: '평일 아침마다 마감이 하루 남은 태스크를 찾아 담당자에게 리마인드해요.',
    tag: '프로젝트',
    gradient: 'from-amber-400 to-orange-600',
    saves: 15,
    build: () => ({
      nodes: [
        gnode('t1', 'schedule', 0, 0, { cron: '0 9 * * 1-5' }),
        gnode('c1', 'if_else', 0, 1, { match: 'all', rules: [{ id: 'r1', field: 'task.status', op: 'neq', value: 'done' }, { id: 'r2', field: 'task.dueDate', op: 'lt', value: '1일 후' }] }, '마감 24시간 이내?'),
        gnode('a1', 'send_message', -0.6, 2, { channel: 'engineering', message: '⏰ {{task.assignee}}님, "{{task.title}}" 마감이 {{task.dueDate}}이에요!' }),
        gnode('d1', 'delay', -0.6, 3, { amount: 4, unit: 'hours' }),
        gnode('a2', 'send_email', -0.6, 4, { to: '{{task.assignee}}', subject: '[리마인드] {{task.title}} 마감 임박', body: '진행 상황을 업데이트 해주세요.' }),
      ],
      edges: [gedge('t1', 'c1'), gedge('c1', 'a1', 'true'), gedge('a1', 'd1'), gedge('d1', 'a2')],
    }),
  },
  {
    id: 'tpl_weekly',
    name: '주간 리포트 자동 생성',
    emoji: '📊',
    description: '매주 금요일 오후, 지표를 수집해 AI가 요약하고 주간 리포트 문서를 만들어 공유해요.',
    tag: 'AI',
    gradient: 'from-cyan-400 to-blue-600',
    saves: 90,
    build: () => ({
      nodes: [
        gnode('t1', 'schedule', 0, 0, { cron: '0 17 * * 5' }),
        gnode('a1', 'http_request', 0, 1, { method: 'GET', url: 'https://example.com/metrics?range=7d' }),
        gnode('a2', 'ai_summary', 0, 2, { input: '{{body}}', style: 'report' }),
        gnode('a3', 'create_doc', 0, 3, { title: '주간 리포트 · {{now.date}}', template: 'weekly', folder: '제품 / 주간 리포트' }),
        gnode('a4', 'send_message', 0, 4, { channel: 'product', message: '📊 이번 주 리포트가 준비됐어요!\n{{ai.summary}}' }),
      ],
      edges: [gedge('t1', 'a1'), gedge('a1', 'a2'), gedge('a2', 'a3'), gedge('a3', 'a4')],
    }),
  },
  {
    id: 'tpl_ticket',
    name: '고객 문의 → 티켓 생성',
    emoji: '🎫',
    description: '고객 문의가 들어오면 AI가 긴급도를 분류하고 고객 지원 프로젝트에 티켓을 만들어요.',
    tag: '고객 지원',
    gradient: 'from-emerald-400 to-teal-600',
    saves: 12,
    build: () => ({
      nodes: [
        gnode('t1', 'form_submitted', 0, 0, { form: 'contact' }),
        gnode('a1', 'ai_summary', 0, 1, { input: '{{form.message}}', style: 'classify' }),
        gnode('c1', 'if_else', 0, 2, { match: 'any', rules: [{ id: 'r1', field: 'ai.summary', op: 'eq', value: '긴급' }] }, '긴급 문의?'),
        gnode('a2', 'create_task', -0.6, 3, { project: 'cs', title: '🔥 [긴급] {{form.company}} 문의', assignee: 'u_sales', priority: 'urgent' }),
        gnode('a3', 'send_message', -0.6, 4, { channel: 'sales', message: '🚨 긴급 고객 문의: {{form.company}} — {{ai.summary}}' }),
        gnode('a4', 'create_task', 0.6, 3, { project: 'cs', title: '{{form.company}} 문의 응대', assignee: 'u_global', priority: 'medium' }),
        gnode('a5', 'send_email', 0.6, 4, { to: '{{form.email}}', subject: '문의가 접수되었습니다', body: '{{form.name}}님, 영업일 기준 1일 이내 답변드릴게요.' }),
      ],
      edges: [gedge('t1', 'a1'), gedge('a1', 'c1'), gedge('c1', 'a2', 'true'), gedge('a2', 'a3'), gedge('c1', 'a4', 'false'), gedge('a4', 'a5')],
    }),
  },
  {
    id: 'tpl_incident',
    name: '장애 알림 에스컬레이션',
    emoji: '🚨',
    description: '모니터링 웹훅으로 장애가 감지되면 심각도에 따라 온콜 호출 및 #incidents 채널로 에스컬레이션해요.',
    tag: 'DevOps',
    gradient: 'from-rose-500 to-red-600',
    saves: 20,
    build: () => ({
      nodes: [
        gnode('t1', 'webhook', 0, 0, { path: '/hooks/incident', method: 'POST' }),
        gnode('c1', 'if_else', 0, 1, { match: 'any', rules: [{ id: 'r1', field: 'body.severity', op: 'eq', value: 'critical' }, { id: 'r2', field: 'body.severity', op: 'eq', value: 'high' }] }, '심각도 높음?'),
        gnode('a1', 'send_message', -0.6, 2, { channel: 'incidents', message: '🚨 @channel {{body.service}} 장애 감지 ({{body.severity}})' }),
        gnode('d1', 'delay', -0.6, 3, { amount: 15, unit: 'minutes' }),
        gnode('a2', 'http_request', -0.6, 4, { method: 'POST', url: 'https://events.pagerduty.com/v2/enqueue', body: '{ "routing_key": "YOUR_ROUTING_KEY", "severity": "{{body.severity}}" }' }),
        gnode('a3', 'create_task', 0.6, 2, { project: 'nexus', title: '[모니터링] {{body.service}} 경고 확인', assignee: 'u_devops', priority: 'medium' }),
      ],
      edges: [gedge('t1', 'c1'), gedge('c1', 'a1', 'true'), gedge('a1', 'd1'), gedge('d1', 'a2'), gedge('c1', 'a3', 'false')],
    }),
  },
]

export const BLANK_TEMPLATE: WorkflowTemplate = {
  id: 'tpl_blank',
  name: '새 워크플로우',
  emoji: '✨',
  description: '빈 캔버스에서 직접 만들어요.',
  tag: '빈 템플릿',
  gradient: 'from-slate-500 to-zinc-700',
  saves: 0,
  build: () => ({ nodes: [gnode('t1', 'message_received', 0, 0)], edges: [] }),
}
