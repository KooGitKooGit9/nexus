import { matches, type SearchFn } from '@/lib/search'
import { useWorkflows } from './store'

export const search: SearchFn = (query) => {
  const q = query.trim()
  if (!q) return []
  return useWorkflows
    .getState()
    .workflows.filter((w) => matches(w.name, q) || matches(w.description, q))
    .slice(0, 6)
    .map((w) => ({
      id: w.id,
      title: w.name,
      subtitle: `${w.enabled ? '활성' : '비활성'} · ${w.nodes.length}단계${w.description ? ' · ' + w.description : ''}`,
      emoji: w.emoji,
      href: `/workflows/${w.id}`,
      group: '자동화',
    }))
}
