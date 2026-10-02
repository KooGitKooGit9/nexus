import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, X, MessageSquareText } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { useCore } from '@/store/core'
import { Avatar, Tabs } from '@/components/ui'
import { useMessenger } from '../store'
import { channelLabel, channelPath, useChatUI } from '../lib'
import { InlinePreview } from '../markdown'

export function SearchPanel({ channelId }: { channelId: string | null }) {
  const q = useChatUI((s) => s.searchQuery)
  const { setSearch, flash } = useChatUI.getState()
  const messages = useMessenger((s) => s.messages)
  const channels = useMessenger((s) => s.channels)
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const [scope, setScope] = useState<'all' | 'here'>(channelId ? 'all' : 'all')
  const [from, setFrom] = useState<string | null>(null)
  const navigate = useNavigate()

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const visible = new Set(channels.filter((c) => c.memberIds.includes(me) || c.kind === 'public').map((c) => c.id))
    return messages
      .filter((m) => visible.has(m.channelId) && !m.deleted && m.kind !== 'system' && (scope === 'all' || m.channelId === channelId) && (!from || m.userId === from))
      .filter((m) => {
        const pollText = m.kind === 'poll' ? ((m.meta as { question?: string })?.question ?? '') : ''
        return (m.text + ' ' + pollText).toLowerCase().includes(term) || m.attachments?.some((a) => a.name.toLowerCase().includes(term))
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 60)
  }, [q, messages, channels, me, scope, channelId, from])

  const authors = useMemo(() => Array.from(new Set(results.map((r) => r.userId))).slice(0, 6), [results])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line/[0.07] px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent"><Search className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold leading-tight">검색 결과</div>
          <div className="truncate text-[11.5px] text-subtle">"{q}" · {results.length}개</div>
        </div>
        <button onClick={() => setSearch('', false)} className="rounded-lg p-1.5 text-muted transition hover:bg-line/10 hover:text-fg"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2 border-b border-line/[0.07] px-4 py-3">
        <Tabs
          size="sm"
          value={scope}
          onChange={setScope}
          items={[
            { value: 'all', label: '모든 대화' },
            ...(channelId ? [{ value: 'here' as const, label: '현재 대화' }] : []),
          ]}
        />
        {authors.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] text-subtle">보낸 사람</span>
            {authors.map((id) => (
              <button key={id} onClick={() => setFrom(from === id ? null : id)} className={cn('rounded-full transition', from === id ? 'ring-2 ring-accent' : 'opacity-70 hover:opacity-100')}>
                <Avatar userId={id} size="xs" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {results.map((m, i) => {
          const ch = channels.find((c) => c.id === m.channelId)
          const u = users.find((x) => x.id === m.userId)
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              onClick={() => {
                navigate(channelPath(m.channelId, { thread: m.threadId, message: m.id }))
                // a thread result needs the right-hand panel, and when narrow the results overlay would hide the message —
                // step aside (the query stays in the header box; Enter reopens the results)
                if (m.threadId || useChatUI.getState().narrow) useChatUI.getState().setSearchOpen(false)
                setTimeout(() => flash(m.id), 250)
              }}
              className="mb-1 w-full rounded-2xl border border-transparent p-3 text-left transition hover:border-line/10 hover:bg-line/[0.04]"
            >
              <div className="mb-1 flex items-center gap-2 text-[11.5px] text-subtle">
                <span className="font-medium text-muted">{ch ? channelLabel(ch) : ''}</span>
                {m.threadId && <span className="flex items-center gap-0.5"><MessageSquareText className="h-3 w-3" />스레드</span>}
                <span className="ml-auto">{timeAgo(m.createdAt)}</span>
              </div>
              <div className="flex gap-2.5">
                <Avatar userId={m.userId} size="sm" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{u?.name ?? 'Nexus Bot'}</div>
                  <div className="line-clamp-3 text-[13px] leading-relaxed text-fg/80">
                    <InlinePreview text={m.text || (m.kind === 'poll' ? `📊 ${(m.meta as { question?: string })?.question ?? ''}` : m.attachments?.map((a) => a.name).join(', ') ?? '')} highlight={q} />
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
        {!results.length && q.trim() && (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="text-4xl">🔍</span>
            <div className="text-[14px] font-semibold">"{q}"에 대한 결과가 없어요</div>
            <div className="text-[12.5px] text-subtle">다른 키워드로 검색하거나 범위를 넓혀보세요.</div>
          </div>
        )}
      </div>
    </div>
  )
}
