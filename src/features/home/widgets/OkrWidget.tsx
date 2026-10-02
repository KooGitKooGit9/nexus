import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Target } from 'lucide-react'
import { useGoals } from '@/features/goals/store'
import { CURRENT_QUARTER } from '@/features/goals/seed'
import { STATUS_META, averageProgress, isCompanyObjective, objectiveProgress, quarterOf } from '@/features/goals/lib'
import { Ring, STATUS_GRADIENT } from '@/features/goals/components/Ring'
import { Widget, WidgetLink, MiniEmpty } from '../components/Widget'

export function OkrWidget({ className, delay }: { className?: string; delay?: number }) {
  const navigate = useNavigate()
  const objectives = useGoals((s) => s.objectives)
  const { quarter, company, all } = useMemo(() => {
    const qNow = quarterOf()
    const quarter = objectives.some((o) => o.quarter === qNow) ? qNow : CURRENT_QUARTER
    const all = objectives.filter((o) => o.quarter === quarter)
    return { quarter, company: all.filter(isCompanyObjective), all }
  }, [objectives])
  const overall = averageProgress(company)
  const atRisk = all.filter((o) => o.status === 'at_risk' || o.status === 'off_track').length

  return (
    <Widget
      className={className}
      delay={delay}
      title="회사 OKR 진척도"
      subtitle={`${quarter} · 평균 ${overall}%${atRisk ? ` · 주의 필요 ${atRisk}개` : ''}`}
      icon={<Target />}
      gradient="from-amber-400 to-orange-600"
      action={<WidgetLink onClick={() => navigate('/goals')}>OKR →</WidgetLink>}
    >
      {company.length === 0 ? (
        <MiniEmpty emoji="🎯" title="이번 분기 목표가 없어요" />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {company.slice(0, 3).map((o, i) => {
            const p = objectiveProgress(o)
            const [from, to] = STATUS_GRADIENT[o.status]
            return (
              <motion.button
                key={o.id}
                onClick={() => navigate(`/goals?quarter=${encodeURIComponent(o.quarter)}&id=${o.id}`)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (delay ?? 0) + 0.2 + i * 0.08 }}
                whileHover={{ y: -3 }}
                className="flex flex-col items-center rounded-2xl border border-transparent p-2 text-center transition hover:border-line/10 hover:bg-line/[0.03]"
              >
                <Ring value={p} size={84} stroke={8} from={from} to={to}>
                  <div>
                    <div className="text-lg leading-none">{o.emoji ?? '🎯'}</div>
                    <div className="mt-0.5 font-display text-sm font-bold tabular-nums">{p}%</div>
                  </div>
                </Ring>
                <div className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug text-fg/90">{o.title}</div>
                <div className="mt-1 text-[10px] font-medium" style={{ color: STATUS_META[o.status].color }}>● {STATUS_META[o.status].label}</div>
              </motion.button>
            )
          })}
        </div>
      )}
    </Widget>
  )
}
