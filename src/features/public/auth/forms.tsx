import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
import { api, type Me } from '@/lib/api'
import { Button } from '@/components/ui'
import { ConsentCheck, FormAlert, PasswordField, TextField } from '../components/Fields'
import { errorMessage, validateEmail, validateName, validatePassword } from '../lib'

/* Shared auth forms — used by the public pages, the invite page (outside the router) and the guest-upgrade card in
 * settings, so they only use plain <a> links (never router <Link>). */

export function LoginForm({
  onSuccess,
  defaultEmail = '',
  forgotLink,
  submitLabel = '로그인',
  autoFocus = true,
}: {
  onSuccess: (me: Me) => void | Promise<void>
  defaultEmail?: string
  forgotLink?: ReactNode
  submitLabel?: string
  autoFocus?: boolean
}) {
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailErr = validateEmail(email)
  const pwErr = password ? null : '비밀번호를 입력해 주세요.'
  const show = (k: keyof typeof touched) => submitted || touched[k]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (emailErr || pwErr) return
    setLoading(true)
    setError(null)
    try {
      const { me } = await api.login({ email: email.trim().toLowerCase(), password })
      await onSuccess(me)
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}
      <TextField
        label="이메일"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus={autoFocus && !defaultEmail}
        placeholder="name@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        error={show('email') ? emailErr : null}
      />
      <PasswordField
        value={password}
        onChange={setPassword}
        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
        error={show('password') ? pwErr : null}
        autoComplete="current-password"
        autoFocus={autoFocus && !!defaultEmail}
        right={forgotLink}
      />
      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full" rightIcon={!loading && <ArrowRight className="h-4 w-4" />}>
        {loading ? '로그인 중…' : submitLabel}
      </Button>
    </form>
  )
}

export function SignupForm({
  onSuccess,
  defaultEmail = '',
  submitLabel = '무료로 시작하기',
  autoFocus = true,
}: {
  onSuccess: (me: Me) => void | Promise<void>
  defaultEmail?: string
  submitLabel?: string
  autoFocus?: boolean
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState({ age: false, terms: false, privacy: false, marketing: false })
  const [touched, setTouched] = useState({ name: false, email: false, password: false })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameErr = validateName(name)
  const emailErr = validateEmail(email)
  const pwErr = validatePassword(password)
  const consentOk = consent.age && consent.terms && consent.privacy
  const show = (k: keyof typeof touched) => submitted || touched[k]
  const all = consent.age && consent.terms && consent.privacy && consent.marketing

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (nameErr || emailErr || pwErr || !consentOk) return
    setLoading(true)
    setError(null)
    try {
      // `marketingOptIn` is extra metadata — the server stores it if supported and ignores it otherwise.
      const body = { name: name.trim(), email: email.trim().toLowerCase(), password, marketingOptIn: consent.marketing }
      const { me } = await api.signup(body)
      await onSuccess(me)
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}
      <TextField
        label="이름"
        autoComplete="name"
        autoFocus={autoFocus}
        placeholder="홍길동"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        error={show('name') ? nameErr : null}
      />
      <TextField
        label="업무용 이메일"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="name@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        error={show('email') ? emailErr : null}
      />
      <PasswordField
        value={password}
        onChange={setPassword}
        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
        error={show('password') ? pwErr : null}
        meter
        autoComplete="new-password"
        placeholder="8자 이상"
      />

      <fieldset className="rounded-2xl border border-line/10 bg-line/[0.02] p-2">
        <legend className="sr-only">약관 동의</legend>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-[13.5px] font-semibold text-fg">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => {
              const v = e.target.checked
              setConsent({ age: v, terms: v, privacy: v, marketing: v })
            }}
            className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
          />
          전체 동의 <span className="text-[11.5px] font-normal text-subtle">(선택 항목 포함)</span>
        </label>
        <div className="my-1 h-px bg-line/[0.08]" />
        <ConsentCheck required checked={consent.age} onChange={(v) => setConsent((c) => ({ ...c, age: v }))} error={submitted && !consent.age}>
          만 14세 이상입니다
        </ConsentCheck>
        <ConsentCheck required checked={consent.terms} onChange={(v) => setConsent((c) => ({ ...c, terms: v }))} error={submitted && !consent.terms} link={{ href: '/legal/terms', label: '보기' }}>
          이용약관 동의
        </ConsentCheck>
        <ConsentCheck required checked={consent.privacy} onChange={(v) => setConsent((c) => ({ ...c, privacy: v }))} error={submitted && !consent.privacy} link={{ href: '/legal/privacy', label: '보기' }}>
          개인정보 수집·이용 동의
        </ConsentCheck>
        <ConsentCheck checked={consent.marketing} onChange={(v) => setConsent((c) => ({ ...c, marketing: v }))}>
          제품 소식·이벤트 이메일 수신 <span className="text-subtle">(동의하지 않아도 가입할 수 있어요)</span>
        </ConsentCheck>
        {submitted && !consentOk && <p role="alert" className="px-2 pb-1 pt-1.5 text-[12px] text-danger">필수 항목에 모두 동의해 주세요.</p>}
      </fieldset>

      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full" rightIcon={!loading && <ArrowRight className="h-4 w-4" />}>
        {loading ? '계정 만드는 중…' : submitLabel}
      </Button>
    </form>
  )
}

export function ForgotForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const emailErr = validateEmail(email)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (emailErr) return
    setLoading(true)
    setError(null)
    try {
      await api.forgotPassword(email.trim().toLowerCase())
      setSent(email.trim().toLowerCase())
    } catch (err) {
      // Rate limits / network errors are real errors; "unknown email" never is (the server always answers ok).
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center" role="status">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[15px] font-semibold">메일을 보냈어요 (등록된 경우)</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted break-keep">
            <b className="text-fg">{sent}</b> 으로 가입된 계정이 있다면 비밀번호 재설정 링크가 담긴 메일이 도착해요. 몇 분 안에 오지 않으면 스팸함을 확인해 주세요.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setSent(null); setSubmitted(false) }}>다른 이메일로 다시 보내기</Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}
      <TextField
        label="가입한 이메일"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus
        placeholder="name@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={submitted ? emailErr : null}
      />
      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        {loading ? '보내는 중…' : '재설정 링크 받기'}
      </Button>
    </form>
  )
}

export function ResetForm({ token, onSuccess }: { token: string; onSuccess: (me: Me) => void | Promise<void> }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pwErr = validatePassword(password)
  const cfErr = confirm !== password ? '비밀번호가 서로 달라요.' : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (pwErr || cfErr) return
    setLoading(true)
    setError(null)
    try {
      const { me } = await api.resetPassword(token, password)
      await onSuccess(me)
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}
      <PasswordField label="새 비밀번호" value={password} onChange={setPassword} error={submitted ? pwErr : null} meter autoComplete="new-password" autoFocus />
      <PasswordField label="새 비밀번호 확인" value={confirm} onChange={setConfirm} error={submitted || confirm.length >= password.length ? (confirm ? cfErr : submitted ? '한 번 더 입력해 주세요.' : null) : null} autoComplete="new-password" />
      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        {loading ? '변경 중…' : '비밀번호 변경하고 로그인'}
      </Button>
    </form>
  )
}
