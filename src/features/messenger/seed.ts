import { daysFromNow, minutesAgo } from '@/lib/utils'
import type { Attachment, BotCard, Channel, EventMeta, HuddleMeta, Message, PollMeta, TaskMeta } from './types'

/* ───────────── Channels ───────────── */

const ALL = ['u_me', 'u_ceo', 'u_cto', 'u_fe', 'u_be', 'u_ml', 'u_devops', 'u_design', 'u_design2', 'u_pm', 'u_mkt', 'u_sales', 'u_hr', 'u_global']
const created = daysFromNow(-420, 10)

export const SEED_CHANNELS: Channel[] = [
  { id: 'c_general', name: 'general', kind: 'public', emoji: '📢', memberIds: ALL, createdBy: 'u_ceo', createdAt: created, topic: '전사 공지 · 타운홀 매주 금요일 16:00', description: '오로라랩스 전 구성원이 함께하는 공지 채널입니다. 중요한 소식은 이곳에서 가장 먼저 공유됩니다.' },
  { id: 'c_random', name: 'random', kind: 'public', emoji: '🎲', memberIds: ALL, createdBy: 'u_hr', createdAt: created, topic: '점심 메뉴, 고양이 사진, 아무 이야기 환영 🐱', description: '업무와 상관없는 모든 이야기를 나누는 곳' },
  { id: 'c_engineering', name: 'engineering', kind: 'public', emoji: '⚙️', memberIds: ['u_me', 'u_cto', 'u_fe', 'u_be', 'u_ml', 'u_devops', 'u_pm', 'u_design'], createdBy: 'u_cto', createdAt: created, topic: '배포 프리즈: 금 15:00 ~ 월 10:00 · 온콜: @윤태현', description: '엔지니어링 전반 논의, 아키텍처 리뷰, 코드 리뷰 요청' },
  { id: 'c_design', name: 'design', kind: 'public', emoji: '🎨', memberIds: ['u_me', 'u_design', 'u_design2', 'u_fe', 'u_pm', 'u_mkt'], createdBy: 'u_design', createdAt: created, topic: '디자인 시스템 v3 · 크리틱 매주 화 11:00', description: '시안 공유, 디자인 크리틱, 디자인 시스템 논의' },
  { id: 'c_product', name: 'product', kind: 'public', emoji: '🚀', memberIds: ['u_me', 'u_pm', 'u_design', 'u_design2', 'u_cto', 'u_fe', 'u_be', 'u_ceo', 'u_mkt', 'u_ml'], createdBy: 'u_me', createdAt: created, topic: 'Q4 로드맵 확정 D-3 🗓', description: '제품 전략, 로드맵, 스프린트, 지표 공유' },
  { id: 'c_marketing', name: 'marketing', kind: 'public', emoji: '📣', memberIds: ['u_me', 'u_mkt', 'u_sales', 'u_global', 'u_ceo', 'u_design'], createdBy: 'u_mkt', createdAt: created, topic: '10월 런칭 캠페인 준비 중', description: '캠페인, 콘텐츠, 브랜드 관련 논의' },
  { id: 'c_sales', name: 'sales-wins', kind: 'public', emoji: '🏆', memberIds: ['u_me', 'u_sales', 'u_global', 'u_ceo', 'u_mkt'], createdBy: 'u_sales', createdAt: created, topic: '계약 소식은 언제나 환영 🎉', description: '세일즈 성과와 고객 성공 사례를 축하하는 채널' },
  { id: 'c_incidents', name: 'incidents', kind: 'public', emoji: '🚨', memberIds: ['u_me', 'u_cto', 'u_be', 'u_fe', 'u_ml', 'u_devops'], createdBy: 'u_devops', createdAt: created, topic: '장애 발생 시 즉시 공유 · 런북: /docs/runbook', description: '장애 알림, 대응 현황, 포스트모템' },
  { id: 'c_seoul', name: 'seoul-office', kind: 'public', emoji: '🏢', memberIds: ['u_me', 'u_ceo', 'u_cto', 'u_ml', 'u_design', 'u_design2', 'u_pm', 'u_mkt', 'u_hr'], createdBy: 'u_hr', createdAt: created, topic: '서울 HQ 소식 · 회의실 예약은 캘린더에서', description: '서울 오피스 공지, 시설, 이벤트' },
  { id: 'c_leadership', name: 'leadership', kind: 'private', emoji: '🔒', memberIds: ['u_me', 'u_ceo', 'u_cto', 'u_mkt', 'u_hr'], createdBy: 'u_ceo', createdAt: created, topic: '리더십 논의 (비공개)', description: '리더십 그룹 전용 비공개 채널' },
  { id: 'c_ailab', name: 'ai-lab', kind: 'public', emoji: '🧠', memberIds: ['u_ml', 'u_cto', 'u_be'], createdBy: 'u_ml', createdAt: daysFromNow(-60, 10), topic: 'LLM 실험 & 논문 읽기', description: '최신 AI 연구, 실험 결과, 논문 스터디' },
  { id: 'c_bookclub', name: 'book-club', kind: 'public', emoji: '📚', memberIds: ['u_hr', 'u_design2', 'u_global', 'u_mkt'], createdBy: 'u_hr', createdAt: daysFromNow(-90, 10), topic: '10월의 책: 「도둑맞은 집중력」', description: '한 달에 한 권, 함께 읽고 이야기 나눠요' },
  { id: 'c_running', name: 'running-crew', kind: 'public', emoji: '🏃', memberIds: ['u_devops', 'u_sales', 'u_fe'], createdBy: 'u_devops', createdAt: daysFromNow(-30, 10), topic: '매주 수요일 한강 러닝 🌉', description: '함께 달리는 오로라 러닝 크루' },

  { id: 'd_fe', name: '', kind: 'dm', memberIds: ['u_me', 'u_fe'], createdBy: 'u_fe', createdAt: created },
  { id: 'd_design', name: '', kind: 'dm', memberIds: ['u_me', 'u_design'], createdBy: 'u_design', createdAt: created },
  { id: 'd_ceo', name: '', kind: 'dm', memberIds: ['u_me', 'u_ceo'], createdBy: 'u_ceo', createdAt: created },
  { id: 'd_pm', name: '', kind: 'dm', memberIds: ['u_me', 'u_pm'], createdBy: 'u_pm', createdAt: created },
  { id: 'd_ml', name: '', kind: 'dm', memberIds: ['u_me', 'u_ml'], createdBy: 'u_ml', createdAt: created },
  { id: 'g_launch', name: '런칭 TF', kind: 'group', memberIds: ['u_me', 'u_mkt', 'u_design', 'u_pm'], createdBy: 'u_mkt', createdAt: daysFromNow(-2, 14) },

  { id: 'a_nexusbot', name: 'Nexus Bot', kind: 'dm', isApp: true, emoji: '🤖', memberIds: ['u_me', 'u_bot'], createdBy: 'u_bot', createdAt: created, description: '리마인더, 일정 요약, 워크스페이스 알림' },
  { id: 'a_github', name: 'GitHub', kind: 'dm', isApp: true, emoji: '🐙', memberIds: ['u_me', 'u_bot'], createdBy: 'u_bot', createdAt: created, description: 'aurora/nexus-web 저장소의 PR · 리뷰 알림' },
]

