import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { isToday } from 'date-fns'
import { Bell, CheckCheck, Trash2, Settings2, X, BellOff } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { useCore, useUI } from '@/store/core'
import { Avatar, Tabs, Tooltip } from '@/components/ui'
import type { AppNotification } from '@/store/types'
import { NOTIF_STYLE } from './notifStyle'
import { useSettings, isDndActive } from '@/features/settings/store'


type TabKey = 'all' | 'mention' | 'assign' | 'approval'
const TAB_FILTER: Record<TabKey, (n: AppNotification) => boolean> = {
  all: () => true,
  mention: (n) => n.type === 'mention' || n.type === 'message',
  assign: (n) => n.type === 'task',
  approval: (n) => n.type === 'approval',
}

export function NotificationPanel() {
  const open = useUI((s) => s.notificationsOpen)
  const setOpen = useUI((s) => s.setNotificationsOpen)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            className="absolute bottom-3 right-3 top-3 flex w-[440px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl glass-strong shadow-float"
            initial={{ x: '110%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '110%', opacity: 0.6 }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
          >
            <PanelBody onClose={() => setOpen(false)} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function PanelBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const all = useCore((s) => s.notifications)
  const markRead = useCore((s) => s.markNotificationRead)
  const markAll = useCore((s) => s.markAllNotificationsRead)
  const clear = useCore((s) => s.clearNotifications)
  const muted = useSettings((s) => s.notif)
  const dnd = useSettings((s) => s.dnd)
  const presenceDnd = useCore((s) => s.users.find((u) => u.id === s.currentUserId)?.presence === 'dnd')
  const [tab, setTab] = useState<TabKey>('all')

  const visible = useMemo(() => all.filter((n) => muted?.[n.type] !== false), [all, muted])
  const list = useMemo(() => visible.filter(TAB_FILTER[tab]), [visible, tab])
  const today = list.filter((n) => isToday(new Date(n.createdAt)))
  const earlier = list.filter((n) => !isToday(new Date(n.createdAt)))
  const unread = visible.filter((n) => !n.read).length
  const count = (k: TabKey) => visible.filter((n) => !n.read && TAB_FILTER[k](n)).length
  const quiet = presenceDnd || isDndActive(dnd)

  const open = (n: AppNotification) => {
    markRead(n.id)
    onClose()
    if (n.link) navigate(n.link)
  }

  return (
    <>
      {/* header */}
      <div className="relative overflow-hidden border-b border-line/[0.08] px-5 pb-3 pt-4">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm">
            <Bell className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-semibold">
              알림
              {unread > 0 && <span className="rounded-full bg-accent-3/15 px-2 py-0.5 text-[11px] font-semibold text-accent-3">{unread}개 안 읽음</span>}
            </div>
            <div className="text-[11.5px] text-muted">{quiet ? '🔕 방해 금지 중 — 알림이 조용히 쌓이고 있어요' : '팀의 소식을 놓치지 마세요'}</div>
          </div>
          <Tooltip content="알림 설정" side="bottom">
            <button onClick={() => { onClose(); navigate('/settings/notifications') }} className="rounded-lg p-2 text-muted transition hover:bg-line/10 hover:text-fg">
              <Settings2 className="h-4 w-4" />
            </button>
          </Tooltip>
          <button onClick={onClose} className="rounded-lg p-2 text-muted transition hover:bg-line/10 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mt-3.5 flex items-center justify-between gap-2">
          <Tabs<TabKey>
            size="sm"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'all', label: '전체', count: count('all') || undefined },
              { value: 'mention', label: '멘션', count: count('mention') || undefined },
              { value: 'assign', label: '할당', count: count('assign') || undefined },
              { value: 'approval', label: '결재', count: count('approval') || undefined },
            ]}
          />
          <div className="flex items-center gap-0.5">
            <Tooltip content="모두 읽음" side="bottom">
              <button disabled={!unread} onClick={markAll} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-muted transition hover:bg-line/10 hover:text-fg disabled:opacity-40">
                <CheckCheck className="h-3.5 w-3.5" />모두 읽음
              </button>
            </Tooltip>
            <Tooltip content="모두 지우기" side="bottom">
              <button disabled={!all.length} onClick={clear} className="rounded-lg p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-40">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {list.length === 0 ? (
          <EmptyInbox tab={tab} />
        ) : (
          <>
            {today.length > 0 && <Group label="오늘" items={today} onOpen={open} />}
            {earlier.length > 0 && <Group label="이전" items={earlier} onOpen={open} offset={today.length} />}
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-line/[0.08] px-5 py-3 text-[11.5px] text-subtle">
        <span>최근 100개 알림이 보관됩니다</span>
        <button onClick={() => { onClose(); navigate('/settings/notifications') }} className="font-medium text-accent hover:underline">
          알림 설정 →
        </button>
      </div>
    </>
  )
}

function Group({ label, items, onOpen, offset = 0 }: { label: string; items: AppNotification[]; onOpen: (n: AppNotification) => void; offset?: number }) {
  return (
    <div className="mb-2">
      <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold tracking-wide text-subtle">{label}</div>
      <div className="space-y-1">
        <AnimatePresence initial={true}>
          {items.map((n, i) => (
            <Item key={n.id} n={n} onOpen={() => onOpen(n)} delay={(offset + i) * 0.03} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Item({ n, onOpen, delay }: { n: AppNotification; onOpen: () => void; delay: number }) {
  const style = NOTIF_STYLE[n.type] ?? NOTIF_STYLE.system
  const Icon = style.icon
  const markRead = useCore((s) => s.markNotificationRead)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0, transition: { delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, x: 30, height: 0 }}
      onClick={onOpen}
      className={cn(
        'group relative flex cursor-pointer gap-3 overflow-hidden rounded-2xl border px-3 py-3 transition-all',
        n.read ? 'border-transparent hover:border-line/10 hover:bg-line/[0.04]' : 'border-accent/15 bg-accent/[0.06] hover:border-accent/30 hover:bg-accent/[0.09]',
      )}
    >
      {!n.read && (
        <>
          <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-accent-gradient" />
          <span className="pointer-events-none absolute -left-8 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-accent/20 blur-2xl" />
        </>
      )}
      <div className="relative shrink-0">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-card', style.tile)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        {n.actorId && <Avatar userId={n.actorId} size="xs" ring className="absolute -bottom-1 -right-1" />}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className={cn('flex-1 text-[13px] leading-snug', n.read ? 'text-fg/80' : 'font-semibold text-fg')}>{n.title}</div>
          {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-3 shadow-[0_0_10px_rgb(var(--accent-3))]" />}
        </div>
        {n.body && <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">{n.body}</div>}
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-subtle">
          <span className="rounded-md bg-line/[0.06] px-1.5 py-0.5">{style.label}</span>
          <span>{timeAgo(n.createdAt)}</span>
          {!n.read && (
            <button
              onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
              className="ml-auto hidden rounded-md px-1.5 py-0.5 font-medium text-accent hover:bg-accent/10 group-hover:block"
            >
              읽음 표시
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function EmptyInbox({ tab }: { tab: TabKey }) {
  return (
    <div className="flex flex-col items-center px-8 pb-10 pt-16 text-center">
      <div className="relative mb-6 h-28 w-28">
        <div className="absolute inset-2 rounded-full bg-accent-gradient opacity-30 blur-2xl" />
        <motion.div
          className="absolute inset-0 flex items-center justify-center rounded-[32px] glass"
          animate={{ rotate: [0, -6, 6, -3, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}
        >
          {tab === 'all' ? <BellOff className="h-10 w-10 text-accent" /> : <CheckCheck className="h-10 w-10 text-accent" />}
        </motion.div>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute text-sm"
            style={{ left: `${[8, 88, 70][i]}%`, top: `${[12, 22, 88][i]}%` }}
            animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
          >
            {['✨', '🌙', '⭐'][i]}
          </motion.span>
        ))}
      </div>
      <div className="font-semibold">{tab === 'all' ? '알림함이 비어 있어요' : '모두 확인했어요!'}</div>
      <p className="mt-1.5 max-w-[260px] text-[13px] text-muted">
        {tab === 'all' ? '새로운 멘션, 할당, 결재 요청이 생기면 이곳에 표시됩니다.' : '이 카테고리에 새로운 알림이 없습니다. 잠시 숨을 돌려보세요 ☕'}
      </p>
    </div>
  )
}
