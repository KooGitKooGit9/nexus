import { daysFromNow, minutesAgo } from '@/lib/utils'
import type { Priority, Project, Subtask, Task, TaskActivity, TaskComment, TaskStatus } from './types'

/* ───────────────────────── Projects ───────────────────────── */

export const SEED_PROJECTS: Project[] = [
  {
    id: 'p_nexus',
    key: 'NX',
    name: 'Nexus 2.0 런칭',
    description: '차세대 워크스페이스 Nexus 2.0 정식 출시. 새로운 홈, 통합 검색, 실시간 협업을 포함합니다.',
    emoji: '🚀',
    color: '#8b5cf6',
    leadId: 'u_me',
    memberIds: ['u_me', 'u_fe', 'u_be', 'u_design', 'u_pm', 'u_mkt', 'u_design2'],
    startDate: daysFromNow(-48),
    endDate: daysFromNow(26),
    sprint: { name: '스프린트 24 · 런칭 준비', startDate: daysFromNow(-6, 9), endDate: daysFromNow(8, 18), goal: '베타 피드백 반영 및 GA 체크리스트 완료' },
    createdAt: daysFromNow(-50),
  },
  {
    id: 'p_mobile',
    key: 'MOB',
    name: '모바일 앱 리뉴얼',
    description: 'iOS/Android 앱을 새 디자인 시스템으로 전면 개편하고 오프라인 모드를 도입합니다.',
    emoji: '📱',
    color: '#22d3ee',
    leadId: 'u_fe',
    memberIds: ['u_fe', 'u_design', 'u_be', 'u_me', 'u_design2'],
    startDate: daysFromNow(-30),
    endDate: daysFromNow(45),
    sprint: { name: '스프린트 7 · 오프라인', startDate: daysFromNow(-3, 9), endDate: daysFromNow(11, 18), goal: '오프라인 동기화 MVP' },
    createdAt: daysFromNow(-32),
  },
  {
    id: 'p_ai',
    key: 'AI',
    name: 'AI 코파일럿',
    description: '문서·메시지·태스크 전반에 걸친 AI 어시스턴트. 요약, 초안 작성, 자동 분류.',
    emoji: '🤖',
    color: '#f472b6',
    leadId: 'u_ml',
    memberIds: ['u_ml', 'u_be', 'u_me', 'u_cto', 'u_fe'],
    startDate: daysFromNow(-22),
    endDate: daysFromNow(38),
    sprint: { name: '스프린트 3 · RAG', startDate: daysFromNow(-8, 9), endDate: daysFromNow(6, 18), goal: '워크스페이스 검색 기반 RAG 파이프라인' },
    createdAt: daysFromNow(-24),
  },
  {
    id: 'p_brand',
    key: 'BRD',
    name: '브랜드 리프레시',
    description: '오로라랩스 브랜드 아이덴티티 리뉴얼 — 로고, 컬러 시스템, 웹사이트, 런칭 캠페인.',
    emoji: '🎨',
    color: '#fbbf24',
    leadId: 'u_design',
    memberIds: ['u_design', 'u_mkt', 'u_me', 'u_design2', 'u_global'],
    startDate: daysFromNow(-40),
    endDate: daysFromNow(14),
    sprint: { name: '스프린트 5 · 웹사이트', startDate: daysFromNow(-5, 9), endDate: daysFromNow(9, 18) },
    createdAt: daysFromNow(-42),
  },
  {
    id: 'p_infra',
    key: 'OPS',
    name: '인프라 마이그레이션',
    description: '레거시 EC2 기반 인프라를 EKS + Terraform으로 이전하고 관측성 스택을 정비합니다.',
    emoji: '🛰️',
    color: '#34d399',
    leadId: 'u_devops',
    memberIds: ['u_devops', 'u_cto', 'u_be', 'u_me'],
    startDate: daysFromNow(-55),
    endDate: daysFromNow(20),
    sprint: { name: '스프린트 11 · 컷오버', startDate: daysFromNow(-9, 9), endDate: daysFromNow(5, 18), goal: '프로덕션 트래픽 50% 전환' },
    createdAt: daysFromNow(-57),
  },
]