/* ───────────── Messages ───────────── */

const M: Message[] = []
let seq = 0
const d = (days: number, h: number, m = 0) => daysFromNow(-days, h, m)
const ago = minutesAgo

type Extra = Partial<Omit<Message, 'reactions'>> & { rx?: Record<string, string[]> }

function msg(channelId: string, userId: string, at: string, text: string, extra: Extra = {}): string {
  const { rx, ...rest } = extra
  const id = rest.id ?? `m_${String(++seq).padStart(3, '0')}`
  M.push({ id, channelId, userId, text, createdAt: at, reactions: rx ?? {}, ...rest })
  return id
}
function reply(rootId: string, userId: string, at: string, text: string, extra: Extra = {}) {
  const root = M.find((m) => m.id === rootId)!
  return msg(root.channelId, userId, at, text, { ...extra, threadId: rootId })
}
function img(name: string, gradient: string, aspect = 1.6, size = 840_000): Attachment {
  return { id: `att_${name}`, name, size, mime: 'image/png', gradient, aspect }
}
function file(name: string, size: number, mime: string): Attachment {
  return { id: `att_${name}`, name, size, mime }
}
const bot = (card: BotCard) => ({ meta: card as unknown as Record<string, unknown> })

/* #general */
msg('c_general', 'u_ceo', d(4, 9, 2), '좋은 아침입니다 여러분 ☀️ 이번 주 금요일 **타운홀**은 오후 4시, 1층 라운지에서 진행합니다. Q3 회고와 Q4 OKR 공유가 있을 예정이에요.', { rx: { '👍': ['u_cto', 'u_fe', 'u_be', 'u_design', 'u_pm', 'u_hr'], '🙌': ['u_mkt', 'u_sales'] } })
msg('c_general', 'u_hr', d(4, 9, 15), '📌 **10월 복지 안내**\n- 건강검진 예약 마감: 10/15\n- 도서구입비 신청은 Nexus 결재에서 가능합니다\n- 매월 마지막 금요일은 _리프레시 데이_ 🌿 (조기 퇴근)', { pinned: true, rx: { '🙏': ['u_me', 'u_design', 'u_ml', 'u_design2'], '❤️': ['u_fe', 'u_pm'] } })
const gEmily = msg('c_general', 'u_hr', d(3, 10, 30), 'Emily Carter님이 이번 주 서울 오피스에 방문하십니다 ✈️ 샌프란시스코에서 글로벌 파트너십을 담당하고 계세요. 반갑게 맞아주세요!', { rx: { '👋': ['u_me', 'u_ceo', 'u_fe', 'u_design', 'u_mkt', 'u_sales', 'u_pm'], '🎉': ['u_design2', 'u_ml'] } })
reply(gEmily, 'u_global', d(3, 10, 48), "Can't wait to meet everyone in person! 안녕하세요 😊")
reply(gEmily, 'u_sales', d(3, 11, 2), '부산에서 올라갈게요 ㅎㅎ 저녁 같이 해요!')
reply(gEmily, 'u_mkt', d(3, 11, 15), '웰컴 디너 장소 제가 알아볼게요 🍣 성수 쪽 어떠세요?')
const gArr = msg('c_general', 'u_ceo', d(2, 18, 10), '이번 분기 **ARR 32억 돌파**했습니다 🚀\n모두의 덕분이에요. 진심으로 감사드립니다. 오늘 저녁은 회사가 쏩니다 🍗', { rx: { '🎉': ['u_me', 'u_cto', 'u_fe', 'u_be', 'u_ml', 'u_devops', 'u_design', 'u_design2', 'u_pm', 'u_mkt', 'u_sales', 'u_hr'], '🔥': ['u_fe', 'u_be', 'u_ml', 'u_mkt', 'u_sales', 'u_global', 'u_devops', 'u_pm'], '🙏': ['u_hr', 'u_design', 'u_design2', 'u_me', 'u_cto'] } })
reply(gArr, 'u_cto', d(2, 18, 14), '팀 전체가 정말 고생 많았습니다 👏')
reply(gArr, 'u_sales', d(2, 18, 20), '다음 분기는 50억 갑니다 💪', { rx: { '💪': ['u_ceo', 'u_global', 'u_mkt'] } })
reply(gArr, 'u_me', d(2, 18, 31), '@박서준 타운홀에서 제품 지표도 같이 공유드릴게요!')
msg('c_general', 'u_bot', d(1, 9, 0), '📅 **오늘의 전사 일정**\n- 10:00 신규 입사자 OT (회의실 Nova)\n- 14:00 보안 교육 (온라인, 필수)\n- 16:00 주간 타운홀')
msg('c_general', 'u_hr', d(1, 14, 22), '🍱 다음 주 팀 회식 메뉴 투표해주세요! 금요일 오전까지 받을게요', {
  kind: 'poll',
  meta: { question: '다음 주 팀 회식 메뉴는?', options: [
    { id: 'o1', label: '한우 오마카세 🥩', voterIds: ['u_ceo', 'u_sales', 'u_mkt', 'u_cto'] },
    { id: 'o2', label: '삼겹살 & 소주 🐷', voterIds: ['u_be', 'u_devops', 'u_fe', 'u_pm', 'u_ml'] },
    { id: 'o3', label: '이탈리안 🍝', voterIds: ['u_design', 'u_design2'] },
    { id: 'o4', label: '베트남 쌀국수 🍜', voterIds: ['u_global'] },
  ] } satisfies PollMeta as unknown as Record<string, unknown>,
})
msg('c_general', 'u_hr', ago(95), '@here 오늘 오후 4시 **Q4 킥오프 타운홀** 리마인드 드립니다! 라운지 & Google Meet 동시 진행 📺', { rx: { '👀': ['u_fe', 'u_design', 'u_pm'], '✅': ['u_me', 'u_cto'] } })
msg('c_general', 'u_ceo', ago(30), '타운홀 자료 미리 공유드립니다. 질문은 이 스레드에 남겨주세요 🙌', { attachments: [file('Q4_Kickoff_Townhall.pdf', 8_420_000, 'application/pdf')], rx: { '🙌': ['u_hr', 'u_mkt'] } })

