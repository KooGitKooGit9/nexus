import { minutesAgo } from '@/lib/utils'
import type { Doc } from './types'
import { COVERS } from './constants'

const cover = (id: string) => COVERS.find((c) => c.id === id)!.css

type SeedInput = Omit<Doc, 'createdAt' | 'updatedAt'> & { created: number; updated: number }

const make = ({ created, updated, ...d }: SeedInput): Doc => ({
  ...d,
  createdAt: minutesAgo(created),
  updatedAt: minutesAgo(updated),
})

const DAY = 60 * 24

export const SEED_DOCS: Doc[] = [
  /* ───────────── 회사 위키 ───────────── */
  make({
    id: 'd_wiki', parentId: null, title: '회사 위키', emoji: '🏢', cover: cover('aurora'),
    authorId: 'u_hr', lastEditedBy: 'u_hr', created: 400 * DAY, updated: 3 * DAY, starred: true, tags: ['위키'],
    content: `> [!👋] 오로라랩스 위키에 오신 것을 환영합니다! 회사에 대해 알아야 할 모든 것이 이곳에 있어요.

## 바로가기
- 🌌 회사 소개 — 미션, 비전, 핵심 가치
- 🌴 복지 & 휴가 정책 — 연차, 리프레시 휴가, 복지 포인트
- 🧭 근무 가이드 — 근무 시간, 재택, 오피스 이용 안내

## 자주 묻는 질문
### 위키는 누가 관리하나요?
피플팀이 전체 구조를 관리하고, 각 팀이 자기 팀 문서를 직접 업데이트합니다. 오래된 정보를 발견하면 **바로 수정**하거나 #people-ops 채널에 알려주세요.

### 새 문서는 어디에 만들어야 하나요?
팀 공간 하위에 만들고, 전사에 공유가 필요한 내용만 회사 위키에 올려주세요.

---

> [!📌] 이 위키는 매 분기 첫째 주에 정기 점검합니다. 다음 점검: 10월 6일
`,
  }),
  make({
    id: 'd_about', parentId: 'd_wiki', title: '회사 소개', emoji: '🌌', cover: cover('nebula'),
    authorId: 'u_ceo', lastEditedBy: 'u_ceo', created: 380 * DAY, updated: 12 * DAY, tags: ['위키', '온보딩'],
    content: `# 우리는 누구인가

오로라랩스는 **팀이 일하는 방식을 다시 설계하는** 회사입니다. 흩어진 메신저, 문서, 일정, 결재를 하나의 워크스페이스로 묶어 팀이 맥락을 잃지 않고 일할 수 있게 돕습니다.

> 좋은 도구는 일을 줄여주는 것이 아니라, 중요한 일에 집중하게 해준다.

## 미션
모든 팀이 **가장 좋은 하루**를 보낼 수 있도록, 협업의 마찰을 없앤다.

## 비전
2028년까지 아시아에서 가장 사랑받는 업무 OS가 된다.

## 핵심 가치
1. **고객에게 집착한다** — 모든 결정은 고객 문제에서 출발합니다.
2. **빠르게, 그러나 깊게** — 작게 실험하고, 배운 것은 끝까지 파고듭니다.
3. **투명하게 공유한다** — 기본값은 공개입니다. 비공개에는 이유가 필요합니다.
4. **서로의 성장을 돕는다** — 피드백은 선물입니다.

## 숫자로 보는 오로라랩스
| 항목 | 수치 |
| --- | --- |
| 설립 | 2020년 1월 |
| 구성원 | 87명 |
| 고객사 | 1,240곳 |
| 누적 투자 | 420억 원 (시리즈 B) |
| 오피스 | 서울 HQ · 판교 · 부산 · 샌프란시스코 |

## 연혁
- 2020.01 — 박서준, 이도윤 공동 창업
- 2021.06 — Nexus 베타 출시, 시드 투자 유치
- 2023.03 — 시리즈 A, 고객사 500곳 돌파
- 2025.09 — 시리즈 B, 북미 법인 설립
- 2026.11 — **Nexus 2.0 출시 예정** 🚀
`,
  }),
  make({
    id: 'd_benefits', parentId: 'd_wiki', title: '복지 & 휴가 정책', emoji: '🌴', cover: cover('lagoon'),
    authorId: 'u_hr', lastEditedBy: 'u_hr', created: 360 * DAY, updated: 2 * DAY, starred: true, tags: ['위키', '피플'],
    content: `> [!✅] 2026년 10월 1일부로 리프레시 휴가 기준이 **3년 → 2년**으로 변경되었습니다.

## 휴가
### 연차
- 입사 첫해부터 **연 15일** 연차 제공 (입사일 기준 비례)
- 반차(4시간), 반반차(2시간) 단위로 사용 가능
- 연차 신청은 Nexus **전자결재 → 휴가 신청** 양식을 이용해주세요

### 리프레시 휴가
- 근속 2년마다 **유급 10일** + 여행 지원금 200만 원
- 사용 기한은 발생일로부터 1년

### 기타 휴가
- 생일 반차 🎂, 결혼 5일, 배우자 출산 10일, 조사 휴가 3~5일

## 복지 포인트
연 **240만 원**의 복지 포인트가 매년 1월 지급됩니다.
- 도서 구입, 운동, 어학, 건강검진 등 자유롭게 사용
- 남은 포인트는 이월되지 않아요

## 장비 & 근무 환경
- 입사 시 MacBook Pro 또는 원하는 장비 선택
- 모니터, 의자, 키보드 등 **홈오피스 지원금 100만 원**

## 건강
- 연 1회 종합 건강검진 (가족 1인 포함)
- 사내 심리 상담 프로그램 (연 6회 무료)

---

문의: 피플팀 배수아 (#people-ops)
`,
  }),
  make({
    id: 'd_workguide', parentId: 'd_wiki', title: '근무 가이드', emoji: '🧭', cover: cover('mint'),
    authorId: 'u_hr', lastEditedBy: 'u_pm', created: 340 * DAY, updated: 9 * DAY, tags: ['위키', '온보딩'],
    content: `## 근무 시간
오로라랩스는 **코어 타임(11:00 ~ 16:00)** 기반 유연 근무제입니다. 코어 타임에는 가급적 온라인 상태를 유지해주세요.

## 재택 근무
- 주 2회까지 자유롭게 재택 가능 (화·목은 팀 데이로 출근 권장)
- 재택 시 Nexus 상태를 **🏠 재택근무**로 설정해주세요

## 오피스 이용
| 오피스 | 위치 | 회의실 |
| --- | --- | --- |
| 서울 HQ | 성수동 | Orion, Lyra, Vega |
| 판교 | 판교역 3번 출구 | Nova |
| 부산 | 센텀시티 | Sirius |

## 커뮤니케이션 원칙
1. 결정은 문서로 남긴다 — 메신저에서 합의한 내용도 위키에 정리
2. 비동기가 기본 — 즉답이 필요하면 멘션과 함께 이유를 적기
3. 회의는 25분/50분 단위로, 아젠다 없는 회의는 거절해도 OK

> [!💡] 회의 전에 **회의록 템플릿**으로 아젠다를 먼저 공유하면 회의 시간이 평균 30% 줄어요.

## 체크리스트 (신규 입사자)
- [x] 노트북 수령 및 SSO 로그인
- [x] Nexus 프로필 사진·상태 설정
- [ ] 팀 온보딩 버디와 커피챗
- [ ] 보안 교육 이수 (입사 1주 내)
`,
  }),

  /* ───────────── 제품 ───────────── */
  make({
    id: 'd_product', parentId: null, title: '제품', emoji: '🚀', cover: cover('sunset'),
    authorId: 'u_me', lastEditedBy: 'u_me', created: 300 * DAY, updated: 1 * DAY, tags: ['제품'],
    content: `제품팀의 모든 문서가 모여 있는 공간입니다.

## 이번 분기 핵심 목표
- 🎯 Nexus 2.0 런칭 (11월 18일)
- 📈 주간 활성 팀(WAT) 35% 성장
- 🤖 AI 도우미 사용률 40% 달성

> [!🚀] 런칭까지 **D-47**. 모든 스펙 변경은 PRD에 기록해주세요.
`,
  }),
  make({
    id: 'd_prd', parentId: 'd_product', title: 'Nexus 2.0 PRD', emoji: '✨', cover: cover('aurora'),
    authorId: 'u_me', lastEditedBy: 'u_pm', created: 45 * DAY, updated: 38, starred: true, tags: ['제품', 'PRD'],
    permissions: { u_pm: 'full', u_design: 'edit', u_fe: 'edit', u_cto: 'comment', u_ceo: 'view' },
    content: `> [!🧭] **상태:** 리뷰 중 · **담당:** 김하늘, 서현우 · **목표 출시:** 2026년 11월 18일

## 배경
고객 인터뷰 42건에서 가장 많이 나온 불만은 **"도구를 오가며 맥락을 잃는다"**는 것이었습니다. 평균적으로 한 팀은 하루 23회 앱을 전환하며, 이로 인해 하루 약 47분이 낭비됩니다.

## 문제 정의
1. 메신저에서 나온 결정이 문서·태스크로 이어지지 않는다
2. 회의 전후 정보가 흩어져 있어 준비 시간이 길다
3. 신규 입사자가 필요한 정보를 찾기 어렵다

## 목표 & 성공 지표
| 지표 | 현재 | 목표 |
| --- | --- | --- |
| 주간 활성 팀 (WAT) | 3,120 | 4,200 |
| 앱 전환 횟수/일 | 23회 | 12회 |
| AI 도우미 사용률 | 18% | 40% |
| NPS | 41 | 55 |

## 핵심 기능
### 1. 통합 커맨드 팔레트
- ⌘K 하나로 메시지, 태스크, 문서, 사람을 검색하고 실행
- 최근 항목·추천 액션을 맥락에 맞게 노출

### 2. AI 도우미
- 문서 요약, 번역, 글 다듬기, 액션 아이템 추출
- 스레드 요약 → 태스크 자동 생성

### 3. 블록 에디터
- 슬래시 명령어, 마크다운 단축키, 드래그로 블록 재정렬
- 실시간 공동 편집과 프레즌스 표시

## 사용자 스토리
- [x] PM으로서, 회의록에서 바로 액션 아이템을 태스크로 만들고 싶다
- [x] 디자이너로서, 문서에 피그마 링크를 임베드하고 싶다
- [ ] 신규 입사자로서, 온보딩 체크리스트를 한 곳에서 보고 싶다
- [ ] 리더로서, 팀의 주간 진행 상황을 자동으로 요약받고 싶다

## 범위 밖 (Non-goals)
- 외부 게스트 초대 (2027년 상반기 검토)
- 오프라인 모드

## 일정
1. 9/15 — 스펙 확정
2. 10/13 — 기능 개발 완료 (Code freeze)
3. 10/27 — 클로즈드 베타 (고객사 30곳)
4. 11/18 — 정식 출시 🎉

> [!⚠️] **리스크:** 실시간 공동 편집의 CRDT 마이그레이션이 일정에 가장 큰 영향을 줄 수 있습니다. 10/6까지 기술 검증 결과를 공유받기로 했어요.

## 오픈 이슈
- 요금제별 AI 사용량 제한 정책 (영업팀과 논의 중)
- 모바일 앱 동시 출시 여부
`,
  }),
  make({
    id: 'd_roadmap', parentId: 'd_product', title: '2026 하반기 로드맵', emoji: '🗺️', cover: cover('ocean'),
    authorId: 'u_me', lastEditedBy: 'u_me', created: 90 * DAY, updated: 4 * DAY, tags: ['제품', '로드맵'],
    content: `## 테마
> 하반기 테마는 **"연결된 맥락(Connected Context)"** 입니다.

## Q3 (완료)
- [x] 메신저 스레드 → 태스크 변환
- [x] 캘린더 ↔ 회의록 자동 연결
- [x] 전자결재 모바일 지원

## Q4 (진행 중)
- [ ] Nexus 2.0 — 블록 에디터 & 커맨드 팔레트
- [ ] AI 도우미 GA
- [ ] 워크플로우 템플릿 마켓
- [ ] 엔터프라이즈 SSO (SAML, SCIM)

## 2027 H1 (검토)
- 외부 게스트 협업
- 데이터 웨어하우스 커넥터
- 다국어 UI (일본어, 영어)

| 분기 | 주요 릴리즈 | 담당 |
| --- | --- | --- |
| Q3 | Connected Threads | 서현우 |
| Q4 | Nexus 2.0 | 김하늘 |
| 2027 Q1 | Guest Spaces | 서현우 |
`,
  }),
  make({
    id: 'd_release', parentId: 'd_product', title: '릴리즈 노트', emoji: '📦', cover: cover('mint'),
    authorId: 'u_pm', lastEditedBy: 'u_fe', created: 200 * DAY, updated: 2 * DAY + 120, tags: ['제품', '릴리즈'],
    content: `## v1.18.0 — 9월 30일
### ✨ 새로운 기능
- 커맨드 팔레트에서 **사람 검색** 지원
- 캘린더 이벤트에 회의록 자동 첨부
### 🐛 버그 수정
- 긴 스레드에서 스크롤 위치가 초기화되던 문제 수정
- 다크 모드에서 표 테두리가 보이지 않던 문제 수정

---

## v1.17.2 — 9월 18일
- 파일 업로드 속도 2배 개선 (청크 업로드)
- 전자결재 알림이 중복 발송되던 문제 수정

---

## v1.17.0 — 9월 4일
- 🎉 **워크플로우 빌더** 정식 출시
- 슬랙 가져오기 도구 베타

> [!📣] 다음 릴리즈(v1.19)는 10월 14일 예정입니다.
`,
  }),

  /* ───────────── 엔지니어링 ───────────── */
  make({
    id: 'd_eng', parentId: null, title: '엔지니어링', emoji: '⚙️', cover: cover('graphite'),
    authorId: 'u_cto', lastEditedBy: 'u_cto', created: 390 * DAY, updated: 6 * DAY, tags: ['엔지니어링'],
    content: `엔지니어링 조직의 기술 문서, 프로세스, 런북을 모아둔 공간입니다.

## 팀 구성
- **Platform** — 이도윤, 정민호, 윤태현
- **Product Engineering** — 최지우 외 6명
- **ML** — 강유나 외 2명

## 주요 링크
- 🏗️ 아키텍처 개요
- 🔍 코드 리뷰 가이드
- 🚨 온콜 런북
`,
  }),
  make({
    id: 'd_arch', parentId: 'd_eng', title: '아키텍처 개요', emoji: '🏗️', cover: cover('nebula'),
    authorId: 'u_cto', lastEditedBy: 'u_be', created: 250 * DAY, updated: 5 * DAY, starred: true, tags: ['엔지니어링', '아키텍처'],
    content: `> [!ℹ️] 이 문서는 Nexus 백엔드의 상위 수준 구조를 설명합니다. 세부 설계는 각 서비스의 기술 설계 문서를 참고하세요.

## 시스템 구성
Nexus는 **이벤트 기반 마이크로서비스** 구조이며, 모든 서비스는 Kubernetes(EKS) 위에서 동작합니다.

| 서비스 | 언어 | 저장소 | 담당 |
| --- | --- | --- | --- |
| gateway | Go | — | Platform |
| messenger | Kotlin | PostgreSQL, Redis | Product |
| docs | Kotlin | PostgreSQL, S3 | Product |
| search | Go | OpenSearch | Platform |
| ai-assist | Python | pgvector | ML |

## 데이터 흐름
1. 클라이언트 → API Gateway (인증, 레이트 리밋)
2. Gateway → 각 도메인 서비스 (gRPC)
3. 도메인 이벤트 → Kafka → 검색 인덱서 / 알림 / 분석

\`\`\`yaml
# 이벤트 예시
topic: docs.page.updated
key: page_8f2a1c
payload:
  workspaceId: ws_aurora
  editorId: u_me
  blocksChanged: 3
\`\`\`

## 실시간 협업
- WebSocket 게이트웨이(**realtime**)가 프레즌스와 커서를 브로드캐스트
- 문서 동기화는 Yjs 기반 CRDT로 마이그레이션 중 (Q4)

> [!⚠️] Kafka 컨슈머 랙이 5만 건을 넘으면 검색 인덱싱이 지연됩니다. 온콜 런북의 **"컨슈머 랙 대응"** 절차를 따르세요.

## 관측성
- 메트릭: Prometheus + Grafana
- 로그: Loki
- 트레이싱: OpenTelemetry → Tempo
`,
  }),
  make({
    id: 'd_codereview', parentId: 'd_eng', title: '코드 리뷰 가이드', emoji: '🔍', cover: cover('ice'),
    authorId: 'u_fe', lastEditedBy: 'u_fe', created: 180 * DAY, updated: 20 * DAY, tags: ['엔지니어링', '프로세스'],
    content: `## 왜 코드 리뷰를 하나요?
버그를 잡기 위해서만이 아닙니다. **지식을 공유하고, 더 나은 설계를 함께 찾기 위해서**입니다.

## PR 작성자
- [ ] PR은 400줄 이하로 작게 유지
- [ ] 설명에 **무엇을, 왜** 변경했는지 작성
- [ ] 스크린샷 또는 영상 첨부 (UI 변경 시)
- [ ] 셀프 리뷰 후 리뷰 요청

## 리뷰어
1. 24시간 내 첫 리뷰를 남긴다
2. 코멘트에 의도를 표시한다 — \`nit:\`, \`question:\`, \`blocking:\`
3. 칭찬도 구체적으로 남긴다 👏

\`\`\`text
nit: 변수명을 isOpen으로 바꾸면 의도가 더 잘 드러날 것 같아요.
blocking: 여기서 에러를 삼키면 재시도 로직이 동작하지 않습니다.
\`\`\`

> 리뷰는 코드에 대한 것이지, 사람에 대한 것이 아니다.

> [!💡] 2명 이상 승인 + CI 통과 시 작성자가 직접 머지합니다.
`,
  }),
  make({
    id: 'd_oncall', parentId: 'd_eng', title: '온콜 런북', emoji: '🚨', cover: cover('ember'),
    authorId: 'u_devops', lastEditedBy: 'u_devops', created: 160 * DAY, updated: 1 * DAY + 300, tags: ['엔지니어링', '운영'],
    content: `> [!🚨] 장애 발생 시 가장 먼저 **#incident** 채널에 알리고 인시던트 커맨더를 지정하세요.

## 심각도 기준
| 등급 | 정의 | 대응 시간 |
| --- | --- | --- |
| SEV1 | 전체 서비스 중단 | 5분 내 |
| SEV2 | 핵심 기능 장애 | 15분 내 |
| SEV3 | 일부 기능 저하 | 업무 시간 내 |

## 대응 절차
1. 알림 확인 후 PagerDuty에서 **Acknowledge**
2. Grafana 대시보드에서 영향 범위 파악
3. 최근 배포가 원인이면 즉시 롤백
4. 상태 페이지 업데이트 (SEV1/2)
5. 해결 후 48시간 내 포스트모템 작성

## 자주 쓰는 명령어
\`\`\`bash
# 최근 배포 롤백
kubectl rollout undo deployment/messenger -n prod

# 컨슈머 랙 확인
kafka-consumer-groups --bootstrap-server $KAFKA --describe --group search-indexer
\`\`\`

## 컨슈머 랙 대응
- 랙 > 50k: 인덱서 레플리카를 2배로 스케일 아웃
- 랙 > 200k: SEV2 선언, 플랫폼팀 호출

---

## 온콜 로테이션 (10월)
- 1주차: 윤태현
- 2주차: 정민호
- 3주차: 최지우
- 4주차: 이도윤
`,
  }),

  /* ───────────── 디자인 ───────────── */
  make({
    id: 'd_design', parentId: null, title: '디자인', emoji: '🎨', cover: cover('rose'),
    authorId: 'u_design', lastEditedBy: 'u_design', created: 280 * DAY, updated: 8 * DAY, tags: ['디자인'],
    content: `디자인팀의 원칙, 시스템, 리서치 결과를 공유합니다.

## 디자인 원칙
1. **명료함이 우선** — 장식보다 이해가 먼저
2. **즐거움을 디테일에** — 마이크로 인터랙션으로 기쁨을
3. **모두를 위한 디자인** — 접근성은 선택이 아닌 기본
`,
  }),
  make({
    id: 'd_ds', parentId: 'd_design', title: '디자인 시스템', emoji: '🧩', cover: cover('peach'),
    authorId: 'u_design', lastEditedBy: 'u_fe', created: 150 * DAY, updated: 95, starred: true, tags: ['디자인', '시스템'],
    content: `> [!🎨] **Aurora DS v3** — 다크 퍼스트, 글래스모피즘, 오로라 그라디언트

## 컬러 토큰
| 토큰 | 다크 | 라이트 | 용도 |
| --- | --- | --- | --- |
| accent | #8B5CF6 | #7C3AED | 주요 액션, 포커스 |
| accent-2 | #22D3EE | #06B6D4 | 보조 강조, 그라디언트 |
| accent-3 | #F472B6 | #EC4899 | 하이라이트 |
| surface | #111321 | #FFFFFF | 카드, 패널 |

## 타이포그래피
- 본문: **Pretendard** 15px / 1.7
- 디스플레이: **Space Grotesk** — 큰 숫자와 헤딩
- 코드: JetBrains Mono

## 컴포넌트 현황
- [x] Button, Badge, Avatar
- [x] Modal, Drawer, Popover
- [x] Tabs (애니메이션 pill)
- [ ] DataTable v2
- [ ] DatePicker 리디자인

## 모션 원칙
- 기본 이징: \`cubic-bezier(0.22, 1, 0.36, 1)\`
- 마이크로 인터랙션 150~250ms, 화면 전환 350~450ms

\`\`\`css
.glass {
  background: rgb(var(--surface) / 0.62);
  backdrop-filter: blur(20px) saturate(160%);
}
\`\`\`

![오로라 그라디언트 무드보드](https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80)
`,
  }),

  /* ───────────── 회의록 ───────────── */
  make({
    id: 'd_meetings', parentId: null, title: '회의록', emoji: '🗓️', cover: cover('ocean'),
    authorId: 'u_pm', lastEditedBy: 'u_pm', created: 220 * DAY, updated: 1 * DAY, tags: ['회의록'],
    content: `모든 정기 회의의 회의록을 이곳에 모읍니다. 새 회의록은 **회의록 템플릿**으로 만들어주세요.

- 📝 주간 제품 싱크 — 매주 수요일 10:00
- 🔁 분기 회고 — 분기 마지막 주
`,
  }),
  make({
    id: 'd_m1001', parentId: 'd_meetings', title: '주간 제품 싱크 10/1', emoji: '📝', cover: cover('sunset'),
    authorId: 'u_pm', lastEditedBy: 'u_me', created: 1 * DAY + 200, updated: 12, tags: ['회의록'],
    content: `> [!🗓️] **일시:** 10월 1일 (수) 10:00 – 10:50 · **장소:** Orion / Google Meet
> **참석:** 김하늘, 서현우, 한소희, 최지우, 정민호, 오민지

## 아젠다
1. Nexus 2.0 진행 상황 공유
2. 클로즈드 베타 고객사 선정
3. AI 도우미 요금 정책

## 논의 내용
### Nexus 2.0 진행 상황
- 블록 에디터 **85% 완료**, 슬래시 메뉴·드래그 재정렬 구현 완료
- 커맨드 팔레트 검색 속도 p95 120ms → 목표 80ms
- 공동 편집 CRDT 검증은 10/6 결과 공유 예정

### 클로즈드 베타
- 후보 고객사 48곳 중 30곳 선정 (스타트업 18, 중견 12)
- 베타 피드백은 전용 채널 #beta-feedback 으로 수집

> 베타 고객은 "가장 불만이 많은 고객"부터 고르자 — 서현우

### AI 요금 정책
- 프로 플랜: 월 500회, 엔터프라이즈: 무제한 (안)
- 영업팀 의견 수렴 후 다음 싱크에서 확정

## 결정 사항
- [x] 베타 시작일 10/27 확정
- [x] 에디터 단축키는 노션과 동일하게 맞춘다

## 액션 아이템
- [ ] 베타 고객사 안내 메일 초안 — @서현우 (10/8)
- [ ] 온보딩 플로우 개선안 시안 — @한소희 (10/10)
- [ ] 검색 성능 개선 PR — @최지우 (10/7)
- [ ] AI 요금 정책 영업팀 의견 취합 — @김하늘 (10/7)
`,
  }),
  make({
    id: 'd_m0924', parentId: 'd_meetings', title: '주간 제품 싱크 9/24', emoji: '📝', cover: cover('mint'),
    authorId: 'u_pm', lastEditedBy: 'u_pm', created: 8 * DAY, updated: 8 * DAY - 120, tags: ['회의록'],
    content: `> [!🗓️] **일시:** 9월 24일 (수) 10:00 · **참석:** 김하늘, 서현우, 한소희, 최지우

## 논의 내용
- 블록 에디터 프로토타입 시연 — 반응 매우 좋음 🎉
- 템플릿 갤러리 6종 확정: 회의록, PRD, 주간 보고, 온보딩, 회고, 기술 설계
- 모바일 동시 출시는 리소스 부족으로 **보류**

## 액션 아이템
- [x] 템플릿 콘텐츠 작성 — @서현우
- [x] 슬래시 메뉴 아이콘 세트 — @한소희
- [ ] 모바일 출시 일정 재검토 — @김하늘
`,
  }),
  make({
    id: 'd_retro', parentId: 'd_meetings', title: 'Q3 회고 (KPT)', emoji: '🔁', cover: cover('rose'),
    authorId: 'u_me', lastEditedBy: 'u_design2', created: 5 * DAY, updated: 3 * DAY, tags: ['회의록', '회고'],
    content: `> [!🔁] 3분기를 돌아보며 **Keep · Problem · Try** 를 정리합니다. 모두 자유롭게 추가해주세요!

## 👍 Keep
- 주간 싱크를 50분 → 25분으로 줄인 것
- 디자인-개발 페어링 세션 (주 2회)
- 고객 인터뷰 42건 — 역대 최다

## 😓 Problem
- 스펙 변경이 메신저에서만 공유되어 누락 발생
- QA 기간이 짧아 릴리즈 직전 야근
- 온보딩 문서가 오래되어 신규 입사자 혼란

## 🚀 Try
- [ ] 스펙 변경은 반드시 PRD에 기록하고 링크 공유
- [ ] Code freeze를 릴리즈 1주 전으로 앞당기기
- [ ] 분기마다 위키 점검의 날 운영

## 팀 무드 📊
| 항목 | 점수 (5점) |
| --- | --- |
| 성취감 | 4.4 |
| 협업 | 4.1 |
| 워라밸 | 3.2 |
`,
  }),
]

export const SEED_RECENT = ['d_m1001', 'd_prd', 'd_ds', 'd_oncall', 'd_benefits', 'd_arch']
export const SEED_EXPANDED: Record<string, boolean> = { d_wiki: true, d_product: true, d_meetings: true }
