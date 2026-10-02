import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KIND_META, KIND_ORDER } from '../meta'
import type { ApprovalKind } from '../types'
import { KindIcon } from '../components/bits'

export function StepType({ value, onPick }: { value: ApprovalKind | null; onPick: (k: ApprovalKind) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {KIND_ORDER.map((k, i) => {
        const m = KIND_META[k]
        const active = value === k
        return (
          <motion.button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'group relative flex flex-col items-start overflow-hidden rounded-2xl border p-5 text-left transition-colors focus-ring',
              active ? 'border-accent/60 bg-accent/[0.08] shadow-glow-sm' : 'border-line/10 bg-line/[0.03] hover:border-line/25 hover:bg-line/[0.05]',
            )}
          >
            <div className={cn('pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40', m.gradient, active && 'opacity-40')} />
            <KindIcon kind={k} size="lg" className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
            <div className="relative mt-4 text-[15px] font-semibold text-fg">{m.label}</div>
            <div className="relative mt-0.5 text-xs text-muted">{m.description}</div>
            <span className="absolute right-3 top-3 text-xl opacity-70 transition group-hover:scale-125">{m.emoji}</span>
            {active && (
              <motion.span layoutId="kind-check" className="absolute bottom-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-gradient text-white shadow-glow-sm">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </motion.span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
