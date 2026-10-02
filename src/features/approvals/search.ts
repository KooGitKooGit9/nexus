import { matches, type SearchFn } from '@/lib/search'
import { getUser } from '@/store/core'
import { useApprovals } from './store'
import { KIND_META, STATUS_META } from './meta'

export const search: SearchFn = (query) => {
  const q = query.trim()
  if (!q) return []
  return useApprovals
    .getState()
    .requests.filter((r) => matches(r.title, q) || matches(r.docNo, q) || matches(getUser(r.requesterId)?.name, q))
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: `${KIND_META[r.kind].label} · ${getUser(r.requesterId)?.name ?? ''} · ${STATUS_META[r.status].label}`,
      emoji: KIND_META[r.kind].emoji,
      href: `/approvals?id=${r.id}`,
      group: '전자결재',
    }))
}
