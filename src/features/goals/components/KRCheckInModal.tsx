import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, History } from 'lucide-react'
import { Avatar, Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { useGoals } from '../store'
import { bigConfetti, burstConfetti, formatNum, krProgress, objectiveProgress, originFromEl } from '../lib'
import { Ring } from './Ring'
import { Sparkline } from './Sparkline'

const CONTINUOUS_UNITS = new Set(['%', '점', '분', '초', '시간', '억원', '만명'])

export function KRCheckInModal({ objectiveId, krId, onClose }: { objectiveId: string | null; krId: string | null; onClose: () => void }) {
  const objective = useGoals((s) => s.objectives.find((o) => o.id === objectiveId))
  const kr = objective?.keyResults.find((k) => k.id === krId)
  const checkIn = useGoals((s) => s.checkInKeyResult)
  const users = useCore((s) => s.users)
  const [value, setValueRaw] = useState(0)
  const [text, setText] = useState('0')
  const [note, setNote] = useState('')
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (kr) {
      setValueRaw(kr.current)
      setText(String(kr.current))
      setNote('')
    }
  }, [kr?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = !!(objective && kr)
  const start = kr?.start ?? 0
  const lowerIsBetter = kr ? kr.target < start : false
  const lo = kr ? Math.min(start, kr.target) : 0
  const hi = kr ? Math.max(start, kr.target) : 100
  const span = hi - lo || 1
  // whole-number KRs move in steps of 1 — except small spans of continuous units (e.g. 3 → 5%), which get decimals
  const isInt = kr ? [kr.current, kr.target, start].every(Number.isInteger) && (span >= 10 || !CONTINUOUS_UNITS.has(kr.unit)) : true
  const step = isInt ? 1 : span <= 2 ? 0.01 : 0.1
  const decimals = isInt ? 0 : step === 0.01 ? 2 : 1
  const round = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals
  const sliderMin = Math.min(round(lowerIsBetter ? Math.max(0, lo - span * 0.2) : lo), value)
  const sliderMax = Math.max(round(lowerIsBetter ? hi : hi + span * 0.2), value)
  /** slider → value (rounded to the step so we never store 7.199999) */
  const setValue = (n: number, fromSlider = false) => {
    const v = fromSlider ? round(n) : n
    setValueRaw(v)
    setText(String(v))
  }

  const preview = kr ? krProgress({ ...kr, current: value }) : 0
  const before = kr ? krProgress(kr) : 0
  const delta = preview - before
  const history = useMemo(() => kr?.history ?? [], [kr])

  if (!open) return <Modal open={false} onClose={onClose} />

  const canSave = Number.isFinite(value) && (value !== kr!.current || !!note.trim())

  const save = () => {
    if (!canSave) return
    const wasObjDone = objectiveProgress(objective!) >= 100
    checkIn(objective!.id, kr!.id, value, note.trim() || undefined)
    const after = useGoals.getState().objectives.find((o) => o.id === objective!.id)
    const objDone = after ? objectiveProgress(after) >= 100 : false
    if (objDone && !wasObjDone) {
      bigConfetti()
      toast('목표 달성! 🏆', { description: objective!.title, variant: 'success', emoji: '🏆' })
    } else if (preview >= 100 && before < 100) {
      burstConfetti(originFromEl(ringRef.current))
      toast('핵심 결과 달성 🎉', { description: kr!.title, variant: 'success', emoji: '🎯' })
    } else {
      toast('체크인이 기록되었습니다', { description: `${kr!.title} · ${formatNum(value)}${kr!.unit}`, variant: 'success', emoji: '📈' })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="핵심 결과 체크인"
      description={`${objective!.emoji ?? '🎯'} ${objective!.title}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>체크인 기록</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-5 rounded-2xl border border-line/10 bg-line/[0.03] p-4">
          <div ref={ringRef}>
            <Ring value={preview} size={92} stroke={9} from={preview >= 100 ? '#34d399' : undefined} to={preview >= 100 ? '#22d3ee' : undefined}>
              <div className="text-center">
                <div className="font-display text-xl font-bold">{preview}%</div>
              </div>
            </Ring>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-fg">{kr!.title}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <Avatar userId={kr!.ownerId} size="xs" />
              {users.find((u) => u.id === kr!.ownerId)?.name ?? '나간 멤버'}
              <span className="text-subtle">·</span>
              시작 {formatNum(start)}{kr!.unit} → 목표 {formatNum(kr!.target)}{kr!.unit}
            </div>
            <motion.div key={delta} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-xs">
              {delta !== 0 ? (
                <span className={delta > 0 ? 'text-success inline-flex items-center gap-1' : 'text-danger inline-flex items-center gap-1'}>
                  {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {delta > 0 ? '+' : ''}{delta}%p
                </span>
              ) : (
                <span className="text-subtle">변화 없음</span>
              )}
            </motion.div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-xs font-medium text-muted">현재 값</span>
            <span className="font-display text-3xl font-bold gradient-text">
              {formatNum(value)}
              <span className="ml-1 text-base text-muted">{kr!.unit}</span>
            </span>
          </div>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={step}
            value={value}
            onChange={(e) => setValue(Number(e.target.value), true)}
            aria-label="현재 값"
            // lower-is-better KRs: slide right = better (toward the target)
            className={cn('w-full cursor-pointer accent-[rgb(var(--accent))]', lowerIsBetter && '[direction:rtl]')}
          />
          <div className={cn('mt-1 flex justify-between text-[11px] text-subtle', lowerIsBetter && 'flex-row-reverse')}>
            <span>{formatNum(sliderMin)}</span>
            <span>목표 {formatNum(kr!.target)}{lowerIsBetter ? ' (낮을수록 좋음)' : ''}</span>
            <span>{formatNum(sliderMax)}</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="직접 입력">
            <Input
              type="number"
              step="any"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                const n = Number(e.target.value)
                if (e.target.value.trim() !== '' && Number.isFinite(n)) setValueRaw(n)
              }}
              onBlur={() => setText(String(value))}
              onKeyDown={(e) => e.key === 'Enter' && canSave && save()}
            />
          </Field>
          <div className="flex items-end gap-1.5">
            <Button variant="outline" size="md" onClick={() => setValue(kr!.target)}>목표 달성</Button>
          </div>
        </div>

        <Field label="코멘트 (선택)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="이번 주 진척 상황, 리스크, 도움이 필요한 부분…" className="min-h-[70px]" />
        </Field>

        {history.length > 0 && (
          <div className="rounded-2xl border border-line/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted"><History className="h-3.5 w-3.5" /> 체크인 기록</span>
              <Sparkline values={history.map((h) => h.value)} width={140} height={32} />
            </div>
            <ul className="space-y-2">
              {[...history].reverse().slice(0, 4).map((h) => (
                <li key={h.id} className="flex items-center gap-2.5 text-xs">
                  <Avatar userId={h.userId} size="xs" />
                  <span className="font-medium text-fg">{formatNum(h.value)}{kr!.unit}</span>
                  {h.note && <span className="truncate text-muted">“{h.note}”</span>}
                  <span className="ml-auto shrink-0 text-subtle" title={formatDate(h.at, 'yyyy.MM.dd HH:mm')}>{timeAgo(h.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