/* #random */
const rLunch = msg('c_random', 'u_design', d(4, 12, 10), '오늘 점심 성수 새로 생긴 텐동집 가실 분? 🍤')
reply(rLunch, 'u_design2', d(4, 12, 11), '저요!!')
reply(rLunch, 'u_pm', d(4, 12, 12), '저도 껴주세요 🙋')
reply(rLunch, 'u_me', d(4, 12, 14), '12:20에 1층에서 봐요')
msg('c_random', 'u_ml', d(4, 15, 40), '오후의 커피 ☕ 내려왔습니다. 에티오피아 예가체프에요. 탕비실로 오세요~', { attachments: [img('pour-over.jpg', 'from-amber-500 via-orange-700 to-stone-900', 1.5)], rx: { '☕': ['u_me', 'u_cto', 'u_design', 'u_pm', 'u_hr'], '😍': ['u_design2', 'u_mkt', 'u_fe'] } })
msg('c_random', 'u_fe', d(3, 18, 30), '퇴근길 하늘 미쳤네요 🌇', { attachments: [img('sunset-hangang.jpg', 'from-fuchsia-500 via-orange-400 to-amber-200', 1.78)], rx: { '😍': ['u_me', 'u_design', 'u_design2', 'u_hr', 'u_mkt', 'u_ml', 'u_pm'] } })
msg('c_random', 'u_mkt', d(2, 11, 0), '혹시 사무실에 우산 두고 가신 분 계신가요? 검은색 장우산 하나 주인 찾아요 ☂️')
msg('c_random', 'u_be', d(2, 11, 4), '제 거 같아요 ㅋㅋ 재택이라 다음 주에 가져갈게요', { rx: { '😂': ['u_mkt', 'u_fe'] } })
msg('c_random', 'u_sales', d(1, 20, 15), '부산 출장 와서 돼지국밥 먹는 중인데 이건 진짜 리스펙입니다 🐷🍲', { attachments: [img('gukbap.jpg', 'from-yellow-200 via-amber-400 to-orange-700', 1.33)], rx: { '🤤': ['u_be', 'u_devops', 'u_pm', 'u_me'] } })
const rWeekend = msg('c_random', 'u_design2', ago(150), '주말에 다들 뭐하세요? 저는 북한산 갑니다 ⛰️')
reply(rWeekend, 'u_devops', ago(146), '가을 산 최고죠 🍁 백운대 코스 추천드려요')
reply(rWeekend, 'u_hr', ago(140), '사진 꼭 #random 에 올려주세요!')
msg('c_random', 'u_global', ago(70), 'Good morning from SF 🌉 (well, good night for you!) 굿나잇~', { rx: { '🌙': ['u_sales', 'u_hr'] } })
msg('c_random', 'u_pm', ago(12), '¯\\\\_(ツ)_/¯ 스프린트 플래닝 또 한 시간 연장...', { rx: { '😂': ['u_fe', 'u_be', 'u_design'] } })

