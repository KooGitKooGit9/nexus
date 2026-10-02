import { useState, type FormEvent } from 'react'
import { AlertTriangle, KeyRound, LogOut, Mail, Save, ShieldCheck, Sparkles, UserRound, UserX } from 'lucide-react'
import { api } from '@/lib/api'
import { refreshMe, reloadInto, useMe, useWorkspace } from '@/lib/workspace'
import { clearSession } from '@/lib/session'
import { toast, useCore } from '@/store/core'
import { Badge, Button, Modal } from '@/components/ui'
import { ConsentCheck, FormAlert, PasswordField, TextField } from '@/features/public/components/Fields'
import { SignupForm } from '@/features/public/auth/forms'
import { errorMessage, validateName, validatePassword } from '@/features/public/lib'
import { SettingsSection, SettingRow } from '../components/Section'

export function AccountSettings() {
  const me = useMe()
  const account = me?.account ?? null

  if (!account) {
    return (
      <SettingsSection title="계정" icon={<UserRound />} description="오프라인 데모 모드에서는 계정 기능을 사용할 수 없어요.">
        <p className="text-[13px] text-muted">서버에 연결된 환경에서 로그인하면 이름·비밀번호 변경과 회원 탈퇴를 할 수 있어요.</p>
      </SettingsSection>
    )
  }
  if (account.guest) return <GuestUpgrade />
  return (
    <>
      <BasicInfo name={account.name} email={account.email} />
      <PasswordChange />
      <SettingsSection title="로그인 세션" icon={<LogOut />} delay={0.1}>
        <SettingRow label="이 기기에서 로그아웃" description="다시 이용하려면 이메일과 비밀번호로 로그인해야 해요." icon={<LogOut />}>
          <LogoutButton />
        </SettingRow>
      </SettingsSection>
      <DeleteAccount />
    </>
  )
}

export function LogoutButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const [loading, setLoading] = useState(false)
  return (
    <Button size={size} variant="outline" loading={loading} leftIcon={<LogOut className="h-3.5 w-3.5" />} onClick={() => { setLoading(true); void clearSession() }}>
      로그아웃
    </Button>
  )
}

