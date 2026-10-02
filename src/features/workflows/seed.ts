import { daysFromNow, minutesAgo } from '@/lib/utils'
import { gedge, gnode } from './graph'
import { TEMPLATES } from './templates'
import type { Workflow, WorkflowRun } from './types'

/** Tiny deterministic PRNG so seeded histories look natural but stable. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

interface RunSpec {
  seed: number
  /** average runs per day */
  perDay: number
  failRate: number
  /** [min,max] duration ms */
  duration: [number, number]
  triggers: string[]
  weekdaysOnly?: boolean
  days?: number
}

function genRuns(id: string, spec: RunSpec): WorkflowRun[] {
  const r = rng(spec.seed)
  const runs: WorkflowRun[] = []
  const days = spec.days ?? 21
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.now() - d * 86400_000)
    const dow = date.getDay()
    if (spec.weekdaysOnly && (dow === 0 || dow === 6)) continue
    // Poisson-ish count
    let count = 0
    let acc = r()
    const L = Math.exp(-spec.perDay)
    let p = acc
    while (p > L && count < 12) { count++; acc = r(); p *= acc }
    for (let i = 0; i < count; i++) {
      const minutes = d * 1440 + Math.floor(r() * 1380) + 20
      const failed = r() < spec.failRate
      runs.push({
        id: `run_${id}_${d}_${i}`,
        startedAt: minutesAgo(minutes),
        durationMs: Math.round(spec.duration[0] + r() * (spec.duration[1] - spec.duration[0])),
        status: failed ? 'failed' : 'success',
        trigger: spec.triggers[Math.floor(r() * spec.triggers.length)],
      })
    }
  }
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 80)
}

const tpl = (id: string) => TEMPLATES.find((t) => t.id === id)!.build()

export function seedWorkflows(): Workflow[] {
  const briefing = {
    nodes: [
      gnode('t1', 'event_start', 0, 0, { calendar: 'me', before: 10 }),
      gnode('a1', 'ai_summary', 0, 1, { input: '{{event.title}} 관련 최근 메시지 · 문서 · 태스크', style: 'bullets' }, '회의 맥락 요약'),
      gnode('a2', 'send_message', 0, 2, { channel: 'product', message: '☕ 10분 후 "{{event.title}}" 시작!\n{{ai.summary}}' }, '나에게 DM 브리핑'),
    ],
    edges: [gedge('t1', 'a1'), gedge('a1', 'a2')],
  }

  const weekly = tpl('tpl_weekly')
  const incident = tpl('tpl_incident')

  return [
    {
      id: 'wf_onboarding', name: '신규 입사자 온보딩', emoji: '🚀', enabled: true, ownerId: 'u_hr', templateId: 'tpl_onboarding',
      description: '입사자 정보가 등록되면 체크리스트 · 환영 메시지 · 장비 세팅 태스크를 자동 생성',
      ...tpl('tpl_onboarding'),
      runs: genRuns('onb', { seed: 11, perDay: 0.35, failRate: 0.03, duration: [3200, 6400], triggers: ['양식 제출 · 신유진', '양식 제출 · 마크 리', '양식 제출 · 홍다은', '양식 제출 · 문태오'] }),
      createdAt: daysFromNow(-120), updatedAt: daysFromNow(-6),
    },
    {
      id: 'wf_approval_alert', name: '결재 승인 시 슬랙 알림', emoji: '🔔', enabled: true, ownerId: 'u_me', templateId: 'tpl_approval_slack',
      description: '최종 승인된 결재를 금액 기준으로 경영지원 · 요청자에게 알림',
      ...tpl('tpl_approval_slack'),
      runs: genRuns('apv', { seed: 23, perDay: 3.2, failRate: 0.02, duration: [600, 1800], triggers: ['결재 승인 · 휴가 신청', '결재 승인 · 법인카드 경비', '결재 승인 · 장비 구매', '결재 승인 · 출장 신청'], weekdaysOnly: true }),
      createdAt: daysFromNow(-64), updatedAt: daysFromNow(-2),
    },
    {
      id: 'wf_deadline', name: '마감 임박 태스크 리마인드', emoji: '⏰', enabled: true, ownerId: 'u_pm', templateId: 'tpl_deadline',
      description: '평일 오전 9시, 마감 24시간 이내 태스크 담당자에게 리마인드',
      ...tpl('tpl_deadline'),
      runs: genRuns('ddl', { seed: 37, perDay: 1.05, failRate: 0.0, duration: [1200, 2400], triggers: ['스케줄 · 평일 오전 9:00'], weekdaysOnly: true }),
      createdAt: daysFromNow(-41), updatedAt: daysFromNow(-12),
    },
    {
      id: 'wf_weekly', name: '주간 제품 리포트', emoji: '📊', enabled: true, ownerId: 'u_me', templateId: 'tpl_weekly',
      description: '매주 금요일 17시 지표 수집 → AI 요약 → 리포트 문서 생성 → #product 공유',
      ...weekly,
      runs: genRuns('wkl', { seed: 41, perDay: 0.2, failRate: 0.1, duration: [8400, 15800], triggers: ['스케줄 · 매주 금요일 오후 5:00'], days: 42 }),
      createdAt: daysFromNow(-90), updatedAt: daysFromNow(-3),
    },
    {
      id: 'wf_incident', name: '장애 알림 에스컬레이션', emoji: '🚨', enabled: true, ownerId: 'u_devops', templateId: 'tpl_incident',
      description: 'Datadog 웹훅 → 심각도 판단 → #incidents 알림 및 PagerDuty 온콜 호출',
      ...incident,
      runs: genRuns('inc', { seed: 53, perDay: 0.7, failRate: 0.12, duration: [900, 3600], triggers: ['웹훅 · api-gateway 5xx 급증', '웹훅 · payments 지연', '웹훅 · search 레이턴시', '웹훅 · worker 큐 적체'] }),
      createdAt: daysFromNow(-200), updatedAt: daysFromNow(-1),
    },
    {
      id: 'wf_briefing', name: '회의 전 AI 브리핑', emoji: '☕', enabled: false, ownerId: 'u_me',
      description: '내 일정 시작 10분 전, 관련 대화와 문서를 AI가 요약해 DM으로 전달',
      ...briefing,
      runs: genRuns('brf', { seed: 67, perDay: 2.4, failRate: 0.04, duration: [2100, 4200], triggers: ['일정 시작 · 주간 제품 싱크', '일정 시작 · 디자인 리뷰', '일정 시작 · 1:1 한소희', '일정 시작 · Q4 OKR 점검'], weekdaysOnly: true, days: 14 }).filter((r) => Date.now() - new Date(r.startedAt).getTime() > 4 * 86400_000), // disabled 4 days ago → no runs since
      createdAt: daysFromNow(-30), updatedAt: daysFromNow(-4),
    },
  ]
}
