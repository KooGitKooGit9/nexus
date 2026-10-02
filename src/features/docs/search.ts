import type { SearchFn, SearchResult } from '@/lib/search'
import { useDocs } from './store'
import { plainText } from './markdown'

export const search: SearchFn = (query) => {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const { docs } = useDocs.getState()
  const scored: { r: SearchResult; score: number }[] = []
  for (const d of docs) {
    const title = (d.title || '제목 없음').toLowerCase()
    let score = 0
    let subtitle: string | undefined
    if (title.startsWith(q)) score = 3
    else if (title.includes(q)) score = 2
    else {
      const text = plainText(d.content)
      const idx = text.toLowerCase().indexOf(q)
      if (idx >= 0) {
        score = 1
        const start = Math.max(0, idx - 18)
        subtitle = (start > 0 ? '…' : '') + text.slice(start, idx + q.length + 40).replace(/\n/g, ' ') + '…'
      }
    }
    if (!score) continue
    const parent = d.parentId ? docs.find((p) => p.id === d.parentId) : undefined
    scored.push({
      score,
      r: {
        id: `doc:${d.id}`,
        title: d.title || '제목 없음',
        subtitle: subtitle ?? (parent ? `${parent.emoji} ${parent.title}` : '워크스페이스'),
        emoji: d.emoji,
        href: `/docs/${d.id}`,
        group: '문서',
      },
    })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 6).map((s) => s.r)
}
