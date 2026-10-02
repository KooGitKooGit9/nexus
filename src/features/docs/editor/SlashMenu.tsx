import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui'
import type { SlashItem } from './slashItems'

interface Props {
  items: SlashItem[]
  index: number
  query: string
  onSelect: (item: SlashItem) => void
  onHover: (index: number) => void
}

/** Animated block-type picker shown under a block when typing `/`. */
export function SlashMenu({ items, index, query, onSelect, onHover }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [above, setAbove] = useState(false)

  useLayoutEffect(() => {
    const host = ref.current?.parentElement
    if (!host) return
    const r = host.getBoundingClientRect()
    setAbove(r.bottom + 360 > window.innerHeight && r.top > 380)
  }, [])

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-slash-index="${index}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [index])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: above ? 6 : -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'absolute left-6 z-50 w-[300px] overflow-hidden rounded-2xl glass-strong shadow-float',
        above ? 'bottom-full mb-2 origin-bottom-left' : 'top-full mt-1.5 origin-top-left',
      )}
    >
      <div className="flex items-center justify-between border-b border-line/10 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
          {query ? <>“{query}” 검색</> : '기본 블록'}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-subtle">
          <Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>↵</Kbd>
        </span>
      </div>
      <div className="max-h-[300px] overflow-y-auto p-1.5">
        {items.length === 0 && <div className="px-3 py-6 text-center text-sm text-subtle">일치하는 블록이 없어요</div>}
        {items.map((it, i) => {
          const Icon = it.icon
          const active = i === index
          return (
            <button
              key={it.type}
              data-slash-index={i}
              onMouseEnter={() => onHover(i)}
              onClick={() => onSelect(it)}
              className={cn('relative flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors', active ? 'text-fg' : 'text-fg/85')}
            >
              {active && (
                <motion.span layoutId="slash-active" className="absolute inset-0 rounded-xl bg-accent/[0.12] ring-1 ring-accent/25" transition={{ type: 'spring', stiffness: 600, damping: 40 }} />
              )}
              <span className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line/10 bg-surface-2', it.tint)}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{it.label}</span>
                <span className="block truncate text-[11px] text-subtle">{it.desc}</span>
              </span>
              {it.hint && <span className="relative font-mono text-[10px] text-subtle">{it.hint}</span>}
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
