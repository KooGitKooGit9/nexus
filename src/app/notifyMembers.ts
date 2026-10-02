import { notifyUser } from '@/lib/inbox'
import { getCurrentUserId } from '@/store/core'
import type { AppNotification } from '@/store/types'

type N = Omit<AppNotification, 'id' | 'createdAt' | 'read'>

/**
 * Deliver a notification to other workspace members (bell + toast in *their* browser).
 * Skips the current user, the bot and duplicates. `actorId` defaults to the current user.
 */
export function notifyMembers(userIds: Iterable<string | null | undefined>, n: N) {
  const me = getCurrentUserId()
  const seen = new Set<string>()
  for (const id of userIds) {
    if (!id || id === me || id === 'u_bot' || seen.has(id)) continue
    seen.add(id)
    notifyUser(id, { actorId: me, ...n })
  }
}

/** Ids of users @-mentioned in free text (matches `@이름` against the given users). */
export function mentionedUserIds(text: string, users: { id: string; name: string }[]): string[] {
  if (!text.includes('@')) return []
  return users.filter((u) => text.includes('@' + u.name)).map((u) => u.id)
}
