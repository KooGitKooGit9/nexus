import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, UserPlus, X } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useCore } from '@/store/core'
import type { CalEvent } from '../types'
import { userConflict } from '../utils'
import { isHuman } from '@/features/people/format'

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
  organizerId: string
  events: CalEvent[]
  range: { start: Date; end: Date } | null
  excludeId?: string
}

export function AttendeePicker({ value, onChange, organizerId, events, range, excludeId }: Props) {
  const users = useCore((s) => s.users)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const busy = (id: string) => (range ? userConflict(events, id, range.start, range.end, excludeId) : undefined)

  const options = useMemo(() => {
    const t = q.trim().toLowerCase()
    return users
      .filter((u) => isHuman(u) && !value.includes(u.id))
      .filter((u) => !t || u.name.toLowerCase().includes(t) || u.nameEn.toLowerCase().includes(t) || u.title.toLowerCase().includes(t) || u.department.includes(t))
      .slice(0, 8)
  }, [users, value, q])

  const add = (id: string) => { onChange([...value, id]); setQ(''); inputRef.current?.focus() }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {value.map((id) => {
            const u = users.find((x) => x.id === id)
            const conflict = busy(id)
            return (
              <motion.span
                key={id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                title={conflict ? `이 시간에 '${conflict.title}' 일정이 있어요` : '참석 가능'}
                className={cn('flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-[12px]', conflict ? 'border-amber-400/40 bg-amber-400/10' : 'border-line/10 bg-line/[0.05]')}
              >
                <Avatar userId={id} size="xs" />
                <span className="text-fg">{u?.name ?? '나간 멤버'}</span>
                <span className={cn('h-1.5 w-1.5 rounded-full', conflict ? 'bg-amber-400' : 'bg-emerald-400')} />
                {id === organizerId ? (
                  <span className="text-[10px] text-subtle">주최</span>
                ) : (
                  <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} className="-mr-1 rounded-full p-0.5 text-subtle hover:bg-line/10 hover:text-fg">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </motion.span>
            )
          })}
        </AnimatePresence>
      </div>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle">{open ? <Search className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return // Korean IME: Enter commits the syllable first
            // Esc closes the suggestion list first instead of the whole dialog
            if (e.key === 'Escape' && open && (q || options.length)) { e.stopPropagation(); setOpen(false); return }
            if (e.key === 'Enter' && open && options[0]) { e.preventDefault(); add(options[0].id) }
            if (e.key === 'Backspace' && !q) {
              const removable = value.filter((x) => x !== organizerId)
              if (removable.length) onChange(value.filter((x) => x !== removable[removable.length - 1]))
            }
          }}
          placeholder="이름, 직함, 부서로 참석자 추가"
          className="input-base pl-9"
        />
        <AnimatePresence>
          {open && options.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-2xl glass-strong p-1.5 shadow-float"
            >
              {options.map((u) => {
                const conflict = busy(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); add(u.id) }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-line/[0.07]"
                  >
                    <Avatar userId={u.id} size="sm" showPresence />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-fg">{u.name} <span className="text-[11px] text-subtle">{u.department}</span></p>
                      <p className="truncate text-[11px] text-muted">{u.title}</p>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', conflict ? 'bg-amber-400/15 text-amber-700 dark:text-amber-400' : 'bg-emerald-400/15 text-emerald-600 dark:text-emerald-400')}>
                      {conflict ? '일정 있음' : '가능'}
                    </span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
