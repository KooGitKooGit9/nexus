/*
 * Ephemeral realtime bits for the messenger: "…님이 입력 중" across browsers.
 *
 *   emit:    emitSyncEvent('typing', { channelId, threadId?, userId?, stop? })
 *            (userId is set when a simulated teammate types in this browser; otherwise the server's `from`)
 *   receive: onSyncEvent('typing', …) → useChatUI.setTyping(key, user, on) with an auto-expiry
 */
import { emitSyncEvent, onSyncEvent } from '@/lib/sync'
import { getCurrentUserId } from '@/store/core'
import { useChatUI } from './lib'
import { useMessenger } from './store'

const TYPING_TTL = 4500
const THROTTLE = 2200

const keyOf = (channelId: string, threadId?: string) => (threadId ? `thread:${threadId}` : channelId)

/* ───────────── outgoing ───────────── */

let lastEmit: { key: string; at: number } | null = null

/** Call on every keystroke in a composer — throttled to one event per ~2s per conversation. */
export function emitTyping(channelId: string, threadId?: string) {
  const key = keyOf(channelId, threadId)
  const now = Date.now()
  if (lastEmit && lastEmit.key === key && now - lastEmit.at < THROTTLE) return
  lastEmit = { key, at: now }
  emitSyncEvent('typing', { channelId, threadId: threadId ?? null })
}

/** The user sent / cleared the composer: hide the indicator for others right away. */
export function emitTypingStop(channelId: string, threadId?: string) {
  if (lastEmit?.key === keyOf(channelId, threadId)) lastEmit = null
  emitSyncEvent('typing', { channelId, threadId: threadId ?? null, stop: true })
}

/** A simulated teammate is typing in this browser — show it to everyone else as well. */
export function emitSimTyping(userId: string, channelId: string, threadId: string | undefined, on: boolean) {
  emitSyncEvent('typing', { channelId, threadId: threadId ?? null, userId, stop: !on })
}

/* ───────────── incoming ───────────── */

const expiry = new Map<string, ReturnType<typeof setTimeout>>()

function show(key: string, userId: string, on: boolean) {
  const id = `${key}|${userId}`
  clearTimeout(expiry.get(id))
  expiry.delete(id)
  useChatUI.getState().setTyping(key, userId, on)
  if (on) expiry.set(id, setTimeout(() => {
    expiry.delete(id)
    useChatUI.getState().setTyping(key, userId, false)
  }, TYPING_TTL))
}

/** A message from `userId` landed in this conversation → their indicator is done. */
export function clearRemoteTyping(channelId: string, threadId: string | undefined, userId: string) {
  const key = keyOf(channelId, threadId)
  if (expiry.has(`${key}|${userId}`)) show(key, userId, false)
}

let started = false
export function startRealtime() {
  if (started) return
  started = true
  onSyncEvent('typing', (msg) => {
    const channelId = typeof msg.channelId === 'string' ? msg.channelId : null
    if (!channelId) return
    const threadId = typeof msg.threadId === 'string' ? msg.threadId : undefined
    const userId = typeof msg.userId === 'string' ? msg.userId : typeof msg.from === 'string' ? msg.from : null
    if (!userId || userId === getCurrentUserId()) return
    show(keyOf(channelId, threadId), userId, !msg.stop)
  })
  // a message from someone who was "typing" ends their indicator immediately
  useMessenger.subscribe((s, prev) => {
    if (s.messages === prev.messages || s.messages.length <= prev.messages.length) return
    for (let i = prev.messages.length; i < s.messages.length; i++) {
      const m = s.messages[i]
      if (m) clearRemoteTyping(m.channelId, m.threadId, m.userId)
    }
  })
}
