import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AtSign, Bookmark, ChevronRight, Compass, Hash, Headphones, Lock, MessageSquareText, PenLine, PhoneOff, Plus, Search, SquarePen, Star, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCore, useUI } from '@/store/core'
import { Avatar, CountBadge, Popover, PresenceDot, Tooltip } from '@/components/ui'
import { useLiveUsers, useLivePresence } from '@/components/ui/Avatar'
import { COMPANY } from '@/store/seed-users'
import { useMessenger, isTimelineMessage, mentionsUser } from '../store'
import { channelTitle, isDirect, otherMembers } from '../lib'
import type { Channel } from '../types'

export type SidebarView = 'threads' | 'activity' | 'saved' | null

interface Props {
  activeId: string | null
  activeView: SidebarView
  onCreateChannel: () => void
  onBrowse: () => void
  onNewDM: () => void
}

interface Unread {
  count: number
  mentions: number
}

export function ChannelSidebar({ activeId, activeView, onCreateChannel, onBrowse, onNewDM }: Props) {
  const me = useCore((s) => s.currentUserId)
  const users = useCore((s) => s.users)
  const liveUsers = useLiveUsers()
  const channels = useMessenger((s) => s.channels)
  const messages = useMessenger((s) => s.messages)
  const lastRead = useMessenger((s) => s.lastRead)
  const starred = useMessenger((s) => s.starred)
  const bookmarks = useMessenger((s) => s.bookmarks)
  const drafts = useMessenger((s) => s.drafts)
  const collapsed = useMessenger((s) => s.collapsed)
  const toggleCollapsed = useMessenger((s) => s.toggleCollapsed)
  const call = useUI((s) => s.call)
  const [filter, setFilter] = useState('')

  const mine = useMemo(() => channels.filter((c) => c.memberIds.includes(me) && !c.archived), [channels, me])

  const { unread, lastActivity, activityCount } = useMemo(() => {
    const unread: Record<string, Unread> = {}
    const lastActivity: Record<string, string> = {}
    const byId = new Map(mine.map((c) => [c.id, c]))
    let activityCount = 0
    for (const m of messages) {
      const ch = byId.get(m.channelId)
      if (!ch) continue
      if (!lastActivity[m.channelId] || m.createdAt > lastActivity[m.channelId]) lastActivity[m.channelId] = m.createdAt
      if (m.userId === me || m.kind === 'system' || !isTimelineMessage(m)) continue
      if (m.createdAt <= (lastRead[m.channelId] ?? '')) continue
      const u = (unread[m.channelId] ??= { count: 0, mentions: 0 })
      u.count++
      const mention = mentionsUser(m.text, me)
      if (isDirect(ch) || mention) u.mentions++
      if (mention) activityCount++
    }
    return { unread, lastActivity, activityCount }
    // users included so names in mentions resolve after edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, lastRead, mine, me, users])

  const q = filter.trim().toLowerCase()
  const matches = (c: Channel) => !q || channelTitle(c, me).toLowerCase().includes(q)

  const starredList = mine.filter((c) => starred.includes(c.id) && matches(c))
  const channelList = mine
    .filter((c) => (c.kind === 'public' || c.kind === 'private') && !starred.includes(c.id) && matches(c))
    .sort((a, b) => a.name.localeCompare(b.name))
  const dmList = mine
    .filter((c) => isDirect(c) && !starred.includes(c.id) && matches(c))
    .sort((a, b) => ((lastActivity[b.id] ?? b.createdAt) > (lastActivity[a.id] ?? a.createdAt) ? 1 : -1))
  const appList = mine.filter((c) => c.isApp && !starred.includes(c.id) && matches(c))

  const row = (c: Channel) => (
    <ChannelRow
      key={c.id}
      channel={c}
      active={activeId === c.id && !activeView}
      unread={unread[c.id]}
      hasDraft={!!drafts[c.id] && activeId !== c.id}
      inCall={call?.channelId === c.id}
    />
  )

  return (
    <aside className="relative flex h-full w-[264px] shrink-0 flex-col border-r border-line/[0.07] bg-surface/35 backdrop-blur-2xl">
      {/* header */}
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-display text-[15px] font-bold tracking-tight">
            {COMPANY.nameKo}
            <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgb(var(--success))]" />
          </div>
          <div className="text-[11px] text-subtle">{liveUsers.filter((u) => u.presence === 'online').length}명 온라인</div>
        </div>
        <Tooltip content="새 메시지" side="bottom">
          <button onClick={onNewDM} className="flex h-8 w-8 items-center justify-center rounded-xl bg-line/[0.06] text-muted transition hover:bg-accent/15 hover:text-accent">
            <SquarePen className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>

      {/* filter */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="채널, 대화 찾기"
            className="h-8 w-full rounded-xl border border-line/[0.08] bg-line/[0.04] pl-8 pr-7 text-[12.5px] outline-none transition placeholder:text-subtle focus:border-accent/40 focus:bg-line/[0.06]"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scrollbar-none">
        {!q && (
          <div className="mb-2 space-y-px">
            <NavRow to="/messages/threads" icon={<MessageSquareText />} label="스레드" active={activeView === 'threads'} />
            <NavRow to="/messages/activity" icon={<AtSign />} label="멘션 & 반응" active={activeView === 'activity'} count={activityCount} />
            <NavRow to="/messages/saved" icon={<Bookmark />} label="저장된 항목" active={activeView === 'saved'} hint={bookmarks.length || undefined} />
          </div>
        )}

        {starredList.length > 0 && (
          <Section id="starred" label="즐겨찾기" icon={<Star className="h-3 w-3" />} collapsed={!q && !!collapsed.starred} onToggle={() => toggleCollapsed('starred')}>
            {starredList.map(row)}
          </Section>
        )}

        <Section
          id="channels"
          label="채널"
          collapsed={!q && !!collapsed.channels}
          onToggle={() => toggleCollapsed('channels')}
          action={
            <Popover placement="bottom-start" trigger={({ toggle }) => (
              <button onClick={(e) => { e.stopPropagation(); toggle() }} className="flex h-5 w-5 items-center justify-center rounded-md text-subtle opacity-0 transition hover:bg-line/10 hover:text-fg group-hover/sec:opacity-100">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}>
              {(close) => (
                <div className="w-48">
                  <MenuBtn icon={<PenLine />} label="채널 만들기" onClick={() => { close(); onCreateChannel() }} />
                  <MenuBtn icon={<Compass />} label="채널 탐색" onClick={() => { close(); onBrowse() }} />
                </div>
              )}
            </Popover>
          }
        >
          {channelList.map(row)}
          {!q && (
            <button onClick={onCreateChannel} className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-subtle transition hover:bg-line/[0.05] hover:text-fg">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-line/[0.07]"><Plus className="h-3 w-3" /></span>
              채널 만들기
            </button>
          )}
        </Section>

        <Section
          id="dms"
          label="다이렉트 메시지"
          collapsed={!q && !!collapsed.dms}
          onToggle={() => toggleCollapsed('dms')}
          action={
            <button onClick={(e) => { e.stopPropagation(); onNewDM() }} className="flex h-5 w-5 items-center justify-center rounded-md text-subtle opacity-0 transition hover:bg-line/10 hover:text-fg group-hover/sec:opacity-100">
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        >
          {dmList.map(row)}
          {!q && (
            <button onClick={onNewDM} className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-subtle transition hover:bg-line/[0.05] hover:text-fg">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-line/[0.07]"><Plus className="h-3 w-3" /></span>
              새 메시지
            </button>
          )}
        </Section>

        {appList.length > 0 && (
          <Section id="apps" label="앱" collapsed={!q && !!collapsed.apps} onToggle={() => toggleCollapsed('apps')}>
            {appList.map(row)}
          </Section>
        )}

        {q && !starredList.length && !channelList.length && !dmList.length && !appList.length && (
          <div className="px-3 py-8 text-center text-[12.5px] text-subtle">
            "{filter}"와 일치하는 대화가 없어요
            <button onClick={onBrowse} className="mt-2 block w-full text-accent hover:underline">모든 채널 탐색하기 →</button>
          </div>
        )}
      </nav>

      <AnimatePresence>{call && <HuddleBar />}</AnimatePresence>
    </aside>
  )
}

function MenuBtn({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition hover:bg-line/[0.07] [&>svg]:h-4 [&>svg]:w-4">
      {icon}
      {label}
    </button>
  )
}

function NavRow({ to, icon, label, active, count, hint }: { to: string; icon: ReactNode; label: string; active: boolean; count?: number; hint?: number }) {
  return (
    <Link
      to={to}
      className={cn(
        'relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors',
        active ? 'font-semibold text-fg' : 'text-muted hover:bg-line/[0.05] hover:text-fg',
        !!count && 'font-semibold text-fg',
      )}
    >
      {active && <motion.span layoutId="msg-side-active" className="absolute inset-0 rounded-lg border border-accent/20 bg-gradient-to-r from-accent/20 via-accent/10 to-transparent" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <span className={cn('relative [&>svg]:h-4 [&>svg]:w-4', active && 'text-accent')}>{icon}</span>
      <span className="relative flex-1">{label}</span>
      {!!count && <CountBadge count={count} className="relative" />}
      {!count && hint !== undefined && <span className="relative text-[11px] text-subtle">{hint}</span>}
    </Link>
  )
}

function Section({ id, label, icon, collapsed, onToggle, action, children }: { id: string; label: string; icon?: ReactNode; collapsed: boolean; onToggle: () => void; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-3" data-section={id}>
      <div onClick={onToggle} className="group/sec flex h-7 cursor-pointer select-none items-center gap-1 rounded-lg px-1.5 text-[11.5px] font-semibold text-subtle transition hover:text-fg">
        <motion.span animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.15 }} className="flex h-4 w-4 items-center justify-center">
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.span>
        {icon}
        <span className="flex-1">{label}</span>
        {action}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="space-y-px overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChannelRow({ channel: c, active, unread, hasDraft, inCall }: { channel: Channel; active: boolean; unread?: Unread; hasDraft: boolean; inCall: boolean }) {
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const isUnread = !!unread?.count
  const others = isDirect(c) ? otherMembers(c, me) : []
  const other = users.find((u) => u.id === others[0])
  const otherPresence = useLivePresence(other)

  let icon: ReactNode
  if (c.isApp) icon = <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-slate-600 to-slate-900 text-[11px]">{c.emoji}</span>
  else if (c.kind === 'dm') icon = other ? (
    <span className="relative">
      <Avatar user={other} size="xs" className="[&>div]:rounded-md" />
      <PresenceDot presence={otherPresence} className="absolute -bottom-0.5 -right-0.5 h-2 w-2" />
    </span>
  ) : null
  else if (c.kind === 'group') icon = (
    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-line/[0.1] text-[10px] font-bold text-muted">{others.length}</span>
  )
  else icon = c.kind === 'private' ? <Lock className="h-[15px] w-[15px]" /> : <Hash className="h-[15px] w-[15px]" />

  return (
    <Link
      to={`/messages/${c.id}`}
      className={cn(
        'group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors',
        active ? 'text-fg' : isUnread ? 'font-semibold text-fg hover:bg-line/[0.05]' : 'text-muted hover:bg-line/[0.05] hover:text-fg',
      )}
    >
      {active && (
        <motion.span layoutId="msg-side-active" className="absolute inset-0 rounded-lg border border-accent/20 bg-gradient-to-r from-accent/25 via-accent/10 to-transparent" transition={{ type: 'spring', stiffness: 500, damping: 38 }}>
          <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-full bg-accent-gradient" />
        </motion.span>
      )}
      <span className={cn('relative flex w-5 shrink-0 items-center justify-center', active ? 'text-accent' : 'text-subtle group-hover:text-muted', isUnread && !active && 'text-fg')}>{icon}</span>
      <span className={cn('relative min-w-0 flex-1 truncate', active && 'font-semibold')}>
        {c.kind === 'dm' || c.kind === 'group' || c.isApp ? channelTitle(c, me) : c.name}
        {c.kind === 'dm' && other?.statusEmoji && <span className="ml-1.5 text-[11px] opacity-80">{other.statusEmoji}</span>}
      </span>
      {inCall && (
        <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-success/15 text-success">
          <Headphones className="h-3 w-3" />
        </span>
      )}
      {hasDraft && !isUnread && <PenLine className="relative h-3.5 w-3.5 text-subtle" />}
      {unread && unread.mentions > 0 ? (
        <CountBadge count={unread.mentions} className="relative" />
      ) : isUnread && !active ? (
        <span className="relative h-1.5 w-1.5 rounded-full bg-fg/70" />
      ) : null}
    </Link>
  )
}

function HuddleBar() {
  const call = useUI((s) => s.call)!
  const endCall = useUI((s) => s.endCall)
  return (
    <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="m-2 rounded-2xl border border-success/25 bg-success/[0.08] p-2.5">
      <div className="flex items-center gap-2">
        <span className="relative flex h-7 w-7 items-center justify-center rounded-xl bg-success/20 text-success">
          <span className="absolute inset-0 rounded-xl bg-success/25 animate-pulse-ring" />
          <Headphones className="relative h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold">{call.title}</div>
          <div className="text-[11px] text-success">{call.participantIds.length}명 참여 중</div>
        </div>
        <Tooltip content="나가기">
          <button onClick={endCall} className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger/90 text-white transition hover:bg-danger">
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>
    </motion.div>
  )
}
