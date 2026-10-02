import { useState } from 'react'
import { Check, Shuffle, Trash2 } from 'lucide-react'
import { cn, pick } from '@/lib/utils'
import { ALL_EMOJIS, COVERS, EMOJI_GROUPS } from '../constants'

export function EmojiPickerPanel({ value, onPick, onRemove }: { value?: string; onPick: (e: string) => void; onRemove?: () => void }) {
  const [group, setGroup] = useState(0)
  return (
    <div className="w-[320px]">
      <div className="flex items-center gap-1 border-b border-line/10 px-1.5 pb-1.5">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => setGroup(i)}
            className={cn('rounded-md px-2 py-1 text-[11px] font-medium transition', group === i ? 'bg-accent/15 text-accent' : 'text-subtle hover:text-fg')}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid max-h-[220px] grid-cols-8 gap-0.5 overflow-y-auto p-1.5">
        {EMOJI_GROUPS[group].emojis.map((em) => (
          <button
            key={em}
            onClick={() => onPick(em)}
            className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-[20px] transition hover:scale-110 hover:bg-line/10', value === em && 'bg-accent/15 ring-1 ring-accent/40')}
          >
            {em}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line/10 px-1.5 pt-1.5">
        <button onClick={() => onPick(pick(ALL_EMOJIS))} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-line/[0.06] hover:text-fg">
          <Shuffle className="h-3.5 w-3.5" /> 랜덤
        </button>
        {onRemove && (
          <button onClick={onRemove} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-danger/10 hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" /> 제거
          </button>
        )}
      </div>
    </div>
  )
}

export function CoverPickerPanel({ value, onPick, onRemove }: { value?: string; onPick: (css: string) => void; onRemove?: () => void }) {
  return (
    <div className="w-[340px] p-1.5">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">그라디언트 커버</span>
        <button onClick={() => onPick(pick(COVERS).css)} className="flex items-center gap-1 text-[11px] text-muted hover:text-accent">
          <Shuffle className="h-3 w-3" /> 랜덤
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {COVERS.map((c) => {
          const active = value === c.css
          return (
            <button key={c.id} onClick={() => onPick(c.css)} className="group text-left">
              <div
                className={cn('relative h-12 rounded-xl ring-1 ring-line/10 transition group-hover:scale-[1.04] group-hover:shadow-card', active && 'ring-2 ring-accent shadow-glow-sm')}
                style={{ background: c.css }}
              >
                {active && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/40 p-1 text-white backdrop-blur"><Check className="h-3 w-3" /></span>
                  </span>
                )}
              </div>
              <div className="mt-1 truncate text-center text-[10px] text-subtle">{c.name}</div>
            </button>
          )
        })}
      </div>
      {onRemove && (
        <button onClick={onRemove} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-muted hover:bg-danger/10 hover:text-danger">
          <Trash2 className="h-3.5 w-3.5" /> 커버 제거
        </button>
      )}
    </div>
  )
}
