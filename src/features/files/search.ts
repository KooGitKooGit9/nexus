import type { SearchFn, SearchResult } from '@/lib/search'
import { formatBytes, timeAgo } from '@/lib/utils'
import { useFiles } from './store'
import { KIND_META, kindOf } from './fileTypes'

const EMOJI: Record<string, string> = {
  folder: '📁', pdf: '📕', doc: '📘', sheet: '📗', slide: '📙', image: '🖼️', video: '🎬', audio: '🎧', zip: '🗜️', design: '🎨', code: '🧩', text: '📄', other: '📄',
}

export const search: SearchFn = (query) => {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const { files } = useFiles.getState()
  const hits: { r: SearchResult; score: number }[] = []
  for (const f of files) {
    if (f.trashed) continue
    const name = f.name.toLowerCase()
    const idx = name.indexOf(q)
    if (idx < 0) continue
    const kind = kindOf(f)
    const parent = f.parentId ? files.find((p) => p.id === f.parentId) : undefined
    const where = parent ? parent.name : '내 드라이브'
    hits.push({
      score: idx === 0 ? 2 : 1,
      r: {
        id: `file:${f.id}`,
        title: f.name,
        subtitle: f.kind === 'folder' ? `폴더 · ${where}` : `${KIND_META[kind].label} · ${f.size ? formatBytes(f.size) + ' · ' : ''}${where} · ${timeAgo(f.updatedAt)}`,
        emoji: EMOJI[kind],
        href: f.kind === 'folder' ? `/files/${f.id}` : `/files/${f.parentId ?? ''}?file=${f.id}`,
        group: '파일',
      },
    })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 6).map((h) => h.r)
}
