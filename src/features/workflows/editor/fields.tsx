import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Braces, Plus, Trash2 } from 'lucide-react'
import { cn, uid } from '@/lib/utils'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { useCore } from '@/store/core'
import { useMessenger } from '@/features/messenger/store'
import { useProjects } from '@/features/projects/store'
import { CHANNELS, OP_OPTIONS, describeCron, isValidCron, type FieldDef } from '../catalog'
import type { ConditionRule } from '../types'

const CRON_PRESETS = [
  { label: '평일 09:00', value: '0 9 * * 1-5' },
  { label: '매일 18:00', value: '0 18 * * *' },
  { label: '매주 금 17:00', value: '0 17 * * 5' },
  { label: '15분마다', value: '*/15 * * * *' },
]

/** Renders text with {{variables}} highlighted. */
export function TemplatePreview({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return (
    <div className="whitespace-pre-wrap break-words rounded-lg bg-line/[0.04] px-2.5 py-2 text-[12px] leading-relaxed text-muted">
      {parts.map((p, i) =>
        /^\{\{.+\}\}$/.test(p) ? (
          <span key={i} className="mx-0.5 rounded-md bg-accent/15 px-1 py-px font-mono text-[11px] text-accent">{p.slice(2, -2)}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </div>
  )
}

function TemplateField({ value, onChange, placeholder, variables }: { value: string; onChange: (v: string) => void; placeholder?: string; variables: string[] }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const insert = (v: string) => {
    const el = ref.current
    const token = `{{${v}}}`
    if (!el) return onChange(value + token)
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }
  return (
    <div className="space-y-2">
      <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[76px] font-mono text-[12.5px]" />
      <div className="flex flex-wrap gap-1">
        {variables.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insert(v)}
            className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 font-mono text-[10.5px] text-accent transition hover:border-accent/50 hover:bg-accent/20"
          >
            <Braces className="h-2.5 w-2.5" />
            {v}
          </button>
        ))}
      </div>
      {value.includes('{{') && <TemplatePreview text={value} />}
    </div>
  )
}

function ConditionsField({ rules, onChange, variables }: { rules: ConditionRule[]; onChange: (r: ConditionRule[]) => void; variables: string[] }) {
  const update = (id: string, patch: Partial<ConditionRule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const listId = 'wf-vars'
  return (
    <div className="space-y-2">
      <datalist id={listId}>{variables.map((v) => <option key={v} value={v} />)}</datalist>
      <AnimatePresence initial={false}>
        {rules.map((r, i) => (
          <motion.div
            key={r.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-line/10 bg-line/[0.03] p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold text-subtle">
                <span>조건 {i + 1}</span>
                {rules.length > 1 && (
                  <button type="button" onClick={() => onChange(rules.filter((x) => x.id !== r.id))} className="rounded p-0.5 hover:bg-danger/10 hover:text-danger">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <Input list={listId} value={r.field} onChange={(e) => update(r.id, { field: e.target.value })} placeholder="필드 (예: task.status)" className="h-8 font-mono text-[12px]" />
                <div className="flex gap-1.5">
                  <Select value={r.op} onChange={(e) => update(r.id, { op: e.target.value as ConditionRule['op'] })} className="h-8 w-[44%] py-0 text-[12px]">
                    {OP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                  {r.op !== 'exists' && <Input value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} placeholder="값" className="h-8 flex-1 text-[12px]" />}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button type="button" variant="outline" size="xs" className="w-full" leftIcon={<Plus className="h-3 w-3" />} onClick={() => onChange([...rules, { id: uid('r'), field: '', op: 'eq', value: '' }])}>
        조건 추가
      </Button>
    </div>
  )
}

export function FieldInput({ field, value, onChange, variables }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; variables: string[] }) {
  const users = useCore((s) => s.users)
  const channels = useMessenger((s) => s.channels)
  const projects = useProjects((s) => s.projects)
  const str = value === undefined || value === null ? '' : String(value)
  switch (field.type) {
    case 'text':
      return <Input value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className="h-9" />
    case 'number':
      return <Input type="number" min={0} value={str} onChange={(e) => onChange(Number(e.target.value))} className="h-9" />
    case 'textarea':
      return <Textarea value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
    case 'template':
      return <TemplateField value={str} onChange={onChange} placeholder={field.placeholder} variables={variables} />
    case 'select':
      return (
        <Select value={str} onChange={(e) => onChange(e.target.value)} className="h-9 py-0">
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )
    case 'channel': {
      const names = channels.filter((c) => c.kind !== 'dm' && !c.archived && c.name).map((c) => c.name)
      const list = names.length ? names : CHANNELS
      return (
        <Select value={str} onChange={(e) => onChange(e.target.value)} className="h-9 py-0">
          {str && !list.includes(str) && <option value={str}># {str}</option>}
          {list.map((c) => <option key={c} value={c}># {c}</option>)}
        </Select>
      )
    }
    case 'user':
      return (
        <Select value={str} onChange={(e) => onChange(e.target.value)} className="h-9 py-0">
          <option value="">👤 워크플로우 소유자</option>
          <option value="$actor">⚡ 이벤트를 일으킨 사람</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.title}</option>)}
        </Select>
      )
    case 'project': {
      const known = projects.some((p) => p.id === str) || (field.allowAll && str === 'all')
      return (
        <Select value={str} onChange={(e) => onChange(e.target.value)} className="h-9 py-0">
          {field.allowAll && <option value="all">모든 프로젝트</option>}
          {str && !known && <option value={str}>{str} (자동 매칭)</option>}
          {projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name} · {p.key}</option>)}
        </Select>
      )
    }
    case 'cron':
      return (
        <div className="space-y-2">
          <Input value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={cn('h-9 font-mono', str && !isValidCron(str) && 'border-danger/50 focus:border-danger/60')} />
          <div className="flex flex-wrap gap-1">
            {CRON_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                className={cn('rounded-md border px-1.5 py-0.5 text-[11px] transition', str === p.value ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line/10 text-muted hover:border-accent/40 hover:text-fg')}
              >
                {p.label}
              </button>
            ))}
          </div>
          {isValidCron(str) ? (
            <div className="rounded-lg bg-accent/10 px-2.5 py-1.5 text-[12px] text-accent">🗓 {describeCron(str)}</div>
          ) : (
            <div className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-[12px] text-danger">⚠ 올바른 cron 형식이 아니에요 · 예: 0 9 * * 1-5 (분 시 일 월 요일)</div>
          )}
        </div>
      )
    case 'conditions':
      return <ConditionsField rules={(value as ConditionRule[]) ?? []} onChange={onChange} variables={variables} />
  }
}
