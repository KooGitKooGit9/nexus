import { motion } from 'framer-motion'
import { CalendarClock, Flag, ListChecks } from 'lucide-react'
import { Card } from '@/components/ui'
import type { Objective } from '../types'
import { STATUS_META, STATUS_ORDER, averageProgress, isCompanyObjective, krProgress, quarterElapsed } from '../lib'
import { AnimatedNumber } from './AnimatedNumber'
import { Ring, STATUS_GRADIENT } from './Ring'

export function GoalsSummary({ objectives, quarter }: { objectives: Objective[]; quarter: string }) {
  const overall = averageProgress(objectives)
  const companyAvg = averageProgress(objectives.filter(isCompanyObjective))
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, objectives.filter((o) => o.status === s).length])) as Record<Objective['status'], number>
  const krs = objectives.flatMap((o) => o.keyResults)
  const krDone = krs.filter((k) => krProgress(k) >= 100).length
  const elapsed = Math.round(quarterElapsed(quarter) * 100)
  const weekAgo = Date.now() - 7 * 864e5
  const weeklyCheckins = krs.reduce((a, k) => a + (k.history ?? []).filter((h) => new Date(h.at).getTime() > weekAgo).length, 0)
  const total = objectives.length || 1

  return (
    <Card spotlight padded={false} className="mb-6">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(600px circle at 0% 0%, rgb(var(--accent) / 0.16), transparent 50%), radial-gradient(500px circle at 100% 100%, rgb(var(--accent-2) / 0.12), transparent 50%)' }} />
      <div className="relative grid gap-6 p-5 sm:p-6 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-center gap-5">
          <Ring value={overall} size={116} stroke={11}>
            <div className="text-center">
              <AnimatedNumber value={overall} suffix="%" className="font-display text-3xl font-bold tracking-tight" />
              <div className="text-[10px] text-muted">전체 진척도</div>
            </div>
          </Ring>
          <div className="space-y-2.5">
            <div>
              <div className="text-xs text-muted">회사 목표 평균</div>
              <AnimatedNumber value={companyAvg} suffix="%" className="font-display text-xl font-semibold gradient-text" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <ListChecks className="h-3.5 w-3.5" />
              핵심 결과 <span className="font-semibold text-fg">{krDone}</span>/{krs.length} 달성
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Flag className="h-3.5 w-3.5" />
              이번 주 체크인 <span className="font-semibold text-fg">{weeklyCheckins}</span>회
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-muted">목표 상태 분포</span>
            <span className="text-subtle">{objectives.length}개 목표</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-line/10">
            {STATUS_ORDER.map((s, i) => (
              <motion.div
                key={s}
                className="h-full"
                style={{ background: `linear-gradient(90deg, ${STATUS_GRADIENT[s][0]}, ${STATUS_GRADIENT[s][1]})` }}
                initial={{ width: 0 }}
                animate={{ width: `${(counts[s] / total) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUS_ORDER.map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                className="rounded-xl border border-line/10 bg-line/[0.03] px-3 py-2.5"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[s].color, boxShadow: `0 0 10px ${STATUS_META[s].color}` }} />
                  {STATUS_META[s].label}
                </div>
                <AnimatedNumber value={counts[s]} className="font-display text-2xl font-bold" />
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4 xl:w-56">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <CalendarClock className="h-3.5 w-3.5" /> {quarter} 경과
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <AnimatedNumber value={elapsed} className="font-display text-2xl font-bold" />
            <span className="text-sm text-muted">%</span>
          </div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-line/10">
            <motion.div className="h-full rounded-full bg-line/40" initial={{ width: 0 }} animate={{ width: `${elapsed}%` }} transition={{ duration: 1 }} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-subtle">
            {overall >= elapsed ? '진척도가 시간 경과를 앞서고 있어요 👏' : '진척도가 일정보다 뒤처져 있어요. 리스크를 점검하세요.'}
          </p>
        </div>
      </div>
    </Card>
  )
}
