import { addDays, endOfDay, startOfDay } from 'date-fns'
import { daysFromNow, hashIndex } from '@/lib/utils'
import { SEED_USERS } from '@/store/seed-users'
import { holidayEvents, isHoliday } from './holidays'
import { roomById } from './constants'
import type { CalEvent, EventType, RsvpStatus } from './types'

/* ───────────── helpers (everything relative to "today" so the demo stays fresh) ───────────── */

const today = () => startOfDay(new Date())
const dayAt = (d: number) => addDays(today(), d)
const isWorkday = (d: number) => {
  const x = dayAt(d)
  return x.getDay() !== 0 && x.getDay() !== 6 && !isHoliday(x)
}
/** shift forward to the next working day */
const wd = (d: number) => {
  let x = d
  while (!isWorkday(x)) x++
  return x
}
const weekday = (d: number) => dayAt(d).getDay() // 0 = Sun

const SLUG = 'abcdefghijkmnopqrstuvwxyz'
const meet = (id: string) => {
  const ch = (i: number) => SLUG[hashIndex(id + i, SLUG.length)]
  return `https://meet.nexus.app/${ch(1)}${ch(2)}${ch(3)}-${ch(4)}${ch(5)}${ch(6)}${ch(7)}`
}

function autoRsvp(id: string, d: number, organizer: string, attendees: string[]): Record<string, RsvpStatus> {
  const r: Record<string, RsvpStatus> = {}
  for (const u of attendees) {
    if (u === organizer) { r[u] = 'yes'; continue }
    const h = hashIndex(id + u, 10)
    if (d < 0) r[u] = h <= 7 ? 'yes' : h === 8 ? 'maybe' : 'no'
    else if (h <= 5) r[u] = 'yes'
    else if (h === 6) r[u] = 'maybe'
    else if (h === 7) r[u] = 'no'
    // else: pending (no response yet)
  }
  return r
}

interface Spec {
  id: string
  title: string
  type?: EventType
  d: number
  h: number
  m?: number
  dur: number
  attendees: string[]
  organizer?: string
  room?: string
  location?: string
  video?: boolean
  desc?: string
  rsvp?: Record<string, RsvpStatus>
  seriesId?: string
  color?: string
}

function mk(s: Spec): CalEvent {
  const organizer = s.organizer ?? 'u_me'
  const attendees = s.attendees.includes(organizer) ? s.attendees : [organizer, ...s.attendees]
  const start = daysFromNow(s.d, s.h, s.m ?? 0)
  const end = new Date(new Date(start).getTime() + s.dur * 60_000).toISOString()
  const room = roomById(s.room)
  return {
    id: s.id,
    title: s.title,
    start,
    end,
    type: s.type ?? 'meeting',
    attendeeIds: attendees,
    organizerId: organizer,
    room: room?.id,
    location: room ? `회의실 ${room.name} (${room.floor})` : s.location,
    videoLink: s.video ? meet(s.id) : undefined,
    description: s.desc,
    rsvp: { ...autoRsvp(s.id, s.d, organizer, attendees), ...s.rsvp },
    seriesId: s.seriesId,
    color: s.color,
  }
}

function allDay(s: Omit<Spec, 'h' | 'm' | 'dur' | 'd'> & { from: number; to: number }): CalEvent {
  const organizer = s.organizer ?? 'u_me'
  const attendees = s.attendees.includes(organizer) ? s.attendees : [organizer, ...s.attendees]
  return {
    id: s.id,
    title: s.title,
    start: startOfDay(dayAt(s.from)).toISOString(),
    end: endOfDay(dayAt(s.to)).toISOString(),
    allDay: true,
    type: s.type ?? 'meeting',
    attendeeIds: attendees,
    organizerId: organizer,
    location: s.location,
    description: s.desc,
    rsvp: { ...autoRsvp(s.id, s.from, organizer, attendees), ...s.rsvp },
    color: s.color,
  }
}

const PRODUCT_TEAM = ['u_me', 'u_pm', 'u_design', 'u_design2', 'u_fe', 'u_be', 'u_ml', 'u_devops']
const ALL = SEED_USERS.map((u) => u.id)

/* ───────────── seed builder ───────────── */