/* #engineering */
const eArch = msg('c_engineering', 'u_cto', d(4, 10, 5), '이번 주 아키텍처 리뷰 안건 정리했습니다.\n1. 이벤트 버스 Kafka → Redpanda 마이그레이션 검토\n2. 실시간 협업 레이어 CRDT 도입\n3. 프론트엔드 번들 사이즈 30% 감축', { pinned: true, rx: { '👀': ['u_fe', 'u_be', 'u_devops', 'u_ml'] } })
reply(eArch, 'u_be', d(4, 10, 20), '1번은 벤치마크 결과 다음 주까지 공유드릴게요. p99 레이턴시 기준으로 비교할 예정입니다.')
reply(eArch, 'u_fe', d(4, 10, 32), '3번은 route-level code splitting 이랑 아이콘 tree-shaking 부터 볼게요 ✂️')
reply(eArch, 'u_devops', d(4, 11, 0), 'Redpanda 쪽 Terraform 모듈 미리 준비해둘게요 🛠')
msg('c_engineering', 'u_bot', d(4, 14, 30), '🔀 새 Pull Request가 열렸습니다', bot({ card: 'pr', repo: 'aurora/nexus-web', number: 482, title: 'feat: 디자인 토큰 v3 적용', branch: 'feat/tokens-v3', additions: 1240, deletions: 388, status: 'review', authorId: 'u_fe', checks: 'passing' }))
msg('c_engineering', 'u_fe', d(4, 14, 45), '@김하늘 @한소희 토큰 v3 PR 올렸습니다! 컬러 시맨틱 네이밍 위주로 봐주시면 돼요 🙏')
const eRetry = msg('c_engineering', 'u_be', d(3, 11, 20), '결제 웹훅 재시도 로직 이렇게 바꾸려고 하는데 의견 주세요\n```kotlin\nsuspend fun retryWebhook(event: WebhookEvent) {\n    val backoff = ExponentialBackoff(base = 500.ms, max = 30.s)\n    repeat(5) { attempt ->\n        runCatching { client.post(event) }\n            .onSuccess { return }\n            .onFailure { delay(backoff.next(attempt)) }\n    }\n    deadLetterQueue.publish(event) // 5회 실패 시 DLQ\n}\n```', { rx: { '👍': ['u_cto', 'u_devops'] } })
reply(eRetry, 'u_cto', d(3, 11, 34), 'jitter 추가하는 거 추천해요. thundering herd 방지 차원에서요')
reply(eRetry, 'u_be', d(3, 11, 40), '넵 `fullJitter` 적용하겠습니다 👍')
reply(eRetry, 'u_ml', d(3, 12, 2), 'DLQ 적재량도 대시보드에 붙여주시면 좋겠어요 📊')
msg('c_engineering', 'u_bot', d(3, 16, 0), '🚀 프로덕션 배포가 완료되었습니다', bot({ card: 'deploy', service: 'api-gateway', env: 'production', version: 'v2.14.0', status: 'success', durationSec: 312, commit: 'a8f3c21' }))
msg('c_engineering', 'u_devops', d(2, 10, 15), '> 금요일 오후 배포 금지 🙅\n농담 아니고 이번 주부터 진짜로 적용합니다. 배포 프리즈: **금 15:00 ~ 월 10:00**', { pinned: true, rx: { '😂': ['u_fe', 'u_be', 'u_ml', 'u_pm', 'u_me', 'u_design'], '✅': ['u_cto', 'u_be', 'u_fe', 'u_ml'] } })
const eModel = msg('c_engineering', 'u_ml', d(2, 13, 40), '추천 모델 v4 오프라인 평가 결과 공유합니다 📈\n- NDCG@10: 0.412 → **0.468** (+13.6%)\n- 추론 레이턴시 p95: 42ms\n다음 주 A/B 테스트 들어갈 예정이에요', { attachments: [file('eval_report_v4.pdf', 2_310_000, 'application/pdf')], rx: { '🔥': ['u_me', 'u_cto', 'u_fe', 'u_be', 'u_pm'], '🚀': ['u_devops', 'u_design', 'u_pm'] } })
reply(eModel, 'u_me', d(2, 13, 52), '와 대박 👏 A/B 테스트 설계는 @서현우 님이랑 같이 보면 좋을 것 같아요')
reply(eModel, 'u_pm', d(2, 14, 5), '넵 가드레일 지표 정리해서 공유드릴게요')
reply(eModel, 'u_ml', d(2, 14, 9), '감사합니다 🙇‍♀️')
msg('c_engineering', 'u_fe', d(1, 10, 30), '`useSyncExternalStore` 로 바꾸고 나서 리렌더 횟수 70% 줄었습니다 ⚡ 프로파일러 비교 첨부해요', { attachments: [img('react-profiler.png', 'from-violet-600 via-indigo-700 to-slate-900', 1.9)], rx: { '⚡': ['u_cto', 'u_be', 'u_me', 'u_ml'] } })
msg('c_engineering', 'u_cto', d(1, 15, 0), '허들', { kind: 'huddle', meta: { startedAt: d(1, 15, 0), endedAt: d(1, 15, 24), participantIds: ['u_cto', 'u_fe', 'u_be', 'u_devops'], durationSec: 1420 } satisfies HuddleMeta as unknown as Record<string, unknown> })
msg('c_engineering', 'u_bot', d(1, 17, 50), '✅ Pull Request가 머지되었습니다', bot({ card: 'pr', repo: 'aurora/nexus-web', number: 479, title: 'fix: 메신저 스크롤 점프 버그 수정', branch: 'fix/scroll-jump', additions: 86, deletions: 41, status: 'merged', authorId: 'u_fe', checks: 'passing' }))
msg('c_engineering', 'u_cto', ago(180), '오늘 오후 2시 **장애 대응 훈련(Game Day)** 진행합니다 🧯 참여자: @윤태현 @정민호 @최지우', { rx: { '🫡': ['u_devops', 'u_be', 'u_fe'] } })
msg('c_engineering', 'u_be', ago(20), '스테이징 DB 마이그레이션 완료했습니다. 이상 없으면 내일 프로덕션 반영할게요 🗄️')
msg('c_engineering', 'u_fe', ago(6), '@김하늘 디자인 토큰 PR 리뷰 부탁드려요 🙏 오늘 머지 목표입니다!')

