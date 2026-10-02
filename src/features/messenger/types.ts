export type ChannelKind = 'public' | 'private' | 'dm' | 'group'

export interface Channel {
  id: string
  name: string // for DMs: '' (derive from members)
  kind: ChannelKind
  memberIds: string[]
  topic?: string
  description?: string
  createdBy: string
  createdAt: string
  emoji?: string
  archived?: boolean
  /** "앱" section entries (integration bots) */
  isApp?: boolean
}

export interface Attachment {
  id: string
  name: string
  size: number
  mime: string
  /** object URL or remote URL; may be empty for mock files */
  url?: string
  /** image placeholder gradient (tailwind from/to classes) for mock images */
  gradient?: string
  /** image aspect (w/h) for nicer placeholders */
  aspect?: number
}

export interface Message {
  id: string
  channelId: string
  userId: string
  text: string // lightweight markdown: **bold** _italic_ `code` ```block``` > quote, @mentions, #channels
  createdAt: string
  editedAt?: string
  /** if set, this message is a reply inside a thread whose root is this id */
  threadId?: string
  reactions: Record<string, string[]> // emoji -> userIds
  attachments?: Attachment[]
  pinned?: boolean
  /** special message kinds rendered with rich cards */
  kind?: 'text' | 'system' | 'poll' | 'huddle' | 'task' | 'event'
  meta?: Record<string, unknown>
  /** thread reply that was also broadcast to the channel ("채널에도 전송") */
  alsoInChannel?: boolean
  /** scheduled send time (only for messages in the scheduled queue) */
  scheduledFor?: string
  /** soft-deleted (keeps thread intact) */
  deleted?: boolean
}

/* ───────── Rich card meta shapes (stored in Message.meta) ───────── */

export interface PollOption {
  id: string
  label: string
  voterIds: string[]
}
export interface PollMeta {
  question: string
  options: PollOption[]
  multi?: boolean
  closed?: boolean
}

export interface TaskMeta {
  title: string
  done: boolean
  assigneeId?: string
  due?: string
  key?: string
}

export interface HuddleMeta {
  startedAt: string
  endedAt?: string
  participantIds: string[]
  durationSec?: number
}

export type BotCard =
  | { card: 'deploy'; service: string; env: string; version: string; status: 'success' | 'failed' | 'running'; durationSec: number; commit: string }
  | { card: 'pr'; repo: string; number: number; title: string; branch: string; additions: number; deletions: number; status: 'open' | 'merged' | 'review'; authorId: string; checks?: 'passing' | 'failing' }
  | { card: 'incident'; severity: 'SEV1' | 'SEV2' | 'SEV3'; title: string; service: string; status: 'investigating' | 'mitigated' | 'resolved'; ownerId?: string }
  | { card: 'gif'; query: string; emoji: string }
  | { card: 'reminder'; text: string; at: string }

export interface EventMeta {
  title: string
  start: string
  end: string
  location?: string
  attendeeIds: string[]
}
