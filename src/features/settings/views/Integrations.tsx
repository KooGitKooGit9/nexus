import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Plug, Loader2, CircleCheck, Lock, Sparkles, Unplug, ExternalLink } from 'lucide-react'
import { toast, useCurrentUser } from '@/store/core'
import { Badge, Button, Modal, Tabs } from '@/components/ui'
import { cn, timeAgo } from '@/lib/utils'
import { useSettings } from '../store'
import { SettingsSection } from '../components/Section'

interface Integration {
  id: string
  name: string
  category: string
  description: string
  mono: string
  bg: string
  scopes: string[]
  features: string[]
  account: (email: string) => string
}

const INTEGRATIONS: Integration[] = [
  { id: 'github', name: 'GitHub', category: '개발', description: 'PR · 이슈를 태스크와 연결하고 커밋을 채널로 받아보세요.', mono: 'GH', bg: 'linear-gradient(135deg,#2b3137,#0d1117)', scopes: ['저장소 메타데이터 읽기', 'Pull Request 읽기 · 코멘트', '이슈 생성 및 업데이트'], features: ['PR ↔ 태스크 자동 연결', '#engineering 커밋 알림'], account: () => 'aurora-labs' },
  { id: 'gcal', name: 'Google Calendar', category: '생산성', description: '회사 캘린더와 양방향 동기화하고 회의실을 예약하세요.', mono: '31', bg: 'linear-gradient(135deg,#4285F4,#34A853 60%,#FBBC05)', scopes: ['캘린더 일정 보기 및 편집', '회의실 리소스 읽기'], features: ['양방향 일정 동기화', 'Meet 링크 자동 생성'], account: (e) => e },
  { id: 'figma', name: 'Figma', category: '디자인', description: '디자인 파일 미리보기와 코멘트를 문서와 메신저에서 확인하세요.', mono: 'F', bg: 'linear-gradient(135deg,#F24E1E,#A259FF 55%,#1ABCFE)', scopes: ['파일 및 프로젝트 읽기', '코멘트 읽기'], features: ['링크 라이브 미리보기', '코멘트 알림'], account: () => 'Aurora Design' },
  { id: 'jira', name: 'Jira', category: '개발', description: '기존 Jira 이슈를 Nexus 프로젝트로 가져오고 상태를 동기화하세요.', mono: 'J', bg: 'linear-gradient(135deg,#2684FF,#0052CC)', scopes: ['프로젝트 및 이슈 읽기', '이슈 상태 변경'], features: ['이슈 일괄 가져오기', '상태 양방향 동기화'], account: () => 'aurora.atlassian.net' },
  { id: 'notion', name: 'Notion', category: '문서', description: 'Notion 페이지를 위키로 가져오고 링크를 임베드하세요.', mono: 'N', bg: 'linear-gradient(135deg,#3a3a3a,#0f0f0f)', scopes: ['선택한 페이지 읽기', '데이터베이스 읽기'], features: ['페이지 가져오기', '링크 임베드'], account: () => 'Aurora Labs 워크스페이스' },
  { id: 'zoom', name: 'Zoom', category: '커뮤니케이션', description: '일정에 Zoom 회의를 자동으로 추가하고 녹화본을 받아보세요.', mono: 'Z', bg: 'linear-gradient(135deg,#2D8CFF,#0B5CFF)', scopes: ['회의 생성', '클라우드 녹화 읽기'], features: ['원클릭 회의 생성', '녹화본 자동 공유'], account: (e) => e },
  { id: 'salesforce', name: 'Salesforce', category: '영업', description: '고객 · 딜 정보를 채널과 대시보드에서 바로 확인하세요.', mono: 'SF', bg: 'linear-gradient(135deg,#00A1E0,#1798c1)', scopes: ['계정 및 영업기회 읽기', '활동 기록 생성'], features: ['딜 단계 변경 알림', '고객 카드 미리보기'], account: () => 'aurora.my.salesforce.com' },
]

