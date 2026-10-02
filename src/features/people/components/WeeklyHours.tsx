import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addDays, format, isSameDay, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { AlertTriangle, BarChart3 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useCore } from '@/store/core'
import { usePeople, workedMs } from '../store'
import { dateKey, pastDayHours, useNow } from '../lib'
import { isDemoWorkspace } from '@/lib/workspace'

const LIMIT = 52
const STANDARD = 40

export function WeeklyHours() {
  const meId = useCore((s) => s.currentUserId)
  const clock = usePeople((s) => s.clock)
  const log = usePeople((s) => s.hoursLog)
  const now = useNow(60_000)

  const data = useMemo(() => {
    const mon = startOfWeek(now, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mon, i)
      const key = dateKey(d)
      const today = isSameDay(d, now)
      const future = d > now && !today
      let hours = 0
      if (today) hours = clock.date === key ? workedMs(clock, now.getTime()) / 3600_000 : 0
      else if (!future) {
        if (log[key] !== undefined) hours = log[key] / 60
        else if (clock.date === key) hours = workedMs(clock, Math.min(now.getTime(), addDays(d, 1).setHours(0, 0, 0, 0))) / 3600_000
        // demo only: plausible history for the seeded persona; real members only see what they actually clocked
        else hours = isDemoWorkspace() ? pastDayHours(meId, d) : 0
      }
      return { key, label: format(d, 'EEE', { locale: ko }), date: format(d, 'M/d'), hours: Math.round(hours * 10) / 10, today, future }
    })
  }, [now, clock, log, meId])

  const total = data.reduce((a, d) => a + d.hours, 0)
  const pct = Math.min(100, (total / LIMIT) * 100)
  const tone = total >= 48 ? 'danger' : total >= STANDARD ? 'warning' : 'ok'

  return (
    <Card>
      <CardHeader icon={<BarChart3 className="h-4 w-4" />} title="이번 주 근무 시간" subtitle="주 52시간 상한 기준 · 오늘은 실시간 반영" />
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-3xl font-bold tabular-nums text-fg">
            {total.toFixed(1)}<span className="ml-1 text-base font-medium text-muted">/ {LIMIT}h</span>
          </div>
          <div className="text-xs text-muted">잔여 {Math.max(0, LIMIT - total).toFixed(1)}시간</div>
        </div>
        {tone !== 'ok' && (
          <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium', tone === 'danger' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning')}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {tone === 'danger' ? '상한 임박 — 휴식 필요' : '법정 근로 40시간 초과'}
          </span>
        )}
      </div>

      {/* 52h meter */}
      <div className="relative mb-6">
        <div className="h-2.5 overflow-hidden rounded-full bg-line/10">
          <div
            className={cn('h-full rounded-full transition-all duration-700', tone === 'danger' ? 'bg-gradient-to-r from-amber-400 to-rose-500' : 'bg-accent-gradient')}
            style={{ width: `${pct}%`, boxShadow: '0 0 12px rgb(var(--accent) / .5)' }}
          />
        </div>
        <div className="absolute -top-0.5 h-3.5 w-0.5 rounded bg-fg/50" style={{ left: `${(STANDARD / LIMIT) * 100}%` }} />
        <div className="relative mt-1.5 flex h-3.5 justify-between text-[10px] text-subtle">
          <span>0h</span>
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(STANDARD / LIMIT) * 100}%` }}>법정 40h</span>
          <span>최대 52h</span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
            <defs>
              <linearGradient id="wh-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent-2))" />
                <stop offset="100%" stopColor="rgb(var(--accent))" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgb(var(--line) / 0.06)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} domain={[0, 12]} ticks={[0, 4, 8, 12]} />
            <ReferenceLine y={8} stroke="rgb(var(--line) / 0.3)" strokeDasharray="4 4" label={{ value: '8h', position: 'right', fill: 'rgb(var(--subtle))', fontSize: 10 }} />
            <Tooltip
              cursor={{ fill: 'rgb(var(--line) / 0.05)', radius: 8 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as (typeof data)[number]
                return (
                  <div className="rounded-xl glass-strong px-3 py-2 text-xs shadow-float">
                    <div className="font-medium text-fg">{d.date} ({d.label}){d.today && ' · 오늘'}</div>
                    <div className="mt-0.5 tabular-nums text-muted">{d.future ? '예정' : `${d.hours}시간 근무`}</div>
                  </div>
                )
              }}
            />
            <Bar dataKey="hours" radius={[6, 6, 2, 2]} maxBarSize={34}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.today ? 'url(#wh-bar)' : 'rgb(var(--accent) / 0.55)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
