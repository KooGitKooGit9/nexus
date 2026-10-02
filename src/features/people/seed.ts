import { daysFromNow, minutesAgo } from '@/lib/utils'
import type { ClockState, Kudos, LeaveBalance, LeaveEntry } from './types'
import { dateKey } from './lib'

const today = new Date()
const dow = today.getDay() // 0 Sun … 6 Sat
const nextMon = ((8 - dow) % 7) || 7
const thisFri = (5 - dow + 7) % 7

export const SEED_LEAVES: LeaveEntry[] = [
  { id: 'lv_1', userId: 'u_devops', type: 'annual', start: daysFromNow(0, 0), end: daysFromNow(1, 0), note: '가족 여행 ✈️' },
  { id: 'lv_2', userId: 'u_ml', type: 'half_pm', start: daysFromNow(1, 0), end: daysFromNow(1, 0), note: '병원 예약' },
  { id: 'lv_3', userId: 'u_design', type: 'annual', start: daysFromNow(nextMon + 2, 0), end: daysFromNow(nextMon + 4, 0), note: '제주도 리프레시 🌊' },
  { id: 'lv_4', userId: 'u_hr', type: 'workshop', start: daysFromNow(thisFri === 0 ? 7 : thisFri, 0), end: daysFromNow(thisFri === 0 ? 7 : thisFri, 0), note: 'HR 컨퍼런스 참석' },
  { id: 'lv_5', userId: 'u_mkt', type: 'annual', start: daysFromNow(nextMon + 4, 0), end: daysFromNow(nextMon + 4, 0) },
  { id: 'lv_6', userId: 'u_me', type: 'half_am', start: daysFromNow(nextMon + 1, 0), end: daysFromNow(nextMon + 1, 0), note: '은행 업무' },
  { id: 'lv_7', userId: 'u_global', type: 'annual', start: daysFromNow(nextMon, 0), end: daysFromNow(nextMon + 1, 0), note: 'Family visit' },
  { id: 'lv_8', userId: 'u_be', type: 'sick', start: daysFromNow(-3, 0), end: daysFromNow(-3, 0), note: '감기 몸살' },
]

export const SEED_BALANCE: LeaveBalance = {
  annualTotal: 15,
  annualUsed: 4.5,
  halfTotal: 6,
  halfUsed: 3,
  sickTotal: 10,
  sickUsed: 1,
}

/** Seed: during the work day the current user is already clocked in (08:47) so the live timer runs;
 *  before 08:47 they simply haven't clocked in yet (no fake 1 a.m. sessions); after 19:30 they've left. */
function seedClock(): ClockState {
  const d = new Date()
  const inAt = new Date(d)
  inAt.setHours(8, 47, 12, 0)
  if (inAt.getTime() > d.getTime()) return { date: dateKey(d), sessions: [], mode: 'office' }
  const outAt = new Date(d)
  outAt.setHours(18, 12, 40, 0)
  const late = d.getHours() * 60 + d.getMinutes() >= 19 * 60 + 30
  return { date: dateKey(d), sessions: [{ in: inAt.toISOString(), ...(late ? { out: outAt.toISOString() } : {}) }], mode: 'office' }
}
export const SEED_CLOCK = seedClock()

