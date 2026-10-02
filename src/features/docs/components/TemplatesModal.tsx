import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FilePlus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Modal } from '@/components/ui'
import { useDocs } from '../store'
import { useDocsUI } from '../uiStore'
import { useCreateDoc } from '../hooks'
import { TEMPLATES } from '../templates'
import { StaticBlocks } from './StaticBlocks'

export function TemplatesModal() {
  const open = useDocsUI((s) => s.templatesOpen)
  const parentId = useDocsUI((s) => s.templatesParentId)
  const close = useDocsUI((s) => s.closeTemplates)
  const parent = useDocs((s) => s.docs.find((d) => d.id === parentId))
  const createDoc = useCreateDoc()
  const [selected, setSelected] = useState(TEMPLATES[0].id)
  const tpl = TEMPLATES.find((t) => t.id === selected) ?? TEMPLATES[0]
  const preview = useMemo(() => tpl.content(), [tpl])

  return (
    <Modal open={open} onClose={close} size="full" title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> 템플릿 갤러리</span>} description={parent ? `${parent.emoji} ${parent.title} 하위에 새 페이지를 만듭니다` : '검증된 템플릿으로 빠르게 시작하세요'}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* template list */}
        <div className="grid content-start gap-2.5 sm:grid-cols-2">
          <button
            onClick={() => createDoc({ parentId })}
            className="group flex items-center gap-3 rounded-2xl border border-dashed border-line/20 p-3.5 text-left transition hover:border-accent/50 hover:bg-accent/5 sm:col-span-2"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-line/[0.06] text-muted transition group-hover:bg-accent-gradient group-hover:text-white group-hover:shadow-glow-sm">
              <FilePlus className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">빈 페이지</span>
              <span className="block text-xs text-subtle">처음부터 자유롭게 작성하기</span>
            </span>
          </button>
          {TEMPLATES.map((t, i) => {
            const active = t.id === selected
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onMouseEnter={() => setSelected(t.id)}
                onFocus={() => setSelected(t.id)}
                onClick={() => setSelected(t.id)}
                onDoubleClick={() => createDoc({ parentId, template: t })}
                className={cn(
                  'relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all',
                  active ? 'border-accent/50 bg-accent/[0.07] shadow-glow-sm' : 'border-line/10 bg-line/[0.02] hover:border-line/20',
                )}
              >
                <div className={cn('absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br opacity-30 blur-2xl', t.tint)} />
                <div className="relative flex items-start gap-3">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-card', t.tint)}>{t.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t.description}</span>
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* preview */}
        <div className="relative overflow-hidden rounded-2xl border border-line/10 bg-surface/60">
          <AnimatePresence mode="wait">
            <motion.div key={tpl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <div className="h-24" style={{ background: tpl.cover }} />
              <div className="px-6 pb-6">
                <div className="-mt-7 text-[44px] leading-none drop-shadow-lg">{tpl.emoji}</div>
                <h3 className="mt-2 font-display text-2xl font-bold">{tpl.title}</h3>
                <div className="relative mt-3 max-h-[340px] overflow-hidden">
                  <StaticBlocks markdown={preview} limit={22} />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-subtle">더블클릭으로도 바로 사용할 수 있어요</span>
                  <Button variant="primary" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => createDoc({ parentId, template: tpl })}>
                    이 템플릿 사용
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  )
}
