import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import {
  Bookmark, BookmarkCheck, ChevronRight, Link2, MailOpen, MessageSquareText, MoreHorizontal, Pencil, Pin, PinOff, SmilePlus, Trash2, LogIn, Info,
} from 'lucide-react'
import { cn, formatTime, timeAgo } from '@/lib/utils'
import { toast, useCore, useUser } from '@/store/core'
import { Avatar, AvatarStack, Badge, Popover, Tooltip } from '@/components/ui'
import { useMessenger, mentionsUser } from '../store'
import { useChatUI, channelPath } from '../lib'
import { Markdown, InlinePreview, ProfileCard } from '../markdown'
import { EmojiPicker } from './EmojiPicker'
import { QUICK_REACTIONS } from '../emoji'
import { AttachmentList } from './Attachments'
import { BotCardView, EventCard, HuddleCard, PollCard, SystemLine, TaskCard } from './cards'
import type { BotCard, Message } from '../types'

interface Props {
  message: Message
  compact?: boolean
  replies?: Message[]
  inThread?: boolean
  /** root of thread when rendered inside the thread panel (no thread summary) */
  isRoot?: boolean
  highlight?: string
}

function fullDate(iso: string) {
  return format(new Date(iso), 'yyyy년 M월 d일 (EEE) a h:mm', { locale: ko })
}

