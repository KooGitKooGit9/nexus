import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Check, ShieldCheck, Sparkles } from 'lucide-react'
import { reloadInto } from '@/lib/workspace'
import { BRAND } from '@/config/brand'
import { Divider } from '@/components/ui'
import { AuthShell } from '../components/AuthShell'
import { DemoButton } from '../components/DemoButton'
import { ForgotForm, LoginForm, ResetForm, SignupForm } from '../auth/forms'

/** `?next=/path` — only same-origin absolute paths. */
function useNext() {
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginPage() {
  const next = useNext()
  return (
    <AuthShell
      title="다시 오신 걸 환영해요"
      subtitle={`${BRAND.name} 계정으로 로그인하세요.`}
      footer={<>아직 계정이 없나요? <Link to="/signup" className="font-semibold text-accent hover:underline">무료로 시작하기</Link></>}
    >
      <LoginForm
        onSuccess={() => reloadInto(next)}
        forgotLink={<Link to="/forgot" className="text-[12px] font-medium text-muted hover:text-accent">비밀번호를 잊으셨나요?</Link>}
      />
      <Divider label="또는" className="my-5" />
      <div className="grid">
        <DemoButton size="md" className="w-full" />
      </div>
      <p className="mt-2 text-center text-[11.5px] text-subtle">가입 없이 샘플 데이터가 담긴 데모 워크스페이스를 24시간 동안 써 볼 수 있어요.</p>
    </AuthShell>
  )
}

const SIGNUP_POINTS = [
  '카드 등록 없이 Free 플랜으로 바로 시작',
  '멤버 10명까지 무료 · 저장공간 5GB',
  '메신저부터 전자결재·AI 비서까지 한곳에서',
  '언제든 데이터 내보내기 · 탈퇴도 설정에서 바로',
]

export function SignupPage() {
  return (
    <AuthShell
      title="팀의 새 업무 공간을 만들어요"
      subtitle="1분이면 충분해요. 가입 후 워크스페이스를 만들고 동료를 초대하세요."
      footer={<>이미 계정이 있나요? <Link to="/login" className="font-semibold text-accent hover:underline">로그인</Link></>}
      aside={
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line/10 bg-surface/50 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> {BRAND.tagline}
          </div>
          <h2 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight break-keep">
            일은 한곳에서,<br />
            <span className="gradient-text">흐름은 끊김 없이.</span>
          </h2>
          <ul className="mt-7 space-y-3">
            {SIGNUP_POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[15px] text-fg/85">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"><Check className="h-3.5 w-3.5" /></span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-start gap-2.5 rounded-2xl border border-line/10 bg-surface/50 p-4 text-[13px] text-muted backdrop-blur">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span className="break-keep">비밀번호는 복호화할 수 없는 해시로만 저장하고, 로그인 세션은 스크립트가 읽을 수 없는 httpOnly 쿠키로 관리해요.</span>
          </div>
        </div>
      }
    >
      <SignupForm onSuccess={() => reloadInto('/')} />
    </AuthShell>
  )
}

export function ForgotPage() {
  return (
    <AuthShell
      title="비밀번호 재설정"
      subtitle="가입한 이메일을 입력하면 재설정 링크를 보내드려요."
      footer={<Link to="/login" className="font-semibold text-accent hover:underline">로그인으로 돌아가기</Link>}
    >
      <ForgotForm />
    </AuthShell>
  )
}

export function ResetPage() {
  const { token = '' } = useParams()
  return (
    <AuthShell
      title="새 비밀번호 설정"
      subtitle="앞으로 사용할 새 비밀번호를 입력하세요. 변경 후 바로 로그인돼요."
      footer={<>링크가 만료됐나요? <Link to="/forgot" className="font-semibold text-accent hover:underline">재설정 메일 다시 받기</Link></>}
    >
      <ResetForm token={token} onSuccess={() => reloadInto('/')} />
    </AuthShell>
  )
}
