import { useMemo, type ReactNode } from 'react'
import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay, startOfWeek, subWeeks, isAfter, isBefore } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { Activity, AlertTriangle, CheckCircle2, Flame, Gauge, TrendingDown, Users, Zap } from 'lucide-react'
import { Card, CardHeader, FadeIn } from '@/components/ui'
import { useCore } from '@/store/core'
import { PALETTE, cn } from '@/lib/utils'
import type { Project, Task, TaskStatus } from '../types'
import { STATUSES, STATUS_META, isOverdue } from '../constants'
import { sprintTasks } from '../components/SprintWidget'

/* ───────────── Styled tooltip ───────────── */

interface TipPayload { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> & { fill?: string } }
function ChartTooltip({ active, payload, label, unit = '' }: { active?: boolean; payload?: TipPayload[]; label?: ReactNode; unit?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong min-w-[150px] rounded-xl px-3 py-2.5 shadow-float">
      {label !== undefined && label !== '' && <div className="mb-1.5 text-[11px] font-semibold text-muted">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.filter((p) => p.value !== undefined && p.value !== null).map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? (p.payload?.fill as string) }} />
            <span className="text-muted">{p.name}</span>
            <span className="ml-auto pl-3 font-display font-semibold tabular-nums text-fg">{p.value}{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const axis = { tick: { fill: 'currentColor', fontSize: 11 }, tickLine: false, axisLine: false } as const

function Kpi({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone: string }) {
  return (
    <Card hover spotlight className="p-4">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5" style={{ background: `${tone}22`, color: tone }}>{icon}</span>
        {label}
      </div>
      <div className="mt-2.5 font-display text-[28px] font-bold leading-none tracking-tight text-fg tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-subtle">{sub}</div>}
    </Card>
  )
}

export function Insights({ project, tasks }: { project: Project; tasks: Task[] }) {
  const users = useCore((s) => s.users)

  const kpi = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done').length
    const overdue = tasks.filter(isOverdue).length
    const active = tasks.filter((t) => t.status === 'in_progress' || t.status === 'review').length
    const dueWeek = tasks.filter((t) => t.dueDate && t.status !== 'done' && differenceInCalendarDays(new Date(t.dueDate), new Date()) >= 0 && differenceInCalendarDays(new Date(t.dueDate), new Date()) <= 7).length
    return { done, overdue, active, dueWeek, rate: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }
  }, [tasks])

  const burndown = useMemo(() => {
    const sp = project.sprint
    if (!sp) return { data: [], total: 0 }
    const st = sprintTasks(project, tasks)
    const total = st.reduce((s, t) => s + (t.estimate ?? 1), 0)
    const start = startOfDay(new Date(sp.startDate))
    const end = startOfDay(new Date(sp.endDate))
    const len = Math.max(1, differenceInCalendarDays(end, start))
    const today = startOfDay(new Date())
    const data = Array.from({ length: len + 1 }, (_, i) => {
      const day = addDays(start, i)
      const doneBy = st.filter((t) => t.completedAt && !isAfter(new Date(t.completedAt), endOfDay(day))).reduce((s, t) => s + (t.estimate ?? 1), 0)
      return {
        day: format(day, 'M/d (EEEEE)', { locale: ko }),
        이상적: Math.round((total - (total * i) / len) * 10) / 10,
        남은작업: isAfter(day, today) ? undefined : total - doneBy,
      }
    })
    return { data, total }
  }, [project, tasks])

  const donut = useMemo(() => STATUSES.map((s) => ({ name: STATUS_META[s].label, value: tasks.filter((t) => t.status === s).length, fill: STATUS_META[s].color })).filter((d) => d.value > 0), [tasks])

  const workload = useMemo(() => {
    const open: TaskStatus[] = ['todo', 'in_progress', 'review']
    const ids = Array.from(new Set(tasks.flatMap((t) => t.assigneeIds)))
    return ids
      .map((id) => {
        const row: Record<string, string | number> = { name: users.find((u) => u.id === id)?.name ?? id }
        let total = 0
        for (const s of open) {
          const n = tasks.filter((t) => t.status === s && t.assigneeIds.includes(id)).length
          row[STATUS_META[s].label] = n
          total += n
        }
        row.total = total
        return row
      })
      .filter((r) => (r.total as number) > 0)
      .sort((a, b) => (b.total as number) - (a.total as number))
      .slice(0, 8)
  }, [tasks, users])

  const velocity = useMemo(() => {
    const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 6 }, (_, i) => {
      const ws = subWeeks(thisWeek, 5 - i)
      const we = addDays(ws, 7)
      const pts = tasks
        .filter((t) => t.completedAt && !isBefore(new Date(t.completedAt), ws) && isBefore(new Date(t.completedAt), we))
        .reduce((s, t) => s + (t.estimate ?? 1), 0)
      return { week: i === 5 ? '이번 주' : `${format(ws, 'M/d')} 주`, 포인트: pts }
    })
  }, [tasks])
  const avgVelocity = Math.round((velocity.slice(0, 5).reduce((s, v) => s + v.포인트, 0) / 5) * 10) / 10

  return (
    <div className="space-y-4 px-6 pb-10 [@container(min-width:1000px)]:px-8">
      <div className="grid grid-cols-2 gap-3 [@container(min-width:900px)]:grid-cols-4 [@container(min-width:900px)]:gap-4">
        <FadeIn className="min-w-0"><Kpi icon={<CheckCircle2 />} label="완료율" value={`${kpi.rate}%`} sub={`${kpi.done} / ${tasks.length} 태스크 완료`} tone={PALETTE[3]} /></FadeIn>
        <FadeIn delay={0.05} className="min-w-0"><Kpi icon={<Activity />} label="진행 중" value={kpi.active} sub="진행 중 + 리뷰" tone={PALETTE[4]} /></FadeIn>
        <FadeIn delay={0.1} className="min-w-0"><Kpi icon={<AlertTriangle />} label="지연됨" value={<span className={cn(kpi.overdue > 0 && 'text-danger')}>{kpi.overdue}</span>} sub="마감일이 지난 미완료 태스크" tone="#f43f5e" /></FadeIn>
        <FadeIn delay={0.15} className="min-w-0"><Kpi icon={<Flame />} label="이번 주 마감" value={kpi.dueWeek} sub="7일 이내 마감 예정" tone={PALETTE[1]} /></FadeIn>
      </div>

      {/* grid-cols-1 (= minmax(0,1fr)) + min-w-0 let recharts' ResponsiveContainer shrink when the pane narrows */}
      <div className="grid grid-cols-1 gap-4 [@container(min-width:1100px)]:grid-cols-5">
        <FadeIn delay={0.1} className="min-w-0 [@container(min-width:1100px)]:col-span-3">
          <Card className="h-full">
            <CardHeader icon={<TrendingDown className="h-4 w-4" />} title="번다운 차트" subtitle={project.sprint ? `${project.sprint.name} · 총 ${burndown.total}pt` : '진행 중인 스프린트가 없습니다'} />
            <div className="h-[260px] text-subtle">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={burndown.data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bd-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE[1]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={PALETTE[1]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
                  <XAxis dataKey="day" {...axis} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis {...axis} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip unit="pt" />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.25 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="linear" dataKey="이상적" name="이상적 진행" stroke="currentColor" strokeOpacity={0.55} strokeDasharray="5 5" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="남은작업" name="남은 작업" stroke={PALETTE[1]} strokeWidth={2} fill="url(#bd-fill)" dot={{ r: 3, strokeWidth: 2, fill: 'rgb(var(--surface))' }} activeDot={{ r: 5, strokeWidth: 2 }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15} className="min-w-0 [@container(min-width:1100px)]:col-span-2">
          <Card className="h-full">
            <CardHeader icon={<Gauge className="h-4 w-4" />} title="상태별 태스크" subtitle="현재 필터 기준" />
            <div className="flex items-center gap-4">
              <div className="relative h-[220px] min-w-0 flex-1 text-subtle">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<ChartTooltip unit="개" />} />
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="rgb(var(--surface))" strokeWidth={2} cornerRadius={4}>
                      {donut.map((d) => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-bold text-fg tabular-nums">{tasks.length}</span>
                  <span className="text-[11px] text-subtle">전체 태스크</span>
                </div>
              </div>
              <div className="flex w-[112px] shrink-0 flex-col gap-2">
                {STATUSES.map((s) => {
                  const n = tasks.filter((t) => t.status === s).length
                  return (
                    <div key={s} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].color }} />
                      <span className="text-muted">{STATUS_META[s].label}</span>
                      <span className="ml-auto font-semibold tabular-nums text-fg">{n}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 [@container(min-width:1100px)]:grid-cols-2">
        <FadeIn delay={0.2} className="min-w-0">
          <Card className="h-full">
            <CardHeader icon={<Users className="h-4 w-4" />} title="담당자별 워크로드" subtitle="열린 태스크 (할 일 · 진행 중 · 리뷰)" />
            <div className="text-subtle" style={{ height: Math.max(200, workload.length * 38 + 50) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workload} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }} barCategoryGap={8}>
                  <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.12} />
                  <XAxis type="number" {...axis} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" {...axis} width={70} />
                  <Tooltip content={<ChartTooltip unit="개" />} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  {(['todo', 'in_progress', 'review'] as TaskStatus[]).map((s, i, arr) => (
                    <Bar key={s} dataKey={STATUS_META[s].label} stackId="w" fill={STATUS_META[s].color} stroke="rgb(var(--surface))" strokeWidth={1} radius={i === arr.length - 1 ? [0, 4, 4, 0] : 0} maxBarSize={18} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={0.25} className="min-w-0">
          <Card className="h-full">
            <CardHeader icon={<Zap className="h-4 w-4" />} title="주간 벨로시티" subtitle={`최근 5주 평균 ${avgVelocity}pt`} />
            <div className="h-[260px] text-subtle">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vel-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={1} />
                      <stop offset="100%" stopColor={PALETTE[0]} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
                  <XAxis dataKey="week" {...axis} />
                  <YAxis {...axis} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip unit="pt" />} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} />
                  <ReferenceLine y={avgVelocity} stroke={PALETTE[2]} strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `평균 ${avgVelocity}`, position: 'insideTopRight', fill: 'currentColor', fontSize: 11 }} />
                  <Bar dataKey="포인트" fill="url(#vel-fill)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
