import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId, getUser } from '@/store/core'
import { notifyUser } from '@/lib/inbox'
import type { Attachment, Channel, ChannelKind, Message, PollMeta } from './types'
import { SEED_BOOKMARKS, SEED_CHANNELS, SEED_MESSAGES, SEED_STARRED, seedLastRead } from './seed'

export interface SendInput {
  channelId: string
  text: string
  userId?: string
  threadId?: string
  attachments?: Attachment[]
  kind?: Message['kind']
  meta?: Record<string, unknown>
  alsoInChannel?: boolean
  createdAt?: string
}

export interface UnreadInfo {
  count: number
  mentions: number
}

interface MessengerState {
  channels: Channel[]
  messages: Message[]
  /** current user's starred channel ids */
  starred: string[]
  /** current user's saved message ids */
  bookmarks: string[]
  /** current user's read cursor per channel (ISO) */
  lastRead: Record<string, string>
  /** composer drafts keyed by channelId or `thread:<rootId>` */
  drafts: Record<string, string>
  /** collapsed sidebar sections */
  collapsed: Record<string, boolean>
  recentEmoji: string[]
  /** messages queued for later sending */
  scheduled: Message[]
  lastChannelId: string

  sendMessage: (input: SendInput) => Message
  editMessage: (id: string, text: string) => void
  deleteMessage: (id: string) => void
  toggleReaction: (id: string, emoji: string, userId?: string) => void
  togglePin: (id: string) => void
  toggleBookmark: (id: string) => void
  updateMeta: (id: string, patch: Record<string, unknown>) => void
  votePoll: (id: string, optionId: string, userId?: string) => void

  createChannel: (input: { name: string; kind: ChannelKind; memberIds: string[]; description?: string; topic?: string; emoji?: string }) => Channel
  openDM: (userIds: string[]) => Channel
  updateChannel: (id: string, patch: Partial<Channel>) => void
  setTopic: (id: string, topic: string) => void
  joinChannel: (id: string, userId?: string) => void
  leaveChannel: (id: string, userId?: string) => void
  addMembers: (id: string, userIds: string[]) => void
  toggleStar: (id: string) => void

  markRead: (channelId: string, at?: string) => void
  markUnreadFrom: (messageId: string) => void
  setDraft: (key: string, text: string) => void
  toggleCollapsed: (section: string) => void
  pushRecentEmoji: (emoji: string) => void
  setLastChannel: (id: string) => void

  scheduleMessage: (input: SendInput, at: string) => void
  cancelScheduled: (id: string) => void
  sendScheduledNow: (id: string) => Message | undefined
  /** posts all due scheduled messages; returns the sent messages */
  releaseDue: () => Message[]

  unreadFor: (channelId: string, userId?: string) => UnreadInfo
  /** Sum of unread messages across all channels the user belongs to (used by the global sidebar badge). */
  unreadTotal: (userId: string) => number
}

type Data = Pick<MessengerState, 'channels' | 'messages' | 'starred' | 'bookmarks' | 'lastRead' | 'drafts' | 'collapsed' | 'recentEmoji' | 'scheduled' | 'lastChannelId'>

function seedData(): Data {
  return {
    channels: SEED_CHANNELS,
    messages: SEED_MESSAGES,
    starred: SEED_STARRED,
    bookmarks: SEED_BOOKMARKS,
    lastRead: seedLastRead(),
    drafts: {},
    collapsed: {},
    recentEmoji: ['👍', '🙌', '🔥', '😂', '🎉', '👀', '🙏', '❤️'],
    scheduled: [],
    lastChannelId: 'c_general',
  }
}

/** Whether a message counts toward a channel timeline (root messages + broadcast thread replies). */
export function isTimelineMessage(m: Message) {
  return (!m.threadId || m.alsoInChannel) && !m.deleted
}

