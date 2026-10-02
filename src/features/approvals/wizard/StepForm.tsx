import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarRange, Plus, Trash2, UploadCloud, X, Wand2, FileText, Flame } from 'lucide-react'
import { cn, uid } from '@/lib/utils'
import { Field, Input, ProgressRing, Select, Switch, Tabs, Textarea } from '@/components/ui'
import { useCore } from '@/store/core'
import { useApprovals } from '../store'
import { ANNUAL_LEAVE_TOTAL, LEAVE_LABEL, leaveDays, usedLeave, won } from '../meta'
import type { LeaveType, LineItem } from '../types'
import { autoTitle, itemsTotal, type Draft } from './draft'

type Patch = (p: Partial<Draft>) => void

const EXPENSE_CATS = ['식대', '교통비', '회식비', '교육비', '사례비', '소모품', '기타']
const TRAVEL_CATS = ['교통', '숙박', '일비', '등록비', '기타']
const SYSTEMS = ['Amplitude (Production)', 'PostgreSQL (prod-replica)', 'AWS 콘솔 (Staging)', 'GitHub Organization', 'Figma Organization', 'Salesforce CRM', 'Google Workspace 관리자', 'Datadog']
const LEVELS = ['읽기 전용 (Read-only)', '편집자 (Editor)', '관리자 (Admin)']

const isoOf = (ymd: string) => (ymd ? new Date(ymd + 'T09:00:00').toISOString() : undefined)

function Section({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-subtle">{icon}{title}</div>
      {children}
    </div>
  )
}

function MoneyInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-subtle">₩</span>
      <input
        inputMode="numeric"
        value={value ? value.toLocaleString('ko-KR') : ''}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
        placeholder="0"
        className="input-base h-9 pl-6 text-right tabular-nums"
      />
    </div>
  )
}

