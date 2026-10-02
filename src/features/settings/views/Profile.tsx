import { useEffect, useState } from 'react'
import { UserRound, Smile, X, Plus, Save, RotateCcw, Check } from 'lucide-react'
import { useCore, useCurrentUser, toast } from '@/store/core'
import { Avatar, Button, Field, Input, Select, Textarea, PRESENCE_COLOR, PRESENCE_LABEL } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'
import type { Presence, User } from '@/store/types'
import { SettingsSection } from '../components/Section'

const EMOJIS = ['🚀', '🎯', '📅', '🍱', '🏠', '🚌', '🌴', '🤒', '🎨', '💻', '☕', '🔕', '🎧', '✈️']
const STATUS_PRESETS = [
  { emoji: '🎯', text: '집중 근무 중' }, { emoji: '📅', text: '회의 중' }, { emoji: '🍱', text: '점심 식사' },
  { emoji: '🏠', text: '재택근무' }, { emoji: '🌴', text: '휴가 중' }, { emoji: '🤒', text: '병가' },
]
const TIMEZONES = ['Asia/Seoul', 'Asia/Tokyo', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles']

type Form = Pick<User, 'name' | 'nameEn' | 'title' | 'bio' | 'statusEmoji' | 'statusText' | 'phone' | 'location' | 'timezone' | 'skills'>
const toForm = (u: User): Form => ({ name: u.name, nameEn: u.nameEn, title: u.title, bio: u.bio ?? '', statusEmoji: u.statusEmoji ?? '', statusText: u.statusText ?? '', phone: u.phone, location: u.location, timezone: u.timezone, skills: u.skills })

export function ProfileSettings() {
  const me = useCurrentUser()
  const updateUser = useCore((s) => s.updateUser)
  const setPresence = useCore((s) => s.setPresence)
  const [form, setForm] = useState<Form>(() => toForm(me))
  const [skill, setSkill] = useState('')
  const [saving, setSaving] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  useEffect(() => { setForm(toForm(me)) }, [me.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(me))
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const preview: User = { ...me, ...form, bio: form.bio || undefined, statusEmoji: form.statusEmoji || undefined, statusText: form.statusText || undefined }

  const save = async () => {
    if (!form.name.trim()) { toast('이름을 입력해 주세요', { variant: 'error' }); return }
    setSaving(true)
    await new Promise((r) => setTimeout(r, 450))
    updateUser(me.id, { ...form, name: form.name.trim(), bio: form.bio?.trim() || undefined, statusEmoji: form.statusEmoji || undefined, statusText: form.statusText?.trim() || undefined })
    setSaving(false)
    toast('프로필이 저장되었어요', { variant: 'success', emoji: '✨' })
  }

  const addSkill = () => {
    const s = skill.trim()
    if (s && !form.skills.includes(s)) set('skills', [...form.skills, s])
    setSkill('')
  }

  return (
    <>
      {/* hero preview */}
      <div className="glass relative overflow-hidden rounded-3xl">
        <div className="h-28 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x opacity-90" />
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_80%_-20%,rgba(255,255,255,0.4),transparent_60%)]" />
        <div className="flex flex-wrap items-end gap-5 px-6 pb-5">
          <div className="-mt-12 rounded-full p-1 ring-4 ring-surface/80">
            <Avatar user={preview} size="2xl" showPresence />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold tracking-tight">{preview.name || '이름 없음'}</h2>
              <span className="text-sm text-muted">{preview.nameEn}</span>
            </div>
            <div className="text-sm text-muted">{preview.title} · {me.department} · 입사 {formatDate(me.joinedAt, 'yyyy년 M월')}</div>
            {(preview.statusEmoji || preview.statusText) && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line/10 bg-line/[0.05] px-2.5 py-1 text-xs">
                {preview.statusEmoji} {preview.statusText}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 pb-1">
            {(['online', 'away', 'dnd', 'offline'] as Presence[]).map((p) => (
              <button
                key={p}
                onClick={() => setPresence(p)}
                className={cn('flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition', me.presence === p ? 'border-accent/40 bg-accent/10 text-fg' : 'border-line/10 text-muted hover:border-line/20 hover:text-fg')}
              >
                <span className={cn('h-2 w-2 rounded-full', PRESENCE_COLOR[p])} />
                {PRESENCE_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SettingsSection title="기본 정보" description="동료들에게 보여지는 정보예요." icon={<UserRound />} delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이름"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="영문 이름"><Input value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></Field>
          <Field label="직함"><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="부서" hint="부서 변경은 피플팀에 요청하세요."><Input value={me.department} disabled className="opacity-60" /></Field>
          <Field label="이메일"><Input value={me.email} disabled className="opacity-60" /></Field>
          <Field label="전화번호"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="근무지"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="시간대">
            <Select value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
              {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="소개" className="sm:col-span-2" hint={`${(form.bio ?? '').length}/160`}>
            <Textarea maxLength={160} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="나를 한 줄로 소개해 주세요" className="min-h-[72px]" />
          </Field>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-medium text-muted">전문 분야</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {form.skills.map((s) => (
              <span key={s} className="group inline-flex items-center gap-1 rounded-lg border border-accent/25 bg-accent/10 px-2 py-1 text-xs text-accent">
                {s}
                <button onClick={() => set('skills', form.skills.filter((x) => x !== s))} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addSkill() } }}
                placeholder="추가…"
                className="h-7 w-28 rounded-lg border border-dashed border-line/20 bg-transparent px-2 text-xs outline-none focus:border-accent/50"
              />
              {skill && <button onClick={addSkill} className="rounded-md p-1 text-accent hover:bg-accent/10"><Plus className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="상태 메시지" description="지금 무엇을 하고 있는지 팀에 알려주세요." icon={<Smile />} delay={0.1}>
        <div className="flex gap-2">
          <div className="relative">
            <button onClick={() => setEmojiOpen((v) => !v)} className="flex h-10 w-12 items-center justify-center rounded-xl border border-line/10 bg-surface-2/70 text-lg transition hover:border-accent/40">
              {form.statusEmoji || <Smile className="h-4 w-4 text-subtle" />}
            </button>
            {emojiOpen && (
              <div className="absolute left-0 top-12 z-10 grid w-60 grid-cols-7 gap-1 rounded-2xl glass-strong p-2 shadow-float">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => { set('statusEmoji', e); setEmojiOpen(false) }} className="rounded-lg p-1.5 text-lg transition hover:scale-110 hover:bg-line/10">{e}</button>
                ))}
              </div>
            )}
          </div>
          <Input value={form.statusText} onChange={(e) => set('statusText', e.target.value)} placeholder="예: Q4 로드맵 집중 중" className="flex-1" />
          {(form.statusEmoji || form.statusText) && (
            <Button variant="ghost" onClick={() => setForm((f) => ({ ...f, statusEmoji: '', statusText: '' }))}>지우기</Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUS_PRESETS.map((s) => {
            const on = form.statusText === s.text
            return (
              <button
                key={s.text}
                onClick={() => setForm((f) => ({ ...f, statusEmoji: s.emoji, statusText: s.text }))}
                className={cn('flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs transition', on ? 'border-accent/50 bg-accent/10 text-fg' : 'border-line/10 text-muted hover:border-accent/30 hover:text-fg')}
              >
                {s.emoji} {s.text}{on && <Check className="h-3 w-3 text-accent" />}
              </button>
            )
          })}
        </div>
      </SettingsSection>

      {/* sticky save bar */}
      <div className={cn('sticky bottom-4 z-10 transition-all duration-300', dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0')}>
        <div className="flex items-center justify-between gap-3 rounded-2xl glass-strong px-4 py-3 shadow-float">
          <span className="flex items-center gap-2 text-[13px] text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-warning" />저장하지 않은 변경 사항이 있어요</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setForm(toForm(me))}>되돌리기</Button>
            <Button size="sm" variant="primary" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={save}>저장</Button>
          </div>
        </div>
      </div>
    </>
  )
}
