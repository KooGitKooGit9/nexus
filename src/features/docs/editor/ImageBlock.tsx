import { useState } from 'react'
import { ImageOff, ImagePlus, Link2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { Block } from '../markdown'
import { AutoTextarea } from './AutoTextarea'

const SAMPLE = 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1200&q=80'

export function ImageBlock({ block, onPatch, onRemove }: { block: Block; onPatch: (p: Partial<Block>) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState('')
  const [broken, setBroken] = useState(false)

  if (!block.url) {
    const submit = () => draft.trim() && onPatch({ url: draft.trim() })
    return (
      <div className="my-2 rounded-2xl border border-dashed border-line/20 bg-line/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
          <ImagePlus className="h-4 w-4 text-accent" /> 이미지 삽입
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
              placeholder="이미지 URL을 붙여넣으세요…"
              className="input-base pl-9"
            />
          </div>
          <Button variant="primary" size="md" onClick={submit}>삽입</Button>
        </div>
        <button onClick={() => onPatch({ url: SAMPLE })} className="mt-2 text-[11px] text-subtle hover:text-accent">샘플 이미지 사용하기</button>
      </div>
    )
  }

  return (
    <figure className="group/img relative my-3">
      {broken ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-line/10 bg-surface-2 text-subtle">
          <ImageOff className="h-6 w-6" />
          <span className="text-xs">이미지를 불러올 수 없어요</span>
        </div>
      ) : (
        <img src={block.url} alt={block.text} onError={() => setBroken(true)} className="max-h-[480px] w-full rounded-2xl border border-line/10 object-cover shadow-card" />
      )}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover/img:opacity-100">
        <button onClick={() => { setBroken(false); onPatch({ url: '' }) }} className="rounded-lg bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur hover:bg-black/70">
          URL 변경
        </button>
        <button onClick={onRemove} className="rounded-lg bg-black/55 p-1.5 text-white backdrop-blur hover:bg-danger"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <figcaption className="mt-2">
        <AutoTextarea
          value={block.text}
          onChange={(e) => onPatch({ text: e.target.value.replace(/\n/g, ' ') })}
          placeholder="캡션 추가…"
          className="text-center text-[13px] text-muted placeholder:text-subtle/0 group-hover/img:placeholder:text-subtle/70 focus:placeholder:text-subtle/70"
        />
      </figcaption>
    </figure>
  )
}