/* #design */
const dsOnb = msg('c_design', 'u_design', d(4, 11, 0), '온보딩 플로우 v2 시안 공유드립니다 ✨\n피그마: https://figma.com/file/aurora-onboarding-v2', { attachments: [img('onboarding-v2.png', 'from-violet-500 via-fuchsia-500 to-pink-400', 1.6), file('onboarding-flow.fig', 14_200_000, 'application/figma')], rx: { '😍': ['u_me', 'u_fe', 'u_design2', 'u_pm'], '👏': ['u_mkt', 'u_me', 'u_fe'] } })
reply(dsOnb, 'u_me', d(4, 11, 20), '3번째 스텝 일러스트 너무 좋네요! 스킵 버튼 위치만 조금 고민해봐요')
reply(dsOnb, 'u_design', d(4, 11, 26), '넵 우측 상단으로 옮긴 버전도 만들어볼게요')
reply(dsOnb, 'u_design2', d(4, 13, 2), '사용성 테스트 때 스킵률도 같이 체크하겠습니다 📝')
msg('c_design', 'u_design2', d(3, 15, 20), '사용성 테스트 5명 완료 🎯 주요 인사이트:\n> 사용자 4/5명이 \'워크스페이스 초대\' 단계에서 망설임\n> 템플릿 선택 화면은 모두 긍정적\n자세한 리포트는 문서에 정리 중이에요', { rx: { '💡': ['u_me', 'u_design', 'u_pm', 'u_fe'] } })
const dsToken = msg('c_design', 'u_fe', d(2, 10, 0), '디자인 토큰 네이밍 질문! `color.bg.surface.raised` vs `surface-raised` 어느 쪽이 좋을까요?')
reply(dsToken, 'u_design', d(2, 10, 8), '전자요! 계층형이 확장성이 좋아서요')
reply(dsToken, 'u_me', d(2, 10, 15), '동의합니다. 다크모드 매핑할 때도 계층형이 훨씬 편해요')
reply(dsToken, 'u_fe', d(2, 10, 18), '그럼 계층형으로 갑니다 ✅', { rx: { '🙌': ['u_design', 'u_me'] } })
msg('c_design', 'u_design', d(1, 16, 30), '다크모드 컬러 팔레트 최종안입니다 🌙', { attachments: [img('dark-palette.png', 'from-slate-900 via-indigo-900 to-violet-700', 1.78)], rx: { '🌙': ['u_me', 'u_fe', 'u_design2'], '🔥': ['u_mkt', 'u_pm'] } })
msg('c_design', 'u_mkt', ago(65), '런칭 랜딩페이지 히어로 섹션 시안 언제쯤 받을 수 있을까요? 다음 주 화요일까지면 좋겠어요 🙏')
msg('c_design', 'u_design', ago(40), '@임채원 월요일 오후까지 1차 드릴게요! 무드보드 먼저 공유드립니다', { attachments: [img('moodboard.png', 'from-cyan-400 via-sky-500 to-indigo-600', 1.4)] })