/* ───────────────────────── Tasks ───────────────────────── */

interface Extra {
  desc?: string
  subs?: [string, boolean][]
  comments?: [string, string, number][] // userId, text, minutesAgo
  reporter?: string
  done?: number // completedAt offset (days)
}
type Row = [title: string, status: TaskStatus, priority: Priority, assignees: string[], labels: string[], start: number | null, due: number | null, estimate: number, extra?: Extra]

const NX: Row[] = [
  ['온보딩 플로우 개선안 작성', 'in_progress', 'high', ['u_me'], ['디자인', '리서치'], -4, 1, 5, {
    desc: '## 배경\n베타 사용자 인터뷰 결과, **첫 7일 리텐션**이 기대치보다 낮습니다. 워크스페이스 생성 이후 *첫 채널 만들기*에서 이탈이 집중됩니다.\n\n## 목표\n- 첫 메시지까지 걸리는 시간 50% 단축\n- 체크리스트 기반 온보딩 도입\n- 팀원 초대 단계를 앞쪽으로 이동\n\n> 참고: 리서치 리포트는 문서 > 리서치 폴더에 있어요.',
    subs: [['베타 인터뷰 12건 정리', true], ['이탈 구간 퍼널 분석', true], ['개선안 와이어프레임', false], ['디자인 리뷰 일정 잡기', false]],
    comments: [['u_pm', '퍼널 데이터 대시보드 링크 공유드려요. 2단계 이탈이 38%입니다 😢', 300], ['u_design', '와이어프레임 초안은 내일 오전까지 피그마에 올려둘게요!', 120], ['u_me', '좋아요. 체크리스트 아이템은 5개 이하로 가는 걸로 해요.', 40]],
    reporter: 'u_pm',
  }],
  ['통합 검색 결과 랭킹 개선', 'review', 'high', ['u_be', 'u_fe'], ['백엔드', '개선'], -9, 0, 8, {
    subs: [['BM25 가중치 튜닝', true], ['최근성 boost 적용', true], ['A/B 실험 설정', false]],
    comments: [['u_be', 'PR 올렸습니다. nDCG@10 기준 12% 개선됐어요.', 180]],
  }],
  ['홈 대시보드 위젯 드래그 정렬', 'in_progress', 'medium', ['u_fe'], ['프론트엔드', '기능'], -3, 4, 5, { subs: [['dnd-kit 도입', true], ['레이아웃 저장', false]] }],
  ['GA 런칭 체크리스트 최종 점검', 'todo', 'urgent', ['u_me', 'u_pm'], ['문서'], 0, 3, 3, {
    desc: '런칭 D-7 체크리스트\n\n- [ ] 성능 예산 확인\n- [ ] 보안 점검 완료\n- [ ] 고객 공지 초안\n- [ ] 롤백 플랜 리허설',
    subs: [['성능 예산 확인', false], ['보안 점검 결과 수합', false], ['롤백 플랜 리허설', false], ['고객 공지 초안 검토', false]],
  }],
  ['실시간 커서 프레즌스 지연 버그', 'todo', 'urgent', ['u_be'], ['버그', '백엔드'], -1, -1, 3, { comments: [['u_fe', '서울-판교 구간에서 800ms 이상 튀는 케이스 재현됩니다.', 90]] }],
  ['런칭 랜딩 페이지 카피 리뷰', 'review', 'medium', ['u_me', 'u_mkt'], ['마케팅'], -5, -2, 2, { comments: [['u_mkt', '헤드라인 A/B 두 가지 버전 준비했어요. 의견 부탁드립니다!', 260]] }],
  ['다크 모드 대비 접근성 감사', 'todo', 'medium', ['u_design'], ['디자인', '개선'], 2, 9, 3],
  ['알림 센터 그룹핑 기능', 'backlog', 'low', ['u_fe'], ['프론트엔드', '기능'], null, 24, 5],
  ['요금제 페이지 리뉴얼', 'backlog', 'medium', ['u_pm'], ['디자인', '마케팅'], null, 30, 3],
  ['단축키 치트시트 모달', 'done', 'low', ['u_fe'], ['프론트엔드', '기능'], -18, -12, 2, { done: -12 }],
  ['커맨드 팔레트 퍼지 검색', 'done', 'high', ['u_fe', 'u_me'], ['프론트엔드', '기능'], -26, -17, 5, { done: -16 }],
  ['베타 사용자 인터뷰 12건 진행', 'done', 'medium', ['u_design2', 'u_me'], ['리서치'], -30, -20, 5, { done: -19 }],
  ['워크스페이스 초대 링크 만료 처리', 'done', 'high', ['u_be'], ['백엔드', '보안'], -16, -9, 3, { done: -8 }],
  ['이벤트 트래킹 스키마 정리', 'done', 'medium', ['u_pm'], ['문서'], -12, -5, 2, { done: -4 }],
  ['런칭 프레스킷 준비', 'todo', 'medium', ['u_mkt'], ['마케팅'], 1, 12, 3],
  ['파일 미리보기 썸네일 생성 최적화', 'in_progress', 'medium', ['u_be'], ['백엔드', '성능'], -2, 6, 5],
]