export function buildSeedEvents(): CalEvent[] {
  const ev: CalEvent[] = []
  const FROM = -14
  const TO = 21

  // ── Recurring ──
  for (let d = FROM; d <= TO; d++) {
    if (!isWorkday(d)) continue
    const w = weekday(d)
    ev.push(mk({
      id: `ev_standup_${d}`, seriesId: 'standup', title: '데일리 스탠드업', d, h: 10, dur: 15,
      attendees: ['u_me', 'u_pm', 'u_fe', 'u_be', 'u_design', 'u_ml', 'u_devops'], organizer: 'u_pm', video: true,
      desc: '어제 한 일 · 오늘 할 일 · 블로커 공유 (15분 타임박스) ⏱️',
      rsvp: { u_me: 'yes' },
    }))
    if (w === 1) {
      ev.push(mk({
        id: `ev_sync_${d}`, seriesId: 'product-sync', title: '주간 제품 싱크', d, h: 14, dur: 60,
        attendees: ['u_me', 'u_pm', 'u_design', 'u_fe', 'u_be', 'u_cto'], room: 'orion', video: true,
        desc: '1. 지난주 지표 리뷰 (DAU · 리텐션)\n2. 스프린트 진행 상황\n3. 이번 주 우선순위 & 리스크\n\n📎 아젠다 문서: 문서 & 위키 › 제품 › 주간 싱크',
      }))
    }
    if (w === 2) {
      ev.push(mk({
        id: `ev_11_sohee_${d}`, seriesId: '1on1-sohee', title: '1:1 · 한소희', d, h: 16, dur: 30,
        attendees: ['u_me', 'u_design'], room: 'vega', desc: '커리어 성장 · 최근 프로젝트 피드백 · 고민 나누기 ☕',
      }))
    }
    if ((w === 2 || w === 4) && d >= -7 && d <= 14) {
      ev.push(mk({
        id: `ev_focus_${d}`, seriesId: 'focus', title: '집중 시간 · 방해 금지', type: 'focus', d, h: 13, m: 30, dur: 120,
        attendees: ['u_me'], desc: '슬랙 알림 꺼짐 🔕 급한 건 전화 주세요.',
      }))
    }
    if (w === 4) {
      ev.push(mk({
        id: `ev_11_hyunwoo_${d}`, seriesId: '1on1-hyunwoo', title: '1:1 · 서현우', d, h: 16, m: 30, dur: 30,
        attendees: ['u_me', 'u_pm'], room: 'vega', desc: '스프린트 회고 · 로드맵 우선순위 조율',
      }))
    }
    if (w === 3 && Math.abs(d) % 14 < 7) {
      ev.push(mk({
        id: `ev_11_ceo_${d}`, seriesId: '1on1-ceo', title: '1:1 · 박서준 (CEO)', d, h: 11, dur: 45,
        attendees: ['u_me', 'u_ceo'], organizer: 'u_ceo', location: 'CEO 집무실 (15F)', desc: '제품 전략 · 채용 계획 · 이사회 준비',
      }))
    }
  }

  // ── Today (shown prominently in the demo) ──
  const t0 = wd(0)
  ev.push(
    mk({ id: 'ev_focus_roadmap', title: '집중 시간: Q4 로드맵 문서', type: 'focus', d: t0, h: 8, m: 30, dur: 75, attendees: ['u_me'], desc: 'Q4 로드맵 v2 초안 마무리 ✍️' }),
    mk({
      id: 'ev_design_review_ds', title: '디자인 리뷰: 디자인 시스템 v3', d: t0, h: 14, dur: 60,
      attendees: ['u_me', 'u_design', 'u_fe', 'u_design2'], organizer: 'u_design', room: 'lyra', video: true,
      desc: '컬러 토큰 · 타이포 스케일 · 다크모드 대비 검토\n\n🔗 Figma: Aurora DS v3 / Foundations',
      rsvp: { u_me: 'yes', u_fe: 'yes', u_design2: 'maybe' },
    }),
    mk({
      id: 'ev_security', title: '보안 점검 미팅', d: t0, h: 14, m: 30, dur: 45,
      attendees: ['u_me', 'u_devops', 'u_cto', 'u_be'], organizer: 'u_devops', room: 'vega', video: true,
      desc: 'ISMS 사전 점검 항목 리뷰 · 접근 권한 정리', rsvp: { u_me: undefined as unknown as RsvpStatus },
    }),
    mk({ id: 'ev_lunch_today', title: '점심 · 마케팅팀과', type: 'personal', d: t0, h: 12, dur: 60, attendees: ['u_me', 'u_mkt', 'u_sales'], location: '을지로 평양냉면 🍜' }),
    mk({ id: 'ev_dinner', title: '팀 회식 🍻', type: 'personal', d: t0, h: 19, dur: 120, attendees: ['u_me', 'u_pm', 'u_design', 'u_design2', 'u_fe'], location: '을지로 노가리 골목', desc: '분기 마무리 기념! 1차만 공식 일정입니다 😄' }),
    // teammates only (overlay & team view)
    mk({ id: 'ev_arch', title: '아키텍처 리뷰', d: t0, h: 9, dur: 120, attendees: ['u_cto', 'u_be', 'u_devops'], organizer: 'u_cto', room: 'orion', desc: '이벤트 버스 마이그레이션 설계' }),
    mk({ id: 'ev_pair', title: '페어 프로그래밍: 캘린더 DnD', type: 'focus', d: t0, h: 15, m: 30, dur: 90, attendees: ['u_fe', 'u_be'], organizer: 'u_fe' }),
    mk({ id: 'ev_busan', title: '고객사 방문: 해운대 리조트', d: t0, h: 10, m: 30, dur: 120, attendees: ['u_sales'], organizer: 'u_sales', location: '부산 해운대구' }),
    mk({ id: 'ev_shoot', title: '런칭 캠페인 영상 촬영', d: t0, h: 13, dur: 240, attendees: ['u_mkt', 'u_design2'], organizer: 'u_mkt', location: '성수동 스튜디오' }),
    mk({ id: 'ev_hr_interview', title: '채용 인터뷰: ML 엔지니어', d: t0, h: 11, dur: 60, attendees: ['u_hr', 'u_ml', 'u_cto'], organizer: 'u_hr', room: 'lyra', video: true }),
    mk({ id: 'ev_ceo_board', title: '이사회 사전 미팅', d: t0, h: 16, dur: 90, attendees: ['u_ceo', 'u_cto'], organizer: 'u_ceo', location: 'CEO 집무실 (15F)' }),
  )

  // A meeting starting soon (shows the reminder + "진행 중/곧 시작" states) — only during waking hours
  const now = new Date()
  if (now.getHours() >= 7 && now.getHours() <= 21) {
    const s = new Date(Math.ceil((now.getTime() + 14 * 60_000) / (5 * 60_000)) * 5 * 60_000)
    ev.push({
      id: 'ev_launch_checkin', title: '런칭 준비 체크인', type: 'meeting',
      start: s.toISOString(), end: new Date(s.getTime() + 30 * 60_000).toISOString(),
      attendeeIds: ['u_me', 'u_mkt', 'u_pm', 'u_fe'], organizerId: 'u_pm', videoLink: meet('launch'),
      description: '11월 런칭 D-데이 체크리스트 최종 점검 🚀', rsvp: { u_pm: 'yes', u_me: 'yes', u_mkt: 'yes', u_fe: 'maybe' },
    })
  }

  // ── Past ──
  ev.push(
    mk({ id: 'ev_okr_kickoff', title: 'Q4 OKR 킥오프', d: wd(-13), h: 10, m: 30, dur: 90, attendees: [...PRODUCT_TEAM, 'u_ceo', 'u_cto', 'u_mkt'], room: 'nova', video: true, desc: 'Q4 회사 목표 & 팀별 Key Result 확정 🎯' }),
    mk({ id: 'ev_bank_poc', title: '고객 미팅: 한빛은행 PoC 리뷰', d: wd(-12), h: 15, dur: 90, attendees: ['u_me', 'u_sales', 'u_be'], organizer: 'u_sales', location: '한빛은행 본점 (을지로)', desc: 'PoC 결과 공유 및 본계약 논의' }),
    mk({ id: 'ev_dr_onboarding', title: '디자인 리뷰: 온보딩 v2', d: wd(-10), h: 14, dur: 60, attendees: ['u_me', 'u_design', 'u_design2', 'u_pm'], organizer: 'u_design', room: 'lyra' }),
    mk({ id: 'ev_int_be', title: '채용 인터뷰: 시니어 백엔드', d: wd(-9), h: 11, dur: 60, attendees: ['u_me', 'u_cto', 'u_be', 'u_hr'], organizer: 'u_hr', room: 'vega', video: true }),
    mk({ id: 'ev_townhall_prev', title: '전사 타운홀 (월간)', d: wd(-8), h: 17, dur: 60, attendees: ALL, organizer: 'u_ceo', room: 'nova', video: true, desc: '월간 실적 · 신규 입사자 소개 · Q&A 🙋' }),
    mk({ id: 'ev_retro', title: '스프린트 회고', d: wd(-7), h: 16, dur: 60, attendees: PRODUCT_TEAM, organizer: 'u_pm', room: 'orion', desc: 'Keep · Problem · Try 🧩' }),
    mk({ id: 'ev_ml_review', title: 'ML 모델 성능 리뷰', d: wd(-5), h: 15, dur: 60, attendees: ['u_me', 'u_ml', 'u_cto'], organizer: 'u_ml', room: 'lyra', video: true, desc: '추천 모델 v4 오프라인 지표 · A/B 계획' }),
    mk({ id: 'ev_planning', title: '스프린트 플래닝', d: wd(-3), h: 10, m: 30, dur: 90, attendees: PRODUCT_TEAM, organizer: 'u_pm', room: 'orion', video: true }),
    mk({ id: 'ev_stripe', title: '파트너십 콜: Stripe APAC', d: wd(-1), h: 9, dur: 45, attendees: ['u_me', 'u_global', 'u_sales'], organizer: 'u_global', video: true, desc: '결제 연동 파트너 프로그램 논의 (PST 16:00)' }),
    allDay({ id: 'ev_dl_sept', title: '마감: 9월 월간 리포트', type: 'deadline', from: wd(-6), to: wd(-6), attendees: ['u_me', 'u_pm'] }),
    allDay({ id: 'ev_ooo_devops', title: '윤태현 휴가 🏖️', type: 'ooo', from: -4, to: -2, attendees: ['u_devops'], organizer: 'u_devops', desc: '제주도 가족 여행' }),
  )

  // ── Upcoming ──
  ev.push(
    mk({ id: 'ev_nextcommerce', title: '고객 미팅: 넥스트커머스 데모', d: wd(3), h: 11, dur: 60, attendees: ['u_me', 'u_sales', 'u_fe'], organizer: 'u_sales', room: 'vega', video: true, desc: '엔터프라이즈 플랜 데모 · 보안 요구사항 Q&A 💼' }),
    mk({ id: 'ev_hr_ot', title: '신규 입사자 오리엔테이션', d: wd(3), h: 10, dur: 180, attendees: ['u_hr'], organizer: 'u_hr', room: 'nova' }),
    mk({ id: 'ev_gpu', title: 'GPU 클러스터 점검', type: 'focus', d: wd(2), h: 14, dur: 120, attendees: ['u_ml', 'u_devops'], organizer: 'u_devops' }),
    mk({ id: 'ev_dentist', title: '치과 예약 🦷', type: 'personal', d: wd(4), h: 8, dur: 60, attendees: ['u_me'], location: '을지로 서울치과' }),
    allDay({ id: 'ev_dl_ds', title: '마감: 디자인 시스템 v3 릴리스', type: 'deadline', from: wd(5), to: wd(5), attendees: ['u_me', 'u_design', 'u_fe'], organizer: 'u_design' }),
    mk({ id: 'ev_int_design', title: '채용 인터뷰: 프로덕트 디자이너', d: wd(6), h: 15, dur: 60, attendees: ['u_me', 'u_design', 'u_hr'], organizer: 'u_hr', room: 'lyra', video: true }),
    mk({ id: 'ev_townhall', title: '전사 타운홀 (월간)', d: wd(7), h: 17, dur: 60, attendees: ALL, organizer: 'u_ceo', room: 'nova', video: true, desc: 'Q3 회고 · Q4 방향 · 오프사이트 안내 🌊' }),
    allDay({ id: 'ev_offsite', title: '2026 H2 오프사이트 🌊', type: 'meeting', from: wd(8), to: wd(8) + 1, attendees: ALL, organizer: 'u_ceo', location: '강릉 씨마크 호텔', desc: '하반기 전략 워크숍 · 팀빌딩 · 바베큐 디너\n버스 출발: 오전 8시 본사 앞 🚌' }),
    mk({ id: 'ev_qbr', title: 'QBR 준비 미팅', d: wd(10), h: 13, dur: 90, attendees: ['u_me', 'u_ceo', 'u_sales', 'u_mkt'], organizer: 'u_me', room: 'orion', video: true }),
    allDay({ id: 'ev_dl_roadmap', title: '마감: Q4 로드맵 확정', type: 'deadline', from: wd(11), to: wd(11), attendees: ['u_me'] }),
    allDay({ id: 'ev_ooo_sohee', title: '한소희 연차 🌴', type: 'ooo', from: 12, to: 14, attendees: ['u_design'], organizer: 'u_design', desc: '결재 승인 완료 · 긴급 시 오민지님께 문의' }),
    mk({ id: 'ev_ux_interview', title: '사용자 인터뷰 세션 #4', d: wd(12), h: 13, dur: 120, attendees: ['u_me', 'u_design2'], organizer: 'u_design2', room: 'vega', video: true, desc: '파워 유저 3명 · 캘린더 기능 사용성 테스트 🔍' }),
    mk({ id: 'ev_ir', title: '투자사 IR 미팅', d: wd(14), h: 10, dur: 90, attendees: ['u_me', 'u_ceo'], organizer: 'u_ceo', location: '강남 파이낸스센터 32F', desc: '시리즈 B 후속 논의 · 제품 로드맵 발표' }),
    allDay({ id: 'ev_ooo_emily', title: 'Emily 서울 출장 ✈️', type: 'ooo', from: 15, to: 17, attendees: ['u_global'], organizer: 'u_global' }),
    mk({ id: 'ev_dr_mobile', title: '디자인 리뷰: 모바일 앱', d: wd(16), h: 14, dur: 60, attendees: ['u_me', 'u_design', 'u_fe', 'u_pm'], organizer: 'u_design', room: 'lyra', video: true }),
    mk({ id: 'ev_audit', title: '보안 감사 리허설', d: wd(18), h: 10, dur: 120, attendees: ['u_me', 'u_cto', 'u_devops', 'u_be'], organizer: 'u_cto', room: 'orion' }),
    allDay({ id: 'ev_dl_gtm', title: '마감: 11월 런칭 GTM 플랜', type: 'deadline', from: wd(20), to: wd(20), attendees: ['u_me', 'u_mkt'], organizer: 'u_mkt' }),
    mk({ id: 'ev_yoga', title: '요가 클래스 🧘', type: 'personal', d: wd(1), h: 7, dur: 60, attendees: ['u_me'], location: '을지로 요가원' }),
    mk({ id: 'ev_lunch_cto', title: '점심 · 이도윤', type: 'personal', d: wd(2), h: 12, dur: 60, attendees: ['u_me', 'u_cto'], location: '광화문 스시 오마카세' }),
  )

  // Birthdays within range
  for (const u of SEED_USERS) {
    for (let d = FROM; d <= TO; d++) {
      const x = dayAt(d)
      const md = `${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      if (md === u.birthday && u.id !== 'u_me') {
        ev.push(allDay({ id: `ev_bday_${u.id}`, title: `🎂 ${u.name}님 생일`, type: 'personal', from: d, to: d, attendees: ['u_me', u.id], organizer: u.id, color: '#f472b6' }))
      }
    }
  }

  // Public holidays for this year & next (other years are added virtually by the views)
  const y = new Date().getFullYear()
  ev.push(...holidayEvents([y, y + 1]))

  // strip undefined RSVP entries
  ev.forEach((e) => {
    if (e.rsvp) Object.keys(e.rsvp).forEach((k) => e.rsvp![k] === undefined && delete e.rsvp![k])
  })
  return ev
}
