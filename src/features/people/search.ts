import type { SearchFn } from '@/lib/search'
import { matches } from '@/lib/search'
import { useCore } from '@/store/core'
import { joinMeta } from '@/features/people/format'

/** Users by name / English name / title / department / skills → profile page. */
export const search: SearchFn = (query) => {
  const q = query.trim()
  if (!q) return []
  return useCore
    .getState()
    .users.filter((u) => u.id !== 'u_bot' && [u.name, u.nameEn, u.title, u.department, u.email, ...(u.skills ?? [])].some((f) => matches(f, q)))
    .slice(0, 6)
    .map((u) => {
      const skill = (u.skills ?? []).find((s) => matches(s, q))
      return {
        id: `person_${u.id}`,
        title: u.name,
        subtitle: joinMeta(u.title, u.department, skill) || u.email,
        emoji: '👤',
        href: `/people/${u.id}`,
        group: '구성원',
      }
    })
}