const MOB: Row[] = [
  ['오프라인 동기화 엔진 설계', 'in_progress', 'urgent', ['u_be', 'u_fe'], ['백엔드', '모바일'], -3, 5, 8, {
    desc: 'CRDT 기반 vs. 서버 우선(last-write-wins) 접근을 비교하고 MVP 범위를 확정합니다.\n\n### 고려사항\n- 충돌 해결 UX\n- 배터리/저장소 사용량\n- 동기화 큐 재시도 정책',
    subs: [['기술 비교 문서', true], ['프로토타입', false], ['충돌 해결 UX 시안', false]],
    comments: [['u_cto', 'Yjs 기반으로 가면 웹이랑 코드 공유가 가능할 것 같아요.', 500]],
  }],
  ['새 탭바 & 내비게이션 구현', 'review', 'high', ['u_fe'], ['프론트엔드', '모바일'], -8, -1, 5, { subs: [['iOS', true], ['Android', true], ['햅틱 피드백', false]] }],
  ['푸시 알림 권한 요청 UX 개선', 'todo', 'medium', ['u_me', 'u_design'], ['디자인', '모바일'], 1, 6, 3],
  ['앱 아이콘 & 스플래시 리디자인', 'done', 'medium', ['u_design'], ['디자인'], -20, -10, 2, { done: -10 }],
  ['모바일 디자인 토큰 동기화', 'done', 'high', ['u_design', 'u_fe'], ['디자인', '프론트엔드'], -24, -14, 5, { done: -13 }],
  ['Android 12 이하 크래시 수정', 'in_progress', 'urgent', ['u_fe'], ['버그', '모바일'], -2, -1, 3, { comments: [['u_fe', 'Crashlytics 상위 1위 이슈입니다. WebView 버전 문제로 보여요.', 75]] }],
  ['딥링크 라우팅 정리', 'todo', 'medium', ['u_fe'], ['프론트엔드', '모바일'], 3, 10, 3],
  ['앱스토어 스크린샷 & 설명 업데이트', 'backlog', 'low', ['u_me'], ['마케팅'], null, 28, 2],
  ['위젯(iOS 홈 화면) 지원', 'backlog', 'medium', ['u_fe'], ['기능', '모바일'], null, 40, 8],
  ['사용성 테스트: 새 내비게이션', 'todo', 'high', ['u_design2', 'u_me'], ['리서치', '디자인'], 2, 7, 3, { subs: [['참가자 6명 모집', true], ['시나리오 작성', false], ['리포트 작성', false]] }],
  ['이미지 업로드 압축 파이프라인', 'review', 'medium', ['u_be'], ['백엔드', '성능'], -6, 2, 3],
  ['생체 인증 로그인', 'done', 'high', ['u_fe', 'u_be'], ['기능', '보안'], -22, -7, 5, { done: -6 }],
  ['접근성: 다이내믹 타입 대응', 'backlog', 'low', ['u_design'], ['디자인', '개선'], null, 35, 3],
  ['모바일 온보딩 화면 카피', 'done', 'low', ['u_me'], ['문서'], -10, -3, 1, { done: -3 }],
]

