import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AtSign, MessageSquareText, SmilePlus, CheckCheck } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { useCore } from '@/store/core'
import { Avatar, Button, EmptyState, Tabs } from '@/components/ui'
import { useMessenger, mentionsUser } from '../store'
import { channelLabel, channelPath } from '../lib'
import { InlinePreview } from '../markdown'
import { ViewShell } from './ViewShell'

type Kind = 'mention' | 'reaction' | 'reply'
interface Item {
  id: string
  kind: Kind
  actorIds: string[]
  emoji?: string
  text: string
  channelId: string
  messageId: string
  threadId?: string
  at: string
  unread: boolean
}

export function ActivityView() {
  const me = useCore((s) => s.currentUserId)
  const users = useCore((s) => s.users)
  const messages = useMessenger((s) => s.messages)
  const channels = useMessenger((s) => s.channels)
  const lastRead = useMessenger((s) => s.lastRead)
  const markRead = useMessenger((s) => s.markRead)
  const [tab, setTab] = useState<'all' | Kind>('all')
  const navigate = useNavigate()

  const items = useMemo(() => {
    const mine = new Set(channels.filter((c) => c.memberIds.includes(me)).map((c) => c.id))
    const out: Item[] = []
    const myRoots = new Set(messages.filter((m) => m.userId === me && !m.threadId).map((m) => m.id))
    for (const m of messages) {
      if (!mine.has(m.channelId) || m.deleted || m.kind === 'system') continue
      const unread = m.createdAt > (lastRead[m.channelId] ?? '')
      if (m.userId !== me && mentionsUser(m.text, me)) {
        out.push({ id: `mn-${m.id}`, kind: 'mention', actorIds: [m.userId], text: m.text, channelId: m.channelId, messageId: m.id, threadId: m.threadId, at: m.createdAt, unread })
      }
      if (m.userId !== me && m.threadId && myRoots.has(m.threadId)) {
        out.push({ id: `rp-${m.id}`, kind: 'reply', actorIds: [m.userId], text: m.text, channelId: m.channelId, messageId: m.id, threadId: m.threadId, at: m.createdAt, unread })
      }
      if (m.userId === me) {
        for (const [emoji, ids] of Object.entries(m.reactions)) {
          const others = ids.filter((x) => x !== me)
          if (others.length) out.push({ id: `rx-${m.id}-${emoji}`, kind: 'reaction', actorIds: others, emoji, text: m.text, channelId: m.channelId, messageId: m.id, threadId: m.threadId, at: m.createdAt, unread: false })
        }
      }
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1))
  }, [messages, channels, lastRead, me])

  const shown = tab === 'all' ? items : items.filter((i) => i.kind === tab)
  const unreadCount = items.filter((i) => i.unread).length
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'Nexus Bot'

  const meta: Record<Kind, { icon: ReactNode; cls: string }> = {
    mention: { icon: <AtSign className="h-3 w-3" />, cls: 'bg-warning text-black' },
    reaction: { icon: <SmilePlus className="h-3 w-3" />, cls: 'bg-accent-3 text-white' },
    reply: { icon: <MessageSquareText className="h-3 w-3" />, cls: 'bg-accent-2 text-white' },
  }

  return (
    <ViewShell
      icon={<AtSign />}
      title="멘션 & 반응"
      subtitle={unreadCount ? `읽지 않은 활동 ${unreadCount}개` : '모든 활동을 확인했어요 ✨'}
      actions={
        unreadCount > 0 && (
          <Button size="sm" variant="ghost" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={() => items.filter((i) => i.unread).forEach((i) => markRead(i.channelId))}>
            모두 읽음
          </Button>
        )
      }
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'all', label: '전체', count: items.length },
          { value: 'mention', label: '멘션', count: items.filter((i) => i.kind === 'mention').length },
          { value: 'reply', label: '스레드 답글', count: items.filter((i) => i.kind === 'reply').length },
          { value: 'reaction', label: '반응', count: items.filter((i) => i.kind === 'reaction').length },
        ]}
      />
      {!shown.length ? (
        <EmptyState icon={<AtSign />} title="아직 활동이 없어요" description="누군가 회원님을 멘션하거나 메시지에 반응하면 여기에 표시돼요." />
      ) : (
        <div className="space-y-1.5">
          {shown.map((it, i) => {
            const ch = channels.find((c) => c.id === it.channelId)
            const actors = it.actorIds.map(nameOf)
            const who = actors.length > 2 ? `${actors.slice(0, 2).join(', ')} 외 ${actors.length - 2}명` : actors.join(', ')
            const title =
              it.kind === 'mention' ? `${who}님이 ${ch ? channelLabel(ch) : ''}에서 회원님을 멘션했습니다` : it.kind === 'reply' ? `${who}님이 스레드에 답글을 남겼습니다` : `${who}님이 회원님의 메시지에 ${it.emoji} 반응을 남겼습니다`
            return (
              <motion.button
                key={it.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.025, 0.35) }}
                onClick={() => navigate(channelPath(it.channelId, { thread: it.threadId, message: it.messageId }))}
                className={cn('group relative flex w-full gap-3 rounded-2xl border p-3.5 text-left transition', it.unread ? 'border-accent/25 bg-accent/[0.05] hover:bg-accent/[0.08]' : 'border-transparent hover:border-line/10 hover:bg-line/[0.04]')}
              >
                <div className="relative shrink-0">
                  {it.kind === 'reaction' ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-line/[0.06] text-xl">{it.emoji}</div>
                  ) : (
                    <Avatar userId={it.actorIds[0]} size="md" />
                  )}
                  <span className={cn('absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2 ring-surface', meta[it.kind].cls)}>{meta[it.kind].icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className={cn('flex-1 text-[13px]', it.unread ? 'font-semibold' : 'text-muted')}>{title}</span>
                    <span className="shrink-0 text-[11px] text-subtle">{timeAgo(it.at)}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 rounded-xl bg-line/[0.035] px-3 py-2 text-[13px] text-fg/80">
                    <InlinePreview text={it.text || '첨부 파일'} />
                  </div>
                </div>
                {it.unread && <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent shadow-glow-sm" />}
              </motion.button>
            )
          })}
        </div>
      )}
    </ViewShell>
  )
}
