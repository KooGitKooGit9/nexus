import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Stamp, Plus, Search, Inbox, Send, Eye, Layers, PartyPopper, Timer, CheckCheck, Hourglass } from 'lucide-react'
import { Page } from '@/app/Page'
import { cn } from '@/lib/utils'
import { Button, Card, EmptyState, Input, PageHeader, UnderlineTabs } from '@/components/ui'
import { useCore } from '@/store/core'
import { useApprovals } from './store'
import { KIND_META, KIND_ORDER, isPendingOn } from './meta'
import type { ApprovalKind, ApprovalRequest } from './types'
import { RequestRow } from './components/RequestRow'
import { RequestDrawer } from './components/RequestDrawer'
import { NewRequestWizard } from './wizard/NewRequestWizard'

type TabKey = 'inbox' | 'mine' | 'done' | 'all'

function Stat({ icon, label, value, sub, accent, delay }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; accent?: boolean; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Card spotlight className={cn('!p-4', accent && 'border-info/30')}>
        {accent && <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-info/30 blur-2xl" />}
        <div className="relative flex items-center gap-2 text-[12px] font-medium text-muted">
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5', accent ? 'bg-info/20 text-info' : 'bg-line/[0.06] text-muted')}>{icon}</span>
          {label}
        </div>
        <div className="relative mt-2 flex items-baseline gap-1.5">
          <span className={cn('font-display text-[28px] font-bold leading-none', accent ? 'text-info' : 'text-fg')}>{value}</span>
          {sub && <span className="text-xs text-subtle">{sub}</span>}
        </div>
      </Card>
    </motion.div>
  )
}

