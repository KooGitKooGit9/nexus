import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Building2, Check, LogOut, PlayCircle, Sparkles, UserPlus } from 'lucide-react'
import { api, type Invite, type Me } from '@/lib/api'
import { reloadInto, useMe } from '@/lib/workspace'
import { clearSession } from '@/lib/session'
import { Button, Textarea } from '@/components/ui'
import { cn, gradientFor, initials } from '@/lib/utils'
import { AuthShell } from './components/AuthShell'
import { FormAlert, TextField } from './components/Fields'
import { InviteLinkList } from './InviteLinks'
import { errorMessage, parseEmails } from './lib'

const SUGGESTIONS = ['우리 팀', '프로덕트팀', '마케팅팀', '스튜디오']

function Steps({ step }: { step: 1 | 2 }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-[12px]" aria-label="진행 단계">
      {[
        { n: 1, label: '워크스페이스' },
        { n: 2, label: '동료 초대' },
      ].map((s, i) => (
        <li key={s.n} className="flex items-center gap-2" aria-current={step === s.n ? 'step' : undefined}>
          {i > 0 && <span className={cn('h-px w-6', step >= s.n ? 'bg-accent' : 'bg-line/15')} />}
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold', step > s.n ? 'bg-success text-white' : step === s.n ? 'bg-accent-gradient text-white shadow-glow-sm' : 'bg-line/10 text-subtle')}>
            {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
          </span>
          <span className={step === s.n ? 'font-semibold text-fg' : 'text-subtle'}>{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

/** Shown to a logged-in account that has no (current) workspace yet. Rendered outside the router. */
export function Onboarding() {
  const me = useMe()
  const account = me?.account
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [creating, setCreating] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Me | null>(null)

  const [emails, setEmails] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])

  const nameErr = !name.trim() ? '워크스페이스 이름을 입력해 주세요.' : name.trim().length > 40 ? '40자 이내로 입력해 주세요.' : null
  const parsed = parseEmails(emails)
  const wsId = created?.currentWorkspaceId ?? null
  const existing = me?.workspaces ?? []

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (nameErr) return
    setCreating(true)
    setError(null)
    try {
      const { me: next } = await api.createWorkspace({ name: name.trim(), kind: 'blank' })
      setCreated(next)
      setStep(2)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const startDemo = async () => {
    setDemoLoading(true)
    setError(null)
    try {
      await api.createWorkspace({ name: 'Aurora Labs (데모)', kind: 'demo' })
      reloadInto('/')
    } catch (err) {
      setError(errorMessage(err))
      setDemoLoading(false)
    }
  }

  const switchTo = async (id: string) => {
    setSwitching(id)
    setError(null)
    try {
      await api.switchWorkspace(id)
      reloadInto('/')
    } catch (err) {
      setError(errorMessage(err))
      setSwitching(null)
    }
  }

  const invite = async (linkOnly: boolean) => {
    if (!wsId) return
    if (!linkOnly && (parsed.valid.length === 0 || parsed.invalid.length > 0)) {
      setInviteError(parsed.invalid.length ? `이메일 형식을 확인해 주세요: ${parsed.invalid.slice(0, 3).join(', ')}` : '초대할 이메일을 입력해 주세요.')
      return
    }
    setInviting(true)
    setInviteError(null)
    try {
      const { invites: list } = await api.createInvites(wsId, linkOnly ? { role: 'member' } : { emails: parsed.valid, role: 'member' })
      setInvites((prev) => [...list, ...prev])
      if (!linkOnly) setEmails('')
    } catch (err) {
      setInviteError(errorMessage(err))
    } finally {
      setInviting(false)
    }
  }

  return (
    <AuthShell
      width="lg"
      topRight={
        <button type="button" onClick={() => void clearSession()} className="focus-ring hidden items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-muted hover:text-fg sm:inline-flex">
          <LogOut className="h-3.5 w-3.5" />로그아웃
        </button>
      }
      footer={account && <span className="text-[12.5px]">{account.email}로 로그인됨 · <button type="button" className="font-medium underline underline-offset-2 hover:text-fg" onClick={() => void clearSession()}>다른 계정으로 로그인</button></span>}
    >
      <Steps step={step} />
      <AnimatePresence mode="wait" initial={false}>
        {step === 1 ? (
          <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
            <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight break-keep">
              {account ? <>{account.name}님, 환영해요 <span aria-hidden>👋</span></> : '환영해요'}
            </h1>
            <p className="mt-1.5 text-[14px] text-muted break-keep">팀이 함께 쓸 워크스페이스를 만들어 볼까요? 회사나 팀 이름이면 충분해요.</p>

            {error && <div className="mt-5"><FormAlert>{error}</FormAlert></div>}

            <form onSubmit={create} noValidate className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className={cn('mt-[26px] flex h-11 w-11 shrink-0 items-center justify-center rounded-[30%] bg-gradient-to-br font-display text-base font-bold text-white shadow-glow-sm transition-all', gradientFor(name.trim() || 'nexus'))} aria-hidden>
                  {name.trim() ? initials(name.trim()) : <Building2 className="h-5 w-5" />}
                </span>
                <TextField
                  className="flex-1"
                  label="워크스페이스 이름"
                  autoFocus
                  maxLength={40}
                  placeholder="예: 오로라 스튜디오"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={submitted ? nameErr : null}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pl-14">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setName(s)} className="rounded-lg border border-line/10 px-2.5 py-1 text-[12px] text-muted transition hover:border-accent/40 hover:text-fg">{s}</button>
                ))}
              </div>
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={creating} rightIcon={!creating && <ArrowRight className="h-4 w-4" />}>
                {creating ? '만드는 중…' : '워크스페이스 만들기'}
              </Button>
            </form>

            <div className="mt-6 rounded-2xl border border-line/10 bg-line/[0.03] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Sparkles className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">먼저 둘러보고 싶나요?</div>
                  <p className="mt-0.5 text-[12.5px] text-muted break-keep">가상 회사 데이터와 동료들이 채워진 데모 워크스페이스로 모든 기능을 체험해 보세요. 실제 팀 워크스페이스와는 분리돼요.</p>
                  <Button size="sm" variant="outline" className="mt-3" loading={demoLoading} leftIcon={<PlayCircle className="h-3.5 w-3.5" />} onClick={() => void startDemo()}>
                    데모 워크스페이스 둘러보기
                  </Button>
                </div>
              </div>
            </div>

            {existing.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 text-[12px] font-semibold text-subtle">참여 중인 워크스페이스</div>
                <ul className="space-y-1.5">
                  {existing.map((w) => (
                    <li key={w.id}>
                      <button type="button" onClick={() => void switchTo(w.id)} disabled={!!switching} className="focus-ring flex w-full items-center gap-3 rounded-xl border border-line/10 px-3 py-2.5 text-left transition hover:border-accent/40 hover:bg-accent/5 disabled:opacity-60">
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-[30%] bg-gradient-to-br text-[12px] font-bold text-white', gradientFor(w.iconColor ?? w.name))}>{initials(w.name)}</span>
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{w.name}</span>
                        {w.kind === 'demo' && <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10.5px] font-medium text-warning">데모</span>}
                        <ArrowRight className="h-4 w-4 text-subtle" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
            <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight break-keep">
              <span className="gradient-text">{name.trim()}</span> 준비 완료!
            </h1>
            <p className="mt-1.5 text-[14px] text-muted break-keep">함께 일할 동료를 초대하세요. 나중에 설정 → 멤버에서도 언제든 초대할 수 있어요.</p>

            <div className="mt-6 space-y-3">
              <label className="block">
                <span className="text-[12.5px] font-medium text-muted">동료 이메일</span>
                <Textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder={'jiwoo@company.com, minjun@company.com\n쉼표나 줄바꿈으로 여러 명을 입력하세요'}
                  className="mt-1.5 min-h-[96px]"
                />
              </label>
              {emails.trim() && (
                <p className="text-[12px] text-subtle">
                  {parsed.valid.length}명 초대 예정{parsed.invalid.length > 0 && <span className="text-danger"> · 형식 오류 {parsed.invalid.length}개</span>}
                </p>
              )}
              {inviteError && <FormAlert>{inviteError}</FormAlert>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="primary" className="flex-1" loading={inviting} leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => void invite(false)}>초대 링크 만들기</Button>
                <Button variant="outline" className="flex-1" disabled={inviting} onClick={() => void invite(true)}>누구나 참여 가능한 링크</Button>
              </div>
              <p className="text-[11.5px] text-subtle break-keep">메일 발송이 설정된 서버라면 초대 메일이 함께 가요. 아래 링크를 메신저 등으로 직접 전달해도 돼요.</p>
              {invites.length > 0 && <InviteLinkList invites={invites} />}
            </div>

            <Button variant={invites.length ? 'primary' : 'secondary'} size="lg" className="mt-6 w-full" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => reloadInto('/')}>
              {invites.length ? '워크스페이스로 이동' : '건너뛰고 시작하기'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}
