import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { getSessionUserId } from '@/lib/session'
import { uid } from '@/lib/utils'
import { SEED_USERS, BOT_USER, CURRENT_USER_ID } from './seed-users'
import type { AppNotification, Presence, Toast, User } from './types'
import { minutesAgo } from '@/lib/utils'
import { useSettings, isDndActive } from '@/features/settings/store'
import { isNarrowViewport } from '@/lib/useMediaQuery'

export type Theme = 'dark' | 'light'
export type Accent = 'aurora' | 'ocean' | 'emerald' | 'sunset' | 'rose'

interface CoreState {
  users: User[]
  currentUserId: string
  notifications: AppNotification[]
  theme: Theme
  accent: Accent
  sidebarCollapsed: boolean
  reduceMotion: boolean

  // user actions
  updateUser: (id: string, patch: Partial<User>) => void
  setPresence: (presence: Presence) => void
  setStatus: (emoji?: string, text?: string) => void

  // notifications
  pushNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void

  // preferences
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setAccent: (a: Accent) => void
  toggleSidebar: () => void
  setReduceMotion: (v: boolean) => void
}

const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', type: 'mention', title: '최지우님이 #engineering 에서 회원님을 멘션했습니다', body: '@김하늘 디자인 토큰 PR 리뷰 부탁드려요 🙏', link: '/messages/c_engineering', actorId: 'u_fe', createdAt: minutesAgo(6), read: false },
  { id: 'n2', type: 'approval', title: '새 결재 요청: 휴가 신청', body: '한소희 · 10월 14일 ~ 10월 16일 연차', link: '/approvals', actorId: 'u_design', createdAt: minutesAgo(42), read: false },
  { id: 'n3', type: 'task', title: '태스크가 할당되었습니다', body: 'NX-142 온보딩 플로우 개선안 작성', link: '/projects', actorId: 'u_pm', createdAt: minutesAgo(95), read: false },
  { id: 'n4', type: 'event', title: '30분 후 회의: 주간 제품 싱크', body: '회의실 Orion · Google Meet', link: '/calendar', createdAt: minutesAgo(130), read: true },
  { id: 'n5', type: 'workflow', title: '워크플로우 "신규 입사자 온보딩" 실행 완료', body: '5개 단계 모두 성공', link: '/workflows', createdAt: minutesAgo(300), read: true },
]

export const useCore = create<CoreState>()(
  persisted<CoreState>('core', (set, get) => ({
    users: SEED_USERS,
    currentUserId: CURRENT_USER_ID,
    // Sample inbox only for the default demo account; other members start with an empty bell
    notifications: (getSessionUserId() ?? CURRENT_USER_ID) === CURRENT_USER_ID ? SEED_NOTIFICATIONS : [],
    theme: 'dark',
    accent: 'aurora',
    sidebarCollapsed: false,
    reduceMotion: false,

    updateUser: (id, patch) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
    setPresence: (presence) => get().updateUser(get().currentUserId, { presence }),
    setStatus: (statusEmoji, statusText) => get().updateUser(get().currentUserId, { statusEmoji, statusText }),

    pushNotification: (n) =>
      set((s) => ({ notifications: [{ ...n, id: uid('ntf'), createdAt: new Date().toISOString(), read: false }, ...s.notifications].slice(0, 100) })),
    markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    clearNotifications: () => set({ notifications: [] }),

    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    setAccent: (accent) => set({ accent }),
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    setReduceMotion: (reduceMotion) => set({ reduceMotion }),
  })),
)
syncAcrossTabs(useCore)

/* ───────────── Convenience selectors / helpers ───────────── */

/** Placeholder while the member's own User hasn't arrived yet (e.g. right after joining) — never crash. */
const NO_USER: User = { id: '', name: '', nameEn: '', title: '', department: '' as User['department'], email: '', phone: '', location: '', timezone: 'Asia/Seoul', managerId: null, presence: 'online', skills: [], joinedAt: '', birthday: '' }
export const useCurrentUser = () => useCore((s) => s.users.find((u) => u.id === s.currentUserId)) ?? NO_USER

