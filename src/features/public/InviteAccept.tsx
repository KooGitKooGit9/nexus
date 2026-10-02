import { useEffect, useState } from 'react'
import { ArrowRight, Clock, LinkIcon, LogOut, Users } from 'lucide-react'
import { api, ApiError, type InvitePreview } from '@/lib/api'
import { reloadInto, useMe } from '@/lib/workspace'
import { Button, Skeleton, Tabs } from '@/components/ui'
import { cn, gradientFor, initials } from '@/lib/utils'
import { AuthShell } from './components/AuthShell'
import { FormAlert } from './components/Fields'
import { LoginForm, SignupForm } from './auth/forms'
import { errorMessage } from './lib'

function tokenFromPath(): string {
  const m = location.pathname.match(/^\/invite\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

function WorkspaceBadge({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-[30%] bg-gradient-to-br font-display font-bold text-white shadow-glow', gradientFor(name))} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  )
}

type Load = { state: 'loading' } | { state: 'invalid'; message: string } | { state: 'ok'; preview: InvitePreview }

/**
 * `/invite/:token` — works both logged out (inside PublicApp) and logged in (App renders it outside any router),
 * so it reads the token from the URL itself and only uses plain links.
 */
export function InviteAccept({ token: tokenProp }: { token?: string } = {}) {
  const token = tokenProp ?? tokenFromPath()
  const me = useMe()
  const account = me?.account ?? null
  const loggedIn = !!account && !account.guest
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoad({ state: 'invalid', message: '초대 링크가 올바르지 않아요.' })
      return
    }
    let alive = true
    api
      .invitePreview(token)
      .then((preview) => alive && setLoad({ state: 'ok', preview }))
      .catch((e) => alive && setLoad({ state: 'invalid', message: e instanceof ApiError && e.status === 404 ? '존재하지 않거나 취소된 초대 링크예요.' : errorMessage(e) }))
    return () => { alive = false }
  }, [token])

  const accept = async () => {
    setAccepting(true)
    setAcceptError(null)
    try {
      await api.acceptInvite(token)
      reloadInto('/')
    } catch (e) {
      setAcceptError(errorMessage(e))
      setAccepting(false)
    }
  }

  const afterAuth = async () => {
    setAuthed(true)
    await accept()
  }

  if (load.state === 'loading') {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-4 py-6" aria-busy="true" aria-label="초대 정보를 불러오는 중">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </AuthShell>
    )
  }

  if (load.state === 'invalid' || load.preview.expired) {
    const expired = load.state === 'ok'
    const subtitle =
      load.state === 'ok'
        ? `${load.preview.workspace.name} 워크스페이스 초대 링크의 유효 기간이 지났어요. 초대한 분(${load.preview.inviter.name})에게 새 링크를 요청해 주세요.`
        : load.message
    return (
      <AuthShell title={expired ? '만료된 초대예요' : '초대를 찾을 수 없어요'} subtitle={subtitle}>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">{expired ? <Clock className="h-6 w-6" /> : <LinkIcon className="h-6 w-6" />}</span>
          <p className="text-[13px] text-muted break-keep">초대 링크는 보안을 위해 일정 기간이 지나면 만료되고, 관리자가 취소할 수도 있어요.</p>
          <div className="grid w-full gap-2 sm:grid-cols-2">
            <a href="/" className="flex h-11 items-center justify-center rounded-xl border border-line/15 text-[14px] font-medium hover:border-accent/50">홈으로</a>
            <a href={loggedIn ? '/' : '/login'} className="flex h-11 items-center justify-center rounded-xl bg-accent-gradient text-[14px] font-semibold text-white shadow-glow-sm">{loggedIn ? '내 워크스페이스로' : '로그인'}</a>
          </div>
        </div>
      </AuthShell>
    )
  }

  const p = load.preview
  const header = (
    <div className="mb-6 flex flex-col items-center text-center">
      <WorkspaceBadge name={p.workspace.name} />
      <p className="mt-4 text-[13.5px] text-muted"><b className="text-fg">{p.inviter.name}</b>님이 초대했어요</p>
      <h1 className="mt-1 font-display text-[26px] font-bold leading-tight tracking-tight break-keep">{p.workspace.name}</h1>
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-subtle"><Users className="h-3.5 w-3.5" />멤버 {p.workspace.memberCount.toLocaleString()}명</p>
    </div>
  )

  if (loggedIn && account) {
    const mismatch = !!p.email && p.email.toLowerCase() !== account.email.toLowerCase()
    return (
      <AuthShell
        footer={
          <button
            type="button"
            onClick={() => { void api.logout().catch(() => undefined).finally(() => location.reload()) }}
            className="inline-flex items-center gap-1.5 font-medium text-muted hover:text-fg"
          >
            <LogOut className="h-3.5 w-3.5" />다른 계정으로 참여하기
          </button>
        }
      >
        {header}
        <div className="space-y-4">
          {mismatch && <FormAlert tone="warning">이 초대는 <b>{p.email}</b> 앞으로 보낸 초대예요. 지금 로그인한 계정({account.email})으로 참여할 수 없다면 다른 계정으로 로그인해 주세요.</FormAlert>}
          {acceptError && <FormAlert>{acceptError}</FormAlert>}
          <div className="rounded-2xl border border-line/10 bg-line/[0.03] px-4 py-3 text-[13px] text-muted">
            <b className="text-fg">{account.name}</b> ({account.email}) 계정으로 참여해요.
          </div>
          <Button variant="primary" size="lg" className="w-full" loading={accepting} rightIcon={!accepting && <ArrowRight className="h-4 w-4" />} onClick={() => void accept()}>
            {accepting ? '참여하는 중…' : `${p.workspace.name}에 참여하기`}
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell footer={<a href="/" className="font-medium text-muted hover:text-fg">{'Nexus가 처음인가요? 서비스 둘러보기'}</a>}>
      {header}
      {authed && acceptError ? (
        <div className="space-y-4">
          <FormAlert>계정은 준비됐지만 초대를 수락하지 못했어요. {acceptError}</FormAlert>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={() => reloadInto('/')}>내 계정으로 이동</Button>
            <Button variant="primary" loading={accepting} onClick={() => void accept()}>다시 시도</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 flex justify-center">
            <Tabs<'signup' | 'login'>
              value={mode}
              onChange={setMode}
              items={[
                { value: 'signup', label: '새 계정 만들기' },
                { value: 'login', label: '기존 계정으로 로그인' },
              ]}
            />
          </div>
          {mode === 'signup' ? (
            <SignupForm key="s" onSuccess={afterAuth} defaultEmail={p.email ?? ''} submitLabel="가입하고 참여하기" />
          ) : (
            <LoginForm
              key="l"
              onSuccess={afterAuth}
              defaultEmail={p.email ?? ''}
              submitLabel="로그인하고 참여하기"
              forgotLink={<a href="/forgot" className="text-[12px] font-medium text-muted hover:text-accent">비밀번호를 잊으셨나요?</a>}
            />
          )}
        </>
      )}
    </AuthShell>
  )
}
