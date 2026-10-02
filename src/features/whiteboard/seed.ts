import { daysFromNow, minutesAgo } from '@/lib/utils'
import type { Board, WbElement } from './types'
import { B, scribbleLoop } from './templates'

function q4Brainstorm(): WbElement[] {
  const frames: [string, string, number, number][] = [
    ['🚀 성장', '#fbbf24', 0, 0],
    ['🧩 제품', '#60a5fa', 640, 0],
    ['⚙️ 운영 효율', '#34d399', 0, 500],
    ['💖 고객 경험', '#f472b6', 640, 500],
  ]
  const notes: [string, 'yellow' | 'blue' | 'green' | 'pink', string][][] = [
    [
      ['레퍼럴 프로그램 도입 — 초대하면 1개월 무료 🎁', 'yellow', 'u_mkt'],
      ['SEO 랜딩 페이지 20개 제작', 'yellow', 'u_mkt'],
      ['파트너 마켓플레이스 입점', 'yellow', 'u_sales'],
      ['웨비나 시리즈 월 2회 🎙️', 'yellow', 'u_global'],
    ],
    [
      ['AI 회의록 요약 기능 🤖', 'blue', 'u_me'],
      ['모바일 오프라인 모드', 'blue', 'u_fe'],
      ['템플릿 갤러리 확장', 'blue', 'u_design'],
      ['Slack 양방향 연동', 'blue', 'u_be'],
    ],
    [
      ['온보딩 자동화 워크플로우', 'green', 'u_hr'],
      ['주간 리포트 자동 생성 📊', 'green', 'u_pm'],
      ['CS 매크로 정리', 'green', 'u_sales'],
      ['인프라 비용 20% 절감 💸', 'green', 'u_devops'],
    ],
    [
      ['NPS 설문 인앱 도입', 'pink', 'u_design2'],
      ['첫 주 체크인 이메일 ✉️', 'pink', 'u_mkt'],
      ['헬프센터 검색 개선', 'pink', 'u_pm'],
      ['VIP 고객 전담 CSM', 'pink', 'u_sales'],
    ],
  ]
  const out: WbElement[] = [
    B.text(0, -150, 'Q4 브레인스토밍 💡', 48, 800),
    B.text(0, -80, '목표: 다음 분기 성장 레버 찾기 · 스티키에 👍 투표는 금요일까지!', 18, 900, '#94a3b8'),
  ]
  const stickies: WbElement[] = []
  frames.forEach(([title, color, fx, fy], fi) => {
    out.push(B.frame(fx, fy, 600, 460, title, color))
    notes[fi].forEach(([t, c, a], i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const s = B.sticky(fx + 25 + col * 190, fy + 70 + row * 190, t, c, a)
      stickies.push(s)
    })
  })
  out.push(...stickies)
  // highlight + vote area
  const ai = stickies[4]
  out.push(B.path(scribbleLoop(ai.x + 85, ai.y + 85, 122, 116), '#f87171', 4))
  out.push(B.ellipse(1340, 330, 280, 170, '🏆 투표 Top 3\n1. AI 회의록\n2. 레퍼럴\n3. 온보딩 자동화', '#8b5cf6', '#8b5cf6', 18))
  out.push(B.arrow(ai.x + 200, ai.y + 60, 1350, 380, '#f87171', 3))
  out.push(B.arrow(stickies[0].x + 170, stickies[0].y + 150, 1360, 430, '#fbbf24', 2))
  out.push(B.arrow(stickies[8].x + 180, stickies[8].y + 40, 1380, 480, '#34d399', 2))
  out.push(B.text(1340, 530, '← 금요일 싱크에서 확정 예정', 16, 300, '#94a3b8'))
  return out
}

function retroKpt(): WbElement[] {
  const cols: [string, string, 'green' | 'pink' | 'blue', [string, string][]][] = [
    ['👍 Keep', '#34d399', 'green', [
      ['데일리 스탠드업 15분 컷 유지 ⏱️', 'u_pm'], ['디자인-개발 페어 리뷰 효과 좋았음', 'u_design'], ['PR 리뷰 24시간 내 처리 👏', 'u_cto'], ['QA 체크리스트 자동화', 'u_fe'], ['금요일 데모데이 🎉', 'u_me'],
    ]],
    ['🤔 Problem', '#f472b6', 'pink', [
      ['스프린트 중간에 요구사항 변경 잦음', 'u_fe'], ['테스트 환경 불안정 😵', 'u_be'], ['회의가 너무 많음…', 'u_design2'], ['API 문서화 누락 3건', 'u_fe'], ['배포 일정 공유가 늦음', 'u_mkt'],
    ]],
    ['🚀 Try', '#60a5fa', 'blue', [
      ['변경 요청은 다음 스프린트 버퍼로', 'u_pm'], ['스테이징 환경 IaC로 재구축', 'u_devops'], ['수요일 노미팅 데이 🙅', 'u_me'], ['PR 템플릿에 API 문서 체크 추가', 'u_be'], ['배포 캘린더 공유 채널 개설 📅', 'u_mkt'],
    ]],
  ]
  const out: WbElement[] = [
    B.text(0, -130, '스프린트 24 회고 — KPT', 44, 800),
    B.text(0, -65, '9/16 – 9/27 · 참석 8명 · 진행: 서현우', 18, 700, '#94a3b8'),
  ]
  const stickies: WbElement[] = []
  cols.forEach(([title, color, sc, notes], ci) => {
    const fx = ci * 450
    out.push(B.frame(fx, 0, 410, 860, title, color))
    notes.forEach(([t, a], i) => {
      stickies.push(B.sticky(fx + 25 + (i % 2) * 190, 80 + Math.floor(i / 2) * 190, t, sc, a))
    })
  })
  out.push(...stickies)
  out.push(B.rect(1360, 0, 360, 300, '✅ 액션 아이템\n\n1. 노미팅 데이 도입 — 서현우\n2. 스테이징 IaC — 윤태현\n3. API 문서 체크 — 정민호', '#8b5cf6', '#8b5cf6', 18))
  out.push(B.text(1360, 340, '이번 스프린트 팀 무드', 18, 360, '#94a3b8'))
  out.push(B.text(1360, 375, '😄 😄 🙂 😐 😄 🤩 🙂 😄', 34, 380))
  out.push(B.arrow(stickies[12].x + 175, stickies[12].y + 60, 1355, 180, '#8b5cf6', 3))
  return out
}

