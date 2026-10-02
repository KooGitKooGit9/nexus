import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Settings, UserRound, Palette, Bell, Plug, Building, ShieldCheck, Database, ChevronRight, KeyRound, Users, CreditCard, type LucideIcon } from 'lucide-react'
import { Page } from '@/app/Page'
import { PageHeader, Avatar } from '@/components/ui'
import { useCurrentUser } from '@/store/core'
import { cn } from '@/lib/utils'
import { ProfileSettings } from './views/Profile'
import { AppearanceSettings } from './views/Appearance'
import { NotificationSettings } from './views/Notifications'
import { IntegrationsTab } from './views/IntegrationsSoon'
import { AccountSettings } from './views/Account'
import { MemberSettings } from './views/Members'
import { BillingSettings } from './views/Billing'
import { WorkspaceSettings } from './views/Workspace'
import { SecuritySettings } from './views/Security'
import { DataSettings } from './views/Data'

interface Tab { id: string; label: string; description: string; icon: LucideIcon; group: '개인' | '워크스페이스'; render: () => React.ReactNode }

const TABS: Tab[] = [
  { id: 'profile', label: '프로필', description: '이름, 직함, 상태', icon: UserRound, group: '개인', render: () => <ProfileSettings /> },
  { id: 'account', label: '계정', description: '비밀번호, 로그아웃, 탈퇴', icon: KeyRound, group: '개인', render: () => <AccountSettings /> },
  { id: 'appearance', label: '테마 & 외관', description: '다크 모드, 액센트, 밀도', icon: Palette, group: '개인', render: () => <AppearanceSettings /> },
  { id: 'notifications', label: '알림', description: '유형별 알림, 방해 금지', icon: Bell, group: '개인', render: () => <NotificationSettings /> },
  { id: 'workspace', label: '워크스페이스', description: '이름, 연결 상태, 위험 구역', icon: Building, group: '워크스페이스', render: () => <WorkspaceSettings /> },
  { id: 'members', label: '멤버', description: '초대, 역할, 대기 중인 초대', icon: Users, group: '워크스페이스', render: () => <MemberSettings /> },
  { id: 'billing', label: '요금제 & 결제', description: '플랜, 사용량, 결제', icon: CreditCard, group: '워크스페이스', render: () => <BillingSettings /> },
  { id: 'integrations', label: '연동', description: '외부 서비스 연결', icon: Plug, group: '워크스페이스', render: () => <IntegrationsTab /> },
  { id: 'security', label: '보안', description: '보호 장치, 로그인 보안', icon: ShieldCheck, group: '워크스페이스', render: () => <SecuritySettings /> },
  { id: 'data', label: '데이터', description: '내보내기, 사용량', icon: Database, group: '워크스페이스', render: () => <DataSettings /> },
]

export default function SettingsPage() {
  const params = useParams()
  const navigate = useNavigate()
  const me = useCurrentUser()
  const sub = (params['*'] ?? '').split('/')[0]
  const active = TABS.find((t) => t.id === sub) ?? TABS[0]

  return (
    <Page>
      <PageHeader icon={<Settings />} title="설정" subtitle="개인 환경과 워크스페이스를 관리하세요" />
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* sub nav */}
        <nav aria-label="설정 메뉴" className="glass min-w-0 shrink-0 rounded-2xl p-1.5 lg:sticky lg:top-0 lg:w-64 lg:rounded-3xl lg:p-2.5">
          <div className="mb-2 hidden items-center gap-3 rounded-2xl bg-line/[0.04] p-3 lg:flex">
            <Avatar user={me} size="md" showPresence />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{me.name}</div>
              <div className="truncate text-[11.5px] text-muted">{me.email}</div>
            </div>
          </div>
          {/* < lg: one horizontally scrollable row of chips; lg+: grouped vertical list */}
          <div className="scrollbar-none flex gap-1 overflow-x-auto lg:block">
            {(['개인', '워크스페이스'] as const).map((g) => (
              <div key={g} className="contents lg:mb-1 lg:block">
                <div className="hidden px-3 pb-1 pt-2.5 text-[11px] font-semibold tracking-wide text-subtle lg:block">{g}</div>
                {TABS.filter((t) => t.group === g).map((t) => {
                  const on = t.id === active.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/settings/${t.id}`)}
                      className={cn('group relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left transition lg:w-full lg:gap-3 lg:whitespace-normal lg:py-2.5', on ? 'text-fg' : 'text-muted hover:bg-line/[0.05] hover:text-fg')}
                    >
                      {on && (
                        <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-xl border border-accent/25 bg-gradient-to-r from-accent/15 to-accent-2/5" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
                          <span className="absolute left-0 top-1/2 hidden h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent-gradient lg:block" />
                        </motion.span>
                      )}
                      <t.icon className={cn('relative h-4 w-4 shrink-0', on && 'text-accent')} />
                      <span className="relative min-w-0 lg:flex-1">
                        <span className="block text-[13px] font-medium">{t.label}</span>
                        <span className="hidden truncate text-[11px] text-subtle lg:block">{t.description}</span>
                      </span>
                      <ChevronRight className={cn('relative hidden h-3.5 w-3.5 shrink-0 transition lg:block', on ? 'text-accent' : 'opacity-0 group-hover:opacity-60')} />
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* content */}
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="space-y-5"
            >
              {active.render()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Page>
  )
}
