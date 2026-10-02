import { matches, type SearchFn, type SearchResult } from '@/lib/search'
import { getCurrentUserId, getUser } from '@/store/core'
import { useMessenger } from './store'
import { channelLabel, channelTitle } from './lib'

export const search: SearchFn = (query) => {
  const q = query.trim()
  if (!q) return []
  const me = getCurrentUserId()
  const { channels, messages } = useMessenger.getState()
  const visible = channels.filter((c) => c.kind === 'public' || c.memberIds.includes(me))

  const chResults: SearchResult[] = visible
    .filter((c) => matches(channelTitle(c), q) || matches(c.description, q) || matches(c.topic, q))
    .slice(0, 3)
    .map((c) => ({
      id: `ch-${c.id}`,
      title: channelLabel(c),
      subtitle: c.topic ?? c.description ?? `멤버 ${c.memberIds.length}명`,
      emoji: c.emoji ?? (c.kind === 'dm' ? '💬' : c.kind === 'group' ? '👥' : '#'),
      href: `/messages/${c.id}`,
      group: '채널',
    }))

  const visibleIds = new Set(visible.filter((c) => c.memberIds.includes(me) || c.kind === 'public').map((c) => c.id))
  const msgResults: SearchResult[] = messages
    .filter((m) => visibleIds.has(m.channelId) && !m.deleted && m.kind !== 'system' && matches(m.text, q))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 6 - chResults.length)
    .map((m) => {
      const ch = channels.find((c) => c.id === m.channelId)!
      const flat = (m.text || (m.kind === 'poll' ? `📊 ${(m.meta as { question?: string })?.question ?? ''}` : m.attachments?.map((a) => a.name).join(', ') ?? ''))
        .replace(/```[\s\S]*?```/g, '[코드]')
        .replace(/^>\s?/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      return {
        id: `msg-${m.id}`,
        title: flat.length > 70 ? flat.slice(0, 70) + '…' : flat,
        subtitle: `${getUser(m.userId)?.name ?? ''} · ${channelLabel(ch)}`,
        emoji: '💬',
        href: `/messages/${m.channelId}${m.threadId ? `/thread/${m.threadId}` : ''}?m=${m.id}`,
        group: '메시지',
      }
    })

  return [...chResults, ...msgResults]
}
