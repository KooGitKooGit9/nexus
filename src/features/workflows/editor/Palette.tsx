import { useState, type DragEvent } from 'react'
import { GripVertical, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui'
import { CATEGORY_META, NODE_DEFS } from '../catalog'
import type { NodeCategory } from '../types'
import { NodeIcon } from '../components/bits'

export const DND_MIME = 'application/nexus-node'

const ORDER: NodeCategory[] = ['trigger', 'condition', 'action', 'delay']

export function Palette({ onAdd, overlay, onClose, className }: { onAdd: (kind: string) => void; overlay?: boolean; onClose?: () => void; className?: string }) {
  const [q, setQ] = useState('')
  const onDragStart = (e: DragEvent, kind: string) => {
    e.dataTransfer.setData(DND_MIME, kind)
    e.dataTransfer.effectAllowed = 'move'
  }
  const needle = q.trim().toLowerCase()
  const filtered = NODE_DEFS.filter((d) => !needle || d.label.toLowerCase().includes(needle) || d.description.toLowerCase().includes(needle) || d.kind.includes(needle))

  return (
    <aside
      className={cn(
        'glass-strong flex w-64 shrink-0 flex-col',
        overlay ? 'absolute bottom-3 left-3 top-3 z-30 max-w-[calc(100%-24px)] overflow-hidden rounded-2xl border border-line/10 shadow-float transition-[bottom] duration-300' : 'border-r border-line/10',
        className,
      )}
    >
      <div className="border-b border-line/10 p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">노드 팔레트</span>
          {overlay && onClose && (
            <button type="button" onClick={onClose} title="팔레트 닫기" className="-mr-1 rounded-md p-1 text-muted transition hover:bg-line/10 hover:text-fg"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>
        <Input icon={<Search />} placeholder="노드 검색" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-[13px]" />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {ORDER.map((cat) => {
          const items = filtered.filter((d) => d.category === cat)
          if (!items.length) return null
          const meta = CATEGORY_META[cat]
          return (
            <div key={cat}>
              <div className={cn('mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold', meta.text)}>
                <span>{meta.glyph}</span>
                {meta.label}
                <span className="ml-auto text-subtle">{items.length}</span>
              </div>
              <div className="space-y-1">
                {items.map((d) => (
                  <div
                    key={d.kind}
                    draggable
                    onDragStart={(e) => onDragStart(e, d.kind)}
                    onDoubleClick={() => onAdd(d.kind)}
                    title="드래그해서 캔버스에 놓거나 더블클릭해서 추가"
                    className={cn(
                      'group flex cursor-grab items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition active:cursor-grabbing',
                      'hover:border-line/10 hover:bg-line/[0.05] hover:shadow-card',
                    )}
                  >
                    <NodeIcon kind={d.kind} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-fg">{d.label}</div>
                      <div className="truncate text-[11px] text-subtle">{d.description}</div>
                    </div>
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition group-hover:opacity-100" />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {!filtered.length && <div className="py-8 text-center text-xs text-subtle">"{q}"에 맞는 노드가 없어요</div>}
      </div>
      <div className="border-t border-line/10 p-3 text-[11px] leading-relaxed text-subtle">
        💡 노드를 드래그해 캔버스에 놓고, 핸들을 끌어 연결하세요. <span className="font-mono">⌫</span>로 삭제.
      </div>
    </aside>
  )
}
