import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Field, Input, Modal } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { TemplateId } from '../types'
import { buildTemplate, TEMPLATES } from '../templates'
import { BoardThumbnail } from './BoardThumbnail'

const EMOJIS = ['🎨', '💡', '🧠', '🗺️', '🔁', '🚀', '📌', '🧩', '🎯', '✨']

export function CreateBoardModal({ open, onClose, onCreate, initialTemplate = 'blank' }: { open: boolean; onClose: () => void; onCreate: (v: { name: string; emoji: string; template: TemplateId }) => void; initialTemplate?: TemplateId }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎨')
  const [template, setTemplate] = useState<TemplateId>(initialTemplate)
  const previews = useMemo(() => Object.fromEntries(TEMPLATES.map((t) => [t.id, buildTemplate(t.id)])), [])

  useEffect(() => {
    if (open) {
      setName('')
      setTemplate(initialTemplate)
      setEmoji(TEMPLATES.find((t) => t.id === initialTemplate)?.emoji ?? '🎨')
    }
  }, [open, initialTemplate])

  const submit = () => {
    const t = TEMPLATES.find((x) => x.id === template)!
    onCreate({ name: name.trim() || (template === 'blank' ? '제목 없는 보드' : t.name), emoji, template })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="새 화이트보드"
      description="템플릿으로 빠르게 시작하거나 빈 캔버스에서 자유롭게 그려보세요."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>보드 만들기</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="보드 이름">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} placeholder={TEMPLATES.find((t) => t.id === template)?.name ?? '제목 없는 보드'} />
          </Field>
          <Field label="아이콘">
            <div className="flex flex-wrap gap-1">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-lg transition hover:bg-line/10', emoji === e && 'bg-accent/15 ring-1 ring-accent/50')}>{e}</button>
              ))}
            </div>
          </Field>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-muted">템플릿</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TEMPLATES.map((t) => {
              const sel = t.id === template
              return (
                <button
                  key={t.id}
                  onClick={() => { setTemplate(t.id); setEmoji(t.emoji) }}
                  className={cn('group relative overflow-hidden rounded-2xl border text-left transition-all', sel ? 'border-accent/60 shadow-glow-sm' : 'border-line/10 hover:border-line/25')}
                >
                  <div className="dot-bg relative h-24 bg-surface-2/60">
                    <BoardThumbnail elements={previews[t.id]} className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" pad={40} />
                    {sel && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent-gradient text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                  </div>
                  <div className="p-2.5">
                    <div className="text-[13px] font-semibold text-fg">{t.emoji} {t.name}</div>
                    <div className="truncate text-[11px] text-subtle">{t.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
