import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, AtSign, CalendarPlus, Check, CheckCircle2, Cookie, FileText, Globe, Heart, KeyRound, ListChecks, Lock, Megaphone, MessageSquareText,
  Search, Send, ShieldCheck, Sparkles, Stamp, type LucideIcon,
} from 'lucide-react'
import { BRAND, PLANS, formatKRW } from '@/config/brand'
import { cn } from '@/lib/utils'
import { DemoButton } from '../../components/DemoButton'
import { Faq, type FaqItem } from '../../components/Faq'
import { Face, Reveal, Section, TypingDots } from './ui'

/* ───────────────────────── AI ───────────────────────── */

const AI_ACTIONS: { icon: LucideIcon; label: string; detail: string; tone: string }[] = [
  { icon: CalendarPlus, label: '일정 생성', detail: '내일 15:00 · 디자인 리뷰 · 참석자 3명', tone: 'text-accent-2 bg-accent-2/15' },
  { icon: ListChecks, label: '태스크 생성', detail: '시안 피드백 정리 · 담당 박서연 · 금 마감', tone: 'text-info bg-info/15' },
  { icon: Send, label: 'DM 전송', detail: '이도윤님에게 리뷰 일정 안내', tone: 'text-accent bg-accent/15' },
  { icon: Megaphone, label: '공지 게시', detail: '디자인 리뷰 일정 변경 안내', tone: 'text-warning bg-warning/15' },
]

const AI_CAN = [
  { icon: Send, t: 'DM 보내기 · 채널에 메시지 게시' },
  { icon: ListChecks, t: '태스크 만들기 · 상태 바꾸기 · 댓글' },
  { icon: CalendarPlus, t: '일정 잡기 · 빈 시간 찾기 · 참석 응답' },
  { icon: Megaphone, t: '공지 작성' },
  { icon: Stamp, t: '전자결재 상신 · 승인/반려' },
  { icon: FileText, t: '문서 작성 · 이어 쓰기 · 요약' },
  { icon: MessageSquareText, t: '안 읽은 대화 요약' },
  { icon: Search, t: '워크스페이스 전체 검색' },
  { icon: Heart, t: '동료에게 칭찬 보내기' },
]

export function AiSection({ reduce }: { reduce: boolean }) {
  return (
    <Section
      id="ai"
      className="overflow-hidden"
      eyebrow={<><Sparkles />Nexus AI</>}
      title={<>말하면, <span className="gradient-text">실행까지</span> 끝내는 AI 비서</>}
      lead="답변만 하는 챗봇이 아니에요. Nexus AI는 워크스페이스의 도구를 직접 사용해서 DM을 보내고, 태스크와 일정을 만들고, 공지를 올려요. 무엇을 했는지는 결과 카드로 투명하게 보여드려요."
    >
      <div className="mt-14 grid items-start gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Reveal>
          <div className="relative">
            <div aria-hidden className="absolute -inset-4 -z-10 rounded-[36px] bg-accent-gradient opacity-20 blur-3xl" />
            <div className="rounded-3xl border border-line/[0.12] bg-surface/80 p-4 shadow-float backdrop-blur-xl sm:p-5" role="img" aria-label="Nexus AI가 요청을 받아 일정, 태스크, DM, 공지를 처리하는 예시">
              <div aria-hidden>
                <div className="flex items-center gap-2 border-b border-line/[0.08] pb-3 text-[13px] font-semibold">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-gradient text-white"><Sparkles className="h-3.5 w-3.5" /></span>
                  Nexus AI
                  <span className="ml-auto rounded-md bg-line/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-subtle">⌘J</span>
                </div>
                <div className="mt-4 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-gradient px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-glow-sm">
                    내일 오후 3시에 디자인 리뷰 잡아주고, 서연님한테 피드백 정리 태스크 줘. 도윤님한테도 DM으로 알려주고 공지도 올려줘
                  </div>
                </div>
                <div className="mt-4 flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"><Sparkles className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1 space-y-2">
                    {AI_ACTIONS.map((a, i) => (
                      <motion.div
                        key={a.label}
                        initial={reduce ? false : { opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.35, duration: 0.4 }}
                        className="flex items-center gap-2.5 rounded-xl border border-line/10 bg-line/[0.03] px-3 py-2"
                      >
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', a.tone)}><a.icon className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-semibold">{a.label}</span>
                          <span className="block truncate text-[11.5px] text-muted">{a.detail}</span>
                        </span>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      </motion.div>
                    ))}
                    <motion.p
                      initial={reduce ? false : { opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 1.8 }}
                      className="pt-1 text-[13px] leading-relaxed text-fg/85"
                    >
                      모두 처리했어요. 내일 14:50에 리뷰 알림을 보내드릴게요 <span className="inline-block">✨</span>
                    </motion.p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-line/10 bg-surface-2/70 px-3 py-2 text-[12px] text-subtle">
                  무엇이든 부탁해 보세요 <TypingDots className="text-accent" />
                  <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gradient text-white"><ArrowRight className="h-3 w-3" /></span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <h3 className="text-[15px] font-semibold">AI가 직접 할 수 있는 일</h3>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {AI_CAN.map((c) => (
              <li key={c.t} className="flex items-center gap-2.5 rounded-xl border border-line/10 bg-surface/50 px-3 py-2.5 text-[13px] backdrop-blur">
                <c.icon className="h-4 w-4 shrink-0 text-accent" />
                <span className="break-keep">{c.t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl border border-line/10 bg-line/[0.03] p-4 text-[12.5px] leading-relaxed text-muted break-keep">
            <b className="text-fg">투명하게 알려드려요.</b> AI 기능은 Google Gemini API로 처리되며, AI를 사용할 때만 요청 내용과 처리에 필요한 워크스페이스 정보가 전송돼요.
            요금제별로 하루 사용 횟수가 정해져 있어요(Free {PLANS[0].limits.aiPerDay}회 · Pro {PLANS[1].limits.aiPerDay.toLocaleString()}회 · Business {PLANS[2].limits.aiPerDay.toLocaleString()}회).
          </div>
        </Reveal>
      </div>
    </Section>
  )
}

/* ───────────────────────── Security ───────────────────────── */

const SECURITY: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: KeyRound, title: '비밀번호 해시 저장', desc: '비밀번호는 사용자별 솔트를 더한 scrypt 해시로만 저장해요. 원래 비밀번호는 저희도 알 수 없어요.' },
  { icon: Cookie, title: 'httpOnly 세션', desc: '로그인 세션은 자바스크립트가 읽을 수 없는 httpOnly 쿠키로 관리해 탈취 위험을 줄여요.' },
  { icon: Lock, title: '워크스페이스 단위 데이터 격리', desc: '모든 API와 실시간 연결은 멤버십을 확인한 뒤 같은 워크스페이스 안에서만 오가요. 파일도 멤버만 열 수 있어요.' },
  { icon: Globe, title: 'HTTPS 배포 권장', desc: '모든 통신을 HTTPS로 암호화해 제공하는 구성을 기본 배포 방식으로 권장해요.' },
]

