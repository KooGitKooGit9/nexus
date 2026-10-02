import { daysFromNow, formatDate, minutesAgo } from '@/lib/utils'
import type { Announcement, KeyResult, KeyResultCheckIn, Objective } from './types'

export const CURRENT_QUARTER = '2026 Q4'
export const QUARTERS = ['2026 Q3', '2026 Q4', '2027 Q1'] as const

/** Builds a plausible weekly check-in history ending at `current`. */
function hist(krId: string, start: number, current: number, ownerId: string, weeks = 4, integer = false): KeyResultCheckIn[] {
  const out: KeyResultCheckIn[] = []
  for (let i = 0; i < weeks; i++) {
    const t = (i + 1) / weeks
    const eased = 1 - Math.pow(1 - t, 1.6)
    const v = start + (current - start) * eased
    out.push({
      id: `${krId}_h${i}`,
      at: daysFromNow(-(weeks - 1 - i) * 7 - 1, 17, 30),
      value: integer ? Math.round(v) : Math.round(v * 10) / 10,
      userId: ownerId,
      note: i === weeks - 1 ? '주간 체크인' : undefined,
    })
  }
  return out
}

function kr(id: string, title: string, current: number, target: number, unit: string, ownerId: string, start = 0): KeyResult {
  return { id, title, current, target, unit, ownerId, start, history: hist(id, start, current, ownerId, 4, [start, current, target].every(Number.isInteger)) }
}