/** Returns a user by id (including the bot). Stable for use in render. */
export function useUser(id: string | undefined | null): User | undefined {
  return useCore((s) => (id === BOT_USER.id ? BOT_USER : s.users.find((u) => u.id === id)))
}

/** Non-hook lookup for use inside actions / event handlers. */
export function getUser(id: string | undefined | null): User | undefined {
  if (id === BOT_USER.id) return BOT_USER
  return useCore.getState().users.find((u) => u.id === id)
}

export function getCurrentUserId() {
  return useCore.getState().currentUserId
}

/* ───────────── Ephemeral UI state (not persisted) ───────────── */

interface UIState {
  commandOpen: boolean
  notificationsOpen: boolean
  aiOpen: boolean
  toasts: Toast[]
  setCommandOpen: (v: boolean) => void
  setNotificationsOpen: (v: boolean) => void
  setAiOpen: (v: boolean) => void
  /** Opens AI panel prefilled with a prompt (used by "Ask AI" buttons across features). */
  aiPrompt: string | null
  askAI: (prompt: string) => void
  consumeAiPrompt: () => string | null
  pushToast: (t: Omit<Toast, 'id'>) => string
  dismissToast: (id: string) => void
  /** Global audio/video call (huddle). Rendered by messenger/CallOverlay, startable from anywhere. */
  call: ActiveCall | null
  startCall: (c: Omit<ActiveCall, 'startedAt'>) => void
  endCall: () => void
  /** Keyboard shortcuts help modal */
  shortcutsOpen: boolean
  setShortcutsOpen: (v: boolean) => void
  /** Narrow viewports: sidebar temporarily expanded as an overlay over the content */
  sidebarPeek: boolean
  setSidebarPeek: (v: boolean) => void
}

export interface ActiveCall {
  title: string
  participantIds: string[]
  video: boolean
  channelId?: string
  startedAt: string
}

export const useUI = create<UIState>()((set, get) => ({
  commandOpen: false,
  notificationsOpen: false,
  aiOpen: false,
  toasts: [],
  aiPrompt: null,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  askAI: (prompt) => set({ aiOpen: true, aiPrompt: prompt }),
  consumeAiPrompt: () => {
    const p = get().aiPrompt
    set({ aiPrompt: null })
    return p
  },
  pushToast: (t) => {
    const id = uid('toast')
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-5) }))
    setTimeout(() => get().dismissToast(id), t.duration ?? 4200)
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  call: null,
  startCall: (c) => set({ call: { ...c, startedAt: new Date().toISOString() } }),
  endCall: () => set({ call: null }),
  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  sidebarPeek: false,
  setSidebarPeek: (sidebarPeek) => set({ sidebarPeek }),
}))

/** `[` / toggle button: on narrow viewports expand the rail as an overlay, otherwise collapse/expand in place. */
export function toggleSidebarResponsive() {
  if (isNarrowViewport()) {
    const ui = useUI.getState()
    ui.setSidebarPeek(!ui.sidebarPeek)
  } else {
    useCore.getState().toggleSidebar()
  }
}

/** Fire-and-forget toast from anywhere (hooks or not). */
export function toast(title: string, opts: Omit<Toast, 'id' | 'title'> = {}) {
  return useUI.getState().pushToast({ title, ...opts })
}

/** Add a notification to the bell inbox, optionally also showing a toast. */
export function notify(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>, showToast = true) {
  useCore.getState().pushNotification(n)
  const prefs = useSettings.getState()
  const me = useCore.getState().users.find((u) => u.id === useCore.getState().currentUserId)
  const muted = prefs.notif?.[n.type] === false || isDndActive(prefs.dnd) || me?.presence === 'dnd'
  if (!showToast || muted) return
  toast(n.title, { description: n.body, actorId: n.actorId, variant: 'info' })
  // Native desktop notification when the tab is in the background
  if (prefs.channels?.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try { new Notification(n.title, { body: n.body, icon: '/favicon.svg' }) } catch { /* ignore */ }
  }
}