function journeyMap(): WbElement[] {
  const stages = [['🔎 인지', '#8b5cf6'], ['🧭 탐색', '#6366f1'], ['✍️ 가입', '#06b6d4'], ['🚀 온보딩', '#10b981'], ['🌟 활성화', '#f59e0b']] as const
  const rowY = [110, 300, 490, 640, 830]
  const rowLabels = ['행동', '생각', '감정', '페인포인트', '기회']
  const out: WbElement[] = [
    B.text(0, -150, '사용자 여정 지도 — 신규 팀 관리자', 44, 1000),
    B.text(0, -85, '페르소나: 30명 규모 스타트업 운영 매니저 "지민" · 목표: 팀 협업 툴 일원화', 18, 1100, '#94a3b8'),
  ]
  const colX = (i: number) => 180 + i * 260
  stages.forEach(([s, c], i) => {
    out.push(B.rect(colX(i), 0, 240, 64, s, c, c, 22))
    if (i < stages.length - 1) out.push(B.arrow(colX(i) + 244, 32, colX(i + 1) - 4, 32, '#94a3b8', 2))
  })
  rowLabels.forEach((r, i) => {
    out.push(B.text(0, rowY[i] + 40, r, 22, 160))
    out.push(B.line(0, rowY[i] - 20, colX(4) + 250, rowY[i] - 20, '#94a3b855', 1))
  })
  const cells: [number, string[], 'yellow' | 'blue' | 'pink' | 'green', string][] = [
    [0, ['SNS 광고로 Nexus 발견', '요금제·기능 비교', 'Google 계정으로 가입', '팀원 초대 & 채널 생성', '첫 프로젝트 보드 운영'], 'yellow', 'u_design2'],
    [1, ['"또 협업툴? 뭐가 다르지?"', '"우리 팀 규모에 맞을까?"', '"가입이 빨라서 좋다"', '"어디서부터 시작하지…"', '"이제 툴 3개 안 써도 되겠다!"'], 'blue', 'u_design2'],
    [3, ['광고 메시지가 모호함', '가격 비교표 부족', '', '빈 워크스페이스가 막막함', '알림이 너무 많음'], 'pink', 'u_pm'],
    [4, ['핵심 가치 1문장 카피', '팀 규모별 추천 플랜', '원클릭 SSO', '템플릿 기반 시작 마법사 ✨', '스마트 알림 다이제스트'], 'green', 'u_me'],
  ]
  cells.forEach(([row, texts, color, author]) => {
    texts.forEach((t, i) => {
      if (!t) return
      out.push(B.sticky(colX(i) + 20, rowY[row], t, color, author, [200, 150]))
    })
  })
  // emotion curve
  const ys = [560, 520, 465, 600, 450]
  const pts: [number, number][] = []
  for (let i = 0; i < ys.length - 1; i++) {
    const x1 = colX(i) + 120, x2 = colX(i + 1) + 120
    for (let k = 0; k < 10; k++) {
      const t = k / 10
      const e = t * t * (3 - 2 * t)
      pts.push([x1 + (x2 - x1) * t, ys[i] + (ys[i + 1] - ys[i]) * e])
    }
  }
  pts.push([colX(4) + 120, ys[4]])
  out.push(B.path(pts, '#f472b6', 4))
  ;['🤔', '😮', '😊', '😣', '🤩'].forEach((emo, i) => out.push(B.text(colX(i) + 102, ys[i] - 52, emo, 30, 50)))
  return out
}

export const SEED_BOARDS: Board[] = [
  {
    id: 'wb_q4', name: 'Q4 브레인스토밍', emoji: '💡', description: '다음 분기 성장 레버 아이디어 발산',
    ownerId: 'u_me', memberIds: ['u_me', 'u_fe', 'u_design', 'u_pm', 'u_mkt', 'u_sales'],
    createdAt: daysFromNow(-6, 10), updatedAt: minutesAgo(12), starred: true, template: 'brainstorm', elements: q4Brainstorm(),
  },
  {
    id: 'wb_retro', name: '스프린트 24 회고 (KPT)', emoji: '🔁', description: 'Keep · Problem · Try',
    ownerId: 'u_pm', memberIds: ['u_pm', 'u_me', 'u_fe', 'u_be', 'u_design', 'u_design2', 'u_devops', 'u_cto'],
    createdAt: daysFromNow(-3, 16), updatedAt: minutesAgo(60 * 20), template: 'kpt', elements: retroKpt(),
  },
  {
    id: 'wb_journey', name: '사용자 여정 지도 — 신규 관리자', emoji: '🗺️', description: '온보딩 개선을 위한 여정 분석',
    ownerId: 'u_design2', memberIds: ['u_design2', 'u_me', 'u_pm', 'u_design'],
    createdAt: daysFromNow(-12, 14), updatedAt: minutesAgo(60 * 50), starred: true, template: 'journey', elements: journeyMap(),
  },
]