export const SEED_OBJECTIVES: Objective[] = [
  /* ───────────── Company (2026 Q4) ───────────── */
  {
    id: 'obj_c1', emoji: '🚀', title: 'Nexus를 팀 협업의 기본 도구로 만든다', quarter: CURRENT_QUARTER, ownerId: 'u_ceo', team: '전사', status: 'on_track',
    description: '메신저·프로젝트·문서를 하나로 묶은 Nexus 2.0으로 팀의 하루가 시작되는 곳이 된다.',
    createdAt: daysFromNow(-20), updatedAt: minutesAgo(180),
    keyResults: [
      kr('kr_c1_1', 'MAU 12만 명 달성', 9.4, 12, '만명', 'u_ceo', 6.8),
      kr('kr_c1_2', '주간 활성 워크스페이스 3,200개', 2610, 3200, '개', 'u_me', 1900),
      kr('kr_c1_3', 'D30 리텐션 45%', 41, 45, '%', 'u_pm', 34),
    ],
  },
  {
    id: 'obj_c2', emoji: '💰', title: '지속 가능한 성장 기반을 확보한다', quarter: CURRENT_QUARTER, ownerId: 'u_ceo', team: '전사', status: 'at_risk',
    description: '엔터프라이즈 중심의 매출 구조로 전환해 흑자 전환의 발판을 만든다.',
    createdAt: daysFromNow(-20), updatedAt: minutesAgo(600),
    keyResults: [
      kr('kr_c2_1', '분기 매출 48억원', 31.5, 48, '억원', 'u_ceo', 0),
      kr('kr_c2_2', '엔터프라이즈 신규 계약 12건', 7, 12, '건', 'u_sales', 0),
      kr('kr_c2_3', 'NPS 50점 이상', 46, 50, '점', 'u_pm', 38),
    ],
  },
  {
    id: 'obj_c3', emoji: '⚙️', title: '세계 최고 수준의 엔지니어링 조직을 만든다', quarter: CURRENT_QUARTER, ownerId: 'u_cto', team: '전사', status: 'on_track',
    description: '빠르고 안전하게 배포하고, 최고의 인재가 모이는 조직.',
    createdAt: daysFromNow(-19), updatedAt: minutesAgo(1440),
    keyResults: [
      kr('kr_c3_1', '주간 배포 빈도 25회', 21, 25, '회/주', 'u_devops', 9),
      kr('kr_c3_2', '장애 평균 복구시간(MTTR) 30분 이하', 48, 30, '분', 'u_cto', 90),
      kr('kr_c3_3', '핵심 포지션 8명 채용', 5, 8, '명', 'u_hr', 0),
    ],
  },

  /* ───────────── Teams aligned to c1 ───────────── */
  {
    id: 'obj_t1', emoji: '🧭', title: '온보딩 경험을 혁신해 활성화율을 끌어올린다', quarter: CURRENT_QUARTER, ownerId: 'u_me', team: '제품', status: 'on_track', parentId: 'obj_c1',
    createdAt: daysFromNow(-18), updatedAt: minutesAgo(45),
    keyResults: [
      kr('kr_t1_1', '첫 주 활성화율 60%', 52, 60, '%', 'u_me', 38),
      kr('kr_t1_2', '온보딩 완료 시간 5분 이내', 7.5, 5, '분', 'u_design', 12),
      kr('kr_t1_3', '사용성 테스트 20회 진행', 14, 20, '회', 'u_design2', 0),
    ],
  },
  {
    id: 'obj_t2', emoji: '🎨', title: 'Nexus 2.0 디자인 시스템을 완성한다', quarter: CURRENT_QUARTER, ownerId: 'u_design', team: '디자인', status: 'done', parentId: 'obj_c1',
    createdAt: daysFromNow(-18), updatedAt: minutesAgo(2880),
    keyResults: [
      kr('kr_t2_1', '핵심 컴포넌트 커버리지 100%', 100, 100, '%', 'u_design', 40),
      kr('kr_t2_2', 'WCAG AA 준수 화면 비율 100%', 100, 100, '%', 'u_fe', 55),
    ],
  },
  {
    id: 'obj_t3', emoji: '📣', title: 'Nexus 2.0 런칭 캠페인을 성공시킨다', quarter: CURRENT_QUARTER, ownerId: 'u_mkt', team: '마케팅', status: 'on_track', parentId: 'obj_c1',
    createdAt: daysFromNow(-17), updatedAt: minutesAgo(320),
    keyResults: [
      kr('kr_t3_1', '런칭 웨비나 참가자 2,000명', 1240, 2000, '명', 'u_mkt', 0),
      kr('kr_t3_2', '오가닉 신규 가입 15,000건', 8900, 15000, '건', 'u_mkt', 0),
      kr('kr_t3_3', '브랜드 검색량 80% 증가', 35, 80, '%', 'u_mkt', 0),
      kr('kr_t3_4', '프로덕트 헌트 Top 5 진입', 0, 1, '회', 'u_me', 0),
    ],
  },

  /* ───────────── Teams aligned to c2 ───────────── */
  {
    id: 'obj_t4', emoji: '🤝', title: '엔터프라이즈 파이프라인을 두 배로 확대한다', quarter: CURRENT_QUARTER, ownerId: 'u_sales', team: '영업', status: 'at_risk', parentId: 'obj_c2',
    createdAt: daysFromNow(-17), updatedAt: minutesAgo(800),
    keyResults: [
      kr('kr_t4_1', '신규 파이프라인 60억원', 38, 60, '억원', 'u_sales', 0),
      kr('kr_t4_2', '엔터프라이즈 계약 12건 체결', 7, 12, '건', 'u_sales', 0),
      kr('kr_t4_3', '해외 리셀러 파트너 3곳 확보', 1, 3, '곳', 'u_global', 0),
    ],
  },
  {
    id: 'obj_t5', emoji: '💜', title: '고객 만족도를 업계 최고 수준으로 끌어올린다', quarter: CURRENT_QUARTER, ownerId: 'u_pm', team: '제품', status: 'off_track', parentId: 'obj_c2',
    createdAt: daysFromNow(-16), updatedAt: minutesAgo(1300),
    keyResults: [
      kr('kr_t5_1', 'NPS 50점 달성', 46, 50, '점', 'u_pm', 38),
      kr('kr_t5_2', '고객 문의 첫 응답 2시간 이내', 3.2, 2, '시간', 'u_pm', 6),
      kr('kr_t5_3', '이탈 고객 인터뷰 30건', 11, 30, '건', 'u_design2', 0),
    ],
  },

  /* ───────────── Teams aligned to c3 ───────────── */
  {
    id: 'obj_t6', emoji: '🛠️', title: '배포 파이프라인을 완전 자동화한다', quarter: CURRENT_QUARTER, ownerId: 'u_devops', team: '엔지니어링', status: 'on_track', parentId: 'obj_c3',
    createdAt: daysFromNow(-16), updatedAt: minutesAgo(240),
    keyResults: [
      kr('kr_t6_1', '주간 배포 빈도 25회', 21, 25, '회/주', 'u_devops', 9),
      kr('kr_t6_2', 'CI 빌드 시간 8분 이내', 11, 8, '분', 'u_devops', 22),
      kr('kr_t6_3', '테스트 커버리지 80%', 64, 80, '%', 'u_fe', 55),
    ],
  },
  {
    id: 'obj_t7', emoji: '🌱', title: '최고의 인재를 채용하고 빠르게 정착시킨다', quarter: CURRENT_QUARTER, ownerId: 'u_hr', team: '피플팀', status: 'on_track', parentId: 'obj_c3',
    createdAt: daysFromNow(-15), updatedAt: minutesAgo(560),
    keyResults: [
      kr('kr_t7_1', '핵심 포지션 8명 채용', 5, 8, '명', 'u_hr', 0),
      kr('kr_t7_2', '오퍼 수락률 85%', 78, 85, '%', 'u_hr', 60),
      kr('kr_t7_3', '신규 입사자 온보딩 만족도 4.5점', 4.6, 4.5, '점', 'u_hr', 3.9),
    ],
  },
  {
    id: 'obj_t8', emoji: '🤖', title: 'AI 어시스턴트 품질을 고도화한다', quarter: CURRENT_QUARTER, ownerId: 'u_ml', team: '엔지니어링', status: 'at_risk', parentId: 'obj_c3',
    createdAt: daysFromNow(-14), updatedAt: minutesAgo(90),
    keyResults: [
      kr('kr_t8_1', '응답 정확도 92%', 84, 92, '%', 'u_ml', 78),
      kr('kr_t8_2', 'p95 응답 지연 1.5초 이하', 2.6, 1.5, '초', 'u_ml', 4),
      kr('kr_t8_3', '할루시네이션 신고율 1% 미만', 1.8, 1, '%', 'u_ml', 3.5),
    ],
  },

  /* ───────────── Last quarter (2026 Q3) ───────────── */
  {
    id: 'obj_q3_c1', emoji: '🧪', title: 'Nexus 2.0 베타를 성공적으로 출시한다', quarter: '2026 Q3', ownerId: 'u_ceo', team: '전사', status: 'done',
    createdAt: daysFromNow(-110), updatedAt: daysFromNow(-5),
    keyResults: [
      kr('kr_q3_1', '베타 참여 팀 300곳', 342, 300, '곳', 'u_me', 0),
      kr('kr_q3_2', '베타 만족도 4.3점', 4.4, 4.3, '점', 'u_pm', 3.6),
    ],
  },
  {
    id: 'obj_q3_t1', emoji: '📱', title: '모바일 앱 성능을 2배 개선한다', quarter: '2026 Q3', ownerId: 'u_fe', team: '엔지니어링', status: 'done', parentId: 'obj_q3_c1',
    createdAt: daysFromNow(-108), updatedAt: daysFromNow(-6),
    keyResults: [
      kr('kr_q3_2_1', '콜드 스타트 1.2초 이하', 1.1, 1.2, '초', 'u_fe', 2.6),
      kr('kr_q3_2_2', '크래시 프리 세션 99.8%', 99.8, 99.8, '%', 'u_fe', 99.1),
    ],
  },
  {
    id: 'obj_q3_t2', emoji: '🎯', title: '베타 피드백 루프를 구축한다', quarter: '2026 Q3', ownerId: 'u_pm', team: '제품', status: 'at_risk', parentId: 'obj_q3_c1',
    createdAt: daysFromNow(-105), updatedAt: daysFromNow(-7),
    keyResults: [
      kr('kr_q3_3_1', '인앱 피드백 1,000건 수집', 870, 1000, '건', 'u_pm', 0),
      kr('kr_q3_3_2', '피드백 반영률 40%', 31, 40, '%', 'u_me', 0),
    ],
  },
]

