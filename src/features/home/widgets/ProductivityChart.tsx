import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, startOfDay, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { TrendingDown, TrendingUp, Activity } from 'lucide-react'
import { useProjects } from '@/features/projects/store'
import { cn } from '@/lib/utils'
import { Widget } from '../components/Widget'
import { isDemoWorkspace } from '@/lib/workspace'

const MOCK = [6, 9, 7, 11, 4, 2, 8, 10, 12, 9, 14, 5, 3, 11]

interface Point { day: string; label: string; count: number }

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs shadow-float">
      <div className="text-subtle">{p.label}</div>
      <div className="mt-0.5 font-semibold text-fg">완료 {p.count}개</div>
    </div>
  )
}

export function ProductivityChart({ className, delay }: { className?: string; delay?: number }) {
  const tasks = useProjects((s) => s.tasks)

  const { data, thisWeek, lastWeek, mock, total } = useMemo(() => {
    const today = startOfDay(new Date())
    const days = Array.from({ length: 14 }, (_, i) => subDays(today, 13 - i))
    const counts = days.map((d) => {
      const s = d.getTime()
      const e = s + 864e5
      return (tasks ?? []).filter((t) => t.completedAt && new Date(t.completedAt).getTime() >= s && new Date(t.completedAt).getTime() < e).length
    })
    const total = counts.reduce((a, b) => a + b, 0)
    const mock = total < 3 && isDemoWorkspace()
    const vals = mock ? MOCK : counts
    const data: Point[] = days.map((d, i) => ({ day: format(d, 'M/d'), label: format(d, 'M월 d일 (EEE)', { locale: ko }), count: vals[i] }))
    const thisWeek = vals.slice(7).reduce((a, b) => a + b, 0)
    const lastWeek = vals.slice(0, 7).reduce((a, b) => a + b, 0)
    return { data, thisWeek, lastWeek, mock, total }
  }, [tasks])

  const change = lastWeek ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0
  const up = change >= 0

  return (
    <Widget
      className={className}
      delay={delay}
      title="주간 생산성"
      subtitle={`최근 14일 팀 완료 태스크${mock ? ' · 샘플 데이터' : ''}`}
      icon={<Activity />}
      gradient="from-sky-400 to-indigo-500"
      action={
        <div className="text-right">
          <div className="font-display text-2xl font-bold leading-none tabular-nums text-fg">{thisWeek}</div>
          <div className={cn('mt-1 flex items-center justify-end gap-0.5 text-[11px] font-medium', up ? 'text-success' : 'text-danger')}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            지난주 대비 {up ? '+' : ''}{change}%
          </div>
        </div>
      }
    >
      <div className="relative h-[190px] -ml-3 -mr-1">
        {total === 0 && !mock && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 text-center">
            <div className="text-[13px] font-medium text-fg/90">아직 완료된 태스크가 없어요</div>
            <div className="text-xs text-subtle">태스크를 완료하면 팀의 흐름이 여기에 그려져요</div>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="home-prod-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="home-prod-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgb(var(--accent))" />
                <stop offset="100%" stopColor="rgb(var(--accent-2))" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--subtle))', fontSize: 10 }} interval={1} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--subtle))', fontSize: 10 }} width={28} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgb(var(--line) / 0.2)', strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="url(#home-prod-stroke)"
              strokeWidth={2}
              fill="url(#home-prod-fill)"
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgb(var(--surface))', fill: 'rgb(var(--accent))' }}
              animationDuration={1200}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Widget>
  )
}