function ItemsEditor({ items, onChange, mode }: { items: LineItem[]; onChange: (i: LineItem[]) => void; mode: 'expense' | 'purchase' | 'travel' }) {
  const upd = (id: string, p: Partial<LineItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)))
  const withQty = mode === 'purchase'
  const total = itemsTotal(items, withQty)
  const cats = mode === 'travel' ? TRAVEL_CATS : EXPENSE_CATS
  return (
    <div className="overflow-hidden rounded-2xl border border-line/10">
      <div className={cn('grid gap-2 bg-line/[0.035] px-3 py-2 text-[11px] font-medium text-muted', withQty ? 'grid-cols-[1fr_64px_130px_110px_28px]' : 'grid-cols-[1fr_110px_140px_28px]')}>
        <span>{withQty ? '품목' : '항목'}</span>
        {withQty ? <><span className="text-right">수량</span><span className="text-right">단가</span><span className="text-right">금액</span></> : <><span>분류</span><span className="text-right">금액</span></>}
        <span />
      </div>
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div
            key={it.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-line/[0.07]"
          >
            <div className={cn('grid items-center gap-2 px-3 py-2', withQty ? 'grid-cols-[1fr_64px_130px_110px_28px]' : 'grid-cols-[1fr_110px_140px_28px]')}>
              <Input value={it.name} onChange={(e) => upd(it.id, { name: e.target.value })} placeholder={withQty ? '예: 맥북 프로 14"' : '예: 고객 미팅 식대'} className="h-9" />
              {withQty ? (
                <>
                  <Input type="number" min={1} value={it.qty ?? 1} onChange={(e) => upd(it.id, { qty: Math.max(1, Number(e.target.value) || 1) })} className="h-9 text-right" />
                  <MoneyInput value={it.amount} onChange={(n) => upd(it.id, { amount: n })} />
                  <span className="text-right text-[13px] font-medium tabular-nums text-fg">{won(it.amount * (it.qty ?? 1))}</span>
                </>
              ) : (
                <>
                  <Select value={it.category ?? ''} onChange={(e) => upd(it.id, { category: e.target.value })} className="h-9 py-0 text-[13px]">
                    <option value="">분류</option>
                    {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                  <MoneyInput value={it.amount} onChange={(n) => upd(it.id, { amount: n })} />
                </>
              )}
              <button type="button" disabled={items.length === 1} onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="flex h-7 w-7 items-center justify-center rounded-lg text-subtle transition hover:bg-danger/10 hover:text-danger disabled:opacity-30">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex items-center justify-between border-t border-line/10 bg-accent/[0.05] px-3 py-2.5">
        <button type="button" onClick={() => onChange([...items, { id: uid('i'), name: '', category: '', qty: 1, amount: 0 }])} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-medium text-accent transition hover:bg-accent/10">
          <Plus className="h-3.5 w-3.5" />항목 추가
        </button>
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] text-muted">합계</span>
          <motion.span key={total} initial={{ scale: 1.15, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-lg font-bold tabular-nums text-fg">{won(total)}</motion.span>
        </div>
      </div>
    </div>
  )
}

function Uploader({ files, onChange, label }: { files: string[]; onChange: (f: string[]) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const add = (list: FileList | null) => {
    if (!list) return
    const names = Array.from(list).map((f) => f.name)
    onChange([...files, ...names.filter((n) => !files.includes(n))])
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    add(e.dataTransfer.files)
  }
  return (
    <div className="space-y-2">
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn('group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center transition', over ? 'border-accent bg-accent/[0.08]' : 'border-line/15 hover:border-accent/50 hover:bg-accent/[0.03]')}
      >
        <UploadCloud className={cn('mb-1.5 h-6 w-6 transition', over ? 'scale-110 text-accent' : 'text-subtle group-hover:text-accent')} />
        <div className="text-[13px] font-medium text-fg">{label}</div>
        <div className="text-[11px] text-subtle">클릭하거나 파일을 끌어다 놓으세요 · JPG, PNG, PDF</div>
        <input ref={ref} type="file" multiple accept="image/*,.pdf,.xlsx,.xls,.csv" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </div>
      {!!files.length && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence>
            {files.map((f) => (
              <motion.span key={f} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1.5 rounded-lg border border-line/10 bg-line/[0.04] py-1 pl-2 pr-1 text-[12px] text-fg">
                <FileText className="h-3.5 w-3.5 text-accent" />{f}
                <button type="button" onClick={() => onChange(files.filter((x) => x !== f))} className="rounded p-0.5 text-subtle hover:bg-danger/10 hover:text-danger"><X className="h-3 w-3" /></button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function DateRange({ d, patch, single }: { d: Draft; patch: Patch; single?: boolean }) {
  return (
    <div className={cn('grid gap-3', single ? 'grid-cols-1' : 'grid-cols-2')}>
      <Field label={single ? '날짜' : '시작일'}>
        <Input type="date" value={d.startDate} onChange={(e) => patch({ startDate: e.target.value, ...(e.target.value > d.endDate || single ? { endDate: e.target.value } : {}) })} className="h-9" />
      </Field>
      {!single && (
        <Field label="종료일">
          <Input type="date" value={d.endDate} min={d.startDate} onChange={(e) => patch({ endDate: e.target.value })} className="h-9" />
        </Field>
      )}
    </div>
  )
}

function LeaveBalance({ days, consumes }: { days: number; consumes: boolean }) {
  const me = useCore((s) => s.currentUserId)
  const requests = useApprovals((s) => s.requests)
  const used = usedLeave(requests, me)
  const remaining = ANNUAL_LEAVE_TOTAL - used
  const after = consumes ? remaining - days : remaining
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line/10 bg-gradient-to-br from-emerald-500/[0.08] to-teal-500/[0.04] p-4">
      <ProgressRing value={(remaining / ANNUAL_LEAVE_TOTAL) * 100} size={64} stroke={7}>
        <span className="font-display text-[15px] font-bold text-fg">{remaining}</span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-fg">잔여 연차 {remaining}일 <span className="font-normal text-subtle">/ {ANNUAL_LEAVE_TOTAL}일</span></div>
        <div className="mt-0.5 text-xs text-muted">올해 사용 {used}일 · {new Date().getFullYear()}년 12월 31일 소멸</div>
        {consumes && (
          <div className={cn('mt-1.5 text-xs font-medium', after < 0 ? 'text-danger' : 'text-success')}>
            신청 후 잔여 <motion.span key={after} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="inline-block font-display font-bold">{after}</motion.span>일
            {after < 0 && ' · 잔여 연차가 부족해요'}
          </div>
        )}
      </div>
    </div>
  )
}

export function StepForm({ d, patch }: { d: Draft; patch: Patch }) {
  const half = d.leaveType === 'half_am' || d.leaveType === 'half_pm'
  const days = d.kind === 'leave' ? leaveDays(d.leaveType, isoOf(d.startDate), isoOf(half ? d.startDate : d.endDate)) : 0
  const suggested = autoTitle(d)

  return (
    <div className="space-y-6">
      <Section title="기본 정보">
        <Field label="제목" hint={!d.titleTouched ? '입력 내용에 따라 자동으로 제안돼요' : undefined}>
          <div className="relative">
            <Input
              value={d.titleTouched ? d.title : suggested}
              onChange={(e) => patch({ title: e.target.value, titleTouched: true })}
              className={cn('h-10 pr-24 text-[14px] font-medium', !d.titleTouched && 'text-muted')}
            />
            {d.titleTouched && (
              <button type="button" onClick={() => patch({ titleTouched: false, title: '' })} className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent/10">
                <Wand2 className="h-3 w-3" />자동 제목
              </button>
            )}
          </div>
        </Field>
      </Section>

      {d.kind === 'leave' && (
        <Section title="휴가 정보" icon={<CalendarRange className="h-3.5 w-3.5" />}>
          <Tabs<LeaveType>
            value={d.leaveType}
            onChange={(v) => patch({ leaveType: v, ...(v === 'half_am' || v === 'half_pm' ? { endDate: d.startDate } : {}) })}
            items={(Object.keys(LEAVE_LABEL) as LeaveType[]).map((k) => ({ value: k, label: LEAVE_LABEL[k] }))}
          />
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
            <DateRange d={d} patch={patch} single={half} />
            <div className="flex h-9 items-center justify-center rounded-xl bg-accent/10 px-4 text-[13px] font-semibold text-accent">
              <motion.span key={days} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="font-display text-base">{days}</motion.span>&nbsp;일
            </div>
          </div>
          <LeaveBalance days={days} consumes={d.leaveType === 'annual' || half} />
          <Field label="사유">
            <Textarea value={d.details} onChange={(e) => patch({ details: e.target.value })} placeholder="예: 가족 여행 / 부재 중 업무는 OOO님이 대응합니다" className="min-h-[80px]" />
          </Field>
        </Section>
      )}

      {d.kind === 'expense' && (
        <Section title="지출 내역">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="지출일"><Input type="date" value={d.startDate} onChange={(e) => patch({ startDate: e.target.value })} className="h-9" /></Field>
          </div>
          <ItemsEditor items={d.items} onChange={(items) => patch({ items })} mode="expense" />
          <Uploader files={d.attachments} onChange={(attachments) => patch({ attachments })} label="영수증 업로드" />
          <Field label="비고"><Textarea value={d.details} onChange={(e) => patch({ details: e.target.value })} placeholder="지출 목적 및 참석자 등" className="min-h-[70px]" /></Field>
        </Section>
      )}

      {d.kind === 'purchase' && (
        <Section title="구매 정보">
          <Field label="거래처"><Input value={d.vendor} onChange={(e) => patch({ vendor: e.target.value })} placeholder="예: 애플코리아, AWS, Figma Inc." className="h-9" /></Field>
          <ItemsEditor items={d.items} onChange={(items) => patch({ items })} mode="purchase" />
          <Uploader files={d.attachments} onChange={(attachments) => patch({ attachments })} label="견적서 첨부" />
          <Field label="구매 사유"><Textarea value={d.details} onChange={(e) => patch({ details: e.target.value })} placeholder="필요성, 대체 가능 여부, 희망 납기 등" className="min-h-[70px]" /></Field>
        </Section>
      )}

      {d.kind === 'travel' && (
        <Section title="출장 정보">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="출장지"><Input value={d.destination} onChange={(e) => patch({ destination: e.target.value })} placeholder="예: 부산 지사, 도쿄" className="h-9" /></Field>
            <Field label="목적"><Input value={d.purpose} onChange={(e) => patch({ purpose: e.target.value })} placeholder="예: 고객사 워크숍" className="h-9" /></Field>
          </div>
          <DateRange d={d} patch={patch} />
          <div className="text-[12px] font-medium text-muted">예상 경비</div>
          <ItemsEditor items={d.items} onChange={(items) => patch({ items })} mode="travel" />
          <Field label="세부 일정"><Textarea value={d.details} onChange={(e) => patch({ details: e.target.value })} placeholder="일자별 일정, 방문처 등" className="min-h-[70px]" /></Field>
        </Section>
      )}

      {d.kind === 'access' && (
        <Section title="권한 정보">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="대상 시스템">
              <Select value={d.system} onChange={(e) => patch({ system: e.target.value })} className="h-9 py-0">
                <option value="">시스템 선택</option>
                {SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="권한 수준">
              <Select value={d.accessLevel} onChange={(e) => patch({ accessLevel: e.target.value })} className="h-9 py-0">
                {LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <DateRange d={d} patch={patch} />
          <Field label="사유"><Textarea value={d.details} onChange={(e) => patch({ details: e.target.value })} placeholder="권한이 필요한 업무와 사용 범위를 적어주세요" className="min-h-[80px]" /></Field>
        </Section>
      )}

      {d.kind === 'general' && (
        <Section title="기안 내용">
          <Field label="내용"><Textarea value={d.details} onChange={(e) => patch({ details: e.target.value })} placeholder="배경, 제안 내용, 기대 효과 등을 작성하세요" className="min-h-[160px]" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="관련 금액 (선택)">
              <MoneyInput value={Number(d.amount) || 0} onChange={(n) => patch({ amount: n ? String(n) : '' })} />
            </Field>
          </div>
          <Uploader files={d.attachments} onChange={(attachments) => patch({ attachments })} label="첨부파일" />
        </Section>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-line/10 bg-line/[0.025] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-danger/15 text-danger"><Flame className="h-4 w-4" /></span>
          <div>
            <div className="text-[13px] font-medium text-fg">긴급 결재</div>
            <div className="text-[11px] text-subtle">결재자에게 우선 알림이 전송돼요</div>
          </div>
        </div>
        <Switch checked={d.urgent} onChange={(urgent) => patch({ urgent })} />
      </div>
    </div>
  )
}
