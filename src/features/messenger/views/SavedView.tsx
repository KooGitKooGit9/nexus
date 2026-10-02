import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, BookmarkX, ExternalLink } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { toast, useCore } from '@/store/core'
import { Avatar, EmptyState, Tooltip } from '@/components/ui'
import { useMessenger } from '../store'
import { channelLabel, channelPath } from '../lib'
import { Markdown } from '../markdown'
import { AttachmentList } from '../components/Attachments'
import { ViewShell } from './ViewShell'

export function SavedView() {
  const bookmarks = useMessenger((s) => s.bookmarks)
  const messages = useMessenger((s) => s.messages)
  const channels = useMessenger((s) => s.channels)
  const toggleBookmark = useMessenger((s) => s.toggleBookmark)
  const users = useCore((s) => s.users)
  const navigate = useNavigate()
  const items = bookmarks.map((id) => messages.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)

  return (
    <ViewShell icon={<Bookmark />} title="저장된 항목" subtitle={`나중에 다시 볼 메시지 ${items.length}개`}>
      {!items.length ? (
        <EmptyState icon={<Bookmark />} title="저장된 메시지가 없어요" description="메시지에 마우스를 올리고 북마크 아이콘을 눌러 나중에 다시 볼 수 있도록 저장하세요." />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((m, i) => {
              const ch = channels.find((c) => c.id === m.channelId)
              const u = users.find((x) => x.id === m.userId)
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                  exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }}
                  className="group glass rounded-2xl p-4 card-hover"
                >
                  <div className="mb-2 flex items-center gap-2 text-[12px] text-subtle">
                    <span className="rounded-md bg-line/[0.06] px-1.5 py-0.5 font-medium text-muted">{ch ? channelLabel(ch) : ''}</span>
                    <span>{timeAgo(m.createdAt)}</span>
                    <div className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <Tooltip content="대화에서 보기">
                        <button onClick={() => navigate(channelPath(m.channelId, { thread: m.threadId, message: m.id }))} className="rounded-lg p-1.5 text-muted hover:bg-line/10 hover:text-fg"><ExternalLink className="h-4 w-4" /></button>
                      </Tooltip>
                      <Tooltip content="저장 취소">
                        <button onClick={() => { toggleBookmark(m.id); toast('저장된 항목에서 제거했어요', { emoji: '🔖' }) }} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"><BookmarkX className="h-4 w-4" /></button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Avatar userId={m.userId} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold">{u?.name ?? 'Nexus Bot'}</div>
                      {m.text && <Markdown text={m.text} />}
                      {m.attachments && <AttachmentList attachments={m.attachments} />}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </ViewShell>
  )
}
