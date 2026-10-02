import { matches, type SearchFn } from '@/lib/search'
import { useCalendar } from './store'
import { TYPE_META } from './constants'
import { formatRange } from './utils'

export const search: SearchFn = (q) => {
  const query = q.trim()
  if (!query) return []
  const now = Date.now()
  return useCalendar
    .getState()
    .events.filter((e) => matches(e.title, query) || matches(e.location, query))
    // upcoming first, then most recent past
    .sort((a, b) => {
      const ta = new Date(a.start).getTime()
      const tb = new Date(b.start).getTime()
      const fa = ta >= now
      const fb = tb >= now
      if (fa !== fb) return fa ? -1 : 1
      return fa ? ta - tb : tb - ta
    })
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      title: e.title,
      subtitle: [formatRange(e), e.location].filter(Boolean).join(' · '),
      emoji: TYPE_META[e.type].emoji,
      href: `/calendar?event=${e.id}`,
      group: '일정',
    }))
}