export default function ApprovalsPage() {
  const requests = useApprovals((s) => s.requests)
  const me = useCore((s) => s.currentUserId)
  const users = useCore((s) => s.users)
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<TabKey>('inbox')
  const [kind, setKind] = useState<ApprovalKind | 'all'>('all')
  const [q, setQ] = useState('')

  const openId = params.get('id')
  const wizardOpen = params.get('new') === '1'
  const openReq = requests.find((r) => r.id === openId) ?? null

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const buckets = useMemo(() => {
    const sorted = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const inbox = sorted.filter((r) => isPendingOn(r, me)).sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))
    const mine = sorted.filter((r) => r.requesterId === me)
    const done = sorted.filter(
      (r) => r.requesterId !== me && !isPendingOn(r, me) && (r.ccIds?.includes(me) || r.steps.some((s) => s.approverId === me && (s.status === 'approved' || s.status === 'rejected'))),
    )
    return { inbox, mine, done, all: sorted } satisfies Record<TabKey, ApprovalRequest[]>
  }, [requests, me])

  const stats = useMemo(() => {
    const monthAgo = Date.now() - 30 * 86400_000
    const mySteps = requests.flatMap((r) => r.steps.filter((s) => s.approverId === me && s.decidedAt).map((s) => ({ s, r })))
    const handled = mySteps.filter(({ s }) => new Date(s.decidedAt!).getTime() > monthAgo).length
    const avgH = mySteps.length ? mySteps.reduce((n, { s, r }) => n + (new Date(s.decidedAt!).getTime() - new Date(r.createdAt).getTime()), 0) / mySteps.length / 3600_000 : 0
    return { handled, avgH, minePending: buckets.mine.filter((r) => r.status === 'pending').length }
  }, [requests, me, buckets])

  const needle = q.trim().toLowerCase()
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? ''
  const list = buckets[tab].filter(
    (r) => (kind === 'all' || r.kind === kind) && (!needle || r.title.toLowerCase().includes(needle) || (r.docNo ?? '').toLowerCase().includes(needle) || userName(r.requesterId).includes(needle)),
  )
  const kindCounts = useMemo(() => {
    const c: Partial<Record<ApprovalKind, number>> = {}
    buckets[tab].forEach((r) => (c[r.kind] = (c[r.kind] ?? 0) + 1))
    return c
  }, [buckets, tab])

  const empty: Record<TabKey, { icon: ReactNode; title: string; desc: string }> = {
    inbox: { icon: <PartyPopper />, title: '모든 결재를 처리했어요 🎉', desc: '새 결재 요청이 오면 여기에 표시돼요.' },
    mine: { icon: <Send />, title: '올린 문서가 없어요', desc: '휴가, 경비, 구매 등 결재를 상신해 보세요.' },
    done: { icon: <Eye />, title: '참조 · 완료 문서가 없어요', desc: '내가 처리했거나 참조된 문서가 여기에 모여요.' },
    all: { icon: <Layers />, title: '문서가 없어요', desc: '' },
  }

  return (
    <Page>
      <PageHeader
        icon={<Stamp />}
        title="전자결재"
        subtitle="휴가 · 경비 · 구매 · 출장 · 권한 결재를 한곳에서"
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setParam('new', '1')}>새 결재 작성</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat delay={0} accent icon={<Inbox />} label="결재 대기" value={buckets.inbox.length} sub="건" />
        <Stat delay={0.05} icon={<Hourglass />} label="진행 중인 내 문서" value={stats.minePending} sub="건" />
        <Stat delay={0.1} icon={<CheckCheck />} label="최근 30일 처리" value={stats.handled} sub="건" />
        <Stat delay={0.15} icon={<Timer />} label="평균 처리 시간" value={stats.avgH < 24 ? stats.avgH.toFixed(1) : (stats.avgH / 24).toFixed(1)} sub={stats.avgH < 24 ? '시간' : '일'} />
      </div>

      <UnderlineTabs<TabKey>
        className="mt-8"
        value={tab}
        onChange={(t) => { setTab(t); setKind('all') }}
        items={[
          { value: 'inbox', label: '결재 대기', icon: <Inbox />, count: buckets.inbox.length },
          { value: 'mine', label: '내가 올린 문서', icon: <Send />, count: buckets.mine.length },
          { value: 'done', label: '참조/완료', icon: <Eye />, count: buckets.done.length },
          { value: 'all', label: '전체', icon: <Layers />, count: buckets.all.length },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', ...KIND_ORDER] as const).map((k) => {
            const active = kind === k
            const count = k === 'all' ? buckets[tab].length : kindCounts[k] ?? 0
            if (k !== 'all' && !count && !active) return null
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn('relative flex items-center gap-1 rounded-full border px-3 py-1 text-[12.5px] font-medium transition', active ? 'border-transparent text-fg' : 'border-line/10 text-muted hover:border-line/25 hover:text-fg')}
              >
                {active && <motion.span layoutId="apv-kind-pill" className="absolute inset-0 rounded-full bg-accent/15 ring-1 ring-accent/40" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                <span className="relative">{k === 'all' ? '전체' : `${KIND_META[k].emoji} ${KIND_META[k].label}`}</span>
                <span className="relative text-[10.5px] text-subtle">{count}</span>
              </button>
            )
          })}
        </div>
        <div className="ml-auto w-full sm:w-64">
          <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목 · 문서번호 · 기안자 검색" className="h-9" />
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {list.map((r, i) => (
            <RequestRow key={r.id} r={r} index={i} onOpen={() => setParam('id', r.id)} />
          ))}
        </AnimatePresence>
        {!list.length && (
          <EmptyState
            icon={q ? <Search /> : empty[tab].icon}
            title={q ? '검색 결과가 없어요' : empty[tab].title}
            description={q ? '다른 키워드로 검색해 보세요.' : empty[tab].desc}
            action={tab === 'mine' && !q ? <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setParam('new', '1')}>새 결재 작성</Button> : undefined}
          />
        )}
      </div>

      <RequestDrawer request={openReq} onClose={() => setParam('id', null)} />
      <NewRequestWizard
        open={wizardOpen}
        onClose={() => setParam('new', null)}
        onCreated={(id) => {
          const next = new URLSearchParams(params)
          next.delete('new')
          next.set('id', id)
          setParams(next, { replace: true })
          setTab('mine')
          setKind('all')
          setQ('')
        }}
      />
    </Page>
  )
}
