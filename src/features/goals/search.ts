import { matches, type SearchFn, type SearchResult } from '@/lib/search'
import { getUser } from '@/store/core'
import { useGoals } from './store'
import { STATUS_META, objectiveProgress } from './lib'

export const search: SearchFn = (query) => {
  const q = query.trim()
  if (!q) return []
  const { objectives, announcements } = useGoals.getState()
  const out: SearchResult[] = []

  for (const o of objectives) {
    const krHit = o.keyResults.find((k) => matches(k.title, q))
    if (matches(o.title, q) || matches(o.team, q) || matches(o.description, q) || krHit) {
      out.push({
        id: `goal:${o.id}`,
        title: o.title,
        subtitle: krHit
          ? `KR · ${krHit.title}`
          : `${o.quarter} · ${o.team} · ${STATUS_META[o.status].label} · ${objectiveProgress(o)}%`,
        emoji: o.emoji ?? '🎯',
        href: `/goals?quarter=${encodeURIComponent(o.quarter)}&id=${o.id}`,
        group: '목표',
      })
    }
    if (out.length >= 4) break
  }

  const anns: SearchResult[] = []
  for (const a of announcements) {
    if (matches(a.title, q) || matches(a.body, q) || matches(a.category, q)) {
      anns.push({
        id: `ann:${a.id}`,
        title: a.title,
        subtitle: `${a.category} · ${getUser(a.authorId)?.name ?? ''}`,
        emoji: a.emoji ?? '📢',
        href: `/announcements?id=${a.id}`,
        group: '공지',
      })
    }
    if (anns.length >= 3) break
  }

  return [...out.slice(0, 6 - Math.min(anns.length, 3)), ...anns].slice(0, 6)
}
