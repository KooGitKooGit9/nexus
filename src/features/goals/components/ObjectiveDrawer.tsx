import { useMemo } from 'react'
import { ArrowUpRight, GitBranch, History } from 'lucide-react'
import { Avatar, Badge, Drawer, EmptyState } from '@/components/ui'
import { useCore } from '@/store/core'
import { formatDate, timeAgo } from '@/lib/utils'
import { useGoals } from '../store'
import { STATUS_META, formatNum, isCompanyObjective, objectiveProgress } from '../lib'
import { KeyResultRow, StatusBadge } from './ObjectiveCard'
import { Ring, STATUS_GRADIENT } from './Ring'
import { Sparkline } from './Sparkline'

export function ObjectiveDrawer({ id, onClose, onKrClick, onOpen }: { id: string | null; onClose: () => void; onKrClick: (objId: string, krId: string) => void; onOpen: (id: string) => void }) {
  const objectives = useGoals((s) => s.objectives)
  const setStatus = useGoals((s) => s.setObjectiveStatus)
  const users = useCore((s) => s.users)
  const o = objectives.find((x) => x.id === id)
  const parent = o?.parentId ? objectives.find((x) => x.id === o.parentId) : undefined
  const children = o ? objectives.filter((x) => x.parentId === o.id) : []

  const timeline = useMemo(() => {
    if (!o) return []
    return o.keyResults
      .flatMap((k) => (k.history ?? []).map((h) => ({ ...h, kr: k })))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 12)
  }, [o])

  const p = o ? objectiveProgress(o) : 0
  const [from, to] = o ? STATUS_GRADIENT[o.status] : ['', '']

  return (
    <Drawer open={!!o} onClose={onClose} width={560} title={o ? <span className="flex items-center gap-2"><span>{o.emoji ?? '🎯'}</span><span className="truncate">목표 상세</span></span> : null}>
      {o && (
        <div className="space-y-6 p-5">
          <div className="relative overflow-hidden rounded-2xl border border-line/10 p-5">
            <div className="pointer-events-none absolute inset-0 opacity-25" style={{ background: `radial-gradient(400px circle at 100% 0%, ${from}, transparent 60%)` }} />
            <div className="relative flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={isCompanyObjective(o) ? 'accent' : 'cyan'}>{isCompanyObjective(o) ? '회사 목표' : o.team}</Badge>
                  <StatusBadge status={o.status} onChange={(s) => setStatus(o.id, s)} />
                  <Badge>{o.quarter}</Badge>
                </div>
                <h2 className="text-lg font-semibold leading-snug text-fg">{o.title}</h2>
                {o.description && <p className="mt-1.5 text-sm text-muted">{o.description}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                  <Avatar userId={o.ownerId} size="sm" showPresence />
                  <div>
                    <div className="font-medium text-fg">{users.find((u) => u.id === o.ownerId)?.name ?? '나간 멤버'}</div>
                    <div className="text-subtle">{users.find((u) => u.id === o.ownerId)?.title}</div>
                  </div>
                </div>
              </div>
              <Ring value={p} size={88} stroke={8} from={from} to={to}>
                <span className="font-display text-lg font-bold">{p}%</span>
              </Ring>
            </div>
          </div>

          {parent && (
            <button onClick={() => onOpen(parent.id)} className="flex w-full items-center gap-3 rounded-xl border border-line/10 bg-line/[0.03] p-3 text-left transition hover:border-accent/40">
              <GitBranch className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-subtle">정렬된 회사 목표</div>
                <div className="truncate text-sm font-medium">{parent.emoji} {parent.title}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-subtle" />
            </button>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">핵심 결과 · {o.keyResults.length}</h3>
            <div className="-mx-2">
              {o.keyResults.map((k) => (
                <div key={k.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><KeyResultRow kr={k} onClick={() => onKrClick(o.id, k.id)} /></div>
                  <Sparkline values={(k.history ?? []).map((h) => h.value)} width={72} height={28} color={STATUS_META[o.status].color} className="shrink-0" />
                </div>
              ))}
            </div>
          </section>

          {children.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">정렬된 팀 목표 · {children.length}</h3>
              <div className="space-y-1.5">
                {children.map((c) => (
                  <button key={c.id} onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-line/[0.05]">
                    <span>{c.emoji ?? '🎯'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                    <Badge tone="cyan">{c.team}</Badge>
                    <span className="w-10 text-right text-xs font-semibold tabular-nums">{objectiveProgress(c)}%</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle"><History className="h-3.5 w-3.5" /> 체크인 타임라인</h3>
            {timeline.length === 0 ? (
              <EmptyState title="아직 체크인이 없어요" description="핵심 결과를 클릭해 첫 체크인을 기록하세요." className="py-8" />
            ) : (
              <ol className="relative space-y-4 border-l border-line/10 pl-5">
                {timeline.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-accent-gradient ring-4 ring-surface" />
                    <div className="flex items-center gap-2 text-xs">
                      <Avatar userId={h.userId} size="xs" />
                      <span className="font-medium text-fg">{users.find((u) => u.id === h.userId)?.name ?? '나간 멤버'}</span>
                      <span className="text-subtle" title={formatDate(h.at, 'yyyy.MM.dd HH:mm')}>{timeAgo(h.at)}</span>
                    </div>
                    <div className="mt-1 text-[13px] text-muted">
                      <span className="text-fg/90">{h.kr.title}</span> → <span className="font-semibold text-fg">{formatNum(h.value)}{h.kr.unit}</span>
                    </div>
                    {h.note && <div className="mt-1 rounded-lg bg-line/[0.04] px-2.5 py-1.5 text-xs text-muted">{h.note}</div>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}
