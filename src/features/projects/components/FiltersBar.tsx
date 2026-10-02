import { motion, AnimatePresence } from 'framer-motion'
import { Search, Flag, Tag, Layers, X, UserCheck, Check } from 'lucide-react'
import { Avatar, Popover, Tooltip } from '@/components/ui'
import { useCore } from '@/store/core'
import { cn } from '@/lib/utils'
import type { GroupBy, Priority } from '../types'
import { ALL_LABELS, PRIORITIES, PRIORITY_META, hexA, labelColor } from '../constants'
import { activeFilterCount, useProjectPrefs } from '../prefs'
import { PriorityIcon } from './atoms'

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: 'status', label: '상태' },
  { value: 'priority', label: '우선순위' },
  { value: 'assignee', label: '담당자' },
  { value: 'label', label: '라벨' },
  { value: 'none', label: '없음' },
]

function FilterChip({ active, children, onClick, count }: { active?: boolean; children: React.ReactNode; onClick?: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[12.5px] font-medium transition',
        active ? 'border-accent/40 bg-accent/10 text-fg shadow-glow-sm' : 'border-line/10 bg-line/[0.03] text-muted hover:border-line/20 hover:text-fg',
      )}
    >
      {children}
      {!!count && <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-gradient px-1 text-[10px] font-bold text-white">{count}</span>}
    </button>
  )
}

export function FiltersBar({ memberIds, showGroupBy }: { memberIds: string[]; showGroupBy?: boolean }) {
  const f = useProjectPrefs((s) => s.filters)
  const set = useProjectPrefs((s) => s.setFilters)
  const reset = useProjectPrefs((s) => s.resetFilters)
  const users = useCore((s) => s.users)
  const n = activeFilterCount(f)
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  // Filters are shared across projects — keep selected people visible even if they aren't members here.
  const people = Array.from(new Set([...memberIds.slice(0, 8), ...f.assigneeIds]))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
        <input
          value={f.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="태스크 검색…"
          className="h-8 w-44 max-w-full rounded-lg border border-line/10 bg-line/[0.03] pl-8 pr-7 text-[12.5px] text-fg outline-none transition-[width,border-color,box-shadow] placeholder:text-subtle focus:w-56 focus:border-accent/50 focus:ring-4 focus:ring-accent/10"
        />
        {f.search && (
          <button onClick={() => set({ search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"><X className="h-3.5 w-3.5" /></button>
        )}
      </div>

      <div className="flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-line/10 bg-line/[0.03] px-1 py-0.5">
        {people.map((id) => {
          const on = f.assigneeIds.includes(id)
          return (
            <Tooltip key={id} content={users.find((u) => u.id === id)?.name} side="bottom">
              <button
                onClick={() => set({ assigneeIds: toggle(f.assigneeIds, id) })}
                className={cn('shrink-0 rounded-full p-[2px] transition', on ? 'bg-accent-gradient shadow-glow-sm' : f.assigneeIds.length ? 'opacity-40 grayscale hover:opacity-80 hover:grayscale-0' : 'hover:scale-110')}
              >
                <Avatar userId={id} size="xs" className="[&>div]:h-6 [&>div]:w-6 [&>div]:text-[10px]" />
              </button>
            </Tooltip>
          )
        })}
      </div>

      <FilterChip active={f.mineOnly} onClick={() => set({ mineOnly: !f.mineOnly })}>
        <UserCheck className="h-3.5 w-3.5" /> 내 작업만
      </FilterChip>

      <Popover
        trigger={({ toggle: t }) => <FilterChip active={f.priorities.length > 0} count={f.priorities.length} onClick={t}><Flag className="h-3.5 w-3.5" />우선순위</FilterChip>}
        className="w-44"
      >
        {PRIORITIES.map((p: Priority) => {
          const on = f.priorities.includes(p)
          return (
            <button key={p} onClick={() => set({ priorities: toggle(f.priorities, p) })} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition', on ? 'bg-accent/10' : 'hover:bg-line/[0.07]')}>
              <PriorityIcon priority={p} className="text-fg" />
              {PRIORITY_META[p].label}
              {on && <Check className="ml-auto h-3.5 w-3.5 text-accent" />}
            </button>
          )
        })}
      </Popover>

      <Popover
        trigger={({ toggle: t }) => <FilterChip active={f.labels.length > 0} count={f.labels.length} onClick={t}><Tag className="h-3.5 w-3.5" />라벨</FilterChip>}
        className="w-52"
      >
        <div className="max-h-72 overflow-y-auto">
          {ALL_LABELS.map((l) => {
            const on = f.labels.includes(l)
            return (
              <button key={l} onClick={() => set({ labels: toggle(f.labels, l) })} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition', on ? 'bg-accent/10' : 'hover:bg-line/[0.07]')}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: labelColor(l), boxShadow: on ? `0 0 8px ${hexA(labelColor(l), 0.8)}` : undefined }} />
                {l}
                {on && <Check className="ml-auto h-3.5 w-3.5 text-accent" />}
              </button>
            )
          })}
        </div>
      </Popover>

      {showGroupBy && (
        <Popover
          trigger={({ toggle: t }) => (
            <FilterChip onClick={t}><Layers className="h-3.5 w-3.5" />그룹: <span className="text-fg">{GROUPS.find((g) => g.value === f.groupBy)?.label}</span></FilterChip>
          )}
          className="w-40"
        >
          {(close) => GROUPS.map((g) => (
            <button key={g.value} onClick={() => { set({ groupBy: g.value }); close() }} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition', f.groupBy === g.value ? 'bg-accent/10' : 'hover:bg-line/[0.07]')}>
              {g.label}
              {f.groupBy === g.value && <Check className="ml-auto h-3.5 w-3.5 text-accent" />}
            </button>
          ))}
        </Popover>
      )}

      <AnimatePresence>
        {n > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={reset}
            className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-[12px] text-subtle transition hover:bg-line/[0.06] hover:text-fg"
          >
            <X className="h-3.5 w-3.5" /> 필터 초기화 ({n})
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
