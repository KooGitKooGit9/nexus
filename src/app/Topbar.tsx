import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, Search, Sun, Moon, Sparkles, LogOut, UserRound, Keyboard, Settings as SettingsIcon, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCore, useCurrentUser, useUI } from '@/store/core'
import { Avatar, Kbd, Popover, Tooltip, PRESENCE_COLOR, PRESENCE_LABEL } from '@/components/ui'
import type { Presence } from '@/store/types'
import { NAV } from './nav'
import { clearSession } from '@/lib/session'
import { useSettings } from '@/features/settings/store'

const STATUS_PRESETS = [
  { emoji: '🎯', text: '집중 근무 중' },
  { emoji: '📅', text: '회의 중' },
  { emoji: '🍱', text: '점심 식사' },
  { emoji: '🏠', text: '재택근무' },
  { emoji: '🚌', text: '이동 중' },
  { emoji: '🌴', text: '휴가 중' },
]

export function Topbar() {
  const loc = useLocation()
  const navigate = useNavigate()
  const theme = useCore((s) => s.theme)
  const toggleTheme = useCore((s) => s.toggleTheme)
  const mutedTypes = useSettings((s) => s.notif)
  // same rule as the notification panel: muted categories don't count
  const unread = useCore((s) => s.notifications.filter((n) => !n.read && mutedTypes?.[n.type] !== false).length)
  const { setCommandOpen, setNotificationsOpen, setAiOpen, setShortcutsOpen } = useUI()
  const me = useCurrentUser()
  const setPresence = useCore((s) => s.setPresence)
  const setStatus = useCore((s) => s.setStatus)

  const current = NAV.find((n) => (n.path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.path)))
  const isMac = navigator.platform.toLowerCase().includes('mac')

  return (
    <header className="relative z-10 flex h-16 min-w-0 shrink-0 items-center gap-3 border-b border-line/[0.07] bg-surface/30 px-4 backdrop-blur-2xl lg:gap-4 lg:px-5">
      <div className="hidden min-w-0 shrink-0 items-center gap-2 md:flex md:max-w-[150px] lg:w-48 lg:max-w-none">
        {current && <current.icon className="h-4 w-4 text-accent shrink-0" />}
        <span className="text-sm font-semibold truncate">{current?.label ?? 'Nexus'}</span>
      </div>

      {/* Search / Command palette trigger */}
      <button
        onClick={() => setCommandOpen(true)}
        aria-label="검색 및 명령 실행"
        className="group mx-auto flex h-10 min-w-0 flex-1 max-w-xl items-center gap-2.5 rounded-xl border border-line/10 bg-line/[0.04] px-3 text-sm text-subtle transition hover:border-accent/40 hover:bg-line/[0.06] hover:shadow-glow-sm lg:gap-3 lg:px-3.5"
      >
        <Search className="h-4 w-4 shrink-0 transition group-hover:text-accent" />
        <span className="min-w-0 flex-1 truncate text-left">
          <span className="hidden lg:inline">메시지, 태스크, 문서, 사람 검색 또는 명령 실행…</span>
          <span className="lg:hidden">검색 · 명령</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span>
      </button>

      <div className="flex shrink-0 items-center gap-1 lg:gap-1.5">
        <Tooltip content={<span>Nexus AI <span className="ml-1 text-white/50">{isMac ? '⌘' : 'Ctrl+'}J</span></span>} side="bottom">
          <button onClick={() => setAiOpen(true)} aria-label="Nexus AI" className="relative flex h-10 w-10 shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl text-[13px] font-semibold text-white xl:w-auto xl:px-3">
            <span className="absolute inset-0 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x" />
            <Sparkles className="relative h-4 w-4" />
            <span className="relative hidden xl:inline">AI에게 묻기</span>
          </button>
        </Tooltip>

        <Tooltip content={theme === 'dark' ? '라이트 모드' : '다크 모드'} side="bottom">
          <button onClick={toggleTheme} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-line/[0.07] hover:text-fg transition">
            <motion.span key={theme} initial={{ rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}>
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </motion.span>
          </button>
        </Tooltip>

        <Tooltip content="알림" side="bottom">
          <button onClick={() => setNotificationsOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-line/[0.07] hover:text-fg transition">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-3 px-1 text-[9px] font-bold text-white ring-2 ring-bg">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        </Tooltip>

        <Popover
          placement="bottom-end"
          className="w-72 p-2"
          trigger={({ toggle }) => (
            <button onClick={toggle} className="ml-1 flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-line/[0.07] transition">
              <Avatar user={me} size="md" showPresence />
              <span className="hidden lg:block text-left leading-tight">
                <span className="block text-[13px] font-semibold">{me.name}</span>
                <span className="block text-[11px] text-muted truncate max-w-[110px]">{me.statusEmoji} {me.statusText ?? me.title}</span>
              </span>
            </button>
          )}
        >
          {(close) => (
            <div>
              <div className="flex items-center gap-3 p-2.5">
                <Avatar user={me} size="lg" showPresence />
                <div className="min-w-0">
                  <div className="font-semibold">{me.name}</div>
                  <div className="text-xs text-muted truncate">{me.title} · {me.department}</div>
                </div>
              </div>
              <div className="px-2.5 pb-2 text-[11px] font-semibold text-subtle">상태</div>
              <div className="grid grid-cols-2 gap-1 px-1 pb-2">
                {(['online', 'away', 'dnd', 'offline'] as Presence[]).map((p) => (
                  <button key={p} onClick={() => setPresence(p)} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-line/[0.07]', me.presence === p && 'bg-line/[0.07]')}>
                    <span className={cn('h-2 w-2 rounded-full', PRESENCE_COLOR[p])} />
                    {PRESENCE_LABEL[p]}
                    {me.presence === p && <Check className="ml-auto h-3 w-3 text-accent" />}
                  </button>
                ))}
              </div>
              <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-subtle">상태 메시지</div>
              <div className="flex flex-wrap gap-1 px-1.5 pb-2">
                {STATUS_PRESETS.map((s) => (
                  <button key={s.text} onClick={() => setStatus(s.emoji, s.text)} className={cn('rounded-lg border border-line/10 px-2 py-1 text-[11.5px] hover:border-accent/40 hover:bg-accent/10', me.statusText === s.text && 'border-accent/50 bg-accent/10')}>
                    {s.emoji} {s.text}
                  </button>
                ))}
                {me.statusText && <button onClick={() => setStatus(undefined, undefined)} className="rounded-lg px-2 py-1 text-[11.5px] text-muted hover:text-danger">지우기</button>}
              </div>
              <div className="my-1 h-px bg-line/10" />
              {[
                { icon: <UserRound />, label: '내 프로필', onClick: () => navigate(`/people/${me.id}`) },
                { icon: <SettingsIcon />, label: '설정', onClick: () => navigate('/settings') },
                { icon: <Keyboard />, label: '키보드 단축키', onClick: () => setShortcutsOpen(true) },
                { icon: <LogOut />, label: '로그아웃', onClick: () => { clearSession(); location.reload() } },
              ].map((it) => (
                <button key={it.label} onClick={() => { it.onClick(); close() }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-line/[0.07] [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-muted">
                  {it.icon}{it.label}
                </button>
              ))}
            </div>
          )}
        </Popover>
      </div>
    </header>
  )
}
