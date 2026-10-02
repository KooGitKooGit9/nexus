import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2 } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { COMPANY } from '@/store/seed-users'
import type { Objective } from '../types'
import { STATUS_META, averageProgress, isCompanyObjective, objectiveProgress } from '../lib'
import { Ring, STATUS_GRADIENT } from './Ring'

interface Edge { id: string; d: string; color: string; delay: number }

/** Visual alignment tree: company root → company objectives → team objectives, with SVG bezier connectors. */
export function AlignmentTree({ objectives, quarter, onOpen }: { objectives: Objective[]; quarter: string; onOpen: (id: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<Edge[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const companies = objectives.filter((o) => !o.parentId || !objectives.some((p) => p.id === o.parentId))
  const childrenOf = (id: string) => objectives.filter((o) => o.parentId === id)
  const overall = averageProgress(objectives)

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const compute = () => {
      const base = el.getBoundingClientRect()
      const rect = (id: string) => {
        const n = el.querySelector<HTMLElement>(`[data-node="${id}"]`)
        if (!n) return null
        const r = n.getBoundingClientRect()
        return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
      }
      const out: Edge[] = []
      const root = rect('root')
      companies.forEach((c, ci) => {
        const cr = rect(c.id)
        if (root && cr) {
          const x1 = root.x + root.w / 2, y1 = root.y + root.h
          const x2 = cr.x + cr.w / 2, y2 = cr.y
          const my = (y1 + y2) / 2
          out.push({ id: `root-${c.id}`, d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, color: STATUS_GRADIENT[c.status][0], delay: ci * 0.08 })
        }
        childrenOf(c.id).forEach((t, ti) => {
          const tr = rect(t.id)
          if (!cr || !tr) return
          const x1 = cr.x + 28, y1 = cr.y + cr.h
          const x2 = tr.x, y2 = tr.y + tr.h / 2
          out.push({ id: `${c.id}-${t.id}`, d: `M${x1},${y1} L${x1},${y2 - 14} Q${x1},${y2} ${x1 + 14},${y2} L${x2},${y2}`, color: STATUS_GRADIENT[t.status][0], delay: 0.3 + ci * 0.08 + ti * 0.06 })
        })
      })
      setEdges(out)
      setSize({ w: el.scrollWidth, h: el.scrollHeight })
    }
    compute()
    // nodes animate in with a transform — re-measure once they settle
    const timers = [450, 900, 1400].map((ms) => window.setTimeout(compute, ms))
    // re-measure when the tree resizes *or* any single node changes height (text re-wrap, font load)
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(compute)
    })
    ro.observe(el)
    el.querySelectorAll('[data-node]').forEach((n) => ro.observe(n))
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectives])

  return (
    <div className="overflow-x-auto pb-4">
      <div ref={wrap} className="relative mx-auto min-w-[880px] px-2 pt-2">
        <svg className="pointer-events-none absolute left-0 top-0" width={size.w} height={size.h}>
          {edges.map((e) => (
            <g key={e.id}>
              <motion.path d={e.d} fill="none" stroke={e.color} strokeOpacity={0.18} strokeWidth={6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: e.delay }} />
              <motion.path d={e.d} fill="none" stroke={e.color} strokeOpacity={0.75} strokeWidth={1.6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: e.delay }} />
            </g>
          ))}
        </svg>

        {/* Root */}
        <div className="flex justify-center">
          <motion.div
            data-node="root"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex items-center gap-3 rounded-2xl bg-accent-gradient px-5 py-3 text-white shadow-glow"
          >
            <Building2 className="h-5 w-5" />
            <div>
              <div className="text-sm font-semibold">{COMPANY.nameKo} · {quarter}</div>
              <div className="text-[11px] text-white/80">회사 목표 {companies.filter(isCompanyObjective).length}개 · 전체 {overall}%</div>
            </div>
          </motion.div>
        </div>

        <div className="mt-14 grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.max(1, companies.length)}, minmax(260px, 1fr))` }}>
          {companies.map((c, ci) => (
            <div key={c.id} className="flex flex-col">
              <TreeNode o={c} company={isCompanyObjective(c)} onOpen={onOpen} delay={0.1 + ci * 0.08} />
              <div className="mt-4 flex flex-col gap-3 pl-12">
                {childrenOf(c.id).map((t, ti) => (
                  <TreeNode key={t.id} o={t} onOpen={onOpen} delay={0.35 + ci * 0.08 + ti * 0.05} />
                ))}
                {!childrenOf(c.id).length && <div className="rounded-xl border border-dashed border-line/15 px-3 py-3 text-xs text-subtle">정렬된 팀 목표가 없습니다</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TreeNode({ o, company, onOpen, delay }: { o: Objective; company?: boolean; onOpen: (id: string) => void; delay: number }) {
  const p = objectiveProgress(o)
  const [from, to] = STATUS_GRADIENT[o.status]
  return (
    <motion.button
      data-node={o.id}
      onClick={() => onOpen(o.id)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className={cn('glass relative flex items-center gap-3 rounded-2xl p-3 text-left transition-shadow hover:shadow-glow-sm', company && 'gradient-border p-4')}
    >
      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: `linear-gradient(${from}, ${to})` }} />
      <Ring value={p} size={company ? 48 : 40} stroke={company ? 5 : 4} from={from} to={to} glow={false}>
        <span className="text-[10px] font-bold tabular-nums">{p}%</span>
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <span>{o.emoji ?? '🎯'}</span>
          <span className="truncate">{company ? '회사 목표' : o.team}</span>
          <span className="ml-auto shrink-0" style={{ color: STATUS_META[o.status].color }}>● {STATUS_META[o.status].label}</span>
        </div>
        <div className={cn('mt-0.5 line-clamp-2 font-medium leading-snug text-fg', company ? 'text-[14px]' : 'text-[13px]')}>{o.title}</div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-subtle">
          <Avatar userId={o.ownerId} size="xs" />
          KR {o.keyResults.length}개
        </div>
      </div>
    </motion.button>
  )
}
