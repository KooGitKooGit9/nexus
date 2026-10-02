import { useState } from 'react'
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowUp, GripVertical, Plus, RotateCcw, Search, X, UserPlus, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Button, Input, Popover } from '@/components/ui'
import { useCore } from '@/store/core'
import type { User } from '@/store/types'
import { ApprovalLine } from '../components/ApprovalLine'
import { isHuman, joinMeta } from '@/features/people/format'

function UserPicker({ exclude, onPick, trigger }: { exclude: string[]; onPick: (id: string) => void; trigger: React.ReactNode }) {
  const users = useCore((s) => s.users)
  const [q, setQ] = useState('')
  const list = users.filter((u) => isHuman(u) && !exclude.includes(u.id) && (!q || u.name.includes(q) || (u.title ?? '').includes(q) || (u.department ?? '').includes(q)))
  const nobody = !users.some((u) => isHuman(u) && !exclude.includes(u.id))
  return (
    <Popover placement="bottom-start" className="w-72 p-2" trigger={({ toggle }) => <span onClick={toggle}>{trigger}</span>}>
      {(close) => (
        <div>
          <Input icon={<Search />} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름, 직책, 부서 검색" className="h-8 text-[13px]" />
          <div className="mt-1.5 max-h-64 overflow-y-auto">
            {list.map((u) => (
              <button key={u.id} type="button" onClick={() => { onPick(u.id); close(); setQ('') }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-line/[0.07]">
                <Avatar user={u} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-fg">{u.name}</div>
                  <div className="truncate text-[11px] text-subtle">{joinMeta(u.title, u.department) || u.email}</div>
                </div>
              </button>
            ))}
            {!list.length && <div className="py-6 text-center text-xs text-subtle">{nobody ? '지정할 수 있는 동료가 없어요 — 설정 → 멤버에서 동료를 초대하세요' : '검색 결과가 없어요'}</div>}
          </div>
        </div>
      )}
    </Popover>
  )
}

function ApproverItem({ id, user, index, total, onMove, onRemove }: { id: string; user?: User; index: number; total: number; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  const controls = useDragControls()
  const role = total === 1 ? '최종 결재' : index === total - 1 ? '최종 결재' : `${index + 1}차 결재`
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30 }}
      whileDrag={{ scale: 1.02, boxShadow: '0 20px 40px -12px rgb(0 0 0 / 0.5)' }}
      className="relative flex items-center gap-3 rounded-2xl border border-line/10 bg-surface/80 px-3 py-2.5 backdrop-blur"
    >
      <button type="button" onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none text-subtle hover:text-fg active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', index === total - 1 ? 'bg-accent-gradient text-white shadow-glow-sm' : 'bg-line/10 text-muted')}>{index + 1}</span>
      <Avatar userId={id} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-fg">{user?.name ?? '나간 멤버'}</div>
        <div className="truncate text-[11.5px] text-subtle">{joinMeta(user?.title, user?.department)}</div>
      </div>
      <span className={cn('rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold', index === total - 1 ? 'bg-accent/15 text-accent' : 'bg-line/[0.06] text-muted')}>{role}</span>
      <div className="flex items-center">
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="rounded-md p-1 text-subtle transition hover:bg-line/10 hover:text-fg disabled:opacity-25"><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="rounded-md p-1 text-subtle transition hover:bg-line/10 hover:text-fg disabled:opacity-25"><ArrowDown className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onRemove} className="rounded-md p-1 text-subtle transition hover:bg-danger/10 hover:text-danger"><X className="h-3.5 w-3.5" /></button>
      </div>
    </Reorder.Item>
  )
}

export function StepLine({ approverIds, ccIds, defaultLine, onChange, onChangeCc }: { approverIds: string[]; ccIds: string[]; defaultLine: string[]; onChange: (ids: string[]) => void; onChangeCc: (ids: string[]) => void }) {
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const move = (i: number, dir: -1 | 1) => {
    const next = [...approverIds]
    const [x] = next.splice(i, 1)
    next.splice(i + dir, 0, x)
    onChange(next)
  }
  const isDefault = approverIds.join() === defaultLine.join()

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_240px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-subtle">결재선 · 순차 결재</div>
          {!isDefault && (
            <Button variant="ghost" size="xs" leftIcon={<RotateCcw className="h-3 w-3" />} onClick={() => onChange(defaultLine)}>기본 결재선</Button>
          )}
        </div>

        {/* requester */}
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line/15 px-3 py-2.5">
          <span className="w-4" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-line/10 text-[10px] font-bold text-muted">기안</span>
          <Avatar userId={me} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-fg">{users.find((u) => u.id === me)?.name} <span className="text-[11px] font-normal text-subtle">(나)</span></div>
            <div className="text-[11.5px] text-subtle">기안자</div>
          </div>
        </div>

        <Reorder.Group axis="y" values={approverIds} onReorder={onChange} className="space-y-2">
          <AnimatePresence initial={false}>
            {approverIds.map((id, i) => (
              <ApproverItem key={id} id={id} user={users.find((u) => u.id === id)} index={i} total={approverIds.length} onMove={(dir) => move(i, dir)} onRemove={() => onChange(approverIds.filter((x) => x !== id))} />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {!approverIds.length && (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-[12.5px] text-warning">결재자를 1명 이상 지정해야 상신할 수 있어요.</div>
        )}

        <UserPicker
          exclude={[me, ...approverIds]}
          onPick={(id) => { onChange([...approverIds, id]); onChangeCc(ccIds.filter((c) => c !== id)) }}
          trigger={
            <button type="button" className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line/20 py-2.5 text-[13px] font-medium text-muted transition hover:border-accent/50 hover:bg-accent/5 hover:text-accent">
              <Plus className="h-4 w-4" />결재자 추가
            </button>
          }
        />
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-subtle">미리보기</div>
          <div className="rounded-2xl border border-line/10 bg-line/[0.025] p-4">
            <ApprovalLine request={{ requesterId: me, status: 'pending', steps: approverIds.map((a, i) => ({ approverId: a, status: i === 0 ? 'pending' : 'waiting' })) }} size="sm" />
            <div className="mt-2 text-[11px] text-subtle">{approverIds.length}단계 순차 결재</div>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-subtle"><Eye className="h-3 w-3" />참조자</div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence>
              {ccIds.map((id) => (
                <motion.span key={id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1 rounded-full bg-line/[0.06] py-0.5 pl-0.5 pr-1 text-[12px] text-fg">
                  <Avatar userId={id} size="xs" />
                  {users.find((u) => u.id === id)?.name ?? '나간 멤버'}
                  <button type="button" onClick={() => onChangeCc(ccIds.filter((c) => c !== id))} className="rounded-full p-0.5 text-subtle hover:bg-danger/10 hover:text-danger"><X className="h-3 w-3" /></button>
                </motion.span>
              ))}
            </AnimatePresence>
            <UserPicker
              exclude={[me, ...approverIds, ...ccIds]}
              onPick={(id) => onChangeCc([...ccIds, id])}
              trigger={
                <button type="button" className="flex items-center gap-1 rounded-full border border-dashed border-line/20 px-2 py-1 text-[12px] text-muted transition hover:border-accent/50 hover:text-accent">
                  <UserPlus className="h-3 w-3" />추가
                </button>
              }
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-subtle">참조자는 결재 권한 없이 문서를 열람하고 결과 알림을 받아요.</p>
        </div>
      </div>
    </div>
  )
}
