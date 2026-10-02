import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format } from 'date-fns'
import { ArrowLeft, ArrowRight, Check, LayoutGrid, PenLine, Route, Send, FileCheck2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Modal } from '@/components/ui'
import { getUser, toast, useCore } from '@/store/core'
import { useApprovals } from '../store'
import { KIND_META, managerChain } from '../meta'
import type { ApprovalKind } from '../types'
import { ApprovalDocument } from '../components/ApprovalDocument'
import { emptyDraft, toInput, toPreview, validateForm, type Draft } from './draft'
import { StepType } from './StepType'
import { StepForm } from './StepForm'
import { StepLine } from './StepLine'

const STEPS = [
  { label: '종류 선택', icon: LayoutGrid },
  { label: '내용 작성', icon: PenLine },
  { label: '결재선 지정', icon: Route },
  { label: '검토 및 상신', icon: FileCheck2 },
]

function StepIndicator({ step, onJump, maxReached }: { step: number; onJump: (i: number) => void; maxReached: number }) {
  return (
    <div className="relative mb-6 flex items-start justify-between px-2">
      <div className="absolute left-[calc(12.5%)] right-[calc(12.5%)] top-[18px] h-[2px] rounded-full bg-line/10">
        <motion.div className="h-full rounded-full bg-accent-gradient shadow-glow-sm" animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
      </div>
      {STEPS.map((s, i) => {
        const done = i < step
        const active = i === step
        const Icon = s.icon
        return (
          <button key={s.label} type="button" disabled={i > maxReached} onClick={() => onJump(i)} className="relative z-[1] flex w-1/4 flex-col items-center gap-1.5 disabled:cursor-not-allowed">
            <motion.span
              animate={{ scale: active ? 1.12 : 1 }}
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors duration-300',
                done && 'border-transparent bg-accent-gradient text-white',
                active && 'border-accent bg-surface text-accent shadow-glow',
                !done && !active && 'border-line/15 bg-surface text-subtle',
              )}
            >
              {active && <span className="absolute inset-0 rounded-full bg-accent/30 animate-pulse-ring" />}
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.span key="c" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><Check className="h-4 w-4" strokeWidth={3} /></motion.span>
                ) : (
                  <motion.span key="i" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Icon className="h-4 w-4" /></motion.span>
                )}
              </AnimatePresence>
            </motion.span>
            <span className={cn('text-[11.5px] font-medium transition-colors', active ? 'text-fg' : done ? 'text-muted' : 'text-subtle')}>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const ymdPlus = (base: string, days: number) => {
  const d = new Date(base + 'T09:00:00')
  d.setDate(d.getDate() + days)
  return format(d, 'yyyy-MM-dd')
}

function defaultLine(users: { id: string; managerId: string | null }[], me: string, kind: ApprovalKind | null): string[] {
  const chain = managerChain(users, me, 2)
  if (kind === 'access') return [...new Set([chain[0], 'u_cto'].filter(Boolean) as string[])].filter((x) => x !== me)
  return chain.slice(0, kind === 'leave' ? 1 : 2)
}

export function NewRequestWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const createRequest = useApprovals((s) => s.createRequest)
  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [dir, setDir] = useState(1)
  const [d, setD] = useState<Draft>(emptyDraft)
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    if (open) {
      setStep(0)
      setMaxReached(0)
      setD(emptyDraft())
      setShowError(false)
    }
  }, [open])

  const defaultLineFor = (kind: ApprovalKind | null) => defaultLine(users, me, kind)
  const defaultLineIds = useMemo(() => defaultLine(users, me, d.kind), [users, me, d.kind])

  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const go = (n: number) => {
    setDir(n > step ? 1 : -1)
    setStep(n)
    setMaxReached((m) => Math.max(m, n))
    setShowError(false)
  }

  const pickKind = (k: ApprovalKind) => {
    if (k !== d.kind) {
      const fresh = emptyDraft()
      const today = format(new Date(), 'yyyy-MM-dd')
      const start = k === 'expense' || k === 'access' ? today : fresh.startDate
      const end = k === 'travel' ? ymdPlus(start, 1) : k === 'access' ? ymdPlus(start, 90) : start
      setD({ ...fresh, kind: k, startDate: start, endDate: end, approverIds: defaultLineFor(k) })
      setMaxReached(1)
    }
    setTimeout(() => go(1), 220)
  }

  const formError = d.kind ? validateForm(d) : '문서 종류를 선택하세요'
  const lineError = d.approverIds.length ? null : '결재자를 지정하세요'
  const canNext = step === 0 ? !!d.kind : step === 1 ? !formError : step === 2 ? !lineError : true
  /** every step before `target` must be valid to land on it */
  const canReach = (target: number) => (target <= 1 || !!d.kind) && (target <= 1 || !formError) && (target <= 2 || !lineError)

  const next = () => {
    if (!canNext) return setShowError(true)
    go(step + 1)
  }

  const submit = () => {
    if (!d.kind || formError || lineError) {
      go(!d.kind ? 0 : formError ? 1 : 2)
      setTimeout(() => setShowError(true), 0)
      return
    }
    const input = toInput(d)
    const id = createRequest(input)
    const first = getUser(input.approverIds[0])
    toast('결재를 상신했어요', { variant: 'success', emoji: '📨', description: `1차 결재자 ${first?.name ?? ''}님에게 알림을 보냈어요` })
    onCreated(id)
  }

  const meta = d.kind ? KIND_META[d.kind] : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          새 결재 작성
          {meta && step > 0 && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', meta.soft, meta.text)}>{meta.emoji} {meta.label}</span>}
        </span>
      }
      description="종류를 고르고, 내용을 작성하고, 결재선을 지정하면 끝!"
      footer={
        <div className="flex w-full items-center gap-2">
          {step > 0 ? <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => go(step - 1)}>이전</Button> : <span />}
          <AnimatePresence>
            {showError && !canNext && (
              <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-[12px] font-medium text-danger">
                {step === 1 ? formError : step === 2 ? lineError : '문서 종류를 선택하세요'}
              </motion.span>
            )}
          </AnimatePresence>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            {step < 3 ? (
              <Button variant="primary" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={next} className={cn(!canNext && 'opacity-60')}>다음</Button>
            ) : (
              <Button variant="primary" leftIcon={<Send className="h-4 w-4" />} onClick={submit} className="px-6">상신하기</Button>
            )}
          </div>
        </div>
      }
    >
      <StepIndicator step={step} onJump={(i) => i <= maxReached && (i < step || canReach(i)) && go(i)} maxReached={maxReached} />
      <div className="relative min-h-[360px]">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -36 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && <StepType value={d.kind} onPick={pickKind} />}
            {step === 1 && <StepForm d={d} patch={patch} />}
            {step === 2 && <StepLine approverIds={d.approverIds} ccIds={d.ccIds} defaultLine={defaultLineIds} onChange={(approverIds) => patch({ approverIds })} onChangeCc={(ccIds) => patch({ ccIds })} />}
            {step === 3 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3.5 py-2.5 text-[12.5px] text-success">
                  <FileCheck2 className="h-4 w-4" />문서를 마지막으로 확인하세요. 상신 후에는 결재가 진행되기 전까지 회수할 수 있어요.
                </div>
                <ApprovalDocument r={toPreview(d, me)} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  )
}
