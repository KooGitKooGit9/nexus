/**
 * Cross-user notifications. `notifyUser(userId, …)` drops an item into the shared `inbox` collection;
 * the recipient's browser (now, or the next time they log in) moves it into their bell inbox,
 * shows a toast, and removes the item. Works offline too (then it's just a local notification).
 */
import { create } from 'zustand'
import { persisted, syncAcrossTabs } from './persist'
import { uid } from './utils'
import { getSessionUserId } from './session'
import type { AppNotification } from '@/store/types'

export interface InboxItem extends Omit<AppNotification, 'read'> {
  userId: string // recipient
}

interface InboxState {
  items: InboxItem[]
}

export const useInbox = create<InboxState>()(persisted<InboxState>('inbox', () => ({ items: [] })))
syncAcrossTabs(useInbox)

/** Send a notification to another member's bell (and a toast if they're online). */
export function notifyUser(userId: string, n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
  const item: InboxItem = { ...n, id: uid('inb'), userId, createdAt: new Date().toISOString() }
  useInbox.setState((s) => ({ items: [...s.items, item] }))
}

/** Deliver inbox items addressed to the current user. Wired once from the app shell. */
export function startInboxDelivery(deliver: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { createdAt?: string }) => void) {
  const run = () => {
    const me = getSessionUserId() ?? 'u_me'
    const mine = useInbox.getState().items.filter((i) => i.userId === me)
    if (!mine.length) return
    useInbox.setState((s) => ({ items: s.items.filter((i) => i.userId !== me) }))
    for (const { userId: _u, id: _id, ...n } of mine) deliver(n)
  }
  run()
  return useInbox.subscribe(run)
}
