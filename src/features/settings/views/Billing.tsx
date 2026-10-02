import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Bot, CalendarClock, Check, CreditCard, Crown, HardDrive, Info, Receipt, RefreshCw, Sparkles, Users, Workflow, type LucideIcon } from 'lucide-react'
import { api, type Billing, type Cycle, type Plan } from '@/lib/api'
import { refreshMe, useWorkspace } from '@/lib/workspace'
import { toast } from '@/store/core'
import { PLANS, formatKRW, planById, yearlySavingPct, type PlanInfo } from '@/config/brand'
import { Badge, Button, Modal, Progress, Skeleton, Tabs } from '@/components/ui'
import { cn, formatBytes, formatDate } from '@/lib/utils'
import { FormAlert } from '@/features/public/components/Fields'
import { errorMessage } from '@/features/public/lib'
import { SettingsSection } from '../components/Section'

/* ───────────────────────── Toss Payments v2 (loaded on demand) ───────────────────────── */

interface TossRequest {
  method: 'CARD'
  amount: { currency: 'KRW'; value: number }
  orderId: string
  orderName: string
  successUrl: string
  failUrl: string
}
type TossFactory = (clientKey: string) => { payment: (o: { customerKey: string }) => { requestPayment: (r: TossRequest) => Promise<unknown> } }

let tossLoading: Promise<TossFactory> | null = null
function loadToss(): Promise<TossFactory> {
  const w = window as unknown as { TossPayments?: TossFactory }
  if (w.TossPayments) return Promise.resolve(w.TossPayments)
  tossLoading ??= new Promise<TossFactory>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.tosspayments.com/v2/standard'
    s.async = true
    s.onload = () => (w.TossPayments ? resolve(w.TossPayments) : reject(new Error('TossPayments SDK missing')))
    s.onerror = () => { tossLoading = null; reject(new Error('결제 모듈을 불러오지 못했어요. 네트워크를 확인해 주세요.')) }
    document.head.appendChild(s)
  })
  return tossLoading
}

/* ───────────────────────── helpers ───────────────────────── */

const daysLeft = (iso?: string) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0)
const RANK: Record<Plan, number> = { free: 0, pro: 1, business: 2 }

function statusLine(b: Billing): string {
  const p = planById(b.plan)
  if (b.status === 'trialing') return `${p.name} 무료 체험 중 · ${daysLeft(b.trialEndsAt)}일 남음 (${b.trialEndsAt ? formatDate(b.trialEndsAt, 'yyyy년 M월 d일') : ''} 종료 후 Free로 전환)`
  if (b.status === 'canceled') return b.renewsAt ? `해지됨 · ${formatDate(b.renewsAt, 'yyyy년 M월 d일')}까지 ${p.name} 기능을 쓸 수 있어요` : '해지됨 · Free 플랜으로 전환돼요'
  if (b.plan === 'free') return '기간 제한 없는 무료 플랜이에요'
  return `${b.cycle === 'yearly' ? '연간(12개월)' : '월간(1개월)'} 선불 · ${b.renewsAt ? `${formatDate(b.renewsAt, 'yyyy년 M월 d일')}까지 이용` : '이용 중'} · 자동 갱신 없음`
}

