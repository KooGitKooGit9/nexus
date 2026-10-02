import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Rocket, Users } from 'lucide-react'
import { Avatar, AvatarStack, Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { getUser, toast, useCore } from '@/store/core'
import { cn, formatDate } from '@/lib/utils'
import { PROJECT_COLORS, PROJECT_EMOJIS, hexA, ink } from '../constants'
import { useProjects } from '../store'
import { AssigneePicker, ChipButton, DateInput } from './atoms'

/**
 * Suggests a unique 2–5 letter key from the name: initials of English words ("Design System" → DS),
 * else the first letters ("Payments" → PAY), else "PRJ" for Korean-only names; appends A–Z on collision.
 */
function autoKey(name: string, taken: string[]): string {
  if (!name.trim()) return ''
  const ascii = name.replace(/[^A-Za-z ]/g, '').trim()
  const initials = ascii ? ascii.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 4) : ''
  const prefix = ascii.replace(/\s+/g, '').slice(0, 3).toUpperCase()
  const base = initials.length >= 2 ? initials : prefix.length >= 2 ? prefix : 'PRJ'
  if (!taken.includes(base)) return base
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const k = (base.slice(0, 4) + c)
    if (!taken.includes(k)) return k
  }
  return base
}

export function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createProject = useProjects((s) => s.createProject)
  const projects = useProjects((s) => s.projects)
  const me = useCore((s) => s.currentUserId)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [emoji, setEmoji] = useState(PROJECT_EMOJIS[0])
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [description, setDescription] = useState('')
  const [leadId, setLeadId] = useState(me)
  const [memberIds, setMemberIds] = useState<string[]>([me])
  const [endDate, setEndDate] = useState<string | undefined>(new Date(Date.now() + 42 * 86_400_000).toISOString())

  useEffect(() => {
    if (!open) return
    setName(''); setKey(''); setKeyTouched(false); setDescription(''); setLeadId(me); setMemberIds([me])
    setEndDate(new Date(Date.now() + 42 * 86_400_000).toISOString())
    setEmoji(PROJECT_EMOJIS[Math.floor(Math.random() * PROJECT_EMOJIS.length)])
    setColor(PROJECT_COLORS[projects.length % PROJECT_COLORS.length])
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (keyTouched) return
    setKey(autoKey(name, projects.map((p) => p.key)))
  }, [name, keyTouched]) // eslint-disable-line react-hooks/exhaustive-deps

  const keyTaken = projects.some((p) => p.key === key.toUpperCase())
  const valid = name.trim() && /^[A-Z]{2,5}$/.test(key.toUpperCase()) && !keyTaken

  const submit = () => {
    if (!valid) return
    const p = createProject({ name, key, emoji, color, description: description || undefined, leadId, memberIds, endDate })
    toast('프로젝트를 만들었습니다', { description: `${p.emoji} ${p.name}`, variant: 'success', emoji: '🚀' })
    onClose()
    navigate(`/projects/${p.id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="새 프로젝트"
      description="팀의 다음 목표를 위한 공간을 만드세요."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!valid} onClick={submit} leftIcon={<Rocket className="h-4 w-4" />}>프로젝트 만들기</Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="프로젝트 이름">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 결제 시스템 개편" onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()} />
            </Field>
            <Field label="키" hint={keyTaken ? <span className="text-danger">이미 사용 중</span> : '영문 2–5자'}>
              <Input value={key} onChange={(e) => { setKeyTouched(true); setKey(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5)) }} placeholder="PAY" className="font-mono uppercase" />
            </Field>
          </div>
          <Field label="설명">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이 프로젝트는 무엇을 달성하나요?" className="min-h-[72px]" />
          </Field>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">아이콘</div>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-lg transition', emoji === e ? 'scale-110 bg-line/10 ring-2 ring-accent' : 'hover:bg-line/[0.07]')}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">컬러</div>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className="relative h-7 w-7 rounded-full transition hover:scale-110" style={{ background: c, boxShadow: color === c ? `0 0 0 2px rgb(var(--surface)), 0 0 0 4px ${c}, 0 0 18px ${c}` : undefined }} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AssigneePicker single value={[leadId]} onChange={(ids) => { setLeadId(ids[0]); setMemberIds((m) => Array.from(new Set([ids[0], ...m]))) }} trigger={({ toggle }) => (
              <ChipButton onClick={toggle}><Avatar userId={leadId} size="xs" />리드: {getUser(leadId)?.name}</ChipButton>
            )} />
            <AssigneePicker value={memberIds} onChange={setMemberIds} trigger={({ toggle }) => (
              <ChipButton onClick={toggle}><Users className="h-3.5 w-3.5 text-subtle" />멤버 {memberIds.length}명</ChipButton>
            )} />
            <div className="rounded-lg border border-line/10 bg-line/[0.03]"><DateInput value={endDate} onChange={setEndDate} placeholder="목표일" className="h-[30px]" /></div>
          </div>
        </div>

        {/* Live preview */}
        <div className="flex flex-col">
          <div className="mb-1.5 text-xs font-medium text-muted">미리보기</div>
          <motion.div
            layout
            className="relative flex-1 overflow-hidden rounded-2xl border border-line/10 bg-surface/60 p-5"
            style={{ boxShadow: `0 0 0 1px ${hexA(color, 0.25)}, 0 20px 50px -20px ${hexA(color, 0.7)}` }}
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl" style={{ background: hexA(color, 0.45) }} />
            <motion.div key={emoji} initial={{ scale: 0.6, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: hexA(color, 0.18), boxShadow: `inset 0 0 0 1px ${hexA(color, 0.4)}` }}>{emoji}</motion.div>
            <div className="relative mt-4 font-mono text-[11px]" style={{ color: ink(color) }}>{key || 'KEY'}</div>
            <div className="relative mt-0.5 text-lg font-bold leading-tight text-fg">{name || '프로젝트 이름'}</div>
            <p className="relative mt-1 line-clamp-3 text-[12.5px] text-muted">{description || '설명이 여기에 표시됩니다.'}</p>
            <div className="relative mt-5 flex items-center justify-between">
              <AvatarStack userIds={memberIds} size="xs" />
              {endDate && <span className="text-[11px] text-subtle">~ {formatDate(endDate, 'M월 d일')}</span>}
            </div>
          </motion.div>
        </div>
      </div>
    </Modal>
  )
}
