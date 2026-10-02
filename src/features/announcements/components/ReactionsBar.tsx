import { AnimatePresence, motion } from 'framer-motion'
import { SmilePlus } from 'lucide-react'
import { Popover, Tooltip } from '@/components/ui'
import { getUser, useCore } from '@/store/core'
import { cn } from '@/lib/utils'
import { useGoals } from '@/features/goals/store'
import { QUICK_REACTIONS } from '../meta'

export function ReactionsBar({ id, reactions }: { id: string; reactions: Record<string, string[]> }) {
  const me = useCore((s) => s.currentUserId)
  const toggle = useGoals((s) => s.toggleReaction)
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length)

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <AnimatePresence initial={false}>
        {entries.map(([emoji, ids]) => {
          const mine = ids.includes(me)
          const names = ids.map((u) => getUser(u)?.name).filter(Boolean)
          return (
            <motion.div key={emoji} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <Tooltip content={`${names.slice(0, 5).join(', ')}${names.length > 5 ? ` 외 ${names.length - 5}명` : ''}`}>
                <button
                  onClick={() => toggle(id, emoji)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition active:scale-90',
                    mine ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm' : 'border-line/10 bg-line/[0.04] text-muted hover:border-line/25',
                  )}
                >
                  <span className="text-sm leading-none">{emoji}</span>
                  <motion.span key={ids.length} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums font-medium">{ids.length}</motion.span>
                </button>
              </Tooltip>
            </motion.div>
          )
        })}
      </AnimatePresence>
      <Popover
        placement="top-start"
        className="p-2 min-w-0"
        trigger={({ toggle: t }) => (
          <button onClick={t} className="flex h-6 w-7 items-center justify-center rounded-full border border-dashed border-line/20 text-subtle transition hover:border-accent/50 hover:text-accent">
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        )}
      >
        {(close) => (
          <div className="grid grid-cols-6 gap-1">
            {QUICK_REACTIONS.map((e) => (
              <button key={e} onClick={() => { toggle(id, e); close() }} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:scale-125 hover:bg-line/10">
                {e}
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  )
}
