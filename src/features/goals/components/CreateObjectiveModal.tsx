import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { getCurrentUserId, toast, useCore } from '@/store/core'
import { cn, uid } from '@/lib/utils'
import { useGoals } from '../store'
import { burstConfetti, isCompanyObjective, quarterOptions } from '../lib'
import type { Objective } from '../types'
import { isHuman } from '@/features/people/format'

const TEAMS = ['전사', '제품', '엔지니어링', '디자인', '마케팅', '영업', '피플팀'] as const
const EMOJIS = ['🎯', '🚀', '💰', '⚙️', '🌱', '📣', '🎨', '🤝', '💜', '🧭', '🛠️', '🤖', '📈', '🏆']
const UNITS = ['%', '건', '명', '억원', '만명', '회', '점', '분', '개']

interface KRDraft { key: string; title: string; start: string; target: string; unit: string; ownerId: string }
const blankKR = (ownerId: string): KRDraft => ({ key: uid('d'), title: '', start: '0', target: '', unit: '%', ownerId })

export function CreateObjectiveModal({ open, onClose, defaultQuarter, onCreated }: { open: boolean; onClose: () => void; defaultQuarter: string; onCreated?: (id: string, quarter: string) => void }) {
  const users = useCore((s) => s.users)
  const objectives = useGoals((s) => s.objectives)
  const addObjective = useGoals((s) => s.addObjective)
  const me = getCurrentUserId()

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [quarter, setQuarter] = useState(defaultQuarter)
  const [team, setTeam] = useState<string>('제품')
  const [ownerId, setOwnerId] = useState(me)
  const [parentId, setParentId] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Objective['status']>('on_track')
  const [krs, setKrs] = useState<KRDraft[]>([blankKR(me), blankKR(me)])

  useEffect(() => {
    if (open) {
      setTitle(''); setEmoji('🎯'); setQuarter(defaultQuarter); setTeam('제품'); setOwnerId(me); setDescription(''); setStatus('on_track')
      setKrs([blankKR(me), blankKR(me)])
      const firstCompany = useGoals.getState().objectives.find((o) => isCompanyObjective(o) && o.quarter === defaultQuarter)
      setParentId(firstCompany?.id ?? '')
    }
  }, [open, defaultQuarter, me])

  const companyObjs = objectives.filter((o) => isCompanyObjective(o) && o.quarter === quarter)
  const krError = (k: KRDraft): string | null => {
    if (!k.title.trim()) return k.target.trim() ? '핵심 결과 내용을 입력하세요' : null
    if (k.target.trim() === '' || !Number.isFinite(Number(k.target))) return '목표값을 숫자로 입력하세요'
    if (k.start.trim() !== '' && !Number.isFinite(Number(k.start))) return '시작값을 숫자로 입력하세요'
    if (Number(k.target) === (Number(k.start) || 0)) return '목표값은 시작값과 달라야 해요'
    return null
  }
  const validKrs = krs.filter((k) => k.title.trim() && !krError(k))
  const invalidKrs = krs.filter((k) => krError(k))
  const problem = title.trim().length < 2
    ? '목표를 2자 이상 입력하세요'
    : invalidKrs.length
      ? krError(invalidKrs[0])
      : validKrs.length === 0
        ? '핵심 결과를 1개 이상 입력하세요'
        : null
  const canSubmit = !problem

  /** Changing the quarter re-targets the alignment to a company objective of that quarter. */
  const changeQuarter = (q: string) => {
    setQuarter(q)
    if (parentId && objectives.find((o) => o.id === parentId)?.quarter !== q) {
      setParentId(objectives.find((o) => isCompanyObjective(o) && o.quarter === q)?.id ?? '')
    }
  }

  const patchKr = (key: string, patch: Partial<KRDraft>) => setKrs((l) => l.map((k) => (k.key === key ? { ...k, ...patch } : k)))

  const submit = () => {
    if (!canSubmit) return
    const id = addObjective({
      title: title.trim(),
      emoji,
      quarter,
      team,
      ownerId,
      status,
      description: description.trim() || undefined,
      parentId: team !== '전사' && parentId ? parentId : undefined,
      keyResults: validKrs.map((k) => {
        const start = Number(k.start) || 0
        return { id: uid('kr'), title: k.title.trim(), start, current: start, target: Number(k.target), unit: k.unit, ownerId: k.ownerId, history: [] }
      }),
    })
    burstConfetti()
    toast('새 목표가 생성되었습니다', { description: `${emoji} ${title.trim()}`, variant: 'success', emoji: '🎯' })
    onCreated?.(id, quarter)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="새 목표 만들기"
      description="측정 가능한 핵심 결과(KR)와 함께 목표를 설정하세요."
      footer={
        <div className="flex w-full items-center gap-2">
          {problem && <span className="mr-auto min-w-0 truncate text-xs text-subtle">⚠️ {problem}</span>}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit}>목표 생성</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex shrink-0 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">아이콘</span>
            <div className="grid grid-cols-7 gap-1 rounded-xl border border-line/10 bg-line/[0.03] p-1.5">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji(e)} className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-base transition', emoji === e ? 'bg-accent/20 ring-1 ring-accent/50' : 'hover:bg-line/10')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <Field label="목표" className="flex-1">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()} placeholder="예: 온보딩 경험을 혁신해 활성화율을 끌어올린다" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이 목표가 왜 중요한가요? (선택)" className="min-h-[52px]" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="분기">
            <Select value={quarter} onChange={(e) => changeQuarter(e.target.value)}>
              {quarterOptions(objectives).map((q) => <option key={q}>{q}</option>)}
            </Select>
          </Field>
          <Field label="팀">
            <Select value={team} onChange={(e) => setTeam(e.target.value)}>
              {TEAMS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="담당자">
            <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {users.filter(isHuman).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="상태">
            <Select value={status} onChange={(e) => setStatus(e.target.value as Objective['status'])}>
              <option value="on_track">순항</option>
              <option value="at_risk">위험</option>
              <option value="off_track">지연</option>
            </Select>
          </Field>
        </div>

        {team !== '전사' && (
          <Field label="정렬할 회사 목표" hint="팀 목표를 회사 목표에 연결하면 정렬 트리에 표시됩니다.">
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— 연결 안 함 —</option>
              {companyObjs.map((o) => <option key={o.id} value={o.id}>{o.emoji ?? '🎯'} {o.title}</option>)}
            </Select>
          </Field>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">핵심 결과 (KR) · {validKrs.length}개</span>
            <Button size="xs" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setKrs((l) => [...l, blankKR(ownerId)])} disabled={krs.length >= 6}>
              KR 추가
            </Button>
          </div>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {krs.map((k, i) => (
                <motion.div
                  key={k.key}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className={cn('rounded-xl border bg-line/[0.03] p-2.5', krError(k) ? 'border-warning/40' : 'border-line/10')}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-[11px] font-bold text-accent">KR{i + 1}</span>
                      <Input value={k.title} onChange={(e) => patchKr(k.key, { title: e.target.value })} placeholder="예: 첫 주 활성화율 60% 달성" className="h-9" />
                      <button type="button" onClick={() => setKrs((l) => l.filter((x) => x.key !== k.key))} disabled={krs.length <= 1} className="rounded-lg p-2 text-subtle transition hover:bg-danger/10 hover:text-danger disabled:opacity-30">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 pl-8 pr-10">
                      <Input type="number" value={k.start} onChange={(e) => patchKr(k.key, { start: e.target.value })} placeholder="시작값" className="h-8 text-xs" title="시작값" />
                      <Input type="number" value={k.target} onChange={(e) => patchKr(k.key, { target: e.target.value })} placeholder="목표값" className="h-8 text-xs" title="목표값" />
                      <Select value={k.unit} onChange={(e) => patchKr(k.key, { unit: e.target.value })} className="h-8 py-0 text-xs">
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </Select>
                      <Select value={k.ownerId} onChange={(e) => patchKr(k.key, { ownerId: e.target.value })} className="h-8 py-0 text-xs">
                        {users.filter(isHuman).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </Select>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <p className="mt-2 text-[11px] text-subtle">💡 목표값이 시작값보다 작으면 “낮을수록 좋은” 지표(예: 응답 시간)로 계산됩니다.</p>
        </div>
      </div>
    </Modal>
  )
}