/* ───────────── Announcements ───────────── */

export const COVER_PRESETS = [
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 55%, #f59e0b 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #f97316 60%, #facc15 100%)',
  'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
  'linear-gradient(135deg, #0f172a 0%, #334155 50%, #0ea5e9 100%)',
  'linear-gradient(135deg, #84cc16 0%, #10b981 50%, #0ea5e9 100%)',
  'linear-gradient(135deg, #f472b6 0%, #fb7185 40%, #fbbf24 100%)',
] as const

const ALL = ['u_me', 'u_ceo', 'u_cto', 'u_fe', 'u_be', 'u_ml', 'u_devops', 'u_design', 'u_design2', 'u_pm', 'u_mkt', 'u_sales', 'u_hr', 'u_global']
const OTHERS = ALL.filter((x) => x !== 'u_me')
/** `n` readers total; `include` (e.g. u_me) always included first. */
const readers = (n: number, include: string[] = []) => [...include, ...OTHERS.filter((x) => !include.includes(x)).slice(0, Math.max(0, n - include.length))]
const d = (days: number, h?: number, m = 0) => formatDate(daysFromNow(days, h, m), 'M월 d일 (EEE)')

export function buildSeedAnnouncements(): Announcement[] {
  return [
    {
      id: 'ann_launch', emoji: '🎉', category: '제품', pinned: true, authorId: 'u_me', createdAt: minutesAgo(95), cover: COVER_PRESETS[0],
      title: 'Nexus 2.0 정식 런칭! 🎉 모두 정말 고생 많으셨습니다',
      body: `드디어 **Nexus 2.0**이 정식 출시되었습니다! 지난 6개월간 함께 달려준 모든 분들께 진심으로 감사드립니다. 🙌

## 이번 릴리즈 하이라이트
- **올인원 워크스페이스** — 메신저, 프로젝트, 문서, 캘린더가 하나로
- **AI 어시스턴트** — 회의 요약, 할 일 추출, 문서 초안 작성
- **워크플로우 자동화** — 노코드로 반복 업무를 자동화
- **전자결재 & OKR** — 의사결정과 목표 관리까지 한 곳에서

## 런칭 지표 (첫 24시간)
| 항목 | 수치 |
| --- | --- |
| 신규 가입 | 4,812건 |
| 프로덕트 헌트 | 일간 2위 🥈 |
| 장애 | 0건 |

> "우리가 매일 쓰고 싶은 도구를 만들자" — 처음 그 약속을 지켰습니다.

런칭 회고는 ${d(3)} 오후 4시 **Orion 회의실**에서 진행합니다. 피자 🍕 준비되어 있어요!`,
      reactions: { '🎉': ['u_ceo', 'u_cto', 'u_fe', 'u_be', 'u_design', 'u_mkt', 'u_hr', 'u_sales'], '🚀': ['u_fe', 'u_devops', 'u_ml', 'u_pm'], '❤️': ['u_design', 'u_design2', 'u_hr'] },
      readBy: readers(11, ['u_me']),
    },
    {
      id: 'ann_townhall', emoji: '🎤', category: '전사공지', pinned: true, authorId: 'u_ceo', createdAt: minutesAgo(60 * 20), cover: COVER_PRESETS[1],
      title: 'Q4 타운홀 미팅 안내 — 2026 하반기 전략과 2027 비전',
      body: `안녕하세요, 박서준입니다.

Q4를 시작하며 전사 타운홀을 진행합니다. 이번 분기 **OKR**과 2027년 방향성을 공유하고, 자유로운 Q&A 시간을 가지려 합니다.

### 일정
- **일시**: ${d(6)} 오후 5시 ~ 6시 30분
- **장소**: 서울 HQ 라운지 / Google Meet 동시 송출
- **대상**: 전 구성원 (판교·부산·SF 원격 참여 가능)

### 아젠다
1. Q3 회고 — 베타 출시와 배운 점
2. Q4 회사 OKR 소개
3. 2027 비전: *"모든 팀의 운영체제"*
4. Ask Me Anything 🙋

사전 질문은 \`#townhall\` 채널에 남겨주세요. 익명 질문도 환영합니다.`,
      reactions: { '👍': ['u_cto', 'u_fe', 'u_be', 'u_pm', 'u_mkt'], '🙌': ['u_hr', 'u_design'] },
      readBy: readers(9),
    },
    {
      id: 'ann_welcome', emoji: '👋', category: '인사', authorId: 'u_hr', createdAt: minutesAgo(60 * 26), cover: COVER_PRESETS[2],
      title: '10월 신규 입사자를 환영해주세요 👋',
      body: `이번 달 오로라랩스에 새로운 동료 세 분이 합류합니다!

- **김도현** · 백엔드 엔지니어 (엔지니어링) — 결제 시스템을 담당합니다
- **이서연** · 브랜드 디자이너 (디자인) — 런칭 캠페인을 함께 합니다
- **박지훈** · 엔터프라이즈 AE (영업) — 금융권 고객을 맡아주실 예정입니다

첫 주에는 **버디 프로그램**이 진행됩니다. 점심 한 끼, 커피 한 잔 함께 해주세요 ☕

> 온보딩 체크리스트는 *문서 > 피플팀 > 온보딩 가이드* 에서 확인할 수 있어요.`,
      reactions: { '👋': ['u_me', 'u_ceo', 'u_fe', 'u_design', 'u_design2', 'u_sales', 'u_mkt'], '🎉': ['u_be', 'u_pm'] },
      readBy: readers(12, ['u_me']),
    },
    {
      id: 'ann_welfare', emoji: '🎁', category: '인사', authorId: 'u_hr', createdAt: minutesAgo(60 * 50), cover: COVER_PRESETS[7],
      title: '하반기 복지 포인트 50만 포인트가 지급되었습니다',
      body: `구성원 여러분, 하반기 **복지 포인트 500,000P**가 지급되었습니다. 🎁

### 사용 안내
- 사용 기한: **12월 31일**까지 (이월 불가)
- 사용처: 도서, 운동, 자기계발, 건강검진, 여행 등
- 신청 방법: *결재 > 경비 청구* 에서 영수증 첨부

올해부터 **마음 건강 상담** 비용도 복지 포인트로 사용 가능합니다. 궁금한 점은 피플팀에 DM 주세요!`,
      reactions: { '😍': ['u_fe', 'u_be', 'u_ml', 'u_design', 'u_pm', 'u_mkt', 'u_sales', 'u_global'], '🙏': ['u_me', 'u_devops'] },
      readBy: readers(13, ['u_me']),
    },
    {
      id: 'ann_office', emoji: '🏢', category: '전사공지', authorId: 'u_ceo', createdAt: minutesAgo(60 * 74), cover: COVER_PRESETS[5],
      title: '서울 HQ 7층 리모델링 공사 안내 (집중 업무 공간 확장)',
      body: `더 나은 업무 환경을 위해 **서울 HQ 7층 리모델링**을 진행합니다.

### 공사 기간
- ${d(9)} ~ ${d(23)} (약 2주)

### 변경 사항
- 7층 좌석 → 임시로 **6층 라운지**와 **판교 오피스** 이용
- 회의실 *Nebula*, *Pulsar* 일시 폐쇄
- 소음 작업은 오전 9시 ~ 11시에 집중 진행

공사 완료 후에는 **폰부스 8개**, **집중 업무 존**, **스탠딩 라운지**가 새로 생깁니다 ✨`,
      reactions: { '👀': ['u_fe', 'u_design', 'u_pm'], '✨': ['u_design2', 'u_mkt'] },
      readBy: readers(8),
    },
    {
      id: 'ann_security', emoji: '🔐', category: 'IT', authorId: 'u_devops', createdAt: minutesAgo(60 * 98), cover: COVER_PRESETS[4],
      title: '[필수] 하반기 정보보안 교육 이수 안내',
      body: `ISMS 인증 유지를 위해 **전 구성원 정보보안 교육 이수**가 필수입니다.

- 교육 시간: 약 40분 (온라인)
- 이수 기한: **${d(14)}**까지
- 미이수 시 사내 시스템 접근이 일시 제한될 수 있습니다

### 꼭 기억해주세요
1. 2단계 인증(2FA)은 **모든 계정**에 필수입니다
2. 고객 데이터는 절대 개인 기기에 저장하지 않습니다
3. 의심스러운 메일은 \`#security\` 채널로 신고해주세요

\`\`\`
교육 링크: Nexus > 설정 > 보안 > 교육 센터
\`\`\``,
      reactions: { '✅': ['u_cto', 'u_be', 'u_fe', 'u_ml', 'u_hr'] },
      readBy: readers(6),
    },
    {
      id: 'ann_yearend', emoji: '🥂', category: '이벤트', authorId: 'u_hr', createdAt: minutesAgo(60 * 122), cover: COVER_PRESETS[3],
      title: '2026 오로라랩스 송년회 — 장소 & 드레스코드 투표 오픈!',
      body: `벌써 한 해를 마무리할 시간이 다가오고 있어요 🥂

올해 송년회는 **12월 셋째 주 금요일**에 진행됩니다. 장소와 드레스코드를 함께 정해요!

### 투표 항목
- 장소: 성수 루프탑 / 한남 와인바 / 을지로 레트로 펍
- 드레스코드: *오로라 컬러* 🌈 / 블랙 & 골드 / 자유

투표는 \`#culture\` 채널에서 진행됩니다. 장기자랑 신청도 받습니다 🎤 (상품 있음!)`,
      reactions: { '🥳': ['u_me', 'u_fe', 'u_be', 'u_design', 'u_design2', 'u_mkt', 'u_sales', 'u_pm', 'u_ml'], '🍷': ['u_ceo', 'u_cto'] },
      readBy: readers(12),
    },
    {
      id: 'ann_chuseok', emoji: '🌕', category: '전사공지', authorId: 'u_hr', createdAt: minutesAgo(60 * 24 * 12), cover: COVER_PRESETS[6],
      title: '추석 연휴 휴무 및 긴급 연락망 안내',
      body: `풍성한 한가위 보내세요! 🌕

### 휴무 안내
- 추석 연휴 기간 동안 전사 휴무입니다
- 개천절(10/3), 한글날(10/9)도 휴무입니다

### 긴급 연락망
| 영역 | 담당 |
| --- | --- |
| 서비스 장애 | 윤태현 (On-call) |
| 고객 이슈 | 조은우 |
| 보안 사고 | 이도윤 |

연휴 동안 장애 알림은 \`#incident\` 채널로 자동 전달됩니다. 모두 푹 쉬고 오세요!`,
      reactions: { '🌕': ['u_me', 'u_ceo', 'u_fe', 'u_be', 'u_ml', 'u_design', 'u_pm', 'u_mkt', 'u_sales', 'u_hr'], '🙏': ['u_devops'] },
      readBy: readers(14, ['u_me']),
    },
  ]
}