/** Bell notification for people added to a channel by the current user (never to yourself). */
function notifyAdded(ch: Channel, userIds: string[], messageId: string) {
  if (ch.kind === 'dm' || ch.isApp) return
  const me = getCurrentUserId()
  const actor = getUser(me)?.name ?? '동료'
  const label = ch.kind === 'group' ? (ch.name || '그룹 대화') : `#${ch.name}`
  for (const uid of userIds) {
    if (uid === me || uid === 'u_bot') continue
    notifyUser(uid, { type: 'message', title: `${actor}님이 회원님을 ${label}에 추가했습니다`, body: ch.description ?? ch.topic, link: `/messages/${ch.id}?m=${messageId}`, actorId: me })
  }
}

export function mentionsUser(text: string, userId: string) {
  const u = getUser(userId)
  if (!u) return false
  return text.includes(`@${u.name}`) || /@(here|channel|everyone)\b/.test(text)
}

export const useMessenger = create<MessengerState>()(
  persisted<MessengerState>(
    'messenger',
    (set, get) => ({
      ...seedData(),

      sendMessage: (input) => {
        const me = input.userId ?? getCurrentUserId()
        const msg: Message = {
          id: uid('msg'),
          channelId: input.channelId,
          userId: me,
          text: input.text,
          createdAt: input.createdAt ?? new Date().toISOString(),
          reactions: {},
          threadId: input.threadId,
          attachments: input.attachments?.length ? input.attachments : undefined,
          kind: input.kind,
          meta: input.meta,
          alsoInChannel: input.alsoInChannel || undefined,
        }
        set((s) => {
          const lastRead = me === getCurrentUserId() ? { ...s.lastRead, [input.channelId]: msg.createdAt } : s.lastRead
          return { messages: [...s.messages, msg], lastRead }
        })
        return msg
      },
      editMessage: (id, text) => {
        // only your own messages can be edited (other people's copies sync in from their clients)
        const me = getCurrentUserId()
        set((s) => ({ messages: s.messages.map((m) => (m.id === id && m.userId === me ? { ...m, text, editedAt: new Date().toISOString() } : m)) }))
      },
      deleteMessage: (id) =>
        set((s) => {
          const target = s.messages.find((m) => m.id === id)
          if (!target || target.userId !== getCurrentUserId()) return s
          const hasReplies = s.messages.some((m) => m.threadId === id)
          return {
            messages: hasReplies
              ? s.messages.map((m) => (m.id === id ? { ...m, deleted: true, text: '', attachments: undefined, reactions: {} } : m))
              : s.messages.filter((m) => m.id !== id),
            bookmarks: s.bookmarks.filter((b) => b !== id),
          }
        }),
      toggleReaction: (id, emoji, userId) => {
        const uidv = userId ?? getCurrentUserId()
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== id) return m
            const cur = m.reactions[emoji] ?? []
            const next = cur.includes(uidv) ? cur.filter((x) => x !== uidv) : [...cur, uidv]
            const reactions = { ...m.reactions }
            if (next.length) reactions[emoji] = next
            else delete reactions[emoji]
            return { ...m, reactions }
          }),
        }))
        if (!userId) get().pushRecentEmoji(emoji)
      },
      togglePin: (id) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m)) })),
      toggleBookmark: (id) =>
        set((s) => ({ bookmarks: s.bookmarks.includes(id) ? s.bookmarks.filter((b) => b !== id) : [id, ...s.bookmarks] })),
      updateMeta: (id, patch) =>
        set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, meta: { ...(m.meta ?? {}), ...patch } } : m)) })),
      votePoll: (id, optionId, userId) => {
        const voter = userId ?? getCurrentUserId()
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== id || m.kind !== 'poll') return m
            const meta = m.meta as unknown as PollMeta
            if (meta.closed) return m
            const options = meta.options.map((o) => {
              const has = o.voterIds.includes(voter)
              if (o.id === optionId) return { ...o, voterIds: has ? o.voterIds.filter((v) => v !== voter) : [...o.voterIds, voter] }
              if (!meta.multi && has) return { ...o, voterIds: o.voterIds.filter((v) => v !== voter) }
              return o
            })
            return { ...m, meta: { ...meta, options } as unknown as Record<string, unknown> }
          }),
        }))
      },

      createChannel: ({ name, kind, memberIds, description, topic, emoji }) => {
        const me = getCurrentUserId()
        const ch: Channel = {
          id: uid('c'),
          name,
          kind,
          memberIds: Array.from(new Set([me, ...memberIds])),
          description,
          topic,
          emoji,
          createdBy: me,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ channels: [...s.channels, ch], lastRead: { ...s.lastRead, [ch.id]: ch.createdAt } }))
        const sys = get().sendMessage({ channelId: ch.id, text: `#${name} 채널을 만들었습니다.`, kind: 'system', meta: { event: 'created' } })
        notifyAdded(ch, ch.memberIds, sys.id)
        return ch
      },
      openDM: (userIds) => {
        const me = getCurrentUserId()
        const members = Array.from(new Set([me, ...userIds]))
        const key = [...members].sort().join(',')
        const existing = get().channels.find((c) => (c.kind === 'dm' || c.kind === 'group') && !c.isApp && [...c.memberIds].sort().join(',') === key)
        if (existing) return existing
        const ch: Channel = {
          id: uid(members.length > 2 ? 'g' : 'd'),
          name: '',
          kind: members.length > 2 ? 'group' : 'dm',
          memberIds: members,
          createdBy: me,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ channels: [...s.channels, ch], lastRead: { ...s.lastRead, [ch.id]: ch.createdAt } }))
        return ch
      },
      updateChannel: (id, patch) => set((s) => ({ channels: s.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      setTopic: (id, topic) => {
        get().updateChannel(id, { topic })
        get().sendMessage({ channelId: id, text: topic ? `채널 주제를 "${topic}"(으)로 설정했습니다.` : '채널 주제를 삭제했습니다.', kind: 'system', meta: { event: 'topic' } })
      },
      joinChannel: (id, userId) => {
        const who = userId ?? getCurrentUserId()
        const ch = get().channels.find((c) => c.id === id)
        if (!ch || ch.memberIds.includes(who)) return
        set((s) => ({
          channels: s.channels.map((c) => (c.id === id ? { ...c, memberIds: [...c.memberIds, who] } : c)),
          lastRead: who === getCurrentUserId() ? { ...s.lastRead, [id]: new Date().toISOString() } : s.lastRead,
        }))
        get().sendMessage({ channelId: id, userId: who, text: '채널에 참여했습니다.', kind: 'system', meta: { event: 'join' } })
      },
      leaveChannel: (id, userId) => {
        const who = userId ?? getCurrentUserId()
        get().sendMessage({ channelId: id, userId: who, text: '채널에서 나갔습니다.', kind: 'system', meta: { event: 'leave' } })
        set((s) => ({
          channels: s.channels.map((c) => (c.id === id ? { ...c, memberIds: c.memberIds.filter((m) => m !== who) } : c)),
          starred: s.starred.filter((x) => x !== id),
        }))
      },
      addMembers: (id, userIds) => {
        const ch = get().channels.find((c) => c.id === id)
        if (!ch) return
        const fresh = userIds.filter((u) => !ch.memberIds.includes(u))
        if (!fresh.length) return
        set((s) => ({ channels: s.channels.map((c) => (c.id === id ? { ...c, memberIds: [...c.memberIds, ...fresh] } : c)) }))
        const names = fresh.map((u) => `@${getUser(u)?.name ?? ''}`).join(', ')
        const sys = get().sendMessage({ channelId: id, text: `${names}님을 채널에 추가했습니다.`, kind: 'system', meta: { event: 'add' } })
        notifyAdded(ch, fresh, sys.id)
      },
      toggleStar: (id) => set((s) => ({ starred: s.starred.includes(id) ? s.starred.filter((x) => x !== id) : [...s.starred, id] })),

      markRead: (channelId, at) => {
        const cur = get().lastRead[channelId]
        let next = at ?? new Date().toISOString()
        if (!at) {
          // other people's clocks may run ahead of ours: never leave a message we've seen "unread"
          for (const m of get().messages) if (m.channelId === channelId && m.createdAt > next) next = m.createdAt
        }
        if (cur && cur >= next) return
        // avoid churn: only write when there is actually something unread
        if (!at && cur) {
          const anyNewer = get().messages.some((m) => m.channelId === channelId && m.createdAt > cur)
          if (!anyNewer) return
        }
        set((s) => ({ lastRead: { ...s.lastRead, [channelId]: next } }))
      },
      markUnreadFrom: (messageId) => {
        const m = get().messages.find((x) => x.id === messageId)
        if (!m) return
        const before = new Date(new Date(m.createdAt).getTime() - 1).toISOString()
        set((s) => ({ lastRead: { ...s.lastRead, [m.channelId]: before } }))
      },
      setDraft: (key, text) =>
        set((s) => {
          if ((s.drafts[key] ?? '') === text) return s
          const drafts = { ...s.drafts }
          if (text.trim()) drafts[key] = text
          else delete drafts[key]
          return { drafts }
        }),
      toggleCollapsed: (section) => set((s) => ({ collapsed: { ...s.collapsed, [section]: !s.collapsed[section] } })),
      pushRecentEmoji: (emoji) => set((s) => ({ recentEmoji: [emoji, ...s.recentEmoji.filter((e) => e !== emoji)].slice(0, 24) })),
      setLastChannel: (id) => {
        if (get().lastChannelId !== id) set({ lastChannelId: id })
      },

      scheduleMessage: (input, at) => {
        const msg: Message = {
          id: uid('sch'),
          channelId: input.channelId,
          userId: input.userId ?? getCurrentUserId(),
          text: input.text,
          createdAt: new Date().toISOString(),
          reactions: {},
          threadId: input.threadId,
          attachments: input.attachments,
          scheduledFor: at,
        }
        set((s) => ({ scheduled: [...s.scheduled, msg].sort((a, b) => (a.scheduledFor! < b.scheduledFor! ? -1 : 1)) }))
      },
      cancelScheduled: (id) => set((s) => ({ scheduled: s.scheduled.filter((m) => m.id !== id) })),
      sendScheduledNow: (id) => {
        const m = get().scheduled.find((x) => x.id === id)
        if (!m) return undefined
        set((s) => ({ scheduled: s.scheduled.filter((x) => x.id !== id) }))
        // the channel may have been left/archived meanwhile — still deliver, it's the user's own message
        return get().sendMessage({ channelId: m.channelId, text: m.text, threadId: m.threadId, attachments: m.attachments, userId: m.userId })
      },
      releaseDue: () => {
        const now = new Date().toISOString()
        const due = get().scheduled.filter((m) => m.scheduledFor! <= now)
        return due.map((m) => get().sendScheduledNow(m.id)).filter((m): m is Message => !!m)
      },

      unreadFor: (channelId, userId) => {
        const me = userId ?? getCurrentUserId()
        const s = get()
        const ch = s.channels.find((c) => c.id === channelId)
        if (!ch || !ch.memberIds.includes(me)) return { count: 0, mentions: 0 }
        const since = s.lastRead[channelId] ?? ''
        let count = 0
        let mentions = 0
        for (const m of s.messages) {
          if (m.channelId !== channelId || m.userId === me || m.createdAt <= since || !isTimelineMessage(m) || m.kind === 'system') continue
          count++
          if (ch.kind === 'dm' || ch.kind === 'group' || mentionsUser(m.text, me)) mentions++
        }
        return { count, mentions }
      },
      unreadTotal: (userId) => {
        const s = get()
        const mine = new Set(s.channels.filter((c) => c.memberIds.includes(userId) && !c.archived).map((c) => c.id))
        let total = 0
        for (const m of s.messages) {
          if (!mine.has(m.channelId) || m.userId === userId || m.kind === 'system' || !isTimelineMessage(m)) continue
          if (m.createdAt > (s.lastRead[m.channelId] ?? '')) total++
        }
        return total
      },
    }),
    {
      version: 2,
      migrate: () => seedData() as MessengerState,
      merge: (persistedState, current) => {
        const p = persistedState as Partial<MessengerState> | undefined
        if (!p || !p.channels?.length) return current
        return { ...current, ...p }
      },
    },
  ),
)
syncAcrossTabs(useMessenger)
