import { CheckCheck, Pin, Sparkles } from 'lucide-react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Avatar, Badge, Button } from '@/components/ui'
import { toast, useCore, useUI, useUser } from '@/store/core'
import { formatDate, timeAgo } from '@/lib/utils'
import { useGoals } from '@/features/goals/store'
import { CATEGORY_META } from '../meta'
import { Markdown } from './Markdown'
import { ReactionsBar } from './ReactionsBar'
import { ReadReceipts } from './ReadReceipts'
import { Cover } from './AnnouncementCard'

/** Full reading view with large cover. */
export function AnnouncementDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const a = useGoals((s) => s.announcements.find((x) => x.id === id))
  const me = useCore((s) => s.currentUserId)
  const markRead = useGoals((s) => s.markRead)
  const author = useUser(a?.authorId)

  useEffect(() => {
    if (!a) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [a, onClose])

  const unread = a ? !a.readBy.includes(me) : false

  return createPortal(
    <AnimatePresence>
      {a && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.article
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl glass-strong shadow-float"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          >
            <Cover a={a} big className="h-44 shrink-0" />
            <button onClick={onClose} aria-label="닫기" className="absolute right-4 top-4 rounded-full bg-black/30 p-2 text-white backdrop-blur transition hover:bg-black/50">
              <X className="h-4 w-4" />
            </button>
            <div className="overflow-y-auto px-5 pb-6 pt-6 sm:px-8">
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {a.pinned && <Badge tone="warning" icon={<Pin className="h-3 w-3" />}>고정</Badge>}
                <Badge tone={CATEGORY_META[a.category].tone}>{CATEGORY_META[a.category].emoji} {a.category}</Badge>
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-fg">{a.title}</h1>
              <div className="mt-3 flex items-center gap-2.5 text-sm">
                <Avatar userId={a.authorId} size="sm" showPresence />
                <div>
                  <div className="font-medium text-fg">{author?.name ?? '나간 멤버'}{author?.title ? <span className="font-normal text-subtle"> · {author.title}</span> : null}</div>
                  <div className="text-xs text-subtle">{formatDate(a.createdAt, 'yyyy년 M월 d일 a h:mm')} · {timeAgo(a.createdAt)}</div>
                </div>
              </div>
              <div className="my-5 h-px bg-line/10" />
              <Markdown source={a.body} />
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line/10 px-5 py-4 sm:px-8">
              <ReactionsBar id={a.id} reactions={a.reactions} />
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <Button size="sm" variant="ghost" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => { onClose(); useUI.getState().askAI(`공지 「${a.title}」의 핵심 내용을 3줄로 요약해줘`) }}>
                  AI 요약
                </Button>
                <ReadReceipts readBy={a.readBy} />
                {unread ? (
                  <Button size="sm" variant="primary" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={() => { markRead(a.id); toast('읽음 확인 완료', { variant: 'success', emoji: '✅' }) }}>
                    읽음 확인
                  </Button>
                ) : (
                  <Badge tone="success" icon={<CheckCheck className="h-3 w-3" />}>확인 완료</Badge>
                )}
              </div>
            </div>
          </motion.article>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