function BasicInfo({ name: current, email }: { name: string; email: string }) {
  const ws = useWorkspace()
  const updateUser = useCore((s) => s.updateUser)
  const [name, setName] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameErr = validateName(name)
  const dirty = name.trim() !== current

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (nameErr || !dirty) return
    setSaving(true)
    setError(null)
    try {
      await api.updateAccount({ name: name.trim() })
      await refreshMe().catch(() => undefined)
      // Reflect immediately in this workspace's member profile (the server also syncs it for team workspaces).
      if (useCore.getState().users.some((u) => u.id === ws.memberId)) updateUser(ws.memberId, { name: name.trim() })
      toast('이름을 변경했어요', { variant: 'success' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection title="기본 정보" description="모든 워크스페이스에서 쓰이는 계정 정보예요." icon={<UserRound />}>
      <form onSubmit={save} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="이름" value={name} maxLength={40} autoComplete="name" onChange={(e) => setName(e.target.value)} error={dirty ? nameErr : null} />
          <TextField label="이메일" value={email} disabled readOnly hint="이메일 변경은 곧 제공돼요." inputClassName="opacity-60" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="primary" loading={saving} disabled={!dirty || !!nameErr} leftIcon={<Save className="h-3.5 w-3.5" />}>저장</Button>
        </div>
      </form>
    </SettingsSection>
  )
}

function PasswordChange() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const curErr = cur ? null : '현재 비밀번호를 입력해 주세요.'
  const nextErr = validatePassword(next) ?? (next && next === cur ? '현재 비밀번호와 다른 비밀번호를 입력해 주세요.' : null)
  const cfErr = confirm === next ? null : '새 비밀번호가 서로 달라요.'

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (curErr || nextErr || cfErr) return
    setSaving(true)
    setError(null)
    try {
      await api.updateAccount({ currentPassword: cur, newPassword: next })
      setCur(''); setNext(''); setConfirm(''); setSubmitted(false)
      toast('비밀번호를 변경했어요', { variant: 'success', emoji: '🔐' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection title="비밀번호 변경" description="비밀번호는 복호화할 수 없는 해시로만 저장돼요." icon={<KeyRound />} delay={0.05}>
      <form onSubmit={save} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="grid gap-4 md:grid-cols-3">
          <PasswordField label="현재 비밀번호" value={cur} onChange={setCur} error={submitted ? curErr : null} autoComplete="current-password" />
          <PasswordField label="새 비밀번호" value={next} onChange={setNext} error={submitted ? nextErr : null} meter autoComplete="new-password" />
          <PasswordField label="새 비밀번호 확인" value={confirm} onChange={setConfirm} error={submitted ? cfErr : null} autoComplete="new-password" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="primary" loading={saving} disabled={!cur && !next && !confirm}>비밀번호 변경</Button>
        </div>
      </form>
    </SettingsSection>
  )
}

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [ack, setAck] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const close = () => { if (loading) return; setOpen(false); setPassword(''); setAck(false); setError(null) }

  const submit = async () => {
    if (!password || !ack) return
    setLoading(true)
    setError(null)
    try {
      await api.deleteAccount(password)
      reloadInto('/')
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-danger/30 bg-danger/[0.04] p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-danger/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger"><UserX className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-danger">회원 탈퇴</h2>
              <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-muted break-keep">계정과 개인정보가 삭제되고 모든 워크스페이스에서 나가게 돼요. 혼자 쓰던 워크스페이스는 함께 삭제돼요. 되돌릴 수 없어요.</p>
            </div>
          </div>
          <Button variant="danger" onClick={() => setOpen(true)}>탈퇴하기</Button>
        </div>
      </section>

      <Modal
        open={open}
        onClose={close}
        size="sm"
        title={<span className="flex items-center gap-2 text-danger"><AlertTriangle className="h-5 w-5" />정말 탈퇴할까요?</span>}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={loading}>취소</Button>
            <Button variant="danger" loading={loading} disabled={!password || !ack} onClick={() => void submit()}>영구 탈퇴</Button>
          </>
        }
      >
        <div className="space-y-4">
          <ul className="list-disc space-y-1.5 rounded-xl border border-danger/20 bg-danger/[0.05] py-3 pl-8 pr-3 text-[12.5px] leading-relaxed text-fg/85 break-keep">
            <li>계정(이름·이메일·비밀번호)이 삭제되고 다시 로그인할 수 없어요.</li>
            <li>참여 중인 모든 워크스페이스에서 나가요. 다른 멤버와 함께 쓰던 메시지·문서는 워크스페이스에 남아요.</li>
            <li>다른 멤버가 있는 워크스페이스의 <b>유일한 소유자</b>라면 먼저 소유권을 넘기거나 워크스페이스를 삭제해야 해요.</li>
            <li>결제 기록 등 법령상 보관 의무가 있는 정보는 정해진 기간 동안 분리 보관 후 파기돼요.</li>
          </ul>
          {error && <FormAlert>{error}</FormAlert>}
          <PasswordField label="비밀번호 확인" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
          <ConsentCheck required checked={ack} onChange={setAck}>위 내용을 확인했고, 탈퇴하면 복구할 수 없다는 것을 이해했어요</ConsentCheck>
        </div>
      </Modal>
    </>
  )
}

function GuestUpgrade() {
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-glow sm:p-7">
        <div className="absolute inset-0 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x motion-reduce:animate-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,rgba(255,255,255,0.45),transparent_50%)]" />
        <div className="noise absolute inset-0" />
        <div className="relative">
          <Badge className="border-white/30 bg-white/15 text-white">게스트 데모</Badge>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight break-keep">계정 만들고 데모 보관하기</h2>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-white/85 break-keep">
            지금은 임시 게스트 계정이라 생성 후 24시간이 지나면 데모 워크스페이스가 사라져요. 계정을 만들면 지금 쓰던 데모를 그대로 보관하고, 내 팀 워크스페이스도 만들 수 있어요.
          </p>
        </div>
      </div>
      <SettingsSection title="계정 만들기" icon={<Sparkles />} delay={0.05}>
        <div className="max-w-md">
          <SignupForm
            autoFocus={false}
            submitLabel="계정 만들고 보관하기"
            onSuccess={async () => {
              await refreshMe().catch(() => undefined)
              reloadInto('/settings/account')
            }}
          />
        </div>
      </SettingsSection>
      <SettingsSection title="그만 둘러볼게요" icon={<ShieldCheck />} delay={0.1}>
        <SettingRow label="데모 종료" description="게스트 세션에서 로그아웃해요. 데모 데이터는 24시간 뒤 자동으로 삭제돼요." icon={<Mail />}>
          <LogoutButton />
        </SettingRow>
      </SettingsSection>
    </>
  )
}