export const SEED_KUDOS: Kudos[] = [
  { id: 'kd_1', fromId: 'u_me', toId: 'u_fe', badge: 'impact', message: '디자인 시스템 v3 정말 멋져요! 컴포넌트 일관성이 확 올라가서 개발 속도가 체감될 정도예요 ✨', createdAt: minutesAgo(48), reactions: { '🔥': ['u_cto', 'u_design', 'u_pm'], '👏': ['u_be'] } },
  { id: 'kd_2', fromId: 'u_cto', toId: 'u_devops', badge: 'challenge', message: '새벽 장애 대응 정말 고생 많으셨어요. 15분 만에 롤백하고 포스트모템까지 깔끔하게 정리해주셔서 감사합니다 🙇', createdAt: minutesAgo(60 * 5), reactions: { '🙌': ['u_be', 'u_fe', 'u_ml', 'u_me'] } },
  { id: 'kd_3', fromId: 'u_pm', toId: 'u_design2', badge: 'customer', message: '유저 인터뷰 12건 인사이트 리포트 최고였어요. 온보딩 이탈 원인이 한눈에 보였습니다!', createdAt: minutesAgo(60 * 9), reactions: { '💡': ['u_me', 'u_design'] } },
  { id: 'kd_4', fromId: 'u_design', toId: 'u_fe', badge: 'collab', message: '모션 디테일까지 픽셀 단위로 맞춰주셔서 감동… 디자이너가 꿈꾸는 프론트엔드 파트너 👯', createdAt: minutesAgo(60 * 20), reactions: { '💖': ['u_design2', 'u_me'] } },
  { id: 'kd_5', fromId: 'u_ceo', toId: 'u_sales', badge: 'impact', message: '하나금융 PoC 계약 성사 축하합니다! 이번 분기 최대 딜이에요 🎉', createdAt: minutesAgo(60 * 26), reactions: { '🎉': ['u_me', 'u_mkt', 'u_hr', 'u_cto', 'u_global'] } },
  { id: 'kd_6', fromId: 'u_be', toId: 'u_ml', badge: 'growth', message: '추천 모델 서빙 레이턴시 40% 줄인 거 대박이에요. 덕분에 많이 배웠습니다!', createdAt: minutesAgo(60 * 30), reactions: { '🧠': ['u_cto'] } },
  { id: 'kd_7', fromId: 'u_hr', toId: 'u_mkt', badge: 'care', message: '신규 입사자 웰컴 키트 디자인부터 포장까지 직접 챙겨주셔서 감사해요 🎁', createdAt: minutesAgo(60 * 50), reactions: { '💖': ['u_hr', 'u_design'] } },
  { id: 'kd_8', fromId: 'u_fe', toId: 'u_be', badge: 'collab', message: 'API 스키마 변경 미리 공유해주셔서 프론트 작업이 하나도 안 막혔어요. 최고의 짝꿍!', createdAt: minutesAgo(60 * 70), reactions: { '🤝': ['u_cto'] } },
  { id: 'kd_9', fromId: 'u_me', toId: 'u_pm', badge: 'challenge', message: '스프린트 범위 조정 결단 멋졌어요. 덕분에 핵심 기능에 집중할 수 있었습니다 💪', createdAt: minutesAgo(60 * 96), reactions: { '💪': ['u_design', 'u_fe'] } },
  { id: 'kd_10', fromId: 'u_global', toId: 'u_sales', badge: 'collab', message: 'Thanks for jumping on the late-night call with the SF partner team — 감사합니다! 🌉', createdAt: minutesAgo(60 * 120), reactions: { '🌍': ['u_ceo'] } },
  { id: 'kd_11', fromId: 'u_design2', toId: 'u_me', badge: 'growth', message: '리서치 방법론 1:1 코칭 정말 큰 도움이 됐어요. 항상 성장할 수 있게 도와주셔서 감사합니다 🌱', createdAt: minutesAgo(60 * 150), reactions: { '🥹': ['u_design'] } },
  { id: 'kd_12', fromId: 'u_ml', toId: 'u_fe', badge: 'care', message: 'WebGL 데모 디버깅 같이 봐주셔서 감사해요. 밤 늦게까지 함께해주셔서 든든했어요!', createdAt: minutesAgo(60 * 200), reactions: {} },
  { id: 'kd_13', fromId: 'u_mkt', toId: 'u_design', badge: 'impact', message: '런칭 캠페인 키비주얼 반응 폭발적이에요! CTR이 2.3배 올랐습니다 📈', createdAt: minutesAgo(60 * 240), reactions: { '📈': ['u_ceo', 'u_me', 'u_sales'] } },
  { id: 'kd_14', fromId: 'u_cto', toId: 'u_be', badge: 'challenge', message: 'Kafka 마이그레이션 무중단으로 끝낸 것 정말 대단합니다. 팀의 자랑이에요!', createdAt: minutesAgo(60 * 300), reactions: { '🚀': ['u_devops', 'u_fe'] } },
  { id: 'kd_15', fromId: 'u_sales', toId: 'u_me', badge: 'customer', message: '고객 미팅에 직접 와서 로드맵 설명해주신 덕분에 계약이 훨씬 수월했어요 🙏', createdAt: minutesAgo(60 * 340), reactions: { '🙏': ['u_ceo'] } },
]
