import { Fragment, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bar, BarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis } from 'recharts'
import { ChevronRight, History, FlaskConical, Zap, Hand, Archive } from 'lucide-react'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { getUser } from '@/store/core'
import { Badge, Card, EmptyState, Tabs } from '@/components/ui'
import type { FlowNode, Workflow, WorkflowRun } from '../types'
import { dailyRunCounts } from '../store'
import { formatDuration } from '../components/bits'
import { NODE_DEF_MAP, getDef } from '../catalog'
import { executionOrder } from '../graph'

type Filter = 'all' | 'success' | 'failed'

function StatusBadge({ status }: { status: WorkflowRun['status'] }) {
  if (status === 'success') return <Badge tone="success" dot>성공</Badge>
  if (status === 'failed') return <Badge tone="danger" dot>실패</Badge>
  return <Badge tone="info" dot>실행 중</Badge>
}

export function RunHistory({ workflow }: { workflow: Workflow }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)
  const runs = workflow.runs
  const shown = runs.filter((r) => filter === 'all' || r.status === filter).slice(0, 60)

  const chart = useMemo(() => {
    const d = dailyRunCounts(workflow, 14)
    return d.map((x, i) => {
      const date = new Date(Date.now() - (13 - i) * 86400_000)
      return { day: `${date.getMonth() + 1}/${date.getDate()}`, 성공: x.total - x.failed, 실패: x.failed }
    })
  }, [workflow])

  const ok = runs.filter((r) => r.status === 'success').length
  const failed = runs.filter((r) => r.status === 'failed').length
  const avg = runs.length ? runs.reduce((n, r) => n + r.durationMs, 0) / runs.length : 0

  if (!runs.length)
    return <EmptyState icon={<History />} title="아직 실행 기록이 없어요" description="상단의 ‘테스트 실행’으로 워크플로우를 시험해 보세요." className="h-full" />

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] space-y-5 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            {[
              { l: '총 실행', v: runs.length.toLocaleString() + '회', c: 'text-fg' },
              { l: '성공률', v: `${Math.round((ok / runs.length) * 1000) / 10}%`, c: 'gradient-text' },
              { l: '실패', v: `${failed}회`, c: failed ? 'text-danger' : 'text-fg' },
              { l: '평균 소요', v: formatDuration(Math.round(avg)), c: 'text-fg' },
            ].map((s) => (
              <Card key={s.l} className="!p-3.5">
                <div className="text-[11px] text-muted">{s.l}</div>
                <div className={cn('mt-1 font-display text-xl font-bold', s.c)}>{s.v}</div>
              </Card>
            ))}
          </div>
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-fg">최근 14일 실행</div>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent" />성공</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-danger" />실패</span>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wf-bar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--accent-2))" />
                      <stop offset="100%" stopColor="rgb(var(--accent))" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'rgb(var(--subtle))' }} interval={1} />
                  <RTooltip
                    cursor={{ fill: 'rgb(var(--line) / 0.05)' }}
                    contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line) / 0.1)', borderRadius: 12, fontSize: 12, color: 'rgb(var(--fg))' }}
                  />
                  <Bar dataKey="성공" stackId="a" fill="url(#wf-bar)" radius={[0, 0, 3, 3]} />
                  <Bar dataKey="실패" stackId="a" fill="rgb(var(--danger))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/10 px-4 py-3">
            <div className="text-sm font-semibold text-fg">실행 기록</div>
            <Tabs size="sm" value={filter} onChange={setFilter} items={[{ value: 'all', label: '전체', count: runs.length }, { value: 'success', label: '성공', count: ok }, { value: 'failed', label: '실패', count: failed }]} />
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-medium text-subtle">
                <th className="w-8 px-4 py-2" />
                <th className="px-2 py-2">상태</th>
                <th className="px-2 py-2">시작 시각</th>
                <th className="px-2 py-2">트리거</th>
                <th className="px-2 py-2">유형</th>
                <th className="px-4 py-2 text-right">소요 시간</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const expanded = open === r.id
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpen(expanded ? null : r.id)} className={cn('cursor-pointer border-t border-line/[0.06] transition hover:bg-line/[0.03]', expanded && 'bg-line/[0.03]')}>
                      <td className="px-4 py-2.5 text-subtle"><ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} /></td>
                      <td className="px-2 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-2 py-2.5">
                        <div className="text-fg">{formatDate(r.startedAt, 'M월 d일 a h:mm')}</div>
                        <div className="text-[11px] text-subtle">{timeAgo(r.startedAt)}</div>
                      </td>
                      <td className="max-w-[280px] truncate px-2 py-2.5 text-muted">{r.trigger}</td>
                      <td className="px-2 py-2.5">
                        <RunKind run={r} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted">
                        {r.status === 'running' ? (r.waitUntil ? `대기 중 · ${formatDate(r.waitUntil, 'HH:mm')} 재개` : '실행 중…') : formatDuration(r.durationMs)}
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <RunSteps run={r} workflow={workflow} />
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                )
              })}
            </tbody>
          </table></div>
        </Card>
      </div>
    </div>
  )
}

