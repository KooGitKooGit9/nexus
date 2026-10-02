import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Hash, Headphones, Info, Lock, Pin, PinOff, Search, Star, Video, X } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { useCore, useUI } from '@/store/core'
import { Avatar, AvatarStack, Kbd, Popover, Tooltip, PRESENCE_LABEL, PresenceDot } from '@/components/ui'
import { useLivePresence } from '@/components/ui/Avatar'
import { useMessenger } from '../store'
import { channelPath, channelTitle, isDirect, otherMembers, useChatUI } from '../lib'
import { startHuddle } from '../actions'
import { SidebarToggle } from './SidebarToggle'
import { InlinePreview } from '../markdown'
import type { Channel } from '../types'

export function ChannelHeader({ channel, onMembers, editTopicSignal }: { channel: Channel; onMembers: () => void; editTopicSignal: number }) {
  const me = useCore((s) => s.currentUserId)
  const users = useCore((s) => s.users)
  const starred = useMessenger((s) => s.starred.includes(channel.id))
  const toggleStar = useMessenger((s) => s.toggleStar)
  const setTopic = useMessenger((s) => s.setTopic)
  const call = useUI((s) => s.call)
  const { setInfoOpen } = useChatUI.getState()
  const [editing, setEditing] = useState(false)
  const [topic, setTopicDraft] = useState(channel.topic ?? '')
  const direct = isDirect(channel)
  const other = direct && channel.kind === 'dm' ? users.find((u) => u.id === otherMembers(channel, me)[0]) : undefined
  const otherPresence = useLivePresence(other)
  const inCall = call?.channelId === channel.id
  const narrow = useChatUI((s) => s.narrow)

  useEffect(() => {
    if (editTopicSignal > 0 && !direct) {
      setTopicDraft(channel.topic ?? '')
      setEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTopicSignal])

  const saveTopic = () => {
    setEditing(false)
    if ((channel.topic ?? '') !== topic.trim()) setTopic(channel.id, topic.trim())
  }

  return (
    <header className={cn('relative z-10 flex h-[60px] shrink-0 items-center gap-3 border-b border-line/[0.07] bg-surface/25 backdrop-blur-xl', narrow ? 'px-3' : 'px-5')}>
      <SidebarToggle />
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {other ? (
          <div className="relative shrink-0">
            <Avatar user={other} size="md" />
            <PresenceDot presence={otherPresence} className="absolute -bottom-0.5 -right-0.5 h-3 w-3" />
          </div>
        ) : channel.kind === 'group' ? (
          <AvatarStack userIds={otherMembers(channel, me)} max={3} size="sm" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-line/[0.06] text-lg">
            {channel.emoji ?? (channel.kind === 'private' ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />)}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <button onClick={() => setInfoOpen(true)} className="group flex min-w-0 items-center gap-1 rounded-lg px-1 -mx-1 hover:bg-line/[0.05]">
              {!direct && !channel.isApp && (channel.kind === 'private' ? <Lock className="h-3.5 w-3.5 text-muted" /> : <Hash className="h-4 w-4 text-muted" />)}
              <span className="truncate text-[15.5px] font-bold tracking-tight">{direct || channel.isApp ? channelTitle(channel, me) : channel.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-subtle transition group-hover:text-fg" />
            </button>
            <Tooltip content={starred ? '즐겨찾기 해제' : '즐겨찾기에 추가'} side="bottom">
              <motion.button whileTap={{ scale: 0.7, rotate: -20 }} onClick={() => toggleStar(channel.id)} className={cn('rounded-md p-1 transition', starred ? 'text-amber-400' : 'text-subtle hover:text-fg')}>
                <Star className={cn('h-4 w-4', starred && 'fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]')} />
              </motion.button>
            </Tooltip>
          </div>
          {editing ? (
            <input
              autoFocus
              value={topic}
              onChange={(e) => setTopicDraft(e.target.value)}
              onBlur={saveTopic}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) saveTopic()
                if (e.key === 'Escape') setEditing(false)
              }}
              placeholder="채널 주제 입력"
              className="h-5 w-[min(440px,40vw)] rounded border-b border-accent/50 bg-transparent text-[12px] outline-none"
            />
          ) : other ? (
            <div className="flex items-center gap-1.5 truncate text-[12px] text-muted">
              {PRESENCE_LABEL[otherPresence]}
              {other.statusText && <span className="truncate">· {other.statusEmoji} {other.statusText}</span>}
              <span className="text-subtle">· {other.title}</span>
            </div>
          ) : (
            <button
              onClick={() => {
                if (direct || channel.isApp) return
                setTopicDraft(channel.topic ?? '')
                setEditing(true)
              }}
              className="block max-w-[min(520px,45vw)] truncate text-left text-[12px] text-muted hover:text-fg"
              title="클릭해서 주제 편집"
            >
              {channel.topic || (channel.isApp ? channel.description : direct ? `${channel.memberIds.length}명` : '주제 추가하기')}
            </button>
          )}
        </div>
      </div>

      <HeaderSearch narrow={narrow} />

      <div className="flex items-center gap-1">
        {!channel.isApp && (
          <button onClick={onMembers} className="mr-1 flex items-center gap-1.5 rounded-xl border border-line/10 py-1 pl-1 pr-2.5 transition hover:border-accent/40 hover:bg-line/[0.04]">
            <AvatarStack userIds={channel.memberIds.filter((x) => x !== 'u_bot')} max={3} size="xs" />
            <span className="text-[12.5px] font-semibold text-muted">{channel.memberIds.length}</span>
          </button>
        )}
        {!channel.isApp && (
          <div className={cn('flex items-center overflow-hidden rounded-xl border transition', inCall ? 'border-success/40 bg-success/15' : 'border-line/10')}>
            <Tooltip content={inCall ? '허들 진행 중' : '허들 시작'} side="bottom">
              <button
                onClick={() => (inCall ? undefined : startHuddle(channel.id, false))}
                className={cn('flex h-8 items-center gap-1.5 px-2.5 text-[12.5px] font-medium transition', inCall ? 'text-success' : 'text-muted hover:bg-line/[0.05] hover:text-fg')}
              >
                <Headphones className="h-4 w-4" />
                {!narrow && (inCall ? '참여 중' : '허들')}
              </button>
            </Tooltip>
            <span className="h-4 w-px bg-line/10" />
            <Tooltip content="화상 회의" side="bottom">
              <button onClick={() => startHuddle(channel.id, true)} className="flex h-8 w-8 items-center justify-center text-muted transition hover:bg-line/[0.05] hover:text-fg">
                <Video className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}
        <PinnedPopover channelId={channel.id} />
        <Tooltip content="채널 정보" side="bottom">
          <button onClick={() => setInfoOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-line/[0.07] hover:text-fg">
            <Info className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
      </div>
    </header>
  )
}

function HeaderSearch({ narrow }: { narrow: boolean }) {
  const q = useChatUI((s) => s.searchQuery)
  const open = useChatUI((s) => s.searchOpen)
  const { setSearch, setSearchOpen } = useChatUI.getState()
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const wide = focused || !!q
  return (
    <motion.div animate={{ width: wide ? (narrow ? 200 : 280) : narrow ? 130 : 190 }} transition={{ type: 'spring', stiffness: 400, damping: 34 }} className="relative hidden md:block">
      <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition', focused ? 'text-accent' : 'text-subtle')} />
      <input
        ref={ref}
        value={q}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => setSearch(e.target.value, e.target.value.trim().length > 0)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) setSearchOpen(true)
          if (e.key === 'Escape') {
            setSearch('', false)
            ref.current?.blur()
          }
        }}
        placeholder="메시지 검색"
        className={cn('h-8 w-full rounded-xl border bg-line/[0.04] pl-8 pr-8 text-[12.5px] outline-none transition placeholder:text-subtle', focused || open ? 'border-accent/40 shadow-glow-sm' : 'border-line/10')}
      />
      {q ? (
        <button onClick={() => setSearch('', false)} className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"><X className="h-3.5 w-3.5" /></button>
      ) : narrow ? null : (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"><Kbd>⌘F</Kbd></span>
      )}
    </motion.div>
  )
}

