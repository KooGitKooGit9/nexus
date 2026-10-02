import { useCore } from '@/store/core'
import { useApprovals } from '@/features/approvals/store'
import { useProjects } from '@/features/projects/store'
import { useMessenger } from '@/features/messenger/store'
import { useUnreadAnnouncements } from '@/features/goals/store'

/** Sidebar counters derived from feature stores. */
export function useSidebarBadges(): Record<string, number> {
  const me = useCore((s) => s.currentUserId)
  const pendingApprovals = useApprovals((s) =>
    s.requests.filter((r) => r.status === 'pending' && r.steps.some((st) => st.approverId === me && st.status === 'pending')).length,
  )
  const myOpenTasks = useProjects((s) => s.tasks.filter((t) => t.assigneeIds.includes(me) && t.status !== 'done').length)
  const unread = useMessenger((s) => s.unreadTotal(me))
  const unreadAnnouncements = useUnreadAnnouncements()
  return { '/announcements': unreadAnnouncements, '/approvals': pendingApprovals, '/projects': myOpenTasks, '/messages': unread }
}
