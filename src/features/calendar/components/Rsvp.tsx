import { Check, CircleHelp, Clock3, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RsvpStatus } from '../types'

export const RSVP_META: Record<RsvpStatus | 'none', { label: string; icon: typeof Check; cls: string; text: string }> = {
  yes: { label: '참석', icon: Check, cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-400/15 border-emerald-400/30', text: 'text-emerald-600 dark:text-emerald-400' },
  maybe: { label: '미정', icon: CircleHelp, cls: 'text-amber-700 dark:text-amber-400 bg-amber-400/15 border-amber-400/30', text: 'text-amber-700 dark:text-amber-400' },
  no: { label: '불참', icon: X, cls: 'text-rose-600 dark:text-rose-400 bg-rose-400/15 border-rose-400/30', text: 'text-rose-600 dark:text-rose-400' },
  none: { label: '응답 대기', icon: Clock3, cls: 'text-muted bg-line/[0.06] border-line/10', text: 'text-muted' },
}

/** Small round status icon overlaid on avatars. */
export function RsvpDot({ status, className }: { status?: RsvpStatus; className?: string }) {
  const m = RSVP_META[status ?? 'none']
  const Icon = m.icon
  return (
    <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border ring-2 ring-surface backdrop-blur', m.cls, className)}>
      <Icon className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  )
}

export function RsvpChip({ status }: { status?: RsvpStatus }) {
  const m = RSVP_META[status ?? 'none']
  const Icon = m.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', m.cls)}>
      <Icon className="h-3 w-3" strokeWidth={2.6} />
      {m.label}
    </span>
  )
}