function Meter({ icon: Icon, label, used, limit, format = (n) => n.toLocaleString(), unit = '' }: { icon: LucideIcon; label: string; used: number; limit: number | null; format?: (n: number) => string; unit?: string }) {
  const pct = limit ? (used / limit) * 100 : 0
  const tone = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'accent'
  return (
    <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
      <div className="flex items-center gap-2 text-[12px] text-muted"><Icon className="h-4 w-4 text-accent" />{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-bold">{format(used)}{unit}</span>
        <span className="text-xs text-subtle">/ {limit === null ? '무제한' : `${format(limit)}${unit}`}</span>
      </div>
      {limit !== null ? <Progress value={Math.max(1.5, pct)} tone={tone} size="sm" className="mt-2.5" /> : <div className="mt-2.5 h-1.5 rounded-full bg-accent-gradient opacity-30" />}
      {limit !== null && pct >= 100 && <div className="mt-1.5 text-[11px] font-medium text-danger">한도에 도달했어요</div>}
    </div>
  )
}

/* ───────────────────────── view ───────────────────────── */

export function BillingSettings() {
  const ws = useWorkspace()
  const offline = ws.id === 'local'
  const isOwner = ws.role === 'owner'
  const canManage = isOwner || ws.role === 'admin'
  const isDemo = ws.kind === 'demo'
  const [billing, setBilling] = useState<Billing | null>(null)
  const [loading, setLoading] = useState(!offline)
  const [error, setError] = useState<string | null>(null)
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [pending, setPending] = useState<Plan | null>(null)
  const [trialFor, setTrialFor] = useState<PlanInfo | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null)
  const [params, setParams] = useSearchParams()
  const handled = useRef(false)

  const load = useCallback(async () => {
    if (offline) return
    setLoading(true)
    setError(null)
    try {
      const b = await api.billing()
      setBilling(b)
      setCycle((c) => (b.plan !== 'free' ? b.cycle : c))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [offline])

  const applyBilling = (b: Billing) => {
    setBilling(b)
    void refreshMe().catch(() => undefined) // plan badge in the sidebar / workspace switcher
  }

  // Return from the Toss payment window: ?toss=success&paymentKey&orderId&amount | ?toss=fail&code&message
  useEffect(() => {
    const toss = params.get('toss')
    if (!toss || handled.current) { void load(); return }
    handled.current = true
    const paymentKey = params.get('paymentKey')
    const orderId = params.get('orderId')
    const amount = Number(params.get('amount'))
    const code = params.get('code')
    const message = params.get('message')
    setParams({}, { replace: true })
    if (toss === 'success' && paymentKey && orderId && Number.isFinite(amount)) {
      setResult({ tone: 'info', text: '결제를 확인하고 있어요…' })
      setLoading(true)
      api
        .confirmPayment({ paymentKey, orderId, amount })
        .then((b) => {
          applyBilling(b)
          setResult({ tone: 'success', text: `결제가 완료됐어요. ${planById(b.plan).name} 플랜을 ${b.renewsAt ? `${formatDate(b.renewsAt, 'yyyy년 M월 d일')}까지` : ''} 이용할 수 있어요.` })
          toast('결제가 완료됐어요', { variant: 'success', emoji: '🎉' })
        })
        .catch((e) => setResult({ tone: 'danger', text: `결제 승인에 실패했어요. ${errorMessage(e)} 카드사 승인이 났다면 자동으로 취소돼요. 문제가 계속되면 문의해 주세요.` }))
        .finally(() => void load())
    } else {
      setResult({ tone: 'danger', text: code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL' ? '결제를 취소했어요. 요금은 청구되지 않았어요.' : `결제를 완료하지 못했어요.${message ? ` (${message})` : ''} 요금은 청구되지 않았어요.` })
      void load()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkout = async (p: PlanInfo) => {
    setPending(p.id)
    setResult(null)
    try {
      const c = await api.checkout(p.id, cycle)
      if (c.provider === 'none') {
        setTrialFor(p)
        return
      }
      const TossPayments = await loadToss()
      const origin = location.origin
      await TossPayments(c.clientKey)
        .payment({ customerKey: c.customerKey })
        .requestPayment({
          method: 'CARD',
          amount: { currency: 'KRW', value: c.amount },
          orderId: c.orderId,
          orderName: c.orderName,
          successUrl: `${origin}/settings/billing?toss=success`,
          failUrl: `${origin}/settings/billing?toss=fail`,
        })
    } catch (e) {
      const code = (e as { code?: string } | null)?.code
      if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') setResult({ tone: 'info', text: '결제를 취소했어요. 요금은 청구되지 않았어요.' })
      else setResult({ tone: 'danger', text: e instanceof Error && !(e as { status?: number }).status && e.message ? e.message : errorMessage(e) })
    } finally {
      setPending(null)
    }
  }

  if (offline) {
    return (
      <SettingsSection title="요금제 & 결제" icon={<CreditCard />} description="오프라인 데모 모드에서는 요금제를 관리할 수 없어요.">
        <p className="text-[13px] text-muted">서버에 연결된 워크스페이스에서 요금제와 사용량을 확인할 수 있어요.</p>
      </SettingsSection>
    )
  }

  const plan = billing ? planById(billing.plan) : null
  const paid = !!billing && billing.plan !== 'free'

  return (
    <>
      {result && <FormAlert tone={result.tone}>{result.text}</FormAlert>}

      {/* plan hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl p-6 text-white shadow-glow sm:p-7">
        <div className="absolute inset-0 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x motion-reduce:animate-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,rgba(255,255,255,0.45),transparent_50%)]" />
        <div className="noise absolute inset-0" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-white/85"><Crown className="h-4 w-4" />현재 플랜 · {ws.name}</div>
            {billing && plan ? (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-display text-4xl font-bold tracking-tight">{plan.name}</span>
                  {billing.status === 'trialing' && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-white/30">체험 D-{daysLeft(billing.trialEndsAt)}</span>}
                  {billing.status === 'canceled' && <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[12px] font-semibold">해지됨</span>}
                </div>
                <div className="mt-1.5 max-w-xl text-[13.5px] text-white/85 break-keep">{statusLine(billing)}</div>
              </>
            ) : (
              <div className="mt-2 h-10 w-40 animate-pulse rounded-xl bg-white/20" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-white/30 bg-white/15 text-white hover:border-white/60 hover:bg-white/25" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={() => void load()} disabled={loading}>
              새로고침
            </Button>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="space-y-2">
          <FormAlert>{error}</FormAlert>
          <Button size="sm" variant="outline" onClick={() => void load()}>다시 시도</Button>
        </div>
      )}

      {/* usage */}
      <SettingsSection title="사용량" description="워크스페이스 전체 기준이에요. AI 사용량은 매일 자정(한국 시간)에 초기화돼요." icon={<HardDrive />} delay={0.05}>
        {billing ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Meter icon={Users} label="멤버" used={billing.usage.members} limit={billing.limits.members} unit="명" />
            <Meter icon={HardDrive} label="저장공간" used={billing.usage.storageBytes} limit={billing.limits.storageBytes} format={formatBytes} />
            <Meter icon={Bot} label="오늘 AI 요청" used={billing.usage.aiToday} limit={billing.limits.aiPerDay} unit="회" />
            {billing.usage.workflows !== undefined && <Meter icon={Workflow} label="자동화 워크플로우" used={billing.usage.workflows} limit={billing.limits.workflows} unit="개" />}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px] rounded-2xl" />)}</div>
        )}
      </SettingsSection>

      {/* plans */}
      <SettingsSection
        title="요금제"
        description="멤버 1명 · 1개월 기준 가격이며 VAT 별도예요. 결제 금액은 현재 멤버 수 × 기간으로 계산돼요."
        icon={<Sparkles />}
        delay={0.1}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Tabs<Cycle>
            size="sm"
            value={cycle}
            onChange={setCycle}
            items={[
              { value: 'monthly', label: '월간 결제' },
              { value: 'yearly', label: `연간 결제 · 최대 ${Math.max(...PLANS.map(yearlySavingPct))}% 절약` },
            ]}
          />
          <span className="text-[11.5px] text-subtle">VAT 별도</span>
        </div>
        {isDemo && <div className="mb-4"><FormAlert tone="info">데모 워크스페이스는 결제 대상이 아니에요. 실제 팀 워크스페이스를 만들면 요금제를 바꿀 수 있어요.</FormAlert></div>}
        {!canManage && !isDemo && <div className="mb-4"><FormAlert tone="info">요금제 변경은 워크스페이스 소유자와 관리자만 할 수 있어요.</FormAlert></div>}
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {PLANS.map((p) => (
            <PlanOption key={p.id} p={p} cycle={cycle} billing={billing} disabled={!canManage || isDemo || !billing} pending={pending} onChoose={() => void checkout(p)} />
          ))}
        </div>
        <p className="mt-4 flex items-start gap-1.5 text-[12px] text-subtle break-keep">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          선불 결제이며 자동 갱신이 없어요. 이용 기간이 끝나기 전에 같은 플랜을 다시 결제하면 기간이 연장돼요. 결제는 토스페이먼츠를 통해 처리되고 카드 정보는 저장하지 않아요.
        </p>
      </SettingsSection>

      {/* cancel */}
      {paid && billing && billing.status !== 'canceled' && !isDemo && (
        <SettingsSection title="요금제 해지" icon={<Receipt />} delay={0.15} description={isOwner ? undefined : '해지는 워크스페이스 소유자만 할 수 있어요.'}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-[13px] leading-relaxed text-muted break-keep">
              {billing.status === 'trialing'
                ? '체험을 끝내면 바로 Free 플랜으로 돌아가요. 결제한 금액이 없으니 청구되는 요금도 없어요.'
                : '해지해도 이미 결제한 기간이 끝날 때까지 지금 플랜을 그대로 쓸 수 있고, 이후 Free 플랜으로 전환돼요. 환불은 이용약관의 환불 기준을 따라요.'}
            </p>
            <Button variant="outline" className="hover:!border-danger/50 hover:!text-danger" disabled={!isOwner} onClick={() => setCancelOpen(true)}>
              {billing.status === 'trialing' ? '체험 종료하기' : '요금제 해지'}
            </Button>
          </div>
        </SettingsSection>
      )}

      <TrialModal
        plan={trialFor}
        billing={billing}
        onClose={() => setTrialFor(null)}
        onStarted={(b) => {
          applyBilling(b)
          setTrialFor(null)
          setResult({ tone: 'success', text: `${planById(b.plan).name} 14일 무료 체험을 시작했어요. ${b.trialEndsAt ? `${formatDate(b.trialEndsAt, 'M월 d일')}까지` : ''} 모든 ${planById(b.plan).name} 기능을 써 보세요.` })
          toast('무료 체험을 시작했어요', { variant: 'success', emoji: '🚀' })
        }}
      />
      {billing && (
        <CancelModal
          open={cancelOpen}
          billing={billing}
          onClose={() => setCancelOpen(false)}
          onDone={(b) => {
            applyBilling(b)
            setCancelOpen(false)
            setResult({ tone: 'info', text: statusLine(b) })
            toast('요금제를 해지했어요')
          }}
        />
      )}
    </>
  )
}

function PlanOption({ p, cycle, billing, disabled, pending, onChoose }: { p: PlanInfo; cycle: Cycle; billing: Billing | null; disabled: boolean; pending: Plan | null; onChoose: () => void }) {
  const current = billing?.plan === p.id
  const price = cycle === 'yearly' ? p.yearly : p.monthly
  let label = '업그레이드'
  let can = !disabled && p.id !== 'free'
  if (billing) {
    if (p.id === 'free') { label = current ? '현재 플랜' : '해지 시 자동 전환'; can = false }
    else if (current && billing.status === 'trialing') label = '지금 결제하기'
    else if (current && billing.status === 'active') label = '이용 기간 연장'
    else if (current && billing.status === 'canceled') label = '다시 결제하기'
    else if (RANK[p.id] < RANK[billing.plan]) label = '이 플랜으로 변경'
  }
  return (
    <div className={cn('relative flex flex-col rounded-2xl border p-5 transition', current ? 'border-accent/50 bg-accent/[0.06] shadow-glow-sm' : 'border-line/10 bg-line/[0.02] hover:border-line/20')}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-lg font-bold">{p.name}</span>
        {current ? <Badge tone="accent" dot>현재</Badge> : p.highlight ? <Badge tone="pink">추천</Badge> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-1">
        <span className="font-display text-2xl font-bold">{formatKRW(price)}</span>
        <span className="whitespace-nowrap text-[12px] text-muted">{p.monthly ? '/ 멤버 · 월' : ''}</span>
      </div>
      <ul className="mt-3 flex-1 space-y-1.5">
        {p.features.map((f) => (
          <li key={f.label} className={cn('flex items-start gap-1.5 text-[12.5px]', f.soon ? 'text-subtle' : 'text-fg/80')}>
            <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', f.soon ? 'text-subtle' : 'text-accent')} />
            <span className="min-w-0 flex-1">{f.label}</span>
            {f.soon && <Badge className="shrink-0">곧 제공</Badge>}
          </li>
        ))}
      </ul>
      <Button className="mt-4 w-full" size="sm" variant={can && !current ? 'primary' : 'outline'} disabled={!can || (pending !== null && pending !== p.id)} loading={pending === p.id} onClick={onChoose}>
        {label}
      </Button>
    </div>
  )
}

function TrialModal({ plan, billing, onClose, onStarted }: { plan: PlanInfo | null; billing: Billing | null; onClose: () => void; onStarted: (b: Billing) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<PlanInfo | null>(plan)
  useEffect(() => { if (plan) { setShown(plan); setError(null) } }, [plan])
  const p = shown
  const alreadyTrialing = billing?.status === 'trialing'
  const start = async () => {
    if (!p) return
    setLoading(true)
    setError(null)
    try {
      onStarted(await api.startTrial(p.id))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }
  return (
    <Modal
      open={!!plan}
      onClose={() => !loading && onClose()}
      size="sm"
      title={<span className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-accent" />온라인 결제 준비 중이에요</span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>닫기</Button>
          {!alreadyTrialing && p?.trialDays && (
            <Button variant="primary" loading={loading} leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => void start()}>
              {p.trialDays}일 무료 체험 시작
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-[13.5px] leading-relaxed text-muted break-keep">
        <p>Nexus 운영자가 결제 대행사(토스페이먼츠) 연동을 마치면 이 화면에서 바로 카드 결제를 할 수 있어요.</p>
        {alreadyTrialing ? (
          <p>지금은 무료 체험 중이에요. 체험이 끝나기 전에 결제가 열리면 다시 시도해 주세요.</p>
        ) : (
          <p>그동안 <b className="text-fg">{p?.name}</b> 플랜을 <b className="text-fg">{p?.trialDays}일 동안 무료로</b> 써 보세요. 카드 등록이 필요 없고, 체험이 끝나면 자동으로 Free 플랜으로 돌아가요. 몰래 결제되는 일은 없어요.</p>
        )}
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Modal>
  )
}

function CancelModal({ open, billing, onClose, onDone }: { open: boolean; billing: Billing; onClose: () => void; onDone: (b: Billing) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const p = planById(billing.plan)
  const trial = billing.status === 'trialing'
  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      onDone(await api.cancelPlan())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      size="sm"
      title={<span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />{trial ? '무료 체험을 끝낼까요?' : `${p.name} 플랜을 해지할까요?`}</span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>유지하기</Button>
          <Button variant="danger" loading={loading} onClick={() => void run()}>{trial ? '체험 종료' : '해지하기'}</Button>
        </>
      }
    >
      <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted break-keep">
        {trial ? (
          <>
            <li>바로 Free 플랜으로 돌아가요. 청구되는 금액은 없어요.</li>
            <li>Free 한도(멤버 10명, 저장공간 5GB, AI 하루 30회)를 넘는 동작은 제한돼요. 데이터는 삭제되지 않아요.</li>
          </>
        ) : (
          <>
            <li>{billing.renewsAt ? `${formatDate(billing.renewsAt, 'yyyy년 M월 d일')}까지` : '결제한 기간이 끝날 때까지'} {p.name} 기능을 그대로 쓸 수 있어요.</li>
            <li>이후 Free 플랜으로 전환되며, 자동 결제는 원래 없어요.</li>
            <li>환불이 필요하면 이용약관의 환불 기준에 따라 문의해 주세요. 데이터는 삭제되지 않아요.</li>
          </>
        )}
      </ul>
      {error && <div className="mt-3"><FormAlert>{error}</FormAlert></div>}
    </Modal>
  )
}
