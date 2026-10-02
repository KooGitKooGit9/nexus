import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Minus, Sparkles, Users } from 'lucide-react'
import { BRAND, PLANS, formatKRW, formatStorageGB, yearlySavingPct, yearlySavingPerMember, type PlanInfo } from '@/config/brand'
import type { Cycle } from '@/lib/api'
import { useMe } from '@/lib/workspace'
import { Badge, Tabs } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Faq, type FaqItem } from '../components/Faq'
import { Backdrop } from '../components/Backdrop'
import { DemoButton } from '../components/DemoButton'
import { useReduce } from '../lib'
import { Reveal } from './landing/ui'

const VAT = 0.1
const maxSaving = Math.max(...PLANS.map(yearlySavingPct))

function PlanCard({ p, cycle, loggedIn }: { p: PlanInfo; cycle: Cycle; loggedIn: boolean }) {
  const price = cycle === 'yearly' ? p.yearly : p.monthly
  const pct = yearlySavingPct(p)
  const cta = p.monthly === 0 ? '무료로 시작하기' : `${p.trialDays}일 무료 체험`
  const ctaCls = cn(
    'flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold transition',
    p.highlight ? 'bg-accent-gradient text-white shadow-glow-sm hover:shadow-glow hover:brightness-110' : 'border border-line/15 hover:border-accent/50 hover:bg-accent/5',
  )
  return (
    <div className={cn('relative flex h-full flex-col rounded-3xl p-6 sm:p-7', p.highlight ? 'gradient-border shadow-glow' : 'glass')}>
      {p.highlight && <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-accent-gradient px-2.5 py-1 text-[11px] font-semibold text-white shadow-glow-sm"><Sparkles className="h-3 w-3" />추천</span>}
      <h2 className="font-display text-2xl font-bold">{p.name}</h2>
      <p className="mt-1 text-[13.5px] text-muted">{p.blurb}</p>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-[40px] font-bold leading-none tracking-tight">{formatKRW(price)}</span>
        <span className="text-[13px] text-muted">{p.monthly ? '/ 멤버 · 월' : ''}</span>
      </div>
      <div className="mt-2 min-h-[36px] text-[12px] leading-relaxed text-subtle">
        {p.monthly === 0 ? (
          '기간 제한 없음 · 카드 등록 불필요'
        ) : cycle === 'yearly' ? (
          <>
            12개월 선불 · 멤버당 연 {formatKRW(p.yearly * 12)}
            <br />
            <span className="text-success">월간 결제보다 멤버당 연 {formatKRW(yearlySavingPerMember(p))} 절약 ({pct}%)</span>
          </>
        ) : (
          <>1개월 선불 · 연간 결제 시 멤버당 월 {formatKRW(p.yearly)}</>
        )}
      </div>
      <div className="mt-5">
        {loggedIn ? (
          <a href="/settings/billing" className={ctaCls}>{p.monthly === 0 ? '내 요금제 보기' : '요금제 변경하기'}</a>
        ) : (
          <Link to="/signup" className={ctaCls}>{cta}</Link>
        )}
      </div>
      <ul className="mt-6 space-y-2.5 border-t border-line/[0.08] pt-6">
        {p.features.map((f) => (
          <li key={f.label} className={cn('flex items-start gap-2 text-[13.5px]', f.soon ? 'text-muted' : 'text-fg/85')}>
            <Check className={cn('mt-0.5 h-4 w-4 shrink-0', f.soon ? 'text-subtle' : 'text-accent')} />
            <span>{f.label}</span>
            {f.soon && <Badge className="ml-auto shrink-0">곧 제공</Badge>}
          </li>
        ))}
      </ul>
    </div>
  )
}

type Cell = string | boolean | 'soon'
const ROWS: { group: string; rows: { label: string; v: [Cell, Cell, Cell] }[] }[] = [
  {
    group: '사용량',
    rows: [
      { label: '멤버 수', v: PLANS.map((p) => (p.limits.members === null ? '무제한' : `${p.limits.members}명`)) as [Cell, Cell, Cell] },
      { label: '저장공간 (워크스페이스 전체)', v: PLANS.map((p) => formatStorageGB(p.limits.storageGB)) as [Cell, Cell, Cell] },
      { label: 'Nexus AI 요청 (워크스페이스 · 하루)', v: PLANS.map((p) => `${p.limits.aiPerDay.toLocaleString()}회`) as [Cell, Cell, Cell] },
      { label: '자동화 워크플로우', v: PLANS.map((p) => (p.limits.workflows === null ? '무제한' : `${p.limits.workflows}개`)) as [Cell, Cell, Cell] },
    ],
  },
  {
    group: '기능',
    rows: [
      { label: '메신저 · 허들 · 음성/영상 통화', v: [true, true, true] },
      { label: '프로젝트 (칸반 · 리스트 · 타임라인)', v: [true, true, true] },
      { label: '문서 · 캘린더 · 드라이브 · 화이트보드', v: [true, true, true] },
      { label: '전자결재 · OKR · 공지 · 구성원', v: [true, true, true] },
      { label: '실행하는 AI 비서', v: [true, true, true] },
      { label: '데이터 내보내기 (JSON)', v: [true, true, true] },
    ],
  },
  {
    group: '관리 · 지원',
    rows: [
      { label: '14일 무료 체험', v: [false, true, true] },
      { label: 'SSO (SAML)', v: [false, false, 'soon'] },
      { label: '감사 로그 내보내기', v: [false, false, 'soon'] },
      { label: '전담 지원', v: [false, false, 'soon'] },
    ],
  },
]

function CellView({ c }: { c: Cell }) {
  if (c === true) return <Check className="mx-auto h-4 w-4 text-accent" aria-label="포함" />
  if (c === false) return <Minus className="mx-auto h-4 w-4 text-subtle/60" aria-label="미포함" />
  if (c === 'soon') return <Badge>곧 제공</Badge>
  return <span className="font-medium">{c}</span>
}

function Estimator({ cycle }: { cycle: Cycle }) {
  const [members, setMembers] = useState(12)
  const months = cycle === 'yearly' ? 12 : 1
  return (
    <div className="glass rounded-3xl p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold"><Users className="h-4 w-4 text-accent" />예상 결제 금액 계산</h2>
        <span className="text-[12px] text-subtle">{cycle === 'yearly' ? '연간(12개월) 선불' : '월간(1개월) 선불'} · VAT 10% 포함</span>
      </div>
      <label className="mt-5 block">
        <span className="flex items-center justify-between text-[13px] text-muted">
          멤버 수 <b className="font-display text-xl text-fg">{members}명</b>
        </span>
        <input type="range" min={1} max={200} value={members} onChange={(e) => setMembers(Number(e.target.value))} className="mt-3 w-full accent-accent" aria-label="멤버 수" />
      </label>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {PLANS.filter((p) => p.monthly > 0).map((p) => {
          const unit = cycle === 'yearly' ? p.yearly : p.monthly
          const supply = unit * members * months
          const total = supply + Math.round(supply * VAT)
          return (
            <div key={p.id} className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
              <div className="text-[12.5px] font-semibold text-muted">{p.name}</div>
              <div className="mt-1 font-display text-2xl font-bold">{formatKRW(total)}</div>
              <div className="mt-1 text-[11.5px] text-subtle">{formatKRW(unit)} × {members}명 × {months}개월 + VAT {formatKRW(Math.round(supply * VAT))}</div>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-[12px] text-subtle">결제 금액은 결제 시점의 워크스페이스 멤버 수를 기준으로 계산돼요. 멤버 {PLANS[0].limits.members}명까지는 Free 플랜으로도 충분할 수 있어요.</p>
    </div>
  )
}

const FAQ: FaqItem[] = [
  { q: '결제는 어떤 방식인가요?', a: '카드로 1개월 또는 12개월 이용료를 미리 결제하는 선불 방식이에요(결제 대행: 토스페이먼츠). 자동 갱신이 없어서 직접 연장하지 않는 한 추가 결제는 일어나지 않아요. 표시된 가격은 VAT 별도예요.' },
  { q: '무료 체험은 어떻게 하나요?', a: '설정 → 요금제 & 결제에서 Pro 또는 Business의 14일 무료 체험을 시작할 수 있어요. 체험에는 카드 정보가 필요 없고, 체험이 끝나면 자동으로 Free 플랜으로 돌아가요.' },
  { q: '해지는 어떻게 하나요?', a: '워크스페이스 소유자가 설정 → 요금제 & 결제에서 버튼 한 번으로 해지할 수 있어요. 이미 결제한 기간이 끝날 때까지는 유료 기능을 그대로 쓸 수 있고, 이후 Free 플랜으로 전환돼요.' },
  { q: '환불 정책이 궁금해요.', a: '결제일로부터 7일 이내이고 유료 기능을 사용하지 않았다면 전액 환불해 드려요. 그 이후 해지하면 남은 이용 기간에 해당하는 금액을 일할 계산해 환불해 드려요. 자세한 기준은 이용약관을 따라요.' },
  { q: '데이터를 내보낼 수 있나요?', a: '모든 플랜에서 설정 → 데이터에서 워크스페이스 데이터를 JSON으로 언제든 내보낼 수 있어요. 요금제를 해지하거나 낮춰도 데이터는 삭제되지 않아요. 다만 Free 한도를 넘는 경우 새 업로드 등이 제한될 수 있어요.' },
  { q: 'Free 플랜 한도를 넘으면 어떻게 되나요?', a: '갑자기 데이터가 사라지거나 몰래 과금되지 않아요. 한도에 닿으면 해당 동작(예: 11번째 멤버 초대, AI 요청)만 막히고, 업그레이드 안내가 표시돼요.' },
]

export function PricingPage() {
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const me = useMe()
  const loggedIn = !!me?.account
  const reduce = useReduce()

  return (
    <div className="relative isolate">
      <Backdrop reduce={reduce} intensity={0.8} />
      <section className="px-4 pb-16 pt-12 sm:px-6 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-[36px] font-bold leading-tight tracking-tight break-keep md:text-[52px]">
              팀 규모에 맞춘 <span className="gradient-text">투명한 요금제</span>
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-muted break-keep">멤버 수만큼만 내고, 자동 결제는 없어요. 작게 무료로 시작해 필요할 때 업그레이드하세요.</p>
          </Reveal>

          <div className="mt-9 flex flex-col items-center gap-2">
            <Tabs<Cycle>
              value={cycle}
              onChange={setCycle}
              items={[
                { value: 'monthly', label: '월간 결제' },
                { value: 'yearly', label: <span className="flex items-center gap-1.5">연간 결제 <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-success">최대 {maxSaving}% 절약</span></span> },
              ]}
            />
            <span className="text-[12px] text-subtle">모든 가격은 멤버 1명 · 1개월 기준, <b className="text-muted">VAT 별도</b>예요.</span>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.06}>
                <PlanCard p={p} cycle={cycle} loggedIn={loggedIn} />
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8">
            <Estimator cycle={cycle} />
          </Reveal>

          <Reveal className="mt-16">
            <h2 className="text-center font-display text-3xl font-bold tracking-tight">플랜 상세 비교</h2>
            <div className="mt-8 overflow-x-auto rounded-3xl border border-line/10 bg-surface/50 backdrop-blur">
              <table className="w-full min-w-[560px] text-[13.5px]">
                <caption className="sr-only">요금제별 기능 비교</caption>
                <thead>
                  <tr className="border-b border-line/10">
                    <th scope="col" className="px-5 py-4 text-left font-medium text-muted">항목</th>
                    {PLANS.map((p) => (
                      <th key={p.id} scope="col" className={cn('px-4 py-4 text-center font-display text-[15px] font-bold', p.highlight && 'text-accent')}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line/[0.06]">
                    <th scope="row" className="px-5 py-3 text-left font-normal text-fg/85">멤버당 월 요금 ({cycle === 'yearly' ? '연간 결제' : '월간 결제'})</th>
                    {PLANS.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center font-semibold">{formatKRW(cycle === 'yearly' ? p.yearly : p.monthly)}</td>
                    ))}
                  </tr>
                  {ROWS.map((g) => (
                    <GroupRows key={g.group} group={g.group} rows={g.rows} />
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal className="mx-auto mt-16 max-w-3xl">
            <h2 className="text-center font-display text-3xl font-bold tracking-tight">결제 · 해지 FAQ</h2>
            <Faq items={FAQ} className="mt-8" />
          </Reveal>

          <Reveal className="mt-14 flex flex-col items-center gap-3 text-center">
            <p className="text-[15px] text-muted">결정하기 전에 먼저 둘러보고 싶다면</p>
            <DemoButton />
            <p className="text-[12px] text-subtle">결제 관련 문의: <a className="underline underline-offset-2" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a></p>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

function GroupRows({ group, rows }: { group: string; rows: { label: string; v: [Cell, Cell, Cell] }[] }) {
  return (
    <>
      <tr className="bg-line/[0.03]">
        <th scope="colgroup" colSpan={4} className="px-5 py-2.5 text-left text-[11.5px] font-semibold tracking-wide text-subtle">{group}</th>
      </tr>
      {rows.map((r) => (
        <tr key={r.label} className="border-b border-line/[0.06] last:border-0">
          <th scope="row" className="px-5 py-3 text-left font-normal text-fg/85">{r.label}</th>
          {r.v.map((c, i) => (
            <td key={i} className="px-4 py-3 text-center"><CellView c={c} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}