/* #product */
const pRoad = msg('c_product', 'u_me', d(4, 9, 30), '📋 **Q4 제품 로드맵 초안** 공유드립니다. 주요 테마:\n1. 실시간 협업 (멀티 커서, 인라인 코멘트)\n2. AI 어시스턴트 고도화\n3. 엔터프라이즈 SSO / 감사 로그\n피드백은 금요일까지 부탁드려요!', { pinned: true, attachments: [file('Q4_Roadmap_v1.pdf', 3_870_000, 'application/pdf')], rx: { '👀': ['u_pm', 'u_cto', 'u_fe', 'u_be', 'u_design', 'u_ceo'], '🙌': ['u_mkt', 'u_design2'] } })
reply(pRoad, 'u_ceo', d(4, 10, 2), '엔터프라이즈 쪽 우선순위 올리는 거 찬성합니다. 대형 고객 3곳이 SSO 요청 중이에요')
reply(pRoad, 'u_cto', d(4, 10, 40), 'CRDT 작업 일정 고려하면 실시간 협업은 11월 중순 베타가 현실적입니다')
reply(pRoad, 'u_pm', d(4, 11, 5), '에픽 단위로 프로젝트에 쪼개두겠습니다 📌')
reply(pRoad, 'u_me', d(4, 11, 30), '좋아요, 다음 주 월요일 싱크에서 확정해요 🙆')
msg('c_product', 'u_pm', d(3, 14, 0), '지난 스프린트 회고 결과 공유합니다\n**잘한 점** 👍 배포 자동화, 코드 리뷰 속도\n**아쉬운 점** 🤔 스펙 변경이 잦았음\n**액션 아이템** 스펙 프리즈 D-3 도입', { rx: { '💯': ['u_me', 'u_fe', 'u_be'] } })
msg('c_product', 'u_pm', d(3, 14, 5), '태스크를 만들었습니다', { kind: 'task', meta: { title: '스펙 프리즈 프로세스 문서화', done: false, assigneeId: 'u_pm', due: daysFromNow(3, 18), key: 'NX-151' } satisfies TaskMeta as unknown as Record<string, unknown> })
msg('c_product', 'u_design2', d(2, 15, 30), 'NPS 서베이 결과 나왔습니다 📊 **NPS 47 → 54** (+7)\n가장 많이 언급된 키워드는 _"빠르다"_, _"예쁘다"_ 였어요', { rx: { '🎉': ['u_me', 'u_pm', 'u_ceo', 'u_design', 'u_mkt'] } })
const pAi = msg('c_product', 'u_ml', d(1, 11, 0), 'AI 어시스턴트 프롬프트 개선 버전 내부 테스트 해보실 분? 🙋‍♀️ 스레드에 댓글 주세요')
reply(pAi, 'u_me', d(1, 11, 3), '저요!')
reply(pAi, 'u_fe', d(1, 11, 5), '저도요 🙌')
reply(pAi, 'u_design', d(1, 11, 20), '저도 참여할게요 ✋')
msg('c_product', 'u_pm', d(1, 15, 0), '로드맵 확정 미팅 일정 잡았습니다 🗓', { kind: 'event', meta: { title: 'Q4 로드맵 확정 미팅', start: daysFromNow(3, 14), end: daysFromNow(3, 15), location: '회의실 Orion · Google Meet', attendeeIds: ['u_me', 'u_pm', 'u_cto', 'u_ceo', 'u_design'] } satisfies EventMeta as unknown as Record<string, unknown> })
msg('c_product', 'u_pm', ago(120), '다음 분기 첫 번째로 집중할 테마 투표 부탁드립니다 🗳', {
  kind: 'poll',
  meta: { question: 'Q4 첫 번째 집중 테마는?', options: [
    { id: 'o1', label: 'AI 어시스턴트', voterIds: ['u_ml', 'u_cto', 'u_fe'] },
    { id: 'o2', label: '실시간 협업', voterIds: ['u_design', 'u_design2'] },
    { id: 'o3', label: '엔터프라이즈 SSO', voterIds: ['u_ceo', 'u_be', 'u_mkt'] },
    { id: 'o4', label: '모바일 앱', voterIds: [] },
  ] } satisfies PollMeta as unknown as Record<string, unknown>,
})

