import type { SearchFn } from '@/lib/search'
import { matches } from '@/lib/search'
import { useWhiteboard } from './store'

/** Boards by name/description, plus sticky-note text → board. */
export const search: SearchFn = (query) => {
  const q = query.trim()
  if (!q) return []
  const out: ReturnType<SearchFn> = []
  for (const b of useWhiteboard.getState().boards) {
    if (matches(b.name, q) || matches(b.description, q)) {
      out.push({ id: `wb_${b.id}`, title: b.name, subtitle: b.description ?? '화이트보드', emoji: b.emoji || '🎨', href: `/whiteboard/${b.id}`, group: '화이트보드' })
      continue
    }
    const hit = b.elements.find((e) => (e.type === 'sticky' || e.type === 'text') && matches(e.text, q))
    if (hit) out.push({ id: `wb_${b.id}_${hit.id}`, title: hit.text!.replace(/\n/g, ' ').slice(0, 60), subtitle: `${b.emoji} ${b.name}`, emoji: '🗒️', href: `/whiteboard/${b.id}`, group: '화이트보드' })
    if (out.length >= 6) break
  }
  return out.slice(0, 6)
}
