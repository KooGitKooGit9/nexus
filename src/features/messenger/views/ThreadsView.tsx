import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageSquareText, CornerDownRight } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { useCore } from '@/store/core'
import { AvatarStack, EmptyState } from '@/components/ui'
import { useMessenger } from '../store'
import { channelLabel, channelPath } from '../lib'
import { MessageItem } from '../components/MessageItem'
import { ViewShell } from './ViewShell'
import type { Message } from '../types'

export function ThreadsView() {
  const me = useCore((s) => s.currentUserId)
  const messages = useMessenger((s) => s.messages)
  const channels = useMessenger((s) => s.channels)
  const navigate = useNavigate()

  const threads = useMemo(() => {
    const replies = new Map<string, Message[]>()
    for (const m of messages) if (m.threadId) replies.set(m.threadId, [...(replies.get(m.threadId) ?? []), m])
    const out: { root: Message; replies: Message[]; last: string }[] = []
    for (const [rootId, rs] of replies) {
      const root = messages.find((m) => m.id === rootId)
      if (!root) continue
      if (root.userId !== me && !rs.some((r) => r.userId === me)) continue
      rs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      out.push({ root, replies: rs, last: rs[rs.length - 1].createdAt })
    }
    return out.sort((a, b) => (a.last < b.last ? 1 : -1))
  }, [messages, me])

  return (
    <ViewShell icon={<MessageSquareText />} title="스레드" subtitle={`참여 중인 스레드 ${threads.length}개`}>
      {!threads.length ? (
        <EmptyState icon={<MessageSquareText />} title="참여 중인 스레드가 없어요" description="메시지에 답글을 달면 스레드가 여기에 모여요." />
      ) : (
        <div className="space-y-4">
          {threads.map(({ root, replies, last }, i) => {
            const ch = channels.find((c) => c.id === root.channelId)
            const tail = replies.slice(-2)
            const hidden = replies.length - tail.length
            return (
              <motion.div key={root.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }} className="glass overflow-hidden rounded-2xl">
                <div className="flex items-center gap-2 border-b border-line/[0.07] px-4 py-2.5 text-[12px]">
                  <span className="font-semibold">{ch ? channelLabel(ch) : ''}</span>
                  <AvatarStack userIds={Array.from(new Set(replies.map((r) => r.userId)))} size="xs" max={4} />
                  <span className="ml-auto text-subtle">마지막 답글 {timeAgo(last)}</span>
                </div>
                <div className="py-2 [&_.px-5]:px-4">
                  <MessageItem message={root} inThread isRoot />
                  {hidden > 0 && (
                    <button onClick={() => navigate(channelPath(root.channelId, { thread: root.id }))} className="ml-[60px] my-1 flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                      <CornerDownRight className="h-3.5 w-3.5" /> 답글 {hidden}개 더 보기
                    </button>
                  )}
                  <div className="ml-6 border-l-2 border-line/[0.08]">
                    {tail.map((r) => (
                      <MessageItem key={r.id} message={r} inThread />
                    ))}
                  </div>
                </div>
                <button onClick={() => navigate(channelPath(root.channelId, { thread: root.id }))} className="w-full border-t border-line/[0.07] px-4 py-2.5 text-left text-[13px] text-subtle transition hover:bg-line/[0.04] hover:text-fg">
                  답글 남기기…
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </ViewShell>
  )
}
