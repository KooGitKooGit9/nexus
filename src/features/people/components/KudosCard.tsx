import { memo } from 'react'
import { motion } from 'framer-motion'
import { SmilePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Popover } from '@/components/ui'
import { useCore, useUser } from '@/store/core'
import { cn, timeAgo } from '@/lib/utils'
import type { Kudos } from '../types'
import { KUDOS_BADGES } from '../lib'
import { usePeople } from '../store'

const QUICK_EMOJIS = ['👏', '🔥', '💖', '🎉', '🙌', '🚀', '🥹', '💯']

export const KudosCard = memo(function KudosCard({ kudos, compact }: { kudos: Kudos; compact?: boolean }) {
  const to = useUser(kudos.toId)
  const from = useUser(kudos.fromId)
  const meId = useCore((s) => s.currentUserId)
  const toggle = usePeople((s) => s.toggleReaction)
  const navigate = useNavigate()
  const b = KUDOS_BADGES[kudos.badge]
  if (!to || !from) return null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96, rotate: -1 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="group relative overflow-hidden rounded-2xl border border-line/10 p-4 shadow-card"
      style={{ background: `linear-gradient(150deg, ${b.from}26, ${b.to}10 55%, rgb(var(--surface) / 0.7))` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-70" style={{ background: b.from }} />
      <div className="pointer-events-none absolute right-3 top-2 select-none text-5xl opacity-[0.13] transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">{b.emoji}</div>

      <div className="relative flex items-center gap-2.5">
        <button onClick={() => navigate(`/people/${to.id}`)} className="shrink-0">
          <Avatar user={to} size={compact ? 'sm' : 'md'} />
        </button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg">
            👏 <button className="hover:underline" onClick={() => navigate(`/people/${to.id}`)}>{to.name}</button>님께
          </div>
          <span
            className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-px text-[10px] font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${b.from}, ${b.to})`, boxShadow: `0 2px 10px -2px ${b.ring}` }}
          >
            {b.emoji} #{b.label}
          </span>
        </div>
      </div>

      <p className={cn('relative mt-3 whitespace-pre-wrap leading-relaxed text-fg/90', compact ? 'text-[13px]' : 'text-[14px]')}>{kudos.message}</p>

      <div className="relative mt-3 flex items-center gap-1.5 text-[11px] text-subtle">
        <Avatar user={from} size="xs" />
        <span className="font-medium text-muted">{from.name}</span>
        <span>· {timeAgo(kudos.createdAt)}</span>
      </div>

      {!compact && (
        <div className="relative mt-3 flex flex-wrap items-center gap-1">
          {Object.entries(kudos.reactions).map(([emoji, ids]) => {
            const mine = ids.includes(meId)
            return (
              <motion.button
                key={emoji}
                whileTap={{ scale: 0.85 }}
                onClick={() => toggle(kudos.id, emoji)}
                className={cn(
                  'flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] tabular-nums transition',
                  mine ? 'border-accent/50 bg-accent/20 text-fg' : 'border-line/10 bg-line/[0.05] text-muted hover:border-line/25',
                )}
              >
                <span>{emoji}</span>{ids.length}
              </motion.button>
            )
          })}
          <Popover
            placement="top-start"
            className="min-w-0 p-1"
            trigger={({ toggle: t }) => (
              <button onClick={t} className="flex h-6 w-7 items-center justify-center rounded-full border border-line/10 text-subtle opacity-0 transition hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                <SmilePlus className="h-3.5 w-3.5" />
              </button>
            )}
          >
            {(close) => (
              <div className="flex gap-0.5">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} onClick={() => { toggle(kudos.id, e); close() }} className="rounded-lg p-1.5 text-lg transition hover:scale-125 hover:bg-line/10">{e}</button>
                ))}
              </div>
            )}
          </Popover>
        </div>
      )}
    </motion.div>
  )
})
