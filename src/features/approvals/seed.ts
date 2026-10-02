import { daysFromNow, formatDate, minutesAgo } from '@/lib/utils'
import { businessDays } from './meta'
import type { ApprovalRequest, ApprovalStep } from './types'

const H = 60
const D = 24 * 60

const step = (approverId: string, status: ApprovalStep['status'], decidedMinAgo?: number, comment?: string): ApprovalStep => ({
  approverId,
  status,
  ...(decidedMinAgo !== undefined ? { decidedAt: minutesAgo(decidedMinAgo) } : {}),
  ...(comment ? { comment } : {}),
})

/** Leave range relative to today, with a title and business-day count that always match the dates. */
function leaveRange(fromDay: number, toDay: number) {
  const startDate = daysFromNow(fromDay, 9)
  const endDate = daysFromNow(toDay, 18)
  const range = `${formatDate(startDate, 'M/d')} ~ ${formatDate(endDate, 'M/d')}`
  return { startDate, endDate, days: businessDays(startDate, endDate), title: `연차 휴가 신청 (${range})` }
}

export function seedApprovals(): ApprovalRequest[] {
  return [
    /* ───────── 결재 대기 (u_me 차례) ───────── */
    {
      id: 'apv_1048', docNo: 'AUR-2026-1048', kind: 'leave', leaveType: 'annual',
      ...leaveRange(12, 14), requesterId: 'u_design', createdAt: minutesAgo(42), status: 'pending',
      details: '가족 여행(제주)으로 연차를 사용하고자 합니다.\n디자인 시스템 v3 핸드오프는 휴가 전까지 완료하고, 부재 중 긴급 건은 오민지님이 대응합니다.',
      steps: [step('u_me', 'pending')], ccIds: ['u_design2', 'u_hr'],
    },
    {
      id: 'apv_1047', docNo: 'AUR-2026-1047', kind: 'purchase', urgent: true,
      title: '사용성 테스트용 아이트래커 장비 대여', requesterId: 'u_design2', createdAt: minutesAgo(3 * H + 12), status: 'pending',
      vendor: '토비테크 코리아', amount: 2_450_000,
      items: [
        { id: 'i1', name: 'Tobii Pro Spark 아이트래커 (2주 대여)', qty: 2, amount: 980_000 },
        { id: 'i2', name: '분석 소프트웨어 라이선스 (1개월)', qty: 1, amount: 490_000 },
      ],
      details: 'Q4 결제 플로우 개선을 위한 사용성 테스트(참가자 12명)에 아이트래킹 데이터가 필요합니다. 10/20 테스트 시작 전 수령이 필요하여 긴급으로 요청드립니다.',
      attachments: ['견적서_토비테크_2026Q4.pdf', '사용성테스트_계획서_v2.pdf'],
      steps: [step('u_me', 'pending'), step('u_ceo', 'waiting')],
    },
    {
      id: 'apv_1046', docNo: 'AUR-2026-1046', kind: 'expense',
      title: '고객 인터뷰 다과비 및 교통비 정산', requesterId: 'u_pm', createdAt: minutesAgo(5 * H + 30), status: 'pending',
      amount: 186_400, startDate: daysFromNow(-3),
      items: [
        { id: 'i1', name: '인터뷰 다과 (스타벅스 판교점)', category: '식대', amount: 64_800 },
        { id: 'i2', name: '참가자 사례 기프티콘 x6', category: '사례비', amount: 90_000 },
        { id: 'i3', name: '택시비 (판교 ↔ 역삼)', category: '교통비', amount: 31_600 },
      ],
      details: '9월 4주차 B2B 고객 인터뷰(6개사) 진행 중 발생한 비용입니다.',
      attachments: ['영수증_스타벅스.jpg', '영수증_카카오T.png', '기프티콘_구매내역.pdf'],
      steps: [step('u_me', 'pending'), step('u_ceo', 'waiting')],
    },
    {
      id: 'apv_1045', docNo: 'AUR-2026-1045', kind: 'purchase',
      title: 'Figma Organization 플랜 연간 갱신', requesterId: 'u_design', createdAt: minutesAgo(D + 2 * H), status: 'pending',
      vendor: 'Figma, Inc.', amount: 4_320_000,
      items: [{ id: 'i1', name: 'Figma Organization 시트 (연간)', qty: 8, amount: 540_000 }],
      details: '현재 Professional 플랜 만료(10/31) 예정. 디자인 시스템 라이브러리 공유 및 브랜치 기능을 위해 Organization 플랜으로 전환을 요청합니다.',
      attachments: ['Figma_견적서.pdf'],
      steps: [step('u_me', 'pending'), step('u_ceo', 'waiting')], ccIds: ['u_fe'],
    },
    {
      id: 'apv_1044', docNo: 'AUR-2026-1044', kind: 'travel',
      title: '부산 지사 고객사 워크숍 출장', requesterId: 'u_pm', createdAt: minutesAgo(D + 6 * H), status: 'pending',
      destination: '부산 지사 (해운대)', purpose: '해운대 고객사 3곳 대상 신규 기능 워크숍 및 요구사항 인터뷰',
      startDate: daysFromNow(8, 7), endDate: daysFromNow(9, 20), amount: 420_000,
      items: [
        { id: 'i1', name: 'KTX 왕복 (서울 ↔ 부산)', category: '교통', amount: 119_600 },
        { id: 'i2', name: '숙박 1박', category: '숙박', amount: 180_000 },
        { id: 'i3', name: '일비 2일', category: '일비', amount: 120_400 },
      ],
      steps: [step('u_me', 'pending')], ccIds: ['u_sales'],
    },
    {
      id: 'apv_1043', docNo: 'AUR-2026-1043', kind: 'access',
      title: 'Amplitude 프로젝트 관리자 권한 요청', requesterId: 'u_design2', createdAt: minutesAgo(2 * D + 3 * H), status: 'pending',
      system: 'Amplitude (Production)', accessLevel: '관리자 (Admin)', startDate: daysFromNow(0), endDate: daysFromNow(90),
      details: '리서치 대시보드 및 코호트 생성을 위해 관리자 권한이 필요합니다. 기간 종료 시 자동 회수 요청드립니다.',
      steps: [step('u_me', 'pending'), step('u_cto', 'waiting')],
    },

    /* ───────── u_me가 처리했거나 참조된 문서 ───────── */
    {
      id: 'apv_1042', docNo: 'AUR-2026-1042', kind: 'expense',
      title: 'Config 2026 디자인 컨퍼런스 참가비', requesterId: 'u_design', createdAt: minutesAgo(2 * D + 5 * H), status: 'pending',
      amount: 350_000, items: [{ id: 'i1', name: 'Config Seoul 얼리버드 티켓', category: '교육비', amount: 350_000 }],
      details: '교육 지원 제도를 활용해 참가합니다. 참관 후 팀 내 세션 공유 예정입니다.',
      attachments: ['Config_결제영수증.pdf'],
      steps: [step('u_me', 'approved', 2 * D + 2 * H, '좋은 세션 많이 듣고 오세요! 공유 세션 기대할게요 🙌'), step('u_ceo', 'pending')],
    },
    {
      id: 'apv_1041', docNo: 'AUR-2026-1041', kind: 'leave', leaveType: 'half_pm', days: 0.5,
      title: '오후 반차 신청', requesterId: 'u_pm', createdAt: minutesAgo(4 * D), status: 'approved',
      startDate: daysFromNow(-2, 14), endDate: daysFromNow(-2, 18), details: '병원 진료',
      steps: [step('u_me', 'approved', 4 * D - 40, '네 다녀오세요~')], completedAt: minutesAgo(4 * D - 40),
    },
    {
      id: 'apv_1040', docNo: 'AUR-2026-1040', kind: 'leave', leaveType: 'sick', days: 1,
      title: '병가 신청 (감기 몸살)', requesterId: 'u_design2', createdAt: minutesAgo(6 * D), status: 'approved',
      startDate: daysFromNow(-6, 9), endDate: daysFromNow(-6, 18), details: '고열로 출근이 어렵습니다. 진단서 첨부합니다.',
      attachments: ['진료확인서.pdf'],
      steps: [step('u_me', 'approved', 6 * D - 25, '푹 쉬세요. 쾌유를 빕니다 🍵')], completedAt: minutesAgo(6 * D - 25),
    },
    {
      id: 'apv_1039', docNo: 'AUR-2026-1039', kind: 'expense',
      title: '사용자 인터뷰 리워드 정산', requesterId: 'u_pm', createdAt: minutesAgo(8 * D), status: 'rejected',
      amount: 240_000, items: [{ id: 'i1', name: '인터뷰 참가자 리워드 x8', category: '사례비', amount: 240_000 }],
      steps: [step('u_me', 'rejected', 7 * D + 3 * H, '영수증(구매 내역)이 누락되었어요. 첨부 후 다시 상신 부탁드려요.')], completedAt: minutesAgo(7 * D + 3 * H),
    },
    {
      id: 'apv_1038', docNo: 'AUR-2026-1038', kind: 'purchase',
      title: '스테이징 서버 증설 (GPU 인스턴스)', requesterId: 'u_be', createdAt: minutesAgo(9 * D), status: 'approved',
      vendor: 'AWS', amount: 1_280_000,
      items: [{ id: 'i1', name: 'g5.xlarge 예약 인스턴스 (1개월)', qty: 2, amount: 640_000 }],
      details: 'AI 어시스턴트 기능의 스테이징 부하 테스트용입니다.',
      steps: [step('u_cto', 'approved', 9 * D - 3 * H, 'LGTM'), step('u_ceo', 'approved', 8 * D, '승인합니다.')],
      ccIds: ['u_me', 'u_devops'], completedAt: minutesAgo(8 * D),
    },
    {
      id: 'apv_1037', docNo: 'AUR-2026-1037', kind: 'travel',
      title: 'NeurIPS 2026 학회 참석 출장', requesterId: 'u_ml', createdAt: minutesAgo(3 * D + 4 * H), status: 'pending',
      destination: '미국 샌디에이고', purpose: 'NeurIPS 2026 참석 및 LLM 에이전트 워크숍 포스터 발표',
      startDate: daysFromNow(62), endDate: daysFromNow(68), amount: 3_800_000,
      items: [
        { id: 'i1', name: '항공권 (인천 ↔ 샌디에이고)', category: '교통', amount: 1_650_000 },
        { id: 'i2', name: '숙박 6박', category: '숙박', amount: 1_350_000 },
        { id: 'i3', name: '학회 등록비', category: '등록비', amount: 800_000 },
      ],
      steps: [step('u_cto', 'approved', 3 * D, '발표 축하해요! 🎉'), step('u_ceo', 'pending')], ccIds: ['u_me'],
    },
    {
      id: 'apv_1036', docNo: 'AUR-2026-1036', kind: 'general',
      title: '런칭 이벤트 대행사 계약 품의', requesterId: 'u_mkt', createdAt: minutesAgo(10 * D), status: 'cancelled',
      amount: 12_000_000, details: 'Nexus 2.0 런칭 오프라인 이벤트 대행 계약 건. (일정 변경으로 회수)',
      steps: [step('u_ceo', 'waiting')], ccIds: ['u_me', 'u_sales'],
    },

    /* ───────── 내가 올린 문서 ───────── */
    {
      id: 'apv_1035', docNo: 'AUR-2026-1035', kind: 'leave', leaveType: 'annual',
      ...leaveRange(20, 21), requesterId: 'u_me', createdAt: minutesAgo(5 * H), status: 'pending',
      details: '개인 사유로 연차를 사용합니다. 부재 중 제품 관련 의사결정은 서현우님께 위임합니다.',
      steps: [step('u_ceo', 'pending')], ccIds: ['u_pm'],
    },
    {
      id: 'apv_1034', docNo: 'AUR-2026-1034', kind: 'general',
      title: 'Q4 제품 로드맵 및 리소스 배분 승인 요청', requesterId: 'u_me', createdAt: minutesAgo(D + 9 * H), status: 'pending',
      details: 'Q4 핵심 과제: ① AI 어시스턴트 GA ② 전자결재 모바일 ③ 온보딩 개선.\n엔지니어링 리소스 60% / 디자인 30% / 리서치 10% 배분을 제안합니다.',
      attachments: ['Q4_로드맵_v3.pdf', '리소스_배분안.xlsx'],
      steps: [step('u_cto', 'approved', D + 2 * H, '엔지니어링 리소스 배분 동의합니다.'), step('u_ceo', 'pending')], ccIds: ['u_pm', 'u_design'],
    },
    {
      id: 'apv_1033', docNo: 'AUR-2026-1033', kind: 'expense',
      title: '제품팀 분기 회식비', requesterId: 'u_me', createdAt: minutesAgo(5 * D), status: 'approved',
      amount: 412_000, startDate: daysFromNow(-6),
      items: [{ id: 'i1', name: '팀 회식 (을지로 노포)', category: '회식비', amount: 412_000 }],
      attachments: ['영수증_회식.jpg'],
      steps: [step('u_ceo', 'approved', 4 * D + 5 * H, '수고 많았어요 👏')], completedAt: minutesAgo(4 * D + 5 * H),
    },
    {
      id: 'apv_1032', docNo: 'AUR-2026-1032', kind: 'purchase',
      title: '사용자 리서치 패널 서비스 연간 구독', requesterId: 'u_me', createdAt: minutesAgo(12 * D), status: 'rejected',
      vendor: 'UserPanel Korea', amount: 1_900_000,
      items: [{ id: 'i1', name: '리서치 패널 연간 구독 (Pro)', qty: 1, amount: 1_900_000 }],
      steps: [step('u_ceo', 'rejected', 11 * D, 'Q4 예산 재검토 후 다시 올려주세요. 기존 툴로 대체 가능한지도 확인 부탁해요.')], completedAt: minutesAgo(11 * D),
    },
    {
      id: 'apv_1031', docNo: 'AUR-2026-1031', kind: 'access',
      title: '프로덕션 DB 읽기 전용 권한 요청', requesterId: 'u_me', createdAt: minutesAgo(14 * D), status: 'approved',
      system: 'PostgreSQL (prod-replica)', accessLevel: '읽기 전용 (Read-only)', startDate: daysFromNow(-14), endDate: daysFromNow(76),
      details: '제품 지표 분석용 SQL 쿼리 실행 목적',
      steps: [step('u_cto', 'approved', 13 * D + 6 * H, '레플리카만 허용합니다.'), step('u_devops', 'approved', 13 * D, '계정 발급 완료했습니다. 1Password 확인해주세요.')],
      completedAt: minutesAgo(13 * D),
    },
  ]
}
