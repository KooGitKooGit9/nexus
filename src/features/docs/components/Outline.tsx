import { useEffect, useMemo, useState, type RefObject } from 'react'
import { motion } from 'framer-motion'
import { ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseMarkdown } from '../markdown'

/** Floating table of contents built from the doc's headings; highlights the section in view. */
export function Outline({ content, scrollRef }: { content: string; scrollRef: RefObject<HTMLDivElement | null> }) {
  const headings = useMemo(
    () => parseMarkdown(content).filter((b) => (b.type === 'h1' || b.type === 'h2' || b.type === 'h3') && b.text.trim()),
    [content],
  )
  const [active, setActive] = useState(0)

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const onScroll = () => {
      const els = Array.from(root.querySelectorAll<HTMLElement>('[data-doc-heading]'))
      const top = root.getBoundingClientRect().top + 110
      let idx = 0
      els.forEach((el, i) => { if (el.getBoundingClientRect().top <= top) idx = i })
      setActive(idx)
    }
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [scrollRef, headings.length])

  if (headings.length < 2) return null

  const go = (i: number) => {
    const el = scrollRef.current?.querySelectorAll<HTMLElement>('[data-doc-heading]')[i]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <motion.nav
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25 }}
      className="sticky top-20 ml-8 w-56 max-h-[calc(100vh-12rem)] overflow-y-auto"
    >
      <div className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">
        <ListTree className="h-3.5 w-3.5" /> 목차
      </div>
      <div className="relative border-l border-line/10">
        {headings.map((h, i) => (
          <button
            key={h.id}
            onClick={() => go(i)}
            className={cn(
              'relative block w-full truncate py-1 pr-2 text-left text-[12.5px] transition-colors',
              h.type === 'h1' ? 'pl-3' : h.type === 'h2' ? 'pl-5' : 'pl-7 text-[12px]',
              i === active ? 'font-medium text-fg' : 'text-subtle hover:text-muted',
            )}
          >
            {i === active && <motion.span layoutId="outline-active" className="absolute -left-px top-1 bottom-1 w-[2px] rounded-full bg-accent-gradient shadow-glow-sm" />}
            {h.text.replace(/\*\*/g, '')}
          </button>
        ))}
      </div>
    </motion.nav>
  )
}
