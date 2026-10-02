import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Cookie, Globe, KeyRound, Lock, LogOut, ScrollText, ShieldCheck, Smartphone, UserCheck } from 'lucide-react'
import { useMe, useWorkspace } from '@/lib/workspace'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { SettingsSection, SettingRow } from '../components/Section'
import { LogoutButton } from './Account'

/** Only real, implemented protections are listed; unbuilt ones are shown disabled as "곧 제공". */
export function SecuritySettings() {
  const navigate = useNavigate()
  const me = useMe()
  const ws = useWorkspace()
  const account = me?.account ?? null
  const https = typeof location !== 'undefined' && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  const secure = location.protocol === 'https:'

  const protections = [
    { icon: KeyRound, title: '비밀번호 해시 저장', desc: '사용자별 솔트를 더한 scrypt 해시로만 저장해요. 원래 비밀번호는 누구도 알 수 없어요.', ok: true },
    { icon: Cookie, title: 'httpOnly 세션 쿠키', desc: '로그인 세션은 자바스크립트가 읽을 수 없는 쿠키로 관리돼요.', ok: true },
    { icon: Lock, title: '워크스페이스 데이터 격리', desc: '모든 요청과 실시간 연결은 멤버십을 확인한 뒤 이 워크스페이스 안에서만 처리돼요.', ok: true },
    {
      icon: Globe,
      title: secure ? 'HTTPS 암호화 연결' : '암호화되지 않은 연결',
      desc: secure ? '지금 연결은 HTTPS로 암호화돼 있어요.' : https ? '로컬 개발 환경이에요. 운영 환경에서는 HTTPS로 배포하세요.' : '지금 연결은 HTTP예요. 운영 환경에서는 반드시 HTTPS로 배포하세요.',
      ok: secure,
      warn: !https,
    },
  ]

  return (
    <>
      <SettingsSection title="적용된 보호 장치" description="지금 이 워크스페이스에 실제로 적용된 보안 조치예요." icon={<ShieldCheck />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {protections.map((p) => (
            <div key={p.title} className={cn('rounded-2xl border p-4', p.warn ? 'border-warning/30 bg-warning/[0.05]' : 'border-line/10 bg-line/[0.03]')}>
              <div className="flex items-center gap-2.5">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', p.ok ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
                  {p.warn ? <AlertTriangle className="h-4 w-4" /> : <p.icon className="h-4 w-4" />}
                </span>
                <span className="text-[13.5px] font-semibold">{p.title}</span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted break-keep">{p.desc}</p>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="로그인 보안" icon={<KeyRound />} delay={0.05}>
        <SettingRow label="비밀번호" description={account ? `${account.email} 계정의 비밀번호를 바꿔요.` : '서버에 연결된 계정에서 사용할 수 있어요.'} icon={<KeyRound />}>
          <Button size="sm" variant="outline" disabled={!account || account.guest} onClick={() => navigate('/settings/account')}>변경하기</Button>
        </SettingRow>
        <SettingRow label={<span className="flex items-center gap-2">2단계 인증 (TOTP)<Badge>곧 제공</Badge></span>} description="로그인할 때 인증 앱의 6자리 코드를 추가로 확인하는 기능이에요." icon={<Smartphone />}>
          <OffSwitch />
        </SettingRow>
        <SettingRow label={<span className="flex items-center gap-2">SSO (SAML)<Badge>곧 제공 · Business</Badge></span>} description="회사 계정(IdP)으로 로그인하는 기능이에요." icon={<UserCheck />}>
          <OffSwitch />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="세션" icon={<LogOut />} delay={0.1} description="다른 기기의 로그인 세션 목록과 원격 로그아웃은 곧 제공돼요.">
        <SettingRow label="이 기기에서 로그아웃" description="공용 PC라면 사용을 마친 뒤 꼭 로그아웃하세요." icon={<LogOut />}>
          {account ? <LogoutButton /> : <Badge>오프라인 모드</Badge>}
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={<span className="flex items-center gap-2">감사 로그<Badge>곧 제공 · Business</Badge></span>} icon={<ScrollText />} delay={0.15}>
        <p className="text-[13px] leading-relaxed text-muted break-keep">
          멤버 초대, 권한 변경, 로그인 같은 보안 활동 기록을 조회하고 내보내는 기능을 준비하고 있어요. {ws.role === 'owner' ? '출시되면 이 화면에서 바로 확인할 수 있어요.' : ''}
        </p>
      </SettingsSection>
    </>
  )
}

/** Static "off" toggle for features that are not available yet (not focusable, not interactive). */
function OffSwitch() {
  return (
    <span aria-hidden className="inline-flex h-6 w-11 items-center rounded-full bg-line/15 p-0.5 opacity-50">
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </span>
  )
}
