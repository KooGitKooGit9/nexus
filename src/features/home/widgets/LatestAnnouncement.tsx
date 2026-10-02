import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCheck, Megaphone, Pin } from 'lucide-react'
import { Avatar, Button, CountBadge } from '@/components/ui'
import { useCore, useUser } from '@/store/core'
import { timeAgo } from '@/lib/utils'
import { useGoals } from '@/features/goals/store'
import { CATEGORY_META } from '@/features/announcements/meta'
import { excerpt } from '@/features/announcements/components/Markdown'
import { MiniEmpty } from '../components/Widget'

export function LatestAnnouncement({ className, delay = 0 }: { className?: string; delay?: number }) {
  const navigate = useNavigate()
  const announcements = useGoals((s) => s.announcements)
  const markRead = useGoals((s) => s.markRead)
  const me = useCore((s) => s.currentUserId)
  const a = useMemo(
    () => [...announcements].sort((x, y) => Number(!!y.pinned) - Number(!!x.pinned) || y.createdAt.localeCompare(x.createdAt))[0],
    [announcements],
  )
  const unread = announcements.filter((x) => !x.readBy.includes(me)).length
  const author = useUser(a?.authorId)

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="glass group relative flex h-full flex-col overflow-hidden rounded-2xl transition-[border-color] hover:border-line/15">
        {!a ? (
          <MiniEmpty emoji="📢" title="아직 공지가 없어요">
            <button className="text-accent hover:underline" onClick={() => navigate('/announcements?new=1')}>첫 공지 작성하기</button>
          </MiniEmpty>
        ) : (
          <>
            <button onClick={() => navigate(`/announcements?id=${a.id}`)} className="relative h-28 shrink-0 overflow-hidden text-left" style={{ background: a.cover ?? 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))' }}>
              <div className="absolute inset-0 dot-bg opacity-30" />
              <div className="absolute -bottom-8 -right-4 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl drop-shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                {a.emoji ?? CATEGORY_META[a.category].emoji}
              </span>
              <div className="absolute left-4 top-3 flex items-center gap-1.5">
                <span className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  <Megaphone className="h-3 w-3" /> 최신 공지
                </span>
                {a.pinned && <span className="flex items-center rounded-full bg-black/25 p-1 text-white backdrop-blur"><Pin className="h-3 w-3" /></span>}
              </div>
              {unread > 0 && <CountBadge count={unread} className="absolute bottom-3 left-4" />}
            </button>
            <div className="flex flex-1 flex-col p-4">
              <button onClick={() => navigate(`/announcements?id=${a.id}`)} className="text-left">
                <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-fg hover:underline decoration-line/30 underline-offset-4">{a.title}</div>
              </button>
              <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted">{excerpt(a.body, 110)}</p>
              <div className="mt-auto flex items-center gap-2 pt-3">
                <Avatar userId={a.authorId} size="xs" />
                <span className="truncate text-[11px] text-subtle">{author?.name ?? '나간 멤버'} · {timeAgo(a.createdAt)}</span>
                {!a.readBy.includes(me) ? (
                  <Button size="xs" variant="outline" className="ml-auto" leftIcon={<CheckCheck className="h-3 w-3" />} onClick={() => markRead(a.id)}>
                    읽음
                  </Button>
                ) : (
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-success"><CheckCheck className="h-3 w-3" /> 확인</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
