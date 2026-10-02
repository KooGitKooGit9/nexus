import type { SearchFn, SearchResult } from '@/lib/search'
import { matches } from '@/lib/search'
import { useProjects } from './store'
import { STATUS_META } from './constants'

export const search: SearchFn = (query) => {
  const q = query.trim()
  if (!q) return []
  const { projects, tasks } = useProjects.getState()
  const out: SearchResult[] = []
  for (const p of projects) {
    if (matches(p.name, q) || matches(p.key, q) || matches(p.description, q))
      out.push({ id: `project:${p.id}`, title: p.name, subtitle: `프로젝트 · ${p.key}`, emoji: p.emoji, href: `/projects/${p.id}`, group: '프로젝트' })
  }
  for (const t of tasks) {
    const p = projects.find((x) => x.id === t.projectId)
    const key = `${p?.key ?? 'T'}-${t.number}`
    if (matches(t.title, q) || matches(key, q))
      out.push({
        id: `task:${t.id}`,
        title: `${key} ${t.title}`,
        subtitle: `${p?.name ?? ''} · ${STATUS_META[t.status].label}`,
        emoji: t.status === 'done' ? '✅' : '🗂️',
        href: `/projects/${t.projectId}?task=${t.id}`,
        group: '태스크',
      })
    if (out.length >= 8) break
  }
  return out.slice(0, 6)
}
