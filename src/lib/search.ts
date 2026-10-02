/**
 * Global search contract. Each feature exports `search(query)` from `src/features/<name>/search.ts`
 * returning matches; the command palette aggregates them.
 */
export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  /** emoji or short glyph shown at left */
  emoji?: string
  /** in-app route to navigate to */
  href: string
  group: string // e.g. '메시지', '태스크', '문서'
}

export type SearchFn = (query: string) => SearchResult[]

export function matches(haystack: string | undefined, q: string) {
  return !!haystack && haystack.toLowerCase().includes(q.toLowerCase())
}
