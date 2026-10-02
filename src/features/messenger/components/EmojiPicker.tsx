import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover } from '@/components/ui'
import { EMOJI_CATEGORIES, emojiName, searchEmoji } from '../emoji'
import { useMessenger } from '../store'

export function EmojiPicker({ onPick, autoFocus = true }: { onPick: (emoji: string) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('')
  const [hover, setHover] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState('recent')
  const recent = useMessenger((s) => s.recentEmoji)
  const pushRecent = useMessenger((s) => s.pushRecentEmoji)
  const scroller = useRef<HTMLDivElement>(null)

  const sections = useMemo(
    () => [{ id: 'recent', label: '최근 사용', icon: '🕘', items: recent.map((e) => ({ e, k: emojiName(e) })) }, ...EMOJI_CATEGORIES],
    [recent],
  )
  const results = useMemo(() => searchEmoji(q, 80), [q])

  const pickIt = (e: string) => {
    pushRecent(e)
    onPick(e)
  }

  const jump = (id: string) => {
    setActiveCat(id)
    setQ('')
    requestAnimationFrame(() => {
      const el = scroller.current?.querySelector<HTMLElement>(`[data-cat="${id}"]`)
      if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' })
    })
  }

  const onScroll = () => {
    const sc = scroller.current
    if (!sc || q) return
    const heads = Array.from(sc.querySelectorAll<HTMLElement>('[data-cat]'))
    let cur = heads[0]?.dataset.cat ?? 'recent'
    for (const h of heads) if (h.offsetTop - sc.scrollTop <= 24) cur = h.dataset.cat!
    if (cur !== activeCat) setActiveCat(cur)
  }

  const grid = (items: { e: string; k: string }[]) => (
    <div className="grid grid-cols-8 gap-0.5 px-1">
      {items.map((it) => (
        <button
          key={it.e}
          type="button"
          onMouseEnter={() => setHover(it.e)}
          onClick={() => pickIt(it.e)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[22px] leading-none transition hover:scale-[1.18] hover:bg-line/[0.08] active:scale-95"
        >
          {it.e}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex w-[336px] flex-col" onMouseDown={(e) => e.stopPropagation()}>
      <div className="p-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이모지 검색 (예: 축하, fire)"
            className="h-9 w-full rounded-xl border border-line/10 bg-surface-2/70 pl-8 pr-3 text-[13px] outline-none transition placeholder:text-subtle focus:border-accent/50 focus:ring-4 focus:ring-accent/10"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) {
                e.preventDefault()
                pickIt(results[0].e)
              }
            }}
          />
        </div>
      </div>
      {!q && (
        <div className="flex items-center justify-between border-b border-line/[0.07] px-2 pb-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              title={s.label}
              className={cn('relative flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:bg-line/[0.07]', activeCat === s.id ? 'opacity-100' : 'opacity-50 grayscale-[40%]')}
            >
              {s.id === 'recent' ? <Clock className="h-4 w-4 text-muted" /> : s.icon}
              {activeCat === s.id && <span className="absolute -bottom-1 left-2 right-2 h-0.5 rounded-full bg-accent-gradient" />}
            </button>
          ))}
        </div>
      )}
      <div ref={scroller} onScroll={onScroll} className="relative h-[264px] overflow-y-auto py-1">
        {q ? (
          results.length ? (
            <>
              <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold text-subtle">검색 결과</div>
              {grid(results)}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
              <span className="text-3xl">🔍</span>
              "{q}"에 맞는 이모지가 없어요
            </div>
          )
        ) : (
          sections.map((s) => (
            <div key={s.id} data-cat={s.id} className="pb-1">
              <div className="sticky top-0 z-[1] bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-subtle backdrop-blur">{s.label}</div>
              {grid(s.items)}
            </div>
          ))
        )}
      </div>
      <div className="flex h-11 items-center gap-2.5 border-t border-line/[0.07] px-3">
        {hover ? (
          <>
            <span className="text-[26px] leading-none">{hover}</span>
            <span className="text-[12px] text-muted">:{emojiName(hover) || 'emoji'}:</span>
          </>
        ) : (
          <span className="text-[12px] text-subtle">이모지를 선택하세요</span>
        )}
      </div>
    </div>
  )
}

/** Popover wrapper for convenience. */
export function EmojiPopover({
  trigger,
  onPick,
  placement = 'top-end',
  open,
  onOpenChange,
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode
  onPick: (e: string) => void
  placement?: 'top-end' | 'top-start' | 'bottom-end' | 'bottom-start' | 'left-start'
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  return (
    <Popover placement={placement} trigger={trigger} className="p-1" open={open} onOpenChange={onOpenChange}>
      {(close) => (
        <EmojiPicker
          onPick={(e) => {
            onPick(e)
            close()
          }}
        />
      )}
    </Popover>
  )
}
