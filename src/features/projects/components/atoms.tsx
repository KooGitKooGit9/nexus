import { useState, type ReactNode } from 'react'
import { Check, Calendar as CalendarIcon, Search, X } from 'lucide-react'
import { Avatar, Popover } from '@/components/ui'
import { useCore } from '@/store/core'
import { cn, formatDate } from '@/lib/utils'
import type { Priority, TaskStatus } from '../types'
import { ALL_LABELS, PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, dueLabel, hexA, ink, isOverdue, labelColor } from '../constants'

/* ───────────── Icons ───────────── */

export function StatusIcon({ status, size = 14, className }: { status: TaskStatus; size?: number; className?: string }) {
  const c = STATUS_META[status].color
  const r = 6
  const circ = 2 * Math.PI * 3
  const frac = { backlog: 0, todo: 0, in_progress: 0.5, review: 0.75, done: 1 }[status]
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={cn('shrink-0', className)}>
      {status === 'done' ? (
        <>
          <circle cx="8" cy="8" r="7" fill={c} />
          <path d="M5 8.2l2 2 4-4.2" stroke="#0b0d18" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r={r} fill="none" stroke={c} strokeWidth="1.6" strokeDasharray={status === 'backlog' ? '2 2.2' : undefined} />
          {frac > 0 && (
            <circle cx="8" cy="8" r="3" fill="none" stroke={c} strokeWidth="6" strokeDasharray={`${circ * frac} ${circ}`} transform="rotate(-90 8 8)" />
          )}
        </>
      )}
    </svg>
  )
}

export function PriorityIcon({ priority, size = 14, className }: { priority: Priority; size?: number; className?: string }) {
  const m = PRIORITY_META[priority]
  if (priority === 'urgent')
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className={cn('shrink-0', className)}>
        <rect x="1" y="1" width="14" height="14" rx="4" fill={m.color} />
        <rect x="7.1" y="3.8" width="1.8" height="5.6" rx="0.9" fill="white" />
        <circle cx="8" cy="11.6" r="1.05" fill="white" />
      </svg>
    )
  const filled = { high: 3, medium: 2, low: 1 }[priority]
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={cn('shrink-0', className)}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 4.5} y={10 - i * 3.5} width="3" height={4 + i * 3.5} rx="1" fill={i < filled ? m.color : 'currentColor'} opacity={i < filled ? 1 : 0.18} />
      ))}
    </svg>
  )
}

export function LabelChip({ label, onRemove, className }: { label: string; onRemove?: () => void; className?: string }) {
  const c = labelColor(label)
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-[3px] text-[10.5px] font-medium leading-none whitespace-nowrap', className)}
      style={{ background: hexA(c, 0.12), borderColor: hexA(c, 0.28), color: ink(c) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {label}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="-mr-0.5 opacity-70 hover:opacity-100">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

export function DueChip({ dueDate, status, className }: { dueDate?: string; status: TaskStatus; className?: string }) {
  if (!dueDate) return null
  const overdue = isOverdue({ dueDate, status })
  const done = status === 'done'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-[3px] text-[10.5px] font-medium leading-none whitespace-nowrap',
        overdue ? 'bg-danger/15 text-danger' : done ? 'text-subtle' : 'bg-line/[0.05] text-muted',
        className,
      )}
      title={formatDate(dueDate, 'yyyy년 M월 d일')}
    >
      <CalendarIcon className="h-3 w-3" />
      {done ? formatDate(dueDate, 'M/d') : dueLabel(dueDate)}
    </span>
  )
}

/* ───────────── Option list ───────────── */

function OptionRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition', active ? 'bg-accent/10 text-fg' : 'text-fg/90 hover:bg-line/[0.07]')}
    >
      {children}
      <span className="ml-auto">{active && <Check className="h-3.5 w-3.5 text-accent" />}</span>
    </button>
  )
}

type Trigger = (props: { open: boolean; toggle: () => void }) => ReactNode

export function StatusPicker({ value, onChange, trigger, placement = 'bottom-start' }: { value: TaskStatus; onChange: (s: TaskStatus) => void; trigger: Trigger; placement?: 'bottom-start' | 'bottom-end' | 'top-start' }) {
  return (
    <Popover placement={placement} trigger={trigger} className="w-48">
      {(close) => (
        <div className="flex flex-col">
          <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">상태</div>
          {STATUSES.map((s) => (
            <OptionRow key={s} active={s === value} onClick={() => { onChange(s); close() }}>
              <StatusIcon status={s} />
              {STATUS_META[s].label}
            </OptionRow>
          ))}
        </div>
      )}
    </Popover>
  )
}

export function PriorityPicker({ value, onChange, trigger, placement = 'bottom-start' }: { value: Priority; onChange: (p: Priority) => void; trigger: Trigger; placement?: 'bottom-start' | 'bottom-end' | 'top-start' }) {
  return (
    <Popover placement={placement} trigger={trigger} className="w-44">
      {(close) => (
        <div className="flex flex-col">
          <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">우선순위</div>
          {PRIORITIES.map((p) => (
            <OptionRow key={p} active={p === value} onClick={() => { onChange(p); close() }}>
              <PriorityIcon priority={p} className="text-fg" />
              {PRIORITY_META[p].label}
            </OptionRow>
          ))}
        </div>
      )}
    </Popover>
  )
}

