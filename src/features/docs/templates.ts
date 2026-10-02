import { formatDate } from '@/lib/utils'
import { COVERS } from './constants'
import { currentWorkspace } from '@/lib/workspace'

export interface DocTemplate {
  id: string
  title: string
  emoji: string
  description: string
  cover: string
  /** Tailwind gradient for the card accent */
  tint: string
  content: () => string
}

const cover = (id: string) => COVERS.find((c) => c.id === id)!.css

export const TEMPLATES: DocTemplate[] = [
  {
    id: 'meeting',
    title: '회의록',
    emoji: '📝',
    description: '아젠다, 논의 내용, 결정 사항과 액션 아이템을 한눈에',
    cover: cover('sunset'),
    tint: 'from-orange-400 to-pink-500',
    content: () => `> [!🗓️] **일시:** ${formatDate(new Date(), 'M월 d일 (EEE) HH:mm')} · **장소:** 회의실 / Google Meet
> **참석:** @이름, @이름

## 아젠다
1. 지난 액션 아이템 리뷰
2. 주요 안건
3. 기타

## 논의 내용
### 안건 1
- 핵심 포인트를 적어주세요

## 결정 사항
- [ ] 결정된 내용

## 액션 아이템
- [ ] 할 일 — @담당자 (기한)
- [ ] 할 일 — @담당자 (기한)

> [!💡] 회의 후 24시간 안에 참석자에게 공유해주세요.
`,
  },
  {
    id: 'prd',
    title: '제품 요구사항(PRD)',
    emoji: '✨',
    description: '배경, 문제 정의, 성공 지표, 범위와 일정을 정리',
    cover: cover('aurora'),
    tint: 'from-violet-500 to-cyan-400',
    content: () => `> [!🧭] **상태:** 초안 · **담당:** @이름 · **목표 출시:** YYYY-MM-DD

## 배경
왜 이 기능이 필요한가요? 고객의 목소리와 데이터를 근거로 작성해주세요.

## 문제 정의
1. 해결하려는 첫 번째 문제
2. 두 번째 문제

## 목표 & 성공 지표
| 지표 | 현재 | 목표 |
| --- | --- | --- |
| 핵심 지표 | — | — |
| 보조 지표 | — | — |

## 사용자 스토리
- [ ] ~로서, ~하고 싶다. 왜냐하면 ~이기 때문이다.
- [ ] ~로서, ~하고 싶다.

## 범위 밖 (Non-goals)
- 이번에 하지 않을 것

## 일정
1. 스펙 확정
2. 디자인 완료
3. 개발 완료
4. 출시 🚀

> [!⚠️] **리스크:** 일정이나 품질에 영향을 줄 수 있는 요소를 적어주세요.
`,
  },
  {
    id: 'weekly',
    title: '주간 업무 보고',
    emoji: '📊',
    description: '이번 주 성과, 다음 주 계획, 이슈를 간결하게',
    cover: cover('mint'),
    tint: 'from-emerald-400 to-sky-500',
    content: () => `> [!📅] **기간:** ${formatDate(new Date(), 'M월 d일')} 주차 · **작성자:** @이름

## 🎯 이번 주 하이라이트
- 가장 중요한 성과 한 가지

## ✅ 완료한 일
- [x] 완료한 업무 1
- [x] 완료한 업무 2

## 🔄 진행 중
- [ ] 진행 중인 업무 (진척도 60%)

## 📌 다음 주 계획
1. 우선순위 1
2. 우선순위 2

## 🚧 이슈 & 도움 요청
> [!🙋] 막혀 있는 부분이나 도움이 필요한 부분을 적어주세요.

## 📈 지표
| 지표 | 지난주 | 이번 주 |
| --- | --- | --- |
| 지표 A | 0 | 0 |
`,
  },
  {
    id: 'onboarding',
    title: '온보딩 가이드',
    emoji: '🌱',
    description: '신규 입사자가 첫 주를 순조롭게 보낼 수 있도록',
    cover: cover('lagoon'),
    tint: 'from-lime-400 to-teal-500',
    content: () => `> [!👋] ${currentWorkspace().name}에 오신 것을 환영합니다! 첫 2주 동안 이 가이드를 따라가 보세요.

## 첫날
- [ ] 노트북 수령 및 SSO 로그인
- [ ] Nexus 프로필 사진 & 상태 설정
- [ ] 팀 채널 참여하기
- [ ] 버디와 점심 🍱

## 첫 주
- [ ] 회사 위키 읽기 (회사 소개, 복지, 근무 가이드)
- [ ] 보안 교육 이수
- [ ] 팀원 1:1 커피챗
- [ ] 첫 번째 작은 과제 완료

## 알아두면 좋은 것
| 무엇 | 어디서 |
| --- | --- |
| 휴가 신청 | 전자결재 → 휴가 신청 |
| 장비 요청 | #it-help |
| 복지 문의 | #people-ops |

## 팀 소개
### 우리 팀이 하는 일
팀의 미션과 주요 업무를 적어주세요.

> [!💡] 모르는 것이 있으면 언제든 버디에게 물어보세요. 질문은 환영입니다!
`,
  },
  {
    id: 'retro',
    title: '회고(KPT)',
    emoji: '🔁',
    description: 'Keep · Problem · Try 로 팀의 다음 스텝을 찾기',
    cover: cover('rose'),
    tint: 'from-pink-500 to-purple-500',
    content: () => `> [!🔁] 이번 스프린트(또는 분기)를 돌아봅니다. 비난 없이, 배움에 집중해요.

## 👍 Keep — 계속할 것
- 잘 된 점

## 😓 Problem — 문제였던 것
- 아쉬웠던 점

## 🚀 Try — 시도해볼 것
- [ ] 다음에 시도할 것 — @담당자

## 팀 무드
| 항목 | 점수 (5점) |
| --- | --- |
| 성취감 | |
| 협업 | |
| 워라밸 | |

---

> 회고의 목적은 사람을 평가하는 것이 아니라, 시스템을 개선하는 것이다.
`,
  },
  {
    id: 'techspec',
    title: '기술 설계 문서',
    emoji: '🏗️',
    description: '설계 목표, 대안 비교, API와 롤아웃 계획까지',
    cover: cover('nebula'),
    tint: 'from-indigo-500 to-fuchsia-500',
    content: () => `> [!ℹ️] **작성자:** @이름 · **리뷰어:** @이름, @이름 · **상태:** 초안

## 개요
한두 문단으로 무엇을 왜 만드는지 설명해주세요.

## 목표
- 목표 1
- 목표 2

## 비목표
- 이번 설계에서 다루지 않는 것

## 설계
### 아키텍처
컴포넌트 간 관계와 데이터 흐름을 설명합니다.

### API
\`\`\`ts
interface CreatePageRequest {
  workspaceId: string
  parentId?: string
  title: string
}
\`\`\`

### 데이터 모델
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | string | 고유 ID |
| createdAt | timestamp | 생성 시각 |

## 대안 검토
1. **대안 A** — 장점 / 단점
2. **대안 B** — 장점 / 단점

## 롤아웃 계획
- [ ] 피처 플래그 뒤에서 내부 배포
- [ ] 5% → 25% → 100% 점진 배포
- [ ] 모니터링 대시보드 구성

> [!⚠️] 롤백 기준과 절차를 반드시 명시해주세요.
`,
  },
]
