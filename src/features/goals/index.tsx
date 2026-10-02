import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { GitFork, LayoutList, Plus, Target, Sparkles, User as UserIcon } from 'lucide-react'
import { Page } from '@/app/Page'
import { Button, EmptyState, FadeIn, PageHeader, Tabs } from '@/components/ui'
import { getCurrentUserId, useUI } from '@/store/core'
import { cn } from '@/lib/utils'
import { useGoals } from './store'
import { QUARTERS, CURRENT_QUARTER } from './seed'
import type { Objective } from './types'
import { isCompanyObjective } from './lib'
import { GoalsSummary } from './components/GoalsSummary'
import { ObjectiveCard } from './components/ObjectiveCard'
import { AlignmentTree } from './components/AlignmentTree'
import { KRCheckInModal } from './components/KRCheckInModal'
import { CreateObjectiveModal } from './components/CreateObjectiveModal'
import { ObjectiveDrawer } from './components/ObjectiveDrawer'

type View = 'list' | 'tree'

export default function GoalsPage() {
  const [params, setParams] = useSearchParams()
  const all = useGoals((s) => s.objectives)
  const quarter = params.get('quarter') ?? CURRENT_QUARTER
  const [view, setView] = useState<View>('list')
  const [team, setTeam] = useState<string>('전체')
  const [mine, setMine] = useState(false)
  const [kr, setKr] = useState<{ o: string; k: string } | null>(null)
  const [drawer, setDrawer] = useState<string | null>(null)
  const highlight = params.get('id')
  const createOpen = params.get('new') === '1'

  const setParam = useCallback(
    (k: string, v: string | null) =>
      setParams((p) => {
        const n = new URLSearchParams(p)
        if (v === null) n.delete(k)
        else n.set(k, v)
        return n
      }, { replace: true }),
    [setParams],
  )

  const inQuarter = useMemo(() => all.filter((o) => o.quarter === quarter), [all, quarter])
  const teams = useMemo(() => ['전체', ...Array.from(new Set(inQuarter.filter((o) => !isCompanyObjective(o)).map((o) => o.team)))], [inQuarter])
  const companyCount = inQuarter.filter(isCompanyObjective).length

  // a team chip from another quarter may not exist here → fall back to 전체
  useEffect(() => {
    if (!teams.includes(team)) setTeam('전체')
  }, [teams, team])
  const me = getCurrentUserId()

  const matchesFilter = (o: Objective) =>
    (team === '전체' || o.team === team) && (!mine || o.ownerId === me || o.keyResults.some((k) => k.ownerId === me))

  const companies = inQuarter.filter((o) => !o.parentId || !inQuarter.some((p) => p.id === o.parentId))
  const groups = companies
    .map((c) => ({ company: c, children: inQuarter.filter((o) => o.parentId === c.id && matchesFilter(o)) }))
    .filter((g) => (team === '전체' && !mine) || g.children.length > 0 || matchesFilter(g.company))

  // deep link (?id=…): jump to the objective's quarter and make sure the current filters don't hide it
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!highlight) {
      handled.current = null
      return
    }
    if (handled.current === highlight) return
    const target = all.find((o) => o.id === highlight)
    if (!target) return
    handled.current = highlight
    if (target.quarter !== quarter) setParam('quarter', target.quarter)
    if (view === 'list' && !matchesFilter(target)) {
      setTeam('전체')
      setMine(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, all])

  // scroll to & pulse a linked objective (?id=) — list card or tree node
  useEffect(() => {
    if (!highlight) return
    const t = setTimeout(() => {
      const el = document.getElementById(`obj-${highlight}`) ?? document.querySelector(`[data-node="${CSS.escape(highlight)}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    const clear = setTimeout(() => setParam('id', null), 2600)
    return () => { clearTimeout(t); clearTimeout(clear) }
  }, [highlight, setParam])

  const onKrClick = (o: string, k: string) => setKr({ o, k })

  return (
    <Page wide>
      <PageHeader
        icon={<Target />}
        title="목표 & OKR"
        subtitle={`오로라랩스 · ${quarter} · 회사 목표 ${companyCount}개 · 팀 목표 ${inQuarter.length - companyCount}개`}
        actions={
          <>
            <Tabs size="sm" value={quarter} onChange={(q) => setParam('quarter', q)} items={QUARTERS.map((q) => ({ value: q, label: q }))} />
            <Tabs<View>
              size="sm"
              value={view}
              onChange={setView}
              items={[
                { value: 'list', label: '목록', icon: <LayoutList /> },
                { value: 'tree', label: '정렬 트리', icon: <GitFork /> },
              ]}
            />
            <Button variant="ghost" size="sm" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => useUI.getState().askAI(`${quarter} OKR 진척 현황을 요약하고 리스크를 알려줘`)}>
              AI 분석
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setParam('new', '1')}>
              목표 추가
            </Button>
          </>
        }
      />

      {inQuarter.length === 0 ? (
        <EmptyState
          icon={<Target />}
          title={`${quarter}에 설정된 목표가 없어요`}
          description="회사 목표를 먼저 세우고, 팀 목표를 정렬해 보세요."
          action={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setParam('new', '1')}>첫 목표 만들기</Button>}
        />
      ) : (
        <>
          <FadeIn><GoalsSummary objectives={inQuarter} quarter={quarter} /></FadeIn>

          <AnimatePresence mode="wait">
            {view === 'tree' ? (
              <motion.div key="tree" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AlignmentTree objectives={inQuarter} quarter={quarter} onOpen={setDrawer} />
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  {teams.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTeam(t)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                        team === t ? 'border-transparent bg-accent-gradient text-white shadow-glow-sm' : 'border-line/10 text-muted hover:border-accent/40 hover:text-fg',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                  <div className="mx-1 h-4 w-px bg-line/10" />
                  <button
                    onClick={() => setMine((v) => !v)}
                    className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition', mine ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line/10 text-muted hover:text-fg')}
                  >
                    <UserIcon className="h-3.5 w-3.5" /> 내 목표
                  </button>
                </div>

                <div className="space-y-8">
                  {groups.map((g, gi) => (
                    <FadeIn key={g.company.id} delay={gi * 0.06}>
                      <ObjectiveCard
                        objective={g.company}
                        company={isCompanyObjective(g.company)}
                        highlighted={highlight === g.company.id}
                        onKrClick={onKrClick}
                        onOpen={setDrawer}
                        childCount={inQuarter.filter((o) => o.parentId === g.company.id).length}
                      />
                      {g.children.length > 0 && (
                        <div className="ml-7 mt-3 space-y-3 pl-9">
                          {g.children.map((c, ci) => {
                            const last = ci === g.children.length - 1
                            return (
                              <div key={c.id} className="relative">
                                {/* connector: vertical trunk + rounded elbow */}
                                <span className={cn('pointer-events-none absolute -left-9 -top-3 w-px bg-gradient-to-b from-accent/50 to-accent-2/40', last ? 'h-7' : 'bottom-0')} />
                                <span className="pointer-events-none absolute -left-9 top-4 h-3 w-7 rounded-bl-xl border-b border-l border-accent-2/40" />
                                <span className="pointer-events-none absolute -left-[9px] top-[25px] h-1.5 w-1.5 rounded-full bg-accent-2 shadow-[0_0_8px_rgb(var(--accent-2))]" />
                                <ObjectiveCard objective={c} highlighted={highlight === c.id} onKrClick={onKrClick} onOpen={setDrawer} />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </FadeIn>
                  ))}
                  {groups.length === 0 && <EmptyState icon={<Target />} title="조건에 맞는 목표가 없어요" description="필터를 변경해 보세요." />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <KRCheckInModal objectiveId={kr?.o ?? null} krId={kr?.k ?? null} onClose={() => setKr(null)} />
      {/* Esc in the check-in modal must not also close the drawer underneath (both listen on window) */}
      <ObjectiveDrawer id={drawer} onClose={() => !kr && setDrawer(null)} onKrClick={onKrClick} onOpen={setDrawer} />
      <CreateObjectiveModal
        open={createOpen}
        defaultQuarter={quarter}
        onClose={() => setParam('new', null)}
        onCreated={(id, q) =>
          setTimeout(
            () =>
              setParams((p) => {
                const n = new URLSearchParams(p)
                n.delete('new')
                n.set('quarter', q)
                n.set('id', id)
                return n
              }, { replace: true }),
            50,
          )
        }
      />
    </Page>
  )
}
