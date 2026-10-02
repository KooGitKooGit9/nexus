import { useMemo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Activity, CheckCircle2, Hourglass, Zap, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui'
import { useWorkflows, runsSince, WEEK_MS } from '../store'
import { TEMPLATES } from '../templates'
import { CountUp } from './bits'

function Stat({ icon, label, children, caption, glow, delay, trend }: { icon: ReactNode; label: string; children: ReactNode; caption: ReactNode; glow: string; delay: number; trend?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      <Card spotlight className="h-full">
        <div className={cn('pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl opacity-30', glow)} />
        <div className="relative flex items-center gap-2 text-[13px] font-medium text-muted">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-white [&>svg]:h-3.5 [&>svg]:w-3.5', glow)}>{icon}</span>
          {label}
        </div>
        <div className="relative mt-3 font-display text-[34px] font-bold leading-none tracking-tight text-fg">{children}</div>
        <div className="relative mt-2 flex items-center gap-1.5 text-xs text-subtle">
          {trend !== undefined && (
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', trend >= 0 ? 'text-success' : 'text-danger')}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          {caption}
        </div>
      </Card>
    </motion.div>
  )
}

export function HeroStats() {
  const workflows = useWorkflows((s) => s.workflows)
  const stats = useMemo(() => {
    const active = workflows.filter((w) => w.enabled).length
    const week = workflows.reduce((n, w) => n + runsSince(w, WEEK_MS).length, 0)
    const twoWeeks = workflows.reduce((n, w) => n + runsSince(w, WEEK_MS * 2).length, 0)
    const prev = twoWeeks - week
    const trend = prev ? Math.round(((week - prev) / prev) * 100) : 0
    const recent = workflows.flatMap((w) => runsSince(w, WEEK_MS * 4)).filter((r) => r.status !== 'running')
    const ok = recent.filter((r) => r.status === 'success').length
    const rate = recent.length ? (ok / recent.length) * 100 : 100
    // Time saved over the last 30 days = successful runs × template's "minutes saved per run" (custom flows: ~10분)
    const savedMin = workflows.reduce((n, w) => {
      const per = TEMPLATES.find((t) => t.id === w.templateId)?.saves ?? 10
      return n + runsSince(w, 30 * 86400_000).filter((r) => r.status === 'success' && !r.manual).length * per
    }, 0)
    const savedHours = Math.round(savedMin / 60)
    return { active, total: workflows.length, week, trend, rate, recentCount: recent.length, savedHours, savedDays: Math.round((savedMin / 60 / 8) * 10) / 10 }
  }, [workflows])

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat delay={0} icon={<Zap />} label="활성 워크플로우" glow="from-violet-500 to-fuchsia-500" caption={<>전체 {stats.total}개 중</>}>
        <CountUp value={stats.active} />
        <span className="ml-1 text-lg text-subtle">/ {stats.total}</span>
      </Stat>
      <Stat delay={0.06} icon={<Activity />} label="이번 주 실행" glow="from-cyan-400 to-blue-600" caption="지난주 대비" trend={stats.trend}>
        <CountUp value={stats.week} />
        <span className="ml-1 text-lg text-subtle">회</span>
      </Stat>
      <Stat delay={0.12} icon={<Hourglass />} label="절약된 시간" glow="from-amber-400 to-orange-600" caption={<>최근 30일 · 약 {stats.savedDays}일치 업무</>}>
        <CountUp value={stats.savedHours} duration={1.8} />
        <span className="ml-1 text-lg text-subtle">시간</span>
      </Stat>
      <Stat delay={0.18} icon={<CheckCircle2 />} label="성공률" glow="from-emerald-400 to-teal-600" caption={<>최근 4주 · {stats.recentCount}회 실행</>}>
        {stats.recentCount ? (
          <>
            <span className="gradient-text">
              <CountUp value={stats.rate} decimals={1} />
            </span>
            <span className="ml-0.5 text-lg text-subtle">%</span>
          </>
        ) : (
          <span className="text-subtle">—</span>
        )}
      </Stat>
    </div>
  )
}