const AI: Row[] = [
  ['RAG 파이프라인 v1 구축', 'in_progress', 'urgent', ['u_ml', 'u_be'], ['AI/ML', '백엔드'], -7, 3, 8, {
    desc: '워크스페이스 문서/메시지/태스크를 청크 단위로 임베딩하여 벡터 DB에 저장하고, 질의 시 하이브리드 검색으로 컨텍스트를 구성합니다.\n\n```\nretriever = Hybrid(bm25, dense, alpha=0.6)\n```',
    subs: [['청킹 전략 결정', true], ['임베딩 배치 잡', true], ['하이브리드 검색', false], ['권한 필터링', false]],
    comments: [['u_cto', '권한 필터링은 반드시 retrieval 단계에서 처리해 주세요. 🔒', 220], ['u_ml', '넵 ACL 메타데이터로 pre-filter 하겠습니다.', 200]],
  }],
  ['AI 요약 프롬프트 평가셋 구축', 'todo', 'high', ['u_me', 'u_ml'], ['AI/ML', '리서치'], 0, 2, 5, { subs: [['요약 샘플 100건 수집', true], ['평가 루브릭 정의', false], ['라벨링 가이드', false]] }],
  ['스레드 요약 UI', 'review', 'medium', ['u_fe'], ['프론트엔드', 'AI/ML'], -6, 0, 3],
  ['토큰 사용량 대시보드', 'todo', 'medium', ['u_be'], ['백엔드', '기능'], 2, 9, 3],
  ['환각 탐지 가드레일', 'backlog', 'high', ['u_ml'], ['AI/ML', '보안'], null, 20, 8],
  ['AI 기능 가격 정책 초안', 'todo', 'medium', ['u_me'], ['문서', '리서치'], 1, 5, 2, { comments: [['u_ceo', '시트당 과금 vs 사용량 과금 둘 다 시뮬레이션 부탁해요.', 600]] }],
  ['스트리밍 응답 렌더링', 'done', 'high', ['u_fe'], ['프론트엔드', 'AI/ML'], -15, -8, 3, { done: -8 }],
  ['LLM 게이트웨이 레이트 리밋', 'done', 'urgent', ['u_be'], ['백엔드', '인프라'], -18, -11, 5, { done: -10 }],
  ['자동 태스크 분류 모델 실험', 'in_progress', 'medium', ['u_ml'], ['AI/ML', '리서치'], -4, 8, 5],
  ['AI 코파일럿 개인정보 처리 검토', 'review', 'high', ['u_me', 'u_cto'], ['보안', '문서'], -5, -3, 2],
  ['초안 작성 기능 (문서)', 'backlog', 'medium', ['u_fe', 'u_ml'], ['기능', 'AI/ML'], null, 26, 5],
  ['임베딩 모델 벤치마크', 'done', 'medium', ['u_ml'], ['AI/ML', '리서치'], -20, -14, 3, { done: -13 }],
  ['AI 패널 단축키 & 진입점 정리', 'done', 'low', ['u_me'], ['디자인'], -9, -5, 1, { done: -5 }],
  ['피드백(👍/👎) 수집 파이프라인', 'todo', 'low', ['u_be'], ['백엔드', '기능'], 4, 13, 2],
]

