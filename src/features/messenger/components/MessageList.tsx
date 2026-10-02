import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Hash, Lock, UserPlus, Pencil } from 'lucide-react'
import { cn, formatDayLabel } from '@/lib/utils'
import { useCore } from '@/store/core'
import { Avatar } from '@/components/ui'
import { useMessenger } from '../store'
import { channelTitle, isDirect, otherMembers, useChatUI, useTyping } from '../lib'
import { MessageItem } from './MessageItem'
import type { Channel, Message } from '../types'

const GROUP_GAP_MS = 5 * 60_000

interface Row {
  m: Message
  compact: boolean
  newDivider: boolean
}

export function MessageList({
  channel,
  focusId,
  onAddMembers,
  onEditTopic,
}: {
  channel: Channel
  focusId?: string | null
  onAddMembers: () => void
  onEditTopic: () => void
}) {
  const me = useCore((s) => s.currentUserId)
  const messages = useMessenger((s) => s.messages)
  const markRead = useMessenger((s) => s.markRead)
  const [since] = useState(() => useMessenger.getState().lastRead[channel.id] ?? '')
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const flash = useChatUI((s) => s.flash)

  const { sections, replies, count, lastMine, latestAt } = useMemo(() => {
    const inChannel = messages.filter((m) => m.channelId === channel.id)
    let latestAt = ''
    for (const m of inChannel) if (m.createdAt > latestAt) latestAt = m.createdAt
    const replies = new Map<string, Message[]>()
    for (const m of inChannel) {
      if (!m.threadId) continue
      const arr = replies.get(m.threadId) ?? []
      arr.push(m)
      replies.set(m.threadId, arr)
    }
    for (const arr of replies.values()) arr.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    const timeline = inChannel
      .filter((m) => (!m.threadId || m.alsoInChannel) && (!m.deleted || replies.has(m.id)))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))

    const sections: { day: string; label: string; rows: Row[] }[] = []
    let dividerPlaced = false
    let prev: Message | null = null
    for (const m of timeline) {
      const dayKey = new Date(m.createdAt).toDateString()
      let sec = sections[sections.length - 1]
      if (!sec || sec.day !== dayKey) {
        sec = { day: dayKey, label: formatDayLabel(m.createdAt), rows: [] }
        sections.push(sec)
        prev = null
      }
      const newDivider = !dividerPlaced && !!since && m.createdAt > since && m.userId !== me && m.kind !== 'system'
      if (newDivider) dividerPlaced = true
      const compact =
        !!prev &&
        !newDivider &&
        prev.userId === m.userId &&
        prev.kind !== 'system' &&
        m.kind !== 'system' &&
        !m.alsoInChannel &&
        !m.pinned &&
        new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP_MS
      sec.rows.push({ m, compact, newDivider })
      prev = m
    }
    const last = timeline[timeline.length - 1]
    return { sections, replies, count: timeline.length, lastMine: last?.userId === me, latestAt }
  }, [messages, channel.id, since, me])

  /* mark read while viewing — only when this channel gets something new, so "읽지 않음으로 표시" sticks
     instead of being undone by chatter in other channels */
  useEffect(() => {
    if (document.visibilityState === 'visible') markRead(channel.id)
  }, [latestAt, channel.id, markRead])
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && markRead(channel.id)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [channel.id, markRead])

  /* initial scroll position */
  useLayoutEffect(() => {
    const sc = scroller.current
    if (!sc) return
    if (focusId) return
    const divider = sc.querySelector<HTMLElement>('[data-new-divider]')
    if (divider) {
      sc.scrollTop = Math.max(0, divider.offsetTop - sc.clientHeight * 0.35)
    } else sc.scrollTop = sc.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id])

  /* jump to a specific message (?m=) */
  useEffect(() => {
    if (!focusId) return
    const t = setTimeout(() => {
      const el = scroller.current?.querySelector<HTMLElement>(`#msg-${CSS.escape(focusId)}`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        flash(focusId)
      } else if (scroller.current) {
        // unknown / deleted message: don't leave the user stranded at the top of the history
        scroller.current.scrollTop = scroller.current.scrollHeight
      }
    }, 60)
    return () => clearTimeout(t)
  }, [focusId, flash])

  /* follow new messages */
  const prevCount = useRef(count)
  useEffect(() => {
    const added = count - prevCount.current
    prevCount.current = count
    if (added <= 0) return
    const sc = scroller.current
    if (!sc) return
    if (atBottom.current || lastMine) {
      requestAnimationFrame(() => sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' }))
      setUnseen(0)
    } else setUnseen((u) => u + added)
  }, [count, lastMine])

  const onScroll = () => {
    const sc = scroller.current
    if (!sc) return
    const dist = sc.scrollHeight - sc.scrollTop - sc.clientHeight
    atBottom.current = dist < 140
    setShowJump(dist > 400)
    if (atBottom.current && unseen) setUnseen(0)
  }

  const jumpToBottom = () => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
    setUnseen(0)
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto overflow-x-hidden pb-2">
        <ChannelIntro channel={channel} onAddMembers={onAddMembers} onEditTopic={onEditTopic} />
        {sections.map((sec) => (
          <section key={sec.day} className="relative">
            <div className="pointer-events-none absolute left-5 right-5 top-[21px] h-px bg-line/[0.08]" />
            <div className="pointer-events-none sticky top-0 z-10 flex justify-center pb-1 pt-2.5">
              <span className="pointer-events-auto rounded-full border border-line/10 bg-surface/90 px-3.5 py-1 text-[11.5px] font-semibold text-fg/80 shadow-card backdrop-blur-xl">
                {sec.label}
              </span>
            </div>
            {sec.rows.map((r) => (
              <div key={r.m.id}>
                {r.newDivider && (
                  <div data-new-divider className="relative my-2 flex items-center gap-2 px-5">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-danger/60 to-danger/80" />
                    <span className="rounded-full bg-danger px-2 py-[2px] text-[10.5px] font-bold text-white shadow-[0_4px_14px_-4px_rgb(var(--danger)/0.7)]">새 메시지</span>
                  </div>
                )}
                <MessageItem message={r.m} compact={r.compact} replies={replies.get(r.m.id)} />
              </div>
            ))}
          </section>
        ))}
        <div className="h-2" />
      </div>

      <AnimatePresence>
        {(unseen > 0 || showJump) && (
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            onClick={jumpToBottom}
            className={cn(
              'absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold shadow-float transition hover:brightness-110',
              unseen > 0 ? 'bg-accent-gradient text-white shadow-glow' : 'glass-strong text-fg',
            )}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {unseen > 0 ? `새 메시지 ${unseen}개` : '최신 메시지로 이동'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChannelIntro({ channel, onAddMembers, onEditTopic }: { channel: Channel; onAddMembers: () => void; onEditTopic: () => void }) {
  const users = useCore((s) => s.users)
  if (isDirect(channel)) {
    const others = otherMembers(channel)
    const first = users.find((u) => u.id === others[0])
    return (
      <div className="px-5 pb-4 pt-10">
        <div className="flex -space-x-3">
          {others.slice(0, 4).map((id) => (
            <Avatar key={id} userId={id} size="xl" ring />
          ))}
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">{channelTitle(channel)}</h2>
        <p className="mt-1 max-w-xl text-[14px] text-muted">
          {channel.kind === 'dm' ? (
            <>
              <b className="text-fg">{first?.name}</b>님과의 다이렉트 메시지의 시작입니다. {first?.title} · {first?.location}
            </>
          ) : (
            <>이 그룹 대화의 시작입니다. {others.length + 1}명이 참여하고 있어요.</>
          )}
        </p>
      </div>
    )
  }
  return (
    <div className="px-5 pb-4 pt-10">
      <div className="relative inline-flex">
        <div className="absolute inset-0 rounded-3xl bg-accent-gradient opacity-40 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl glass text-3xl">
          {channel.emoji ?? (channel.kind === 'private' ? <Lock className="h-7 w-7" /> : <Hash className="h-7 w-7" />)}
        </div>
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
        <span className="gradient-text">{channel.isApp ? channel.name : `#${channel.name}`}</span>
        {!channel.isApp && <span className="text-fg">에 오신 것을 환영합니다</span>}
      </h2>
      <p className="mt-1 max-w-2xl text-[14px] text-muted">{channel.description ?? '이 채널의 시작입니다.'}</p>
      {!channel.isApp && (
        <div className="mt-4 flex gap-2">
          <button onClick={onAddMembers} className="flex items-center gap-1.5 rounded-xl border border-line/10 bg-line/[0.04] px-3 py-1.5 text-[12.5px] font-medium transition hover:border-accent/40 hover:text-accent">
            <UserPlus className="h-3.5 w-3.5" /> 멤버 추가
          </button>
          <button onClick={onEditTopic} className="flex items-center gap-1.5 rounded-xl border border-line/10 bg-line/[0.04] px-3 py-1.5 text-[12.5px] font-medium transition hover:border-accent/40 hover:text-accent">
            <Pencil className="h-3.5 w-3.5" /> 주제 편집
          </button>
        </div>
      )}
    </div>
  )
}

export function TypingIndicator({ typingKey, className }: { typingKey: string; className?: string }) {
  const ids = useTyping(typingKey)
  const users = useCore((s) => s.users)
  const names = ids.map((id) => users.find((u) => u.id === id)?.name ?? '')
  const label =
    names.length === 1 ? `${names[0]}님이 입력 중` : names.length === 2 ? `${names[0]}님과 ${names[1]}님이 입력 중` : `${names.length}명이 입력 중`
  return (
    <div className={cn('h-6 px-5', className)}>
      <AnimatePresence>
        {ids.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex items-center gap-2 text-[12px] text-muted"
          >
            <div className="flex -space-x-1.5">
              {ids.slice(0, 3).map((id) => (
                <Avatar key={id} userId={id} size="xs" ring />
              ))}
            </div>
            <span className="flex items-center gap-[3px] rounded-full bg-line/[0.06] px-2 py-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent animate-typing-dot" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </span>
            <span>
              <b className="font-semibold text-fg/80">{label}</b>…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