function RunKind({ run: r }: { run: WorkflowRun }) {
  if (!r.mode && !r.steps) return <Badge tone="neutral" icon={<Archive className="h-3 w-3" />}>샘플 기록</Badge>
  if (r.manual && r.mode !== 'live') return <Badge tone="pink" icon={<FlaskConical className="h-3 w-3" />}>테스트</Badge>
  if (r.manual) return <Badge tone="warning" icon={<Hand className="h-3 w-3" />}>수동 실행</Badge>
  return <Badge tone="cyan" icon={<Zap className="h-3 w-3" />}>자동</Badge>
}

function RunSteps({ run, workflow }: { run: WorkflowRun; workflow: Workflow }) {
  // Seeded / automatic runs don't store steps — synthesize the executed path from the graph (branch picked deterministically per run).
  const steps = useMemo(() => {
    if (run.steps) return run.steps
    const hash = [...run.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)
    const { order } = executionOrder(workflow.nodes as FlowNode[], workflow.edges, (id) => ((hash + id.length) % 3 === 0 ? 'false' : 'true'))
    return order.map(({ node, branch }, i, arr) => {
      const failedHere = run.status === 'failed' && i === arr.length - 1
      return {
        nodeId: node.id,
        label: node.data.title || getDef(node.data.kind).label,
        status: failedHere ? ('failed' as const) : ('success' as const),
        at: Math.round((run.durationMs / arr.length) * (i + 1)),
        message: failedHere ? '외부 서비스 응답 시간 초과 (504 Gateway Timeout)' : branch ? `${branch === 'true' ? '참' : '거짓'} 분기` : undefined,
      }
    })
  }, [run, workflow.nodes, workflow.edges])
  const synthetic = !run.steps
  return (
    <div className="space-y-1.5 bg-line/[0.02] px-4 py-3 sm:px-12">
      {synthetic && <div className="mb-1 text-[11px] text-subtle">데모용 샘플 기록이라 실제 단계 로그가 없어요 — 아래는 현재 그래프 기준 예시 경로예요.</div>}
      {run.actorId && <div className="mb-1 text-[11px] text-subtle">실행한 브라우저: {getUser(run.actorId)?.name ?? run.actorId}{run.mode === 'dry' ? ' · 테스트(부작용 없음)' : ''}</div>}
      {!steps.length && <div className="font-mono text-[11.5px] text-subtle">{run.status === 'running' ? '실행 중…' : '기록된 단계가 없어요'}</div>}
      {steps.map((st, i) => (
        <div key={i} className="flex items-start gap-3 font-mono text-[11.5px]">
          <span className="w-14 shrink-0 text-right text-subtle">+{formatDuration(st.at)}</span>
          <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', st.status === 'success' ? 'bg-success' : st.status === 'failed' ? 'bg-danger' : 'bg-subtle')} />
          <span className={cn('min-w-0', st.status === 'skipped' ? 'text-subtle line-through' : st.status === 'failed' ? 'text-danger' : 'text-fg/85')}>
            {labelFor(st.label)}
            {st.message && <span className="text-muted"> — {st.message}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

function labelFor(label: string) {
  return NODE_DEF_MAP[label]?.label ?? label
}