const BRD: Row[] = [
  ['새 로고 최종안 확정', 'review', 'urgent', ['u_design', 'u_me'], ['디자인'], -6, -2, 3, {
    subs: [['3개 시안 내부 투표', true], ['경영진 리뷰', true], ['상표 검색', false]],
    comments: [['u_ceo', 'B안이 가장 오로라 느낌이 나네요 ✨', 1400], ['u_design', '상표 검색 결과만 나오면 확정 가능합니다.', 400]],
  }],
  ['브랜드 컬러 시스템 정의', 'done', 'high', ['u_design'], ['디자인'], -25, -15, 5, { done: -14 }],
  ['웹사이트 메인 페이지 리디자인', 'in_progress', 'high', ['u_design', 'u_fe'], ['디자인', '프론트엔드'], -4, 6, 8, { subs: [['히어로 섹션', true], ['기능 소개 섹션', false], ['고객 사례 섹션', false], ['반응형 QA', false]] }],
  ['브랜드 가이드라인 문서', 'todo', 'medium', ['u_design2'], ['문서', '디자인'], 2, 11, 3],
  ['런칭 캠페인 영상 스토리보드', 'in_progress', 'medium', ['u_mkt'], ['마케팅'], -3, 3, 5],
  ['SNS 채널 프로필 교체', 'todo', 'low', ['u_mkt'], ['마케팅'], 6, 13, 1],
  ['명함 & 오피스 사이니지', 'backlog', 'low', ['u_hr'], ['디자인'], null, 21, 2],
  ['글로벌 사이트 영문 카피', 'todo', 'medium', ['u_global', 'u_me'], ['마케팅', '문서'], 0, 4, 3],
  ['브랜드 서베이 결과 분석', 'done', 'medium', ['u_design2', 'u_me'], ['리서치'], -28, -19, 3, { done: -18 }],
  ['일러스트 스타일 탐색', 'done', 'low', ['u_design'], ['디자인'], -21, -12, 3, { done: -11 }],
  ['파비콘 & OG 이미지 교체', 'todo', 'low', ['u_fe'], ['프론트엔드', '디자인'], 5, 12, 1],
  ['보도자료 초안', 'backlog', 'medium', ['u_mkt', 'u_me'], ['마케팅', '문서'], null, 15, 2],
  ['모션 가이드 (로고 애니메이션)', 'review', 'medium', ['u_design'], ['디자인'], -5, 1, 3],
]

const OPS: Row[] = [
  ['EKS 클러스터 프로덕션 구성', 'done', 'urgent', ['u_devops'], ['인프라'], -30, -18, 8, { done: -17 }],
  ['Terraform 모듈화 & 상태 분리', 'done', 'high', ['u_devops'], ['인프라'], -24, -12, 5, { done: -11 }],
  ['트래픽 50% 카나리 전환', 'in_progress', 'urgent', ['u_devops', 'u_be'], ['인프라', '백엔드'], -2, 2, 5, {
    desc: '### 컷오버 계획\n1. 10% → 25% → 50% 단계적 전환\n2. 각 단계 30분 관찰 (에러율 < 0.1%, p95 < 300ms)\n3. 이상 시 즉시 롤백\n\n**모니터링 대시보드**: Grafana > Cutover',
    subs: [['10% 전환', true], ['25% 전환', true], ['50% 전환', false], ['사후 리포트', false]],
    comments: [['u_devops', '25%까지 문제 없습니다. p95 210ms 유지 중 📉', 55], ['u_cto', '👍 50%는 내일 오전 10시에 진행하죠.', 30]],
  }],
  ['관측성 스택 (OpenTelemetry) 도입', 'review', 'high', ['u_devops'], ['인프라', '성능'], -10, -1, 5],
  ['DB 커넥션 풀 튜닝', 'todo', 'high', ['u_be'], ['백엔드', '성능'], 0, 3, 3],
  ['비용 최적화: 스팟 인스턴스 도입', 'backlog', 'medium', ['u_devops'], ['인프라'], null, 25, 5],
  ['장애 대응 런북 업데이트', 'todo', 'medium', ['u_me', 'u_devops'], ['문서', '인프라'], 1, 7, 2],
  ['시크릿 관리 Vault 이전', 'in_progress', 'high', ['u_devops'], ['보안', '인프라'], -5, -2, 5, { comments: [['u_devops', 'staging은 완료, prod 키 로테이션 일정 조율 중입니다.', 700]] }],
  ['레거시 EC2 디커미션 계획', 'backlog', 'low', ['u_devops'], ['인프라'], null, 32, 3],
  ['CI 파이프라인 캐시 최적화', 'done', 'medium', ['u_devops', 'u_fe'], ['인프라', '성능'], -14, -6, 3, { done: -6 }],
  ['DR(재해복구) 리허설', 'todo', 'high', ['u_devops', 'u_cto'], ['인프라'], 6, 15, 5],
  ['마이그레이션 진행 현황 공유 (전사)', 'todo', 'low', ['u_me'], ['문서'], 2, 5, 1],
  ['알림 노이즈 줄이기 (PagerDuty)', 'done', 'medium', ['u_devops'], ['인프라', '개선'], -9, -4, 2, { done: -2 }],
  ['로그 보존 정책 수립', 'review', 'low', ['u_be'], ['보안', '문서'], -3, 3, 2],
]