/* #marketing */
msg('c_marketing', 'u_mkt', d(4, 10, 20), '10월 캠페인 KPI 정리했습니다 🎯\n- 신규 가입: 4,000명\n- 웨비나 참석: 600명\n- 콘텐츠 MQL: 350건', { pinned: true })
msg('c_marketing', 'u_global', d(3, 13, 10), 'The partner webinar with Notion got confirmed for Oct 21 🎉 영어 세션은 제가 진행할게요!', { rx: { '🎉': ['u_mkt', 'u_me', 'u_sales', 'u_ceo'] } })
msg('c_marketing', 'u_sales', d(2, 16, 45), '케이스 스터디 인터뷰 고객사 2곳 섭외 완료했습니다 ✍️')
const mkPr = msg('c_marketing', 'u_mkt', d(1, 10, 10), '프레스 릴리즈 초안입니다. 검토 부탁드려요 @김하늘 @박서준', { attachments: [file('Press_Release_Draft.docx', 284_000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')] })
reply(mkPr, 'u_ceo', d(1, 11, 0), '숫자는 확정된 것만 넣읍시다')
reply(mkPr, 'u_me', d(1, 11, 40), '제품 기능 설명 부분 수정 제안 남겼어요 ✏️', { rx: { '🙏': ['u_mkt'] } })
msg('c_marketing', 'u_design', ago(200), 'SNS 배너 3종 업로드했어요 🖼', { attachments: [img('banner-instagram.png', 'from-pink-500 via-rose-500 to-orange-400', 1), img('banner-linkedin.png', 'from-sky-500 via-blue-600 to-indigo-700', 1.9), img('banner-x.png', 'from-zinc-800 via-slate-700 to-violet-600', 1.9)], rx: { '😍': ['u_mkt', 'u_global'] } })

/* #sales-wins */
const sWin = msg('c_sales', 'u_sales', d(3, 17, 0), '🏆 **한빛제약** 엔터프라이즈 계약 체결! 연 1.2억 규모입니다 🎉', { rx: { '🎉': ['u_me', 'u_ceo', 'u_mkt', 'u_global'], '🔥': ['u_ceo', 'u_mkt'], '🍾': ['u_global', 'u_me'] } })
reply(sWin, 'u_ceo', d(3, 17, 10), '역대급입니다 👏👏')
reply(sWin, 'u_mkt', d(3, 17, 22), '케이스 스터디 바로 진행하시죠!')
const sUs = msg('c_sales', 'u_global', d(1, 18, 30), 'Closed **Brightwave Inc.** — our first US customer 🇺🇸🎉', { rx: { '🎉': ['u_me', 'u_ceo', 'u_sales', 'u_mkt'], '🇺🇸': ['u_sales', 'u_ceo'] } })
reply(sUs, 'u_sales', d(1, 18, 40), 'Emily 최고 👏')
reply(sUs, 'u_ceo', d(1, 19, 5), 'Huge milestone! 🚀')
msg('c_sales', 'u_sales', ago(100), '📈 9월 세일즈 리포트: 신규 계약 14건, 갱신률 96%', { attachments: [file('Sales_Report_Sep.xlsx', 512_000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')] })

/* #incidents */
const iPay = msg('c_incidents', 'u_bot', d(3, 2, 14), '🚨 장애가 감지되었습니다', bot({ card: 'incident', severity: 'SEV2', title: '결제 API 응답 지연 (p99 > 3s)', service: 'payments-api', status: 'resolved', ownerId: 'u_be' }))
reply(iPay, 'u_be', d(3, 2, 40), '원인 파악: 커넥션 풀 고갈. 풀 사이즈 상향 + 슬로우 쿼리 인덱스 추가했습니다')
reply(iPay, 'u_devops', d(3, 2, 55), 'Grafana 알람 임계값도 조정했어요')
reply(iPay, 'u_cto', d(3, 8, 30), '새벽에 고생 많았어요. 포스트모템 금요일까지 부탁해요 📝')
msg('c_incidents', 'u_be', d(3, 9, 10), '포스트모템 문서 작성 완료: 타임라인, 근본 원인, 재발 방지 액션 아이템 5개 정리했습니다', { attachments: [file('postmortem-payments-api.pdf', 1_140_000, 'application/pdf')], rx: { '🙏': ['u_cto', 'u_devops', 'u_me'] } })
msg('c_incidents', 'u_bot', d(1, 13, 0), '배포에 실패했습니다', bot({ card: 'deploy', service: 'web-app', env: 'staging', version: 'v3.8.0-rc.2', status: 'failed', durationSec: 187, commit: 'f41b9e0' }))
msg('c_incidents', 'u_devops', d(1, 13, 12), 'e2e 테스트 flaky 이슈였습니다. 재시도 후 정상 배포 완료 ✅')
msg('c_incidents', 'u_bot', d(1, 13, 15), '스테이징 배포가 완료되었습니다', bot({ card: 'deploy', service: 'web-app', env: 'staging', version: 'v3.8.0-rc.2', status: 'success', durationSec: 204, commit: 'f41b9e0' }))
msg('c_incidents', 'u_bot', ago(35), '⚠️ 새로운 알림이 발생했습니다', bot({ card: 'incident', severity: 'SEV3', title: '검색 인덱싱 지연 (약 5분)', service: 'search-indexer', status: 'investigating', ownerId: 'u_devops' }))
msg('c_incidents', 'u_devops', ago(28), '확인 중입니다. 인덱서 워커 한 대가 OOM으로 재시작 루프 돌고 있네요 👀 메모리 리밋 올려서 롤아웃할게요', { rx: { '👀': ['u_be', 'u_cto'] } })

/* #seoul-office */
msg('c_seoul', 'u_hr', d(4, 8, 50), '🏢 이번 주 회의실 Orion 공조기 점검 있습니다 (수 14~16시). 해당 시간 예약은 Nova로 옮겨주세요!')
msg('c_seoul', 'u_hr', d(2, 12, 0), '간식 냉장고 새로 채웠어요 🍫🥤 이번엔 그릭요거트 추가!', { rx: { '😋': ['u_me', 'u_design', 'u_design2', 'u_pm', 'u_ml', 'u_mkt'] } })
msg('c_seoul', 'u_ceo', d(1, 9, 20), '오늘 오후에 투자사 손님 방문 예정이니 라운지 정리 부탁드려요 🙏')
msg('c_seoul', 'u_hr', ago(55), '@here 오늘 6시 1층 라운지에서 웰컴 피자 파티 🍕 Emily 환영회 겸해서요!', { rx: { '🍕': ['u_design', 'u_design2', 'u_ml', 'u_pm', 'u_mkt', 'u_cto', 'u_ceo'] } })

/* #leadership */
const lHire = msg('c_leadership', 'u_ceo', d(3, 19, 0), 'Q4 채용 계획 논의 필요합니다. 엔지니어 4, 디자이너 1, 세일즈 2 생각 중인데 의견 주세요')
reply(lHire, 'u_cto', d(3, 19, 20), '엔지니어 중 1명은 SRE로 뽑고 싶습니다')
reply(lHire, 'u_hr', d(3, 19, 45), '채용 브랜딩 캠페인 같이 준비할게요 🌱')
reply(lHire, 'u_me', d(3, 20, 10), 'PM 1명 추가도 검토 부탁드려요. 엔터프라이즈 트랙 전담이요')
msg('c_leadership', 'u_ceo', d(1, 16, 0), '이사회 자료 초안 올렸습니다. 월요일까지 각자 파트 업데이트 부탁드립니다', { attachments: [file('Board_Deck_Q3.pptx', 18_600_000, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')] })
msg('c_leadership', 'u_ceo', ago(15), '@김하늘 오늘 타운홀 전에 10분만 얘기할 수 있을까요?')

/* DMs */
msg('d_fe', 'u_fe', d(2, 21, 0), '하늘님 혹시 내일 오전에 잠깐 페어링 가능하실까요? 메신저 스레드 UX 고민이 있어서요')
msg('d_fe', 'u_me', d(2, 21, 12), '네 10시 어때요?')
msg('d_fe', 'u_fe', d(2, 21, 13), '좋아요 👍', { rx: { '🙌': ['u_me'] } })
msg('d_fe', 'u_fe', ago(8), '토큰 PR에 스크린샷 첨부해뒀어요! 시간 되실 때 봐주세요 😊', { attachments: [img('tokens-v3-preview.png', 'from-emerald-400 via-teal-500 to-cyan-600', 1.7)] })

msg('d_design', 'u_design', d(1, 17, 0), '하늘님 온보딩 v2 피드백 반영본 올렸어요')
msg('d_design', 'u_me', d(1, 17, 20), '확인했어요! 완전 좋아졌네요 👏')
msg('d_design', 'u_design', d(1, 17, 21), '😊🙏')
msg('d_design', 'u_design', ago(25), '혹시 다음 주 사용성 테스트 참관하실래요? 화요일 오후 2시예요')

msg('d_ceo', 'u_ceo', d(3, 20, 0), '로드맵 초안 잘 봤어요. 엔터프라이즈 쪽 조금 더 공격적으로 가봅시다 💼')
msg('d_ceo', 'u_me', d(3, 20, 15), '넵 반영해서 다시 공유드릴게요')

msg('d_pm', 'u_pm', d(1, 9, 40), '스프린트 23 백로그 정리했습니다. 우선순위 한 번 봐주세요')
msg('d_pm', 'u_me', d(1, 9, 52), '오후에 볼게요!')
msg('d_pm', 'u_pm', d(1, 9, 53), '태스크를 만들었습니다', { kind: 'task', meta: { title: '스프린트 23 우선순위 확정', done: false, assigneeId: 'u_me', due: daysFromNow(0, 18), key: 'NX-158' } satisfies TaskMeta as unknown as Record<string, unknown> })

msg('d_ml', 'u_ml', d(2, 18, 0), 'LLM 비용 리포트 공유드려요. 지난달 대비 22% 절감 💸', { attachments: [file('llm_cost_sep.xlsx', 96_000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')] })
msg('d_ml', 'u_me', d(2, 18, 30), '와 어떻게 줄이셨어요?')
msg('d_ml', 'u_ml', d(2, 18, 33), '시맨틱 캐싱이랑 작은 모델 라우팅이요! 다음 주에 자세히 공유할게요 😎')

msg('g_launch', 'u_mkt', d(2, 14, 0), '런칭 TF 방 만들었어요 🚀 런칭일은 **10월 28일**로 잠정 확정입니다')
msg('g_launch', 'u_pm', d(2, 14, 6), '체크리스트 문서로 만들어둘게요 ✅')
msg('g_launch', 'u_design', d(2, 14, 20), '에셋 리스트업 할게요 🎨')
msg('g_launch', 'u_mkt', ago(18), '런칭 영상 콘티 나왔어요 🎬 다들 한번 봐주세요', { attachments: [file('launch-storyboard.pdf', 6_250_000, 'application/pdf')] })

/* Apps */
msg('a_nexusbot', 'u_bot', d(4, 8, 0), '👋 안녕하세요 김하늘님! 저는 **Nexus Bot**이에요.\n`/remind`, `/poll`, `/task`, `/huddle` 같은 명령어를 메시지 입력창에서 사용해보세요.')
msg('a_nexusbot', 'u_bot', ago(240), '📅 **오늘 일정 요약**\n- 10:00 디자인 리뷰\n- 14:00 Game Day\n- 16:00 Q4 킥오프 타운홀')
msg('a_github', 'u_bot', d(1, 14, 0), '👀 리뷰가 요청되었습니다', bot({ card: 'pr', repo: 'aurora/nexus-web', number: 485, title: 'feat(messenger): 스레드 패널 & 슬래시 커맨드', branch: 'feat/threads', additions: 2104, deletions: 312, status: 'review', authorId: 'u_fe', checks: 'passing' }))
msg('a_github', 'u_bot', ago(50), '✅ Pull Request가 머지되었습니다', bot({ card: 'pr', repo: 'aurora/nexus-web', number: 481, title: 'chore: 번들 사이즈 18% 감축', branch: 'chore/bundle-diet', additions: 204, deletions: 1180, status: 'merged', authorId: 'u_fe', checks: 'passing' }))

export const SEED_MESSAGES: Message[] = M

/** Current user's read cursor per channel — leaves a few channels unread at start. */
export function seedLastRead(): Record<string, string> {
  const now = new Date().toISOString()
  const lr: Record<string, string> = {}
  for (const c of SEED_CHANNELS) lr[c.id] = now
  Object.assign(lr, {
    c_general: ago(60),
    c_engineering: ago(50),
    c_design: ago(90),
    c_incidents: ago(40),
    c_seoul: ago(60),
    c_sales: ago(110),
    c_leadership: ago(20),
    d_fe: ago(30),
    d_design: ago(30),
    g_launch: ago(30),
    a_github: ago(60),
  })
  return lr
}

export const SEED_STARRED = ['c_product', 'c_engineering', 'd_fe']
export const SEED_BOOKMARKS = [pRoad, eRetry, eModel]