export const MessageItem = memo(function MessageItem({ message: m, compact, replies = [], inThread, isRoot, highlight }: Props) {
  const me = useCore((s) => s.currentUserId)
  const author = useUser(m.userId)
  const editingId = useChatUI((s) => s.editingId)
  const highlighted = useChatUI((s) => s.highlightId === m.id)
  const bookmarked = useMessenger((s) => s.bookmarks.includes(m.id))
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState<null | 'emoji' | 'more'>(null)
  const navigate = useNavigate()
  const [fresh] = useState(() => Date.now() - new Date(m.createdAt).getTime() < 8000)

  const mine = m.userId === me
  const mentioned = !mine && mentionsUser(m.text, me)
  const editing = editingId === m.id
  const card = (m.meta as { card?: string } | undefined)?.card ? (m.meta as unknown as BotCard) : null

  if (m.kind === 'system') {
    return (
      <div id={`msg-${m.id}`} className="flex items-center gap-3 px-5 py-1.5">
        <div className="flex w-9 justify-center">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-line/[0.06] text-subtle">
            {m.meta?.event === 'join' ? <LogIn className="h-3 w-3" /> : <Info className="h-3 w-3" />}
          </span>
        </div>
        <SystemLine message={m} />
        <span className="text-[11px] text-subtle">{formatTime(m.createdAt)}</span>
      </div>
    )
  }

  const showToolbar = (hover || menu !== null) && !editing && !m.deleted
  const openThread = () => navigate(channelPath(m.channelId, { thread: m.threadId && !isRoot ? m.threadId : m.id }))

  return (
    <motion.div
      id={`msg-${m.id}`}
      initial={fresh ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'group/msg relative flex gap-3 px-5 transition-colors duration-300',
        compact ? 'py-[3px]' : 'pt-2 pb-1',
        'hover:bg-line/[0.025]',
        m.pinned && 'bg-warning/[0.035]',
        mentioned && 'bg-warning/[0.07] hover:bg-warning/[0.09] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-warning',
        highlighted && 'bg-accent/[0.12] hover:bg-accent/[0.12] ring-1 ring-inset ring-accent/40',
        (hover || menu) && 'bg-line/[0.035]',
      )}
    >
      {/* gutter */}
      <div className="w-9 shrink-0">
        {compact ? (
          <Tooltip content={fullDate(m.createdAt)}>
            <span className="mt-[3px] block w-9 text-right text-[10px] leading-5 text-subtle opacity-0 transition group-hover/msg:opacity-100">{format(new Date(m.createdAt), 'h:mm')}</span>
          </Tooltip>
        ) : (
          <Popover placement="right-start" className="w-72 p-0" trigger={({ toggle }) => (
            <button onClick={toggle} className="mt-0.5 rounded-xl transition hover:scale-105 active:scale-95">
              <Avatar userId={m.userId} size="md" className={cn(m.userId === 'u_bot' && '[&>div]:rounded-xl')} />
            </button>
          )}>
            {(close) => <ProfileCard userId={m.userId} onDone={close} />}
          </Popover>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {m.pinned && !compact && (
          <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-300"><Pin className="h-3 w-3" /> 고정됨</div>
        )}
        {!compact && (
          <div className="flex items-baseline gap-2">
            <Popover placement="bottom-start" className="w-72 p-0" trigger={({ toggle }) => (
              <button onClick={toggle} className="text-[14.5px] font-semibold text-fg hover:underline">{author?.name ?? '알 수 없음'}</button>
            )}>
              {(close) => <ProfileCard userId={m.userId} onDone={close} />}
            </Popover>
            {m.userId === 'u_bot' && <Badge className="self-center py-[1px] text-[10px]">앱</Badge>}
            {author?.statusEmoji && m.userId !== 'u_bot' && <span className="text-[12px]" title={author.statusText}>{author.statusEmoji}</span>}
            <Tooltip content={fullDate(m.createdAt)}>
              <span className="text-[11.5px] text-subtle hover:underline">{formatTime(m.createdAt)}</span>
            </Tooltip>
          </div>
        )}

        {m.alsoInChannel && !inThread && m.threadId && (
          <ThreadBroadcastLabel rootId={m.threadId} onOpen={openThread} />
        )}

        {editing ? (
          <InlineEditor message={m} />
        ) : m.deleted ? (
          <div className="text-[13.5px] italic text-subtle">삭제된 메시지입니다.</div>
        ) : (
          <>
            {m.kind === 'task' ? (
              <TaskCard message={m} />
            ) : m.kind === 'huddle' ? (
              <HuddleCard message={m} />
            ) : (
              <>
                {m.text && !(card?.card === 'gif') && (
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <Markdown text={m.text} highlight={highlight} className="min-w-0 max-w-full" />
                    {m.editedAt && (
                      <Tooltip content={`${fullDate(m.editedAt)}에 수정됨`}>
                        <span className="text-[11px] text-subtle">(수정됨)</span>
                      </Tooltip>
                    )}
                  </div>
                )}
                {m.kind === 'poll' && <PollCard message={m} />}
                {m.kind === 'event' && <EventCard message={m} />}
                {card && <BotCardView card={card} />}
              </>
            )}
            {m.attachments && m.attachments.length > 0 && <AttachmentList attachments={m.attachments} />}
          </>
        )}

        {Object.keys(m.reactions).length > 0 && !m.deleted && <Reactions message={m} />}

        {!inThread && replies.length > 0 && <ThreadSummary replies={replies} onOpen={openThread} />}
      </div>

      {/* hover toolbar */}
      {showToolbar && (
        <div className="absolute -top-4 right-5 z-20 flex items-center gap-0.5 rounded-xl border border-line/10 bg-surface/95 p-0.5 shadow-float backdrop-blur-xl">
          {QUICK_REACTIONS.map((e) => (
            <ToolbarBtn key={e} label={`${e} 반응`} onClick={() => useMessenger.getState().toggleReaction(m.id, e)}>
              <span className="text-[16px] leading-none">{e}</span>
            </ToolbarBtn>
          ))}
          <Popover
            placement="left-start"
            className="p-1"
            open={menu === 'emoji'}
            onOpenChange={(v) => setMenu(v ? 'emoji' : null)}
            trigger={({ toggle }) => (
              <ToolbarBtn label="반응 추가" onClick={toggle} active={menu === 'emoji'}>
                <SmilePlus className="h-4 w-4" />
              </ToolbarBtn>
            )}
          >
            <EmojiPicker
              onPick={(e) => {
                useMessenger.getState().toggleReaction(m.id, e)
                setMenu(null)
              }}
            />
          </Popover>
          <span className="mx-0.5 h-5 w-px bg-line/10" />
          {(!inThread || isRoot) && (
            <ToolbarBtn label="스레드에 답글" onClick={openThread}>
              <MessageSquareText className="h-4 w-4" />
            </ToolbarBtn>
          )}
          <ToolbarBtn
            label={bookmarked ? '저장 취소' : '나중을 위해 저장'}
            active={bookmarked}
            onClick={() => {
              useMessenger.getState().toggleBookmark(m.id)
              toast(bookmarked ? '저장된 항목에서 제거했어요' : '저장된 항목에 추가했어요', { emoji: '🔖' })
            }}
          >
            {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </ToolbarBtn>
          <Popover
            placement="bottom-end"
            open={menu === 'more'}
            onOpenChange={(v) => setMenu(v ? 'more' : null)}
            trigger={({ toggle }) => (
              <ToolbarBtn label="더 보기" onClick={toggle} active={menu === 'more'}>
                <MoreHorizontal className="h-4 w-4" />
              </ToolbarBtn>
            )}
          >
            {(close) => (
              <MoreMenu
                message={m}
                mine={mine}
                close={() => {
                  close()
                  setMenu(null)
                  setHover(false)
                }}
              />
            )}
          </Popover>
        </div>
      )}
    </motion.div>
  )
})

function ToolbarBtn({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <Tooltip content={label}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-line/[0.08] hover:text-fg active:scale-90', active && 'bg-accent/15 text-accent')}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function MoreMenu({ message: m, mine, close }: { message: Message; mine: boolean; close: () => void }) {
  const s = useMessenger.getState()
  const item = (icon: ReactNode, label: string, fn: () => void, danger?: boolean, shortcut?: string) => (
    <button
      onClick={() => {
        fn()
        close()
      }}
      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition', danger ? 'text-danger hover:bg-danger/10' : 'text-fg/90 hover:bg-line/[0.07]')}
    >
      <span className="opacity-80 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="font-mono text-[11px] text-subtle">{shortcut}</span>}
    </button>
  )
  return (
    <div className="flex w-52 flex-col">
      {item(m.pinned ? <PinOff /> : <Pin />, m.pinned ? '고정 해제' : '채널에 고정', () => {
        s.togglePin(m.id)
        toast(m.pinned ? '고정을 해제했어요' : '메시지를 고정했어요', { emoji: '📌' })
      })}
      {item(<Link2 />, '링크 복사', () => {
        navigator.clipboard?.writeText(`${location.origin}${channelPath(m.channelId, { thread: m.threadId && !m.alsoInChannel ? m.threadId : undefined, message: m.id })}`).catch(() => {})
        toast('메시지 링크를 복사했어요', { emoji: '🔗' })
      })}
      {!mine && item(<MailOpen />, '여기서부터 읽지 않음으로 표시', () => s.markUnreadFrom(m.id))}
      {mine && m.kind !== 'poll' && m.kind !== 'task' && (
        <>
          <div className="my-1 h-px bg-line/10" />
          {item(<Pencil />, '메시지 편집', () => useChatUI.getState().setEditing(m.id), false, '↑')}
          {item(<Trash2 />, '메시지 삭제', () => {
            s.deleteMessage(m.id)
            toast('메시지를 삭제했어요', { emoji: '🗑️' })
          }, true)}
        </>
      )}
      {mine && (m.kind === 'poll' || m.kind === 'task') && (
        <>
          <div className="my-1 h-px bg-line/10" />
          {item(<Trash2 />, '삭제', () => s.deleteMessage(m.id), true)}
        </>
      )}
    </div>
  )
}

function Reactions({ message: m }: { message: Message }) {
  const me = useCore((s) => s.currentUserId)
  const users = useCore((s) => s.users)
  const toggle = useMessenger((s) => s.toggleReaction)
  const [pickerOpen, setPickerOpen] = useState(false)
  const nameOf = (id: string) => (id === me ? '나' : users.find((u) => u.id === id)?.name ?? (id === 'u_bot' ? 'Nexus Bot' : ''))
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {Object.entries(m.reactions).map(([emoji, ids]) => {
        const active = ids.includes(me)
        const names = ids.map(nameOf)
        const who = names.length > 4 ? `${names.slice(0, 4).join(', ')} 외 ${names.length - 4}명` : names.join(', ')
        return (
          <Tooltip key={emoji} content={<span className="flex items-center gap-1.5"><span className="text-base">{emoji}</span>{who}님이 반응했습니다</span>}>
            <motion.button
              layout
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.88 }}
              onClick={() => toggle(m.id, emoji)}
              className={cn(
                'flex h-7 items-center gap-1 rounded-full border px-2 text-[12.5px] transition-colors',
                active ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm' : 'border-line/10 bg-line/[0.04] text-muted hover:border-line/25 hover:bg-line/[0.07]',
              )}
            >
              <span className="text-[15px] leading-none">{emoji}</span>
              <motion.span key={ids.length} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-semibold tabular-nums">
                {ids.length}
              </motion.span>
            </motion.button>
          </Tooltip>
        )
      })}
      <Popover
        placement="top-start"
        className="p-1"
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        trigger={({ toggle: t }) => (
          <button onClick={t} className="flex h-7 w-8 items-center justify-center rounded-full border border-line/10 bg-line/[0.03] text-subtle opacity-0 transition hover:border-accent/40 hover:text-accent group-hover/msg:opacity-100 data-[open=true]:opacity-100" data-open={pickerOpen}>
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        )}
      >
        <EmojiPicker
          onPick={(e) => {
            toggle(m.id, e)
            setPickerOpen(false)
          }}
        />
      </Popover>
    </div>
  )
}