function build(project: Project, rows: Row[], startNumber: number, numberOverrides: Record<number, number> = {}): Task[] {
  const counters: Record<TaskStatus, number> = { backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0 }
  return rows.map(([title, status, priority, assigneeIds, labels, start, due, estimate, extra = {}], i) => {
    const number = numberOverrides[i] ?? startNumber + i
    const id = `t_${project.key.toLowerCase()}_${number}`
    const createdDays = Math.min(start ?? -3, due ?? 0) - 4 - (i % 5)
    const reporterId = extra.reporter ?? project.leadId
    const subtasks: Subtask[] = (extra.subs ?? []).map(([t, d], j) => ({ id: `${id}_s${j}`, title: t, done: status === 'done' ? true : d }))
    const comments: TaskComment[] = (extra.comments ?? []).map(([userId, text, ago], j) => ({ id: `${id}_c${j}`, userId, text, createdAt: minutesAgo(ago) }))
    const activity: TaskActivity[] = [
      { id: `${id}_a0`, userId: reporterId, text: '태스크를 생성했습니다', createdAt: daysFromNow(createdDays, 10, 12) },
      ...(assigneeIds.length ? [{ id: `${id}_a1`, userId: reporterId, text: `담당자를 지정했습니다`, createdAt: daysFromNow(createdDays, 10, 20) }] : []),
      ...(status !== 'backlog' && status !== 'todo'
        ? [{ id: `${id}_a2`, userId: assigneeIds[0] ?? reporterId, text: '상태를 진행 중으로 변경했습니다', createdAt: daysFromNow(start ?? -2, 11, 5) }]
        : []),
      ...(status === 'review' || status === 'done'
        ? [{ id: `${id}_a3`, userId: assigneeIds[0] ?? reporterId, text: '상태를 리뷰로 변경했습니다', createdAt: daysFromNow((extra.done ?? due ?? 0) - 1, 16, 30) }]
        : []),
      ...(status === 'done' ? [{ id: `${id}_a4`, userId: assigneeIds[0] ?? reporterId, text: '상태를 완료로 변경했습니다', createdAt: daysFromNow(extra.done ?? due ?? -1, 17, 40) }] : []),
    ]
    return {
      id,
      number,
      projectId: project.id,
      title,
      description: extra.desc,
      status,
      priority,
      assigneeIds,
      reporterId,
      labels,
      startDate: start !== null ? daysFromNow(start, 9) : undefined,
      dueDate: due !== null ? daysFromNow(due, 18) : undefined,
      estimate,
      subtasks,
      comments,
      createdAt: daysFromNow(createdDays, 10, 12),
      updatedAt: comments.length ? comments[comments.length - 1].createdAt : daysFromNow(Math.min(0, due ?? 0), 15),
      completedAt: status === 'done' ? daysFromNow(extra.done ?? due ?? -1, 17, 40) : undefined,
      order: (counters[status]++) * 1000,
      activity,
    }
  })
}

const [pNx, pMob, pAi, pBrd, pOps] = SEED_PROJECTS

// NX-142 is referenced by a seeded notification — keep it as the onboarding task.
export const SEED_TASKS: Task[] = [
  ...build(pNx, NX, 142, {}),
  ...build(pMob, MOB, 58),
  ...build(pAi, AI, 21),
  ...build(pBrd, BRD, 34),
  ...build(pOps, OPS, 87),
]

for (const p of SEED_PROJECTS) {
  const nums = SEED_TASKS.filter((t) => t.projectId === p.id).map((t) => t.number)
  p.nextNumber = Math.max(0, ...nums) + 1
}
