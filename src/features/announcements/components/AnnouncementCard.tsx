import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCheck, MoreHorizontal, Pin, PinOff, Trash2, ArrowRight } from 'lucide-react'
import { Avatar, Badge, Button, Card, Menu } from '@/components/ui'
import { toast, useCore, useUser } from '@/store/core'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { useGoals } from '@/features/goals/store'
import type { Announcement } from '@/features/goals/types'
import { CATEGORY_META } from '../meta'
import { excerpt } from './Markdown'
import { ReactionsBar } from './ReactionsBar'
import { ReadReceipts } from './ReadReceipts'
import { ConfirmDialog } from '@/features/goals/components/ConfirmDialog'

export function Cover({ a, className, big }: { a: Announcement; className?: string; big?: boolean }) {
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ background: a.cover ?? 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))' }}>
      <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.7), transparent 40%), radial-gradient(circle at 80% 90%, rgba(255,255,255,.4), transparent 45%)' }} />
      <div className="absolute inset-0 dot-bg opacity-30" />
      <div className="absolute -bottom-10 -right-6 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
      <span className={cn('absolute inset-y-0 flex items-center', big ? 'right-8' : 'right-5')}>
        <motion.span
          className={cn('select-none drop-shadow-[0_8px_24px_rgba(0,0,0,.35)]', big ? 'text-7xl' : 'text-5xl')}
          initial={{ rotate: -8, scale: 0.9 }}
          whileHover={{ rotate: 6, scale: 1.1 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        >
          {a.emoji ?? CATEGORY_META[a.category].emoji}
        </motion.span>
      </span>
    </div>
  )
}

export function AnnouncementCard({ a, onOpen, highlighted }: { a: Announcement; onOpen: () => void; highlighted?: boolean }) {
  const me = useCore((s) => s.currentUserId)
  const author = useUser(a.authorId)
  const markRead = useGoals((s) => s.markRead)
  const togglePin = useGoals((s) => s.togglePin)
  const del = useGoals((s) => s.deleteAnnouncement)
  const unread = !a.readBy.includes(me)
  const cat = CATEGORY_META[a.category]
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <motion.div layout id={`ann-${a.id}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35 }}>
      <Card spotlight hover padded={false} onClick={onOpen} className={cn('cursor-pointer', highlighted && 'ring-2 ring-accent/60 shadow-glow', a.pinned && 'border-accent/25')}>
        <div className="flex flex-col sm:flex-row">
          <Cover a={a} className="h-28 shrink-0 sm:h-auto sm:w-52" />
          <div className="relative min-w-0 flex-1 p-5">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {a.pinned && <Badge tone="warning" icon={<Pin className="h-3 w-3" />}>고정</Badge>}
              <Badge tone={cat.tone}>{cat.emoji} {a.category}</Badge>
              {unread && (
                <span className="flex items-center gap-1 rounded-md bg-accent-gradient px-1.5 py-0.5 text-[10px] font-bold text-white shadow-glow-sm">
                  NEW
                </span>
              )}
              <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
                <Menu
                  trigger={<button aria-label="공지 메뉴" className="rounded-lg p-1 text-subtle hover:bg-line/10 hover:text-fg"><MoreHorizontal className="h-4 w-4" /></button>}
                  items={[
                    { label: a.pinned ? '고정 해제' : '상단 고정', icon: a.pinned ? <PinOff /> : <Pin />, onClick: () => togglePin(a.id) },
                    { label: '읽음으로 표시', icon: <CheckCheck />, onClick: () => markRead(a.id), disabled: !unread },
                    ...(a.authorId === me
                      ? [{ divider: true, label: '' }, { label: '삭제', icon: <Trash2 />, danger: true, onClick: () => setConfirmDel(true) }]
                      : []),
                  ]}
                />
              </div>
            </div>
            <h3 className={cn('text-[17px] font-semibold leading-snug text-fg', unread && 'pr-2')}>{a.title}</h3>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{excerpt(a.body, 180)}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Avatar userId={a.authorId} size="xs" />
              <span className="font-medium text-fg/90">{author?.name}</span>
              <span className="text-subtle">{author?.title}</span>
              <span className="text-subtle">·</span>
              <span className="text-subtle" title={formatDate(a.createdAt, 'yyyy.MM.dd HH:mm')}>{timeAgo(a.createdAt)}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/[0.06] pt-3">
              <ReactionsBar id={a.id} reactions={a.reactions} />
              <div className="ml-auto flex items-center gap-2">
                <ReadReceipts readBy={a.readBy} />
                {unread ? (
                  <Button size="xs" variant="primary" leftIcon={<CheckCheck className="h-3.5 w-3.5" />} onClick={(e) => { e.stopPropagation(); markRead(a.id) }}>
                    읽음 확인
                  </Button>
                ) : (
                  <span className="hidden items-center gap-1 text-[11px] text-success sm:flex"><CheckCheck className="h-3.5 w-3.5" /> 확인함</span>
                )}
                <ArrowRight className="h-4 w-4 text-subtle" />
              </div>
            </div>
          </div>
        </div>
      </Card>
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="공지를 삭제할까요?"
        description={<>“{a.title}” 공지와 반응·읽음 기록이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.</>}
        onConfirm={() => {
          del(a.id)
          toast('공지가 삭제되었습니다', { description: a.title, emoji: '🗑️' })
        }}
      />
    </motion.div>
  )
}
