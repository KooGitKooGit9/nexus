import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge, Modal } from '@/components/ui'
import { TEMPLATES, BLANK_TEMPLATE, type WorkflowTemplate } from '../templates'
import { previewKinds } from '../graph'
import { MiniFlow } from './bits'

function TemplateCard({ tpl, onUse, index }: { tpl: WorkflowTemplate; onUse: (id: string) => void; index: number }) {
  const kinds = useMemo(() => {
    const g = tpl.build()
    return previewKinds(g.nodes, g.edges, 6)
  }, [tpl])
  return (
    <motion.button
      type="button"
      onClick={() => onUse(tpl.id)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="group glass relative flex flex-col overflow-hidden rounded-2xl text-left transition-all hover:border-accent/35 hover:shadow-glow-sm focus-ring"
    >
      <div className={cn('relative h-20 overflow-hidden bg-gradient-to-br', tpl.gradient)}>
        <div className="absolute inset-0 dot-bg opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl drop-shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{tpl.emoji}</span>
        <div className="absolute bottom-2.5 right-3 rounded-lg bg-black/25 px-2 py-1.5 backdrop-blur-md">
          <MiniFlow kinds={kinds} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-fg">{tpl.name}</h4>
          <Badge tone="accent" className="ml-auto shrink-0">{tpl.tag}</Badge>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{tpl.description}</p>
        <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-subtle">
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />실행당 ~{tpl.saves}분 절약</span>
          <span className="inline-flex items-center gap-1 font-medium text-accent opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
            사용하기 <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </motion.button>
  )
}

export function TemplateGrid({ onUse, className }: { onUse: (id: string) => void; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {TEMPLATES.map((t, i) => (
        <TemplateCard key={t.id} tpl={t} onUse={onUse} index={i} />
      ))}
    </div>
  )
}

export function TemplateGalleryModal({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: (id: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} size="xl" title="템플릿으로 시작하기" description="자주 쓰는 자동화를 몇 초 만에 만들어 보세요. 생성 후 자유롭게 수정할 수 있어요.">
      <button
        type="button"
        onClick={() => onUse(BLANK_TEMPLATE.id)}
        className="group mb-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line/20 px-4 py-3.5 text-left transition hover:border-accent/50 hover:bg-accent/5"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-line/[0.06] text-muted transition group-hover:bg-accent-gradient group-hover:text-white">
          <Plus className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-fg">빈 워크플로우</span>
          <span className="block text-xs text-muted">트리거 하나에서 시작해 캔버스에서 직접 구성해요</span>
        </span>
        <ArrowRight className="ml-auto h-4 w-4 text-subtle transition group-hover:translate-x-1 group-hover:text-accent" />
      </button>
      <TemplateGrid onUse={onUse} />
    </Modal>
  )
}
