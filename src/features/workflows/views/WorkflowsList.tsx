import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { LayoutTemplate, Plus, Search, Workflow as WorkflowIcon, Sparkles } from 'lucide-react'
import { Page } from '@/app/Page'
import { Button, EmptyState, Input, PageHeader, Tabs, FadeIn } from '@/components/ui'
import { toast } from '@/store/core'
import { useWorkflows } from '../store'
import { HeroStats } from '../components/HeroStats'
import { WorkflowCard } from '../components/WorkflowCard'
import { TemplateGalleryModal, TemplateGrid } from '../components/TemplateGallery'
import { TEMPLATES } from '../templates'

type Filter = 'all' | 'on' | 'off'

export function WorkflowsList() {
  const workflows = useWorkflows((s) => s.workflows)
  const createFromTemplate = useWorkflows((s) => s.createFromTemplate)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const galleryOpen = params.get('new') === '1'
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const setGallery = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('new', '1')
    else next.delete('new')
    // opening pushes a history entry so that, after creating, the editor can *replace* it —
    // browser Back from the new workflow then lands on the list instead of re-opening the gallery
    setParams(next, { replace: !open })
  }

  const use = (tplId: string) => {
    const id = createFromTemplate(tplId)
    const tpl = TEMPLATES.find((t) => t.id === tplId)
    toast(tpl ? `"${tpl.name}" 템플릿으로 생성했어요` : '새 워크플로우를 만들었어요', { emoji: tpl?.emoji ?? '✨', variant: 'success', description: '캔버스에서 단계를 수정하고 활성화하세요' })
    navigate(`/workflows/${id}`, { replace: galleryOpen })
  }

  const list = useMemo(() => {
    return workflows
      .filter((w) => (filter === 'on' ? w.enabled : filter === 'off' ? !w.enabled : true))
      .filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()) || (w.description ?? '').toLowerCase().includes(q.trim().toLowerCase()))
  }, [workflows, filter, q])

  const onCount = workflows.filter((w) => w.enabled).length

  return (
    <Page>
      <PageHeader
        icon={<WorkflowIcon />}
        title="자동화"
        subtitle="반복 업무는 Nexus에게 맡기고, 중요한 일에 집중하세요"
        actions={
          <>
            <Button variant="secondary" leftIcon={<LayoutTemplate className="h-4 w-4" />} onClick={() => setGallery(true)}>템플릿</Button>
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setGallery(true)}>새 워크플로우</Button>
          </>
        }
      />

      <HeroStats />

      <div className="mt-9 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-fg">내 워크플로우</h2>
          <Tabs
            size="sm"
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: '전체', count: workflows.length },
              { value: 'on', label: '활성', count: onCount },
              { value: 'off', label: '비활성', count: workflows.length - onCount },
            ]}
          />
        </div>
        <div className="w-full sm:w-64">
          <Input icon={<Search />} placeholder="워크플로우 검색" value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((w, i) => (
            <WorkflowCard key={w.id} wf={w} index={i} />
          ))}
        </AnimatePresence>
      </div>
      {list.length === 0 && (
        <EmptyState
          icon={<Sparkles />}
          title={q ? '검색 결과가 없어요' : filter === 'on' ? '활성화된 워크플로우가 없어요' : filter === 'off' ? '비활성 워크플로우가 없어요' : '워크플로우가 없어요'}
          description={q ? '다른 키워드로 검색해 보세요.' : filter === 'on' ? '카드의 스위치를 켜면 자동으로 실행되기 시작해요.' : filter === 'off' ? '모든 워크플로우가 실행 중이에요 ⚡' : '템플릿으로 첫 자동화를 만들어 보세요.'}
          action={!q && filter === 'all' && <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setGallery(true)}>새 워크플로우</Button>}
        />
      )}

      <FadeIn delay={0.2} className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-fg">템플릿 갤러리</h2>
            <p className="mt-0.5 text-sm text-muted">오로라랩스 팀이 가장 많이 쓰는 자동화</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setGallery(true)}>전체 보기</Button>
        </div>
        <TemplateGrid onUse={use} />
      </FadeIn>

      <TemplateGalleryModal open={galleryOpen} onClose={() => setGallery(false)} onUse={use} />
    </Page>
  )
}
