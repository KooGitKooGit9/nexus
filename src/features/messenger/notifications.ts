/*
 * Who gets a bell notification for a message — computed once, by the client that created the message
 * (the real author's browser, or the browser that ran a simulated teammate's reply).
 *
 * - the current user is notified locally (`notify`) unless they're already looking at the conversation
 * - everyone else gets `notifyUser` (delivered now if online, else at their next login)
 * - the author never notifies themselves
 */
import { getCurrentUserId, getUser, notify, useCore } from '@/store/core'
import { notifyUser } from '@/lib/inbox'
import { isUserOnline } from '@/lib/sync'
import { useMessenger } from './store'
import { channelLabel, channelPath, channelTitle, getChannel, isDirect } from './lib'
import type { Channel, Message } from './types'

const BOT = 'u_bot'

/** Is the current user looking at this conversation right now? (exact path segment, tab visible) */
export function isViewingChannel(channelId: string) {
  if (typeof window === 'undefined' || document.visibilityState !== 'visible') return false
  const segs = window.location.pathname.split('/')
  return segs[1] === 'messages' && segs[2] === channelId
}

function preview(m: Message) {
  const t = (m.text || '').replace(/```/g, '').replace(/[*_~`>]/g, '').replace(/\s+/g, ' ').trim()
  if (t) return t.length > 140 ? `${t.slice(0, 140)}…` : t
  if (m.kind === 'poll') return '📊 투표'
  if (m.attachments?.length) return m.attachments.some((a) => a.mime.startsWith('image/')) ? '🖼️ 이미지' : `📎 ${m.attachments[0].name}`
  return ''
}

type Reason = 'dm' | 'mention' | 'thread'

function titleFor(reason: Reason, ch: Channel, author: string, me: string) {
  if (reason === 'dm') return ch.kind === 'group' ? `${author}님이 ${channelTitle(ch, me)}에 메시지를 보냈습니다` : `${author}님의 새 메시지`
  if (reason === 'mention') return `${author}님이 ${channelLabel(ch)}에서 회원님을 멘션했습니다`
  return `${author}님이 ${channelLabel(ch)} 스레드에 답글을 남겼습니다`
}

/**
 * Notify everyone a freshly created message concerns (DM members, @mentioned people, thread participants).
 * `simulated` → the author is a simulated teammate: only notify the current user and people who are online,
 * so offline members don't pile up inbox items for background chatter.
 */
export function notifyRecipients(m: Message, opts: { simulated?: boolean } = {}) {
  const ch = getChannel(m.channelId)
  if (!ch || ch.isApp || m.kind === 'system' || m.deleted) return
  const me = getCurrentUserId()
  const authorName = getUser(m.userId)?.name ?? '동료'
  const reasons = new Map<string, Reason>()
  const add = (id: string, r: Reason) => {
    if (!id || id === m.userId || id === BOT || reasons.has(id) || !getUser(id)) return
    reasons.set(id, r)
  }

  if (isDirect(ch)) {
    for (const id of ch.memberIds) add(id, 'dm')
  } else {
    const text = m.text || ''
    const users = ch.memberIds.map((id) => getUser(id)).filter((u): u is NonNullable<typeof u> => !!u)
    // explicit @이름 mentions (anyone in the workspace)
    for (const id of mentionedIds(text)) add(id, 'mention')
    if (/@(channel|everyone)\b/.test(text)) for (const u of users) add(u.id, 'mention')
    else if (/@here\b/.test(text)) for (const u of users) if (u.id === me || isUserOnline(u.id)) add(u.id, 'mention')
  }

  // thread replies → root author + everyone who replied before
  if (m.threadId) {
    const all = useMessenger.getState().messages
    const root = all.find((x) => x.id === m.threadId)
    if (root) add(root.userId, 'thread')
    for (const x of all) if (x.threadId === m.threadId && x.id !== m.id) add(x.userId, 'thread')
  }

  const link = channelPath(m.channelId, { message: m.id })
  const body = preview(m)
  for (const [id, reason] of reasons) {
    const n = { type: reason === 'mention' ? ('mention' as const) : ('message' as const), title: titleFor(reason, ch, authorName, id), body, link, actorId: m.userId }
    if (id === me) {
      if (!isViewingChannel(ch.id)) notify(n)
    } else if (!opts.simulated || isUserOnline(id)) {
      notifyUser(id, n)
    }
  }
}

/** userIds mentioned as `@이름` in a message (longest names first so "@김하늘" doesn't also match "@김하"). */
export function mentionedIds(text: string): string[] {
  if (!text.includes('@')) return []
  const out: string[] = []
  const users = [...useCore.getState().users].sort((a, b) => b.name.length - a.name.length)
  for (const u of users) if (u.id !== BOT && text.includes(`@${u.name}`)) out.push(u.id)
  return out
}
