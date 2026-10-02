import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquareText, X } from 'lucide-react'
import { useMessenger } from '../store'
import { channelLabel, threadReplies, useChatUI } from '../lib'
import { MessageItem } from './MessageItem'
import { Composer } from './Composer'
import { TypingIndicator } from './MessageList'
import { EmptyState } from '@/components/ui'

export function ThreadPanel({ channelId, rootId, onClose }: { channelId: string; rootId: string; onClose: () => void }) {
  const messages = useMessenger((s) => s.messages)
  const channel = useMessenger((s) => s.channels.find((c) => c.id === channelId))
  const root = messages.find((m) => m.id === rootId)
  const replies = useMemo(() => threadReplies(messages, rootId), [messages, rootId])
  const scroller = useRef<HTMLDivElement>(null)
  const [sp] = useSearchParams()
  const focusId = sp.get('m')

  useEffect(() => {
    if (!focusId) return
    const t = setTimeout(() => {
      const el = scroller.current?.querySelector(`#msg-${CSS.escape(focusId)}`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        useChatUI.getState().flash(focusId)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [focusId, rootId])

  useEffect(() => {
    const sc = scroller.current
    if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: replies.length ? 'smooth' : 'auto' })
  }, [replies.length, rootId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement).closest('textarea')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const participants = Array.from(new Set(replies.map((r) => r.userId)))

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line/[0.07] px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold leading-tight">스레드</div>
          <div className="truncate text-[11.5px] text-subtle">{channel ? channelLabel(channel) : ''} · 참여자 {participants.length}명</div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-line/10 hover:text-fg">
          <X className="h-4 w-4" />
        </button>
      </div>
      {!root ? (
        <EmptyState icon={<MessageSquareText />} title="스레드를 찾을 수 없어요" description="메시지가 삭제되었을 수 있어요." />
      ) : (
        <>
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2 pt-2 [&_.px-5]:px-4">
            <MessageItem message={root} inThread isRoot />
            <div className="my-2 flex items-center gap-3 px-4">
              <span className="text-[12px] font-medium text-subtle">{replies.length ? `${replies.length}개의 답글` : '아직 답글이 없어요'}</span>
              <div className="h-px flex-1 bg-line/10" />
            </div>
            {replies.map((r, i) => {
              const prev = replies[i - 1]
              const compact = !!prev && prev.userId === r.userId && new Date(r.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000
              return <MessageItem key={r.id} message={r} inThread compact={compact} />
            })}
          </div>
          <TypingIndicator typingKey={`thread:${rootId}`} className="px-4" />
          <Composer key={rootId} channelId={channelId} threadId={rootId} placeholder="답글 남기기…" variant="thread" />
        </>
      )}
    </div>
  )
}