function Logo({ it, size = 'md' }: { it: Integration; size?: 'md' | 'lg' }) {
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center font-display font-bold text-white shadow-card ring-1 ring-white/10', size === 'lg' ? 'h-16 w-16 rounded-2xl text-xl' : 'h-12 w-12 rounded-xl text-base')}
      style={{ background: it.bg }}
    >
      {it.mono}
    </div>
  )
}

type Filter = 'all' | 'connected' | 'available'

export function IntegrationSettings() {
  const state = useSettings((s) => s.integrations)
  const disconnect = useSettings((s) => s.disconnectIntegration)
  const [filter, setFilter] = useState<Filter>('all')
  const [connecting, setConnecting] = useState<Integration | null>(null)
  const count = INTEGRATIONS.filter((i) => state[i.id]?.connected).length
  const list = INTEGRATIONS.filter((i) => (filter === 'all' ? true : filter === 'connected' ? state[i.id]?.connected : !state[i.id]?.connected))

  return (
    <>
      <SettingsSection
        title="연동"
        description="자주 쓰는 도구를 Nexus에 연결해 하나의 워크스페이스에서 일하세요."
        icon={<Plug />}
        action={<Badge tone="accent" dot>{count}개 연결됨 (데모)</Badge>}
      >
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] px-3.5 py-2.5 text-[12.5px] text-fg/85">
          <span className="mt-px shrink-0 rounded-md bg-warning/20 px-1.5 py-0.5 text-[10.5px] font-bold text-warning">데모 연동</span>
          <span>
            외부 서비스 계정이 없어 실제로 연결되지는 않아요. 연결 과정과 상태는 시연용이며 GitHub · Figma 등의 데이터를 가져오거나 보내지 않아요.
            실제로 외부와 통신하려면 <b>자동화</b>의 <b>HTTP 요청</b> 액션을 사용하세요.
          </span>
        </div>
        <Tabs<Filter>
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: '전체', count: INTEGRATIONS.length },
            { value: 'connected', label: '연결됨', count },
            { value: 'available', label: '사용 가능', count: INTEGRATIONS.length - count },
          ]}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {list.map((it, i) => {
              const st = state[it.id]
              const on = !!st?.connected
              return (
                <motion.div
                  key={it.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.03 } }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={cn('group relative overflow-hidden rounded-2xl border p-4 transition-all', on ? 'border-success/25 bg-success/[0.04]' : 'border-line/10 bg-line/[0.02] hover:border-accent/30 hover:shadow-glow-sm')}
                >
                  <div className="flex items-start gap-3.5">
                    <Logo it={it} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{it.name}</span>
                        <Badge>{it.category}</Badge>
                        <Badge tone="warning">데모 연동</Badge>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-muted">{it.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {it.features.map((f) => <span key={f} className="rounded-md bg-line/[0.05] px-2 py-0.5 text-[11px] text-muted">{f}</span>)}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/[0.07] pt-3">
                    {on ? (
                      <div className="min-w-0 text-[11.5px]">
                        <div className="flex items-center gap-1.5 font-medium text-success"><span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgb(var(--success))]" />연결됨 (데모)</div>
                        <div className="truncate text-subtle">{st.account}{st.connectedAt && ` · ${timeAgo(st.connectedAt)}`}</div>
                      </div>
                    ) : (
                      <span className="text-[11.5px] text-subtle">연결되지 않음</span>
                    )}
                    {on ? (
                      <Button size="sm" variant="ghost" leftIcon={<Unplug className="h-3.5 w-3.5" />} onClick={() => { disconnect(it.id, it.name); toast(`${it.name} 연결을 해제했어요`, { emoji: '🔌' }) }} className="hover:!text-danger">
                        연결 해제
                      </Button>
                    ) : (
                      <Button size="sm" variant="primary" leftIcon={<Plug className="h-3.5 w-3.5" />} onClick={() => setConnecting(it)}>데모 연결</Button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </SettingsSection>
      <OAuthModal it={connecting} onClose={() => setConnecting(null)} />
    </>
  )
}

const AUTH_STEPS = (name: string) => [`${name}(으)로 리디렉션하는 중…`, '권한 승인을 확인하는 중…', '액세스 토큰을 교환하는 중…', '워크스페이스 데이터를 동기화하는 중…']

function OAuthModal({ it, onClose }: { it: Integration | null; onClose: () => void }) {
  const me = useCurrentUser()
  const connect = useSettings((s) => s.connectIntegration)
  const [phase, setPhase] = useState<'consent' | 'auth' | 'done'>('consent')
  const [step, setStep] = useState(0)
  const [last, setLast] = useState<Integration | null>(it)

  useEffect(() => { if (it) { setLast(it); setPhase('consent'); setStep(0) } }, [it])

  const shown = it ?? last
  useEffect(() => {
    if (phase !== 'auth' || !shown) return
    const steps = AUTH_STEPS(shown.name)
    if (step < steps.length) {
      const t = setTimeout(() => setStep((s) => s + 1), 520 + Math.random() * 300)
      return () => clearTimeout(t)
    }
    connect(shown.id, shown.name, shown.account(me.email))
    setPhase('done')
    toast(`${shown.name} 데모 연동 완료`, { variant: 'success', description: '시연용 연결이라 실제 데이터는 오가지 않아요.', emoji: '🎉' })
  }, [phase, step, shown, connect, me.email])

  useEffect(() => {
    if (phase !== 'done') return
    const t = setTimeout(onClose, 1100)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  if (!shown) return null
  return (
    <Modal open={!!it} onClose={phase === 'auth' ? () => {} : onClose} size="sm" hideClose={phase === 'auth'}>
      <div className="pt-2 text-center">
        <div className="flex items-center justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow"><Sparkles className="h-7 w-7" /></div>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-accent" animate={phase === 'auth' ? { opacity: [0.2, 1, 0.2] } : { opacity: phase === 'done' ? 1 : 0.3 }} transition={{ duration: 1, repeat: phase === 'auth' ? Infinity : 0, delay: i * 0.12 }} />
            ))}
          </div>
          <Logo it={shown} size="lg" />
        </div>

        <AnimatePresence mode="wait">
          {phase === 'consent' && (
            <motion.div key="c" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <h3 className="mt-5 text-lg font-semibold">{shown.name} 연결 <span className="align-middle text-[11px] font-bold text-warning">데모</span></h3>
              <p className="mt-1 text-[13px] text-muted"><b className="text-fg">Nexus</b>가 {me.email} 계정에 다음 권한을 요청해요.</p>
              <ul className="mt-4 space-y-2 rounded-2xl border border-line/10 bg-line/[0.03] p-4 text-left">
                {shown.scopes.map((s) => (
                  <li key={s} className="flex items-center gap-2.5 text-[13px]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success"><Check className="h-3 w-3" /></span>{s}
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-subtle"><Lock className="h-3 w-3" />시연용 연결이에요 — 실제 {shown.name} 계정에는 접근하지 않아요</p>
              <div className="mt-5 flex gap-2">
                <Button className="flex-1" variant="ghost" onClick={onClose}>취소</Button>
                <Button className="flex-1" variant="primary" rightIcon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => { setStep(0); setPhase('auth') }}>승인하고 연결</Button>
              </div>
            </motion.div>
          )}
          {phase === 'auth' && (
            <motion.div key="a" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-6 space-y-2 pb-2 text-left">
              {AUTH_STEPS(shown.name).map((s, i) => (
                <div key={s} className={cn('flex items-center gap-2.5 text-[13px] transition-opacity', i > step && 'opacity-30')}>
                  {i < step ? <CircleCheck className="h-4 w-4 text-success" /> : i === step ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <span className="h-4 w-4 rounded-full border border-line/20" />}
                  {s}
                </div>
              ))}
            </motion.div>
          )}
          {phase === 'done' && (
            <motion.div key="d" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 pb-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success text-white shadow-[0_0_30px_rgb(var(--success)/0.5)]"><Check className="h-6 w-6" /></div>
              <div className="mt-3 font-semibold">연결되었어요!</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