export function AssigneePicker({ value, onChange, trigger, candidateIds, placement = 'bottom-start', single }: { value: string[]; onChange: (ids: string[]) => void; trigger: Trigger; candidateIds?: string[]; placement?: 'bottom-start' | 'bottom-end' | 'top-start'; single?: boolean }) {
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const [q, setQ] = useState('')
  const pool = users
    .filter((u) => !candidateIds || candidateIds.includes(u.id) || value.includes(u.id))
    .filter((u) => !q || u.name.includes(q) || u.nameEn.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0))
  return (
    <Popover placement={placement} trigger={trigger} className="w-60">
      {(close) => (
        <div className="flex flex-col">
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="담당자 검색…" className="w-full rounded-lg bg-line/[0.05] py-1.5 pl-8 pr-2 text-[13px] outline-none placeholder:text-subtle" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {pool.map((u) => {
              const active = value.includes(u.id)
              return (
                <OptionRow
                  key={u.id}
                  active={active}
                  onClick={() => {
                    if (single) { onChange([u.id]); close(); return }
                    onChange(active ? value.filter((x) => x !== u.id) : [...value, u.id])
                  }}
                >
                  <Avatar userId={u.id} size="xs" />
                  <span className="truncate">{u.name}</span>
                  {u.id === me && <span className="text-[10px] text-subtle">나</span>}
                </OptionRow>
              )
            })}
            {!pool.length && <div className="px-3 py-4 text-center text-xs text-subtle">결과 없음</div>}
          </div>
        </div>
      )}
    </Popover>
  )
}

export function LabelPicker({ value, onChange, trigger, placement = 'bottom-start' }: { value: string[]; onChange: (labels: string[]) => void; trigger: Trigger; placement?: 'bottom-start' | 'bottom-end' | 'top-start' }) {
  const [q, setQ] = useState('')
  const all = Array.from(new Set([...ALL_LABELS, ...value]))
  const list = all.filter((l) => !q || l.toLowerCase().includes(q.toLowerCase()))
  const canCreate = q.trim() && !all.includes(q.trim())
  return (
    <Popover placement={placement} trigger={trigger} className="w-56">
      <div className="flex flex-col">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { onChange([...value, q.trim()]); setQ('') } }}
          placeholder="라벨 검색 또는 생성…"
          className="mb-1 w-full rounded-lg bg-line/[0.05] px-2.5 py-1.5 text-[13px] outline-none placeholder:text-subtle"
        />
        <div className="max-h-64 overflow-y-auto">
          {list.map((l) => {
            const active = value.includes(l)
            return (
              <OptionRow key={l} active={active} onClick={() => onChange(active ? value.filter((x) => x !== l) : [...value, l])}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: labelColor(l), boxShadow: `0 0 8px ${hexA(labelColor(l), 0.6)}` }} />
                {l}
              </OptionRow>
            )
          })}
          {canCreate && (
            <button onClick={() => { onChange([...value, q.trim()]); setQ('') }} className="w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-accent hover:bg-accent/10">
              + "{q.trim()}" 라벨 만들기
            </button>
          )}
        </div>
      </div>
    </Popover>
  )
}

/** Compact date input styled as a chip. */
export function DateInput({ value, onChange, placeholder = '날짜 없음', className }: { value?: string; onChange: (iso: string | undefined) => void; placeholder?: string; className?: string }) {
  const v = value ? formatDate(value, 'yyyy-MM-dd') : ''
  return (
    <label className={cn('relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] transition hover:bg-line/[0.06]', className)}>
      <CalendarIcon className="h-3.5 w-3.5 text-subtle" />
      <span className={value ? 'text-fg' : 'text-subtle'}>{value ? formatDate(value, 'M월 d일 (EEE)') : placeholder}</span>
      <input
        type="date"
        value={v}
        onChange={(e) => {
          if (!e.target.value) return onChange(undefined)
          const [y, m, d] = e.target.value.split('-').map(Number)
          onChange(new Date(y, m - 1, d, 18, 0).toISOString())
        }}
        className="absolute inset-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      {value && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(undefined) }}
          className="relative z-10 rounded p-0.5 text-subtle hover:text-fg"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </label>
  )
}

/** Chip-style trigger button used inside property panels & modals. */
export function ChipButton({ children, onClick, className, active }: { children: ReactNode; onClick?: () => void; className?: string; active?: boolean }) {
  return (
    <button
      type="button"
      // Only swallow the click when we handle it — as a <Menu> trigger (no onClick) the wrapping span must receive it.
      onClick={(e) => { if (!onClick) return; e.stopPropagation(); onClick() }}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition',
        active ? 'border-accent/40 bg-accent/10 text-fg' : 'border-line/10 bg-line/[0.03] text-fg/90 hover:border-line/20 hover:bg-line/[0.06]',
        className,
      )}
    >
      {children}
    </button>
  )
}