function ThreadSummary({ replies, onOpen }: { replies: Message[]; onOpen: () => void }) {
  const authors = Array.from(new Set(replies.map((r) => r.userId))).slice(0, 4)
  const last = replies[replies.length - 1]
  return (
    <button
      onClick={onOpen}
      className="group/thr -ml-1.5 mt-1.5 flex w-full max-w-[520px] items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 text-left transition hover:border-line/10 hover:bg-surface/60 hover:shadow-card"
    >
      <AvatarStack userIds={authors} size="xs" max={4} />
      <span className="text-[12.5px] font-semibold text-accent">{replies.length}개의 답글</span>
      <span className="text-[12px] text-subtle group-hover/thr:hidden">마지막 답글 {timeAgo(last.createdAt)}</span>
      <span className="hidden flex-1 items-center justify-between text-[12px] text-muted group-hover/thr:flex">
        스레드 보기 <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  )
}

function ThreadBroadcastLabel({ rootId, onOpen }: { rootId: string; onOpen: () => void }) {
  const root = useMessenger((s) => s.messages.find((x) => x.id === rootId))
  if (!root) return null
  return (
    <button onClick={onOpen} className="mb-0.5 flex max-w-full items-center gap-1 truncate text-[12px] text-subtle hover:text-accent">
      <MessageSquareText className="h-3 w-3 shrink-0" />
      스레드에 답글:
      <span className="truncate text-muted"><InlinePreview text={root.text || '메시지'} /></span>
    </button>
  )
}

function InlineEditor({ message }: { message: Message }) {
  const [text, setText] = useState(message.text)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(240, el.scrollHeight) + 'px'
  }, [text])
  const cancel = () => useChatUI.getState().setEditing(null)
  const save = () => {
    if (text.trim() && text !== message.text) useMessenger.getState().editMessage(message.id, text.trim())
    cancel()
  }
  return (
    <div className="mt-1 rounded-xl border border-accent/40 bg-surface-2/70 p-2 shadow-glow-sm">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') cancel()
        }}
        rows={1}
        className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-subtle">
        <span>Esc로 취소 · Enter로 저장</span>
        <div className="flex gap-1.5">
          <button onClick={cancel} className="rounded-lg px-2.5 py-1 text-[12px] text-muted hover:bg-line/10">취소</button>
          <button onClick={save} className="rounded-lg bg-accent-gradient px-2.5 py-1 text-[12px] font-semibold text-white shadow-glow-sm">저장</button>
        </div>
      </div>
    </div>
  )
}
