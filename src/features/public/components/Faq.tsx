import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FaqItem { q: string; a: ReactNode }

/** Accessible accordion (button + region, one open at a time). */
export function Faq({ items, className }: { items: FaqItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0)
  const base = useId()
  return (
    <div className={cn('divide-y divide-line/[0.08] overflow-hidden rounded-3xl border border-line/10 bg-surface/50 backdrop-blur', className)}>
      {items.map((it, i) => {
        const on = open === i
        const bid = `${base}-b${i}`
        const pid = `${base}-p${i}`
        return (
          <div key={it.q}>
            <h3>
              <button
                id={bid}
                type="button"
                aria-expanded={on}
                aria-controls={pid}
                onClick={() => setOpen(on ? null : i)}
                className="focus-ring flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-line/[0.03] sm:px-6"
              >
                <span className="min-w-0 flex-1 text-[15px] font-semibold text-fg break-keep">{it.q}</span>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line/10 transition-all duration-300', on ? 'rotate-45 bg-accent-gradient text-white border-transparent' : 'text-muted')}>
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div
                  id={pid}
                  role="region"
                  aria-labelledby={bid}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 text-[14px] leading-relaxed text-muted break-keep sm:px-6">{it.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