export function SecuritySection() {
  return (
    <Section
      id="security"
      eyebrow={<><ShieldCheck />보안</>}
      title={<>회사 데이터는 <span className="gradient-text">기본부터 안전하게</span></>}
      lead="화려한 인증 마크 대신, 실제로 적용된 보호 장치를 그대로 알려드려요."
    >
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECURITY.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.05}>
            <div className="h-full rounded-3xl border border-line/10 bg-surface/50 p-5 backdrop-blur transition hover:border-success/30">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success"><s.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-[15.5px] font-semibold">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted break-keep">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-6 text-center text-[13px] text-muted">
        개인정보를 어떻게 처리하는지는 <Link to="/legal/privacy" className="font-semibold text-fg underline underline-offset-2 hover:text-accent">개인정보처리방침</Link>에서 확인하세요.
      </Reveal>
    </Section>
  )
}

/* ───────────────────────── Pricing teaser ───────────────────────── */

export function PricingTeaser() {
  return (
    <Section
      id="pricing"
      eyebrow={<><AtSign />요금제</>}
      title={<>작게 시작하고, <span className="gradient-text">필요할 때 확장</span>하세요</>}
      lead="숨은 비용 없이 멤버 수만큼만. 유료 플랜은 14일 동안 무료로 체험할 수 있어요."
    >
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLANS.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.06}>
            <div className={cn('relative h-full rounded-3xl p-6', p.highlight ? 'gradient-border shadow-glow' : 'border border-line/10 bg-surface/50 backdrop-blur')}>
              {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-accent-gradient px-2.5 py-1 text-[11px] font-semibold text-white shadow-glow-sm">추천</span>}
              <div className="font-display text-xl font-bold">{p.name}</div>
              <div className="mt-1 text-[13px] text-muted">{p.blurb}</div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold">{p.monthly ? formatKRW(p.yearly) : '₩0'}</span>
                <span className="text-[12.5px] text-muted">{p.monthly ? '/ 멤버 · 월' : '영구 무료'}</span>
              </div>
              <div className="mt-1 h-4 text-[11.5px] text-subtle">{p.monthly ? `연간 결제 기준 · 월간 결제 시 ${formatKRW(p.monthly)}` : ''}</div>
              <ul className="mt-5 space-y-2">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-[13px] text-fg/85"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />{f.label}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-8 flex flex-col items-center gap-2">
        <Link to="/pricing" className="focus-ring inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-semibold text-accent hover:underline">
          요금제 자세히 비교하기 <ArrowRight className="h-4 w-4" />
        </Link>
        <span className="text-[12px] text-subtle">모든 가격은 VAT 별도예요.</span>
      </Reveal>
    </Section>
  )
}

