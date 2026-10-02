import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AtSign, Hash, Lock } from 'lucide-react'
import { Avatar, CountBadge } from '@/components/ui'
import { useCore } from '@/store/core'
import { timeAgo } from '@/lib/utils'
import { useMessenger } from '@/features/messenger/store'
import type { Channel } from '@/features/messenger/types'
import { MiniEmpty, Widget, WidgetLink } from '../components/Widget'

/** Highlights @mentions in a short snippet. */
function Snippet({ text, handle }: { text: string; handle: string }) {
  const clean = text.replace(/```[\s\S]*?```/g, '[코드]').replace(/[*_`>]/g, '').replace(/\s+/g, ' ').trim()
  const parts = clean.split(/(@[가-힣A-Za-z0-9_]+)/g)
  return (
    <span className="line-clamp-2">
      {parts.map((p, i) =>
        p.startsWith('@') ? (
          <span key={i} className={p === handle ? 'rounded bg-accent/20 px-1 font-medium text-accent' : 'font-medium text-accent-2'}>{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  )
}

export function Mentions({ className, delay }: { className?: string; delay?: number }) {
  const navigate = useNavigate()
  const messages = useMessenger((s) => s.messages)
  const channels = useMessenger((s) => s.channels)
  const me = useCore((s) => s.currentUserId)
  const users = useCore((s) => s.users)
  const myName = users.find((u) => u.id === me)?.name ?? ''
  const handle = `@${myName}`
  // same source as the sidebar's 메신저 badge
  const unread = useMessenger((s) => s.unreadTotal(me))

  const mentions = useMemo(
    () =>
      (messages ?? [])
        .filter((m) => {
          if (m.userId === me || m.deleted || m.scheduledFor) return false
          const c = channels?.find((x) => x.id === m.channelId)
          if (!c || (c.kind !== 'public' && !c.memberIds.includes(me))) return false
          return (!!myName && m.text.includes(handle)) || m.text.includes('@channel') || m.text.includes('@here')
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [messages, channels, me, handle],
  )

  const chName = (c?: Channel) => {
    if (!c) return ''
    if (c.kind === 'dm') return 'DM'
    return c.name
  }

  return (
    <Widget
      className={className}
      delay={delay}
      title="최근 멘션"
      subtitle={unread ? `읽지 않은 메시지 ${unread}개` : '나를 언급한 메시지'}
      icon={<AtSign />}
      gradient="from-indigo-500 to-purple-600"
      action={
        <div className="flex items-center gap-1.5">
          <CountBadge count={unread} />
          <WidgetLink onClick={() => navigate('/messages')}>메신저 →</WidgetLink>
        </div>
      }
    >
      {mentions.length === 0 ? (
        <MiniEmpty emoji="💬" title="새로운 멘션이 없어요">팀원이 회원님을 언급하면 여기에 표시돼요.</MiniEmpty>
      ) : (
        <ul className="space-y-1">
          {mentions.map((m, i) => {
            const c = channels?.find((x) => x.id === m.channelId)
            const author = users.find((u) => u.id === m.userId)
            return (
              <motion.li key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (delay ?? 0) + 0.2 + i * 0.05 }}>
                <button
                  onClick={() => navigate(m.threadId ? `/messages/${m.channelId}/thread/${m.threadId}?m=${m.id}` : `/messages/${m.channelId}?m=${m.id}`)}
                  className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-line/[0.05]"
                >
                  <Avatar userId={m.userId} size="sm" showPresence />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12px]">
                      <span className="font-semibold text-fg">{author?.name ?? '알 수 없음'}</span>
                      {c && (
                        <span className="flex items-center gap-0.5 text-subtle">
                          {c.kind === 'private' ? <Lock className="h-3 w-3" /> : c.kind === 'dm' ? null : <Hash className="h-3 w-3" />}
                          {chName(c)}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-subtle">{timeAgo(m.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 text-[13px] leading-snug text-muted">
                      <Snippet text={m.text} handle={handle} />
                    </div>
                  </div>
                </button>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}