export function PinnedPopover({ channelId }: { channelId: string }) {
  const messages = useMessenger((s) => s.messages)
  const pinned = useMemo(() => messages.filter((m) => m.channelId === channelId && m.pinned && !m.deleted), [messages, channelId])
  const togglePin = useMessenger((s) => s.togglePin)
  const users = useCore((s) => s.users)
  const navigate = useNavigate()
  return (
    <Popover
      placement="bottom-end"
      className="w-[360px] p-0"
      trigger={({ toggle, open }) => (
        <Tooltip content="고정된 메시지" side="bottom">
          <button onClick={toggle} className={cn('relative flex h-8 items-center gap-1 rounded-xl px-2 text-muted transition hover:bg-line/[0.07] hover:text-fg', open && 'bg-line/[0.07] text-fg')}>
            <Pin className="h-4 w-4" />
            {pinned.length > 0 && <span className="text-[12px] font-semibold">{pinned.length}</span>}
          </button>
        </Tooltip>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-2 border-b border-line/[0.07] px-4 py-3 text-[13.5px] font-semibold">
            <Pin className="h-4 w-4 text-amber-500" /> 고정된 메시지 <span className="text-subtle">{pinned.length}</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto p-1.5">
            <AnimatePresence initial={false}>
              {pinned.map((m) => {
                const u = users.find((x) => x.id === m.userId)
                return (
                  <motion.div key={m.id} layout exit={{ opacity: 0, height: 0 }} className="group relative rounded-xl p-2.5 transition hover:bg-line/[0.05]">
                    <button
                      className="w-full text-left"
                      onClick={() => {
                        close()
                        navigate(channelPath(channelId, { message: m.id }))
                      }}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <Avatar userId={m.userId} size="xs" />
                        <span className="text-[12.5px] font-semibold">{u?.name ?? 'Nexus Bot'}</span>
                        <span className="text-[11px] text-subtle">{timeAgo(m.createdAt)}</span>
                      </div>
                      <div className="line-clamp-3 text-[12.5px] leading-relaxed text-fg/80">
                        <InlinePreview text={m.text || (m.kind === 'poll' ? '📊 투표' : '첨부 파일')} />
                      </div>
                    </button>
                    <button onClick={() => togglePin(m.id)} title="고정 해제" className="absolute right-2 top-2 rounded-lg p-1 text-subtle opacity-0 transition hover:bg-line/10 hover:text-fg group-hover:opacity-100">
                      <PinOff className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {!pinned.length && (
              <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
                <span className="text-3xl">📌</span>
                <div className="text-[13px] font-medium">아직 고정된 메시지가 없어요</div>
                <div className="text-[12px] text-subtle">중요한 메시지에 마우스를 올리고 ⋯ → 채널에 고정을 선택하세요.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </Popover>
  )
}
