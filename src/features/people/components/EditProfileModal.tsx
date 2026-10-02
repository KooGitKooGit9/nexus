import { useState } from 'react'
import { X } from 'lucide-react'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import type { Department, User } from '@/store/types'
import { DEPARTMENTS, managerChain } from '../lib'
import { isHuman } from '../format'

const TIMEZONES = [
  { v: 'Asia/Seoul', l: '서울 (KST)' },
  { v: 'Asia/Tokyo', l: '도쿄 (JST)' },
  { v: 'Asia/Singapore', l: '싱가포르 (SGT)' },
  { v: 'Europe/London', l: '런던 (GMT/BST)' },
  { v: 'Europe/Berlin', l: '베를린 (CET)' },
  { v: 'America/New_York', l: '뉴욕 (ET)' },
  { v: 'America/Los_Angeles', l: '샌프란시스코 (PT)' },
]

const STATUS_PRESETS = [
  { e: '🚀', t: '집중 근무 중' },
  { e: '🏠', t: '재택근무' },
  { e: '📅', t: '회의 중' },
  { e: '☕', t: '커피 타임' },
  { e: '🌴', t: '휴가 중' },
  { e: '🤒', t: '병가' },
]

export function EditProfileModal({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
  const updateUser = useCore((s) => s.updateUser)
  const users = useCore((s) => s.users)
  // possible managers: real people who don't (indirectly) report to this user — no cycles in the org chart
  const managerOptions = users.filter((u) => isHuman(u) && u.id !== user.id && !managerChain(users, u.id).includes(user.id))
  const [birthday, setBirthday] = useState(user.birthday ?? '')
  const [f, setF] = useState(user)
  const [skill, setSkill] = useState('')
  // Reset the form only when the modal opens — not on every store update of `user` (presence ticks, cross-tab sync)
  // which would wipe what the user is typing.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) { setF(user); setSkill(''); setBirthday(user.birthday ?? '') }
  }

  const set = <K extends keyof User>(k: K, v: User[K]) => setF((p) => ({ ...p, [k]: v }))
  const addSkill = () => {
    const s = skill.trim()
    if (s && !f.skills.includes(s)) set('skills', [...f.skills, s])
    setSkill('')
  }

  const save = () => {
    const bday = birthday.trim().replace(/[./]/g, '-')
    const bdayOk = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(bday)
    if (bday && !bdayOk) {
      toast('생일은 MM-DD 형식으로 입력해 주세요', { variant: 'warning', description: '예: 03-27' })
      return
    }
    updateUser(user.id, {
      department: f.department,
      managerId: f.managerId || null,
      birthday: bdayOk ? bday : '',
      title: f.title.trim() || user.title,
      statusEmoji: f.statusEmoji || undefined,
      statusText: f.statusText?.trim() || undefined,
      phone: f.phone,
      location: f.location,
      timezone: f.timezone || 'Asia/Seoul',
      bio: f.bio?.trim() || undefined,
      skills: f.skills,
      nameEn: f.nameEn.trim() || user.nameEn,
    })
    toast('프로필이 업데이트되었습니다', { emoji: '✨', variant: 'success' })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="프로필 편집"
      description="동료들에게 보여지는 정보를 업데이트하세요."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={save}>저장</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium text-muted">상태</span>
          <div className="mt-1.5 flex gap-2">
            <Input className="w-16 text-center text-lg" value={f.statusEmoji ?? ''} maxLength={4} onChange={(e) => set('statusEmoji', e.target.value)} placeholder="😀" />
            <Input value={f.statusText ?? ''} onChange={(e) => set('statusText', e.target.value)} placeholder="무엇을 하고 있나요?" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STATUS_PRESETS.map((p) => (
              <button key={p.t} onClick={() => setF((x) => ({ ...x, statusEmoji: p.e, statusText: p.t }))} className="rounded-full border border-line/10 bg-line/[0.04] px-2.5 py-1 text-[11px] text-muted transition hover:border-accent/40 hover:text-fg">
                {p.e} {p.t}
              </button>
            ))}
            <button onClick={() => setF((x) => ({ ...x, statusEmoji: undefined, statusText: undefined }))} className="rounded-full px-2.5 py-1 text-[11px] text-subtle hover:text-danger">지우기</button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="직책"><Input value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="영문 이름"><Input value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></Field>
          <Field label="전화번호"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="근무지"><Input value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="부서">
            <Select value={f.department ?? ''} onChange={(e) => set('department', e.target.value as Department)}>
              <option value="">선택 안 함</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="매니저">
            <Select value={f.managerId ?? ''} onChange={(e) => set('managerId', e.target.value || null)}>
              <option value="">없음</option>
              {managerOptions.map((u) => <option key={u.id} value={u.id}>{u.name}{u.title ? ` · ${u.title}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="생일 (MM-DD)"><Input value={birthday} onChange={(e) => setBirthday(e.target.value)} placeholder="예: 03-27" maxLength={5} /></Field>
          <Field label="시간대">
            <Select value={f.timezone || 'Asia/Seoul'} onChange={(e) => set('timezone', e.target.value)}>
              {TIMEZONES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="소개"><Textarea value={f.bio ?? ''} onChange={(e) => set('bio', e.target.value)} placeholder="자신을 소개해 주세요" /></Field>
        <div>
          <span className="text-xs font-medium text-muted">스킬</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {f.skills.map((s) => (
              <span key={s} className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 py-0.5 pl-2.5 pr-1 text-xs text-fg">
                {s}
                <button onClick={() => set('skills', f.skills.filter((x) => x !== s))} className="rounded-full p-0.5 text-muted hover:bg-line/10 hover:text-fg"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={skill} onChange={(e) => setSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addSkill() } }} placeholder="스킬 추가 후 Enter" />
            <Button variant="secondary" onClick={addSkill}>추가</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