/* ───────────────────────── FAQ & CTA ───────────────────────── */

const FAQ: FaqItem[] = [
  {
    q: '정말 무료로 쓸 수 있나요?',
    a: `네. Free 플랜은 기간 제한 없이 무료예요. 멤버 ${PLANS[0].limits.members}명, 저장공간 ${PLANS[0].limits.storageGB}GB, AI 하루 ${PLANS[0].limits.aiPerDay}회, 자동화 ${PLANS[0].limits.workflows}개까지 쓸 수 있고 카드 등록도 필요 없어요.`,
  },
  {
    q: '데모 체험은 어떻게 동작하나요?',
    a: '로그인 없이 가상의 회사(Aurora Labs) 데이터가 채워진 임시 워크스페이스가 만들어져요. 가상 동료들의 반응은 데모에서만 동작하고, 데모는 24시간 뒤 자동으로 삭제돼요. 마음에 들면 설정에서 계정을 만들어 보관할 수 있어요.',
  },
  {
    q: '우리 회사 데이터는 다른 회사와 분리되나요?',
    a: '네. 모든 요청과 실시간 연결은 워크스페이스 멤버인지 확인한 뒤 해당 워크스페이스 안에서만 처리돼요. 새로 만든 워크스페이스에는 초대한 동료와 Nexus 봇만 있고 가상 인물은 없어요.',
  },
  {
    q: 'AI는 어떤 데이터를 보나요?',
    a: 'AI 기능을 사용할 때만 요청 내용과 처리에 필요한 워크스페이스 정보(예: 일정, 태스크)가 Google Gemini API로 전송돼요. AI를 쓰지 않으면 외부로 전송되지 않아요. 자세한 내용은 개인정보처리방침의 국외 이전 항목을 확인하세요.',
  },
  {
    q: '결제는 어떻게 하나요?',
    a: '카드로 1개월 또는 12개월 이용료를 선불 결제해요(토스페이먼츠). 자동 갱신이 없어서 모르는 사이에 결제되는 일이 없어요. 가격은 VAT 별도이고, 유료 플랜은 14일 무료 체험으로 먼저 써 볼 수 있어요.',
  },
  {
    q: '해지하거나 탈퇴하면 데이터는 어떻게 되나요?',
    a: '요금제 해지와 회원 탈퇴 모두 설정에서 바로 할 수 있어요. 떠나기 전에 워크스페이스 데이터를 JSON으로 내보낼 수 있고, 탈퇴하면 개인정보는 관계 법령에 따라 보관해야 하는 경우를 제외하고 지체 없이 파기해요.',
  },
  {
    q: '모바일에서도 쓸 수 있나요?',
    a: '네, 휴대폰과 태블릿 브라우저에서도 화면에 맞게 동작해요. 전용 모바일 앱은 곧 제공할 예정이에요.',
  },
]

export function LandingFaq() {
  return (
    <Section id="faq" eyebrow={<><MessageSquareText />자주 묻는 질문</>} title="궁금한 점이 있나요?">
      <Reveal className="mx-auto mt-12 max-w-3xl">
        <Faq items={FAQ} />
        <p className="mt-5 text-center text-[13px] text-muted">
          더 궁금한 점은 <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-fg underline underline-offset-2 hover:text-accent">{BRAND.supportEmail}</a>로 물어봐 주세요.
        </p>
      </Reveal>
    </Section>
  )
}

export function FinalCta({ reduce }: { reduce: boolean }) {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative isolate overflow-hidden rounded-[32px] px-6 py-14 text-center text-white shadow-glow sm:px-12 md:py-20">
          <div aria-hidden className={cn('absolute inset-0 -z-10 bg-accent-gradient-3 bg-[length:200%_200%]', !reduce && 'animate-gradient-x motion-reduce:animate-none')} />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_-10%,rgba(255,255,255,0.45),transparent_55%)]" />
          <div aria-hidden className="noise absolute inset-0 -z-10" />
          <div aria-hidden className="mx-auto mb-6 flex w-fit -space-x-2">
            {['김하늘', '이도윤', '박서연', '최민준', '정유나'].map((n) => <Face key={n} name={n} size={36} className="ring-2 ring-white/40" />)}
          </div>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight break-keep md:text-5xl">오늘, 팀의 일하는 방식을 하나로</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/85 break-keep">워크스페이스를 만들고 동료를 초대하는 데 1분이면 충분해요. 먼저 둘러보고 싶다면 데모부터 시작하세요.</p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-start">
            <Link to="/signup" className="focus-ring rounded-2xl">
              <span className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-semibold text-[#1b1035] shadow-float transition hover:bg-white/90 sm:w-auto">
                무료로 시작하기 <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <DemoButton variant="outline" className="w-full border-white/40 bg-white/10 text-white hover:border-white/70 hover:bg-white/20 sm:w-auto" errorClassName="text-white" />
          </div>
        </div>
      </Reveal>
    </section>
  )
}
