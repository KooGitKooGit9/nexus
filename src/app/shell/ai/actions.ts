/**
 * Nexus AI — executable actions. The agent proposes an `AgentAction`; the chat renders a confirm card
 * and only on [보내기]/[만들기] do we call the real feature-store actions.
 */
import { getCurrentUserId, getUser, toast } from '@/store/core'
import type { User } from '@/store/types'
import { useMessenger } from '@/features/messenger/store'
import { respondTo } from '@/features/messenger/simulator'
import { useProjects } from '@/features/projects/store'
import type { Priority } from '@/features/projects/types'
import { useCalendar } from '@/features/calendar/store'
import { useDocs } from '@/features/docs/store'

export type AgentAction =
  | { kind: 'dm'; userIds: string[]; text: string }
  | { kind: 'post'; channelId: string; text: string }
  | { kind: 'task'; projectId: string; title: string; assigneeIds: string[]; dueDate?: string; priority: Priority }
  | { kind: 'event'; title: string; start: string; end: string; attendeeIds: string[]; location?: string; videoLink?: string }
  | { kind: 'doc'; title: string; emoji: string; content: string; parentId: string | null }

export interface ActionResult { href: string; label: string; summary: string }

export const ACTION_VERB: Record<AgentAction['kind'], string> = { dm: '보내기', post: '게시하기', task: '만들기', event: '일정 추가', doc: '만들기' }

/** Runs the action against the real stores. Throws if the target no longer exists. */
export function executeAction(a: AgentAction): ActionResult {
  switch (a.kind) {
    case 'dm': {
      const users = a.userIds.map((id) => getUser(id)).filter((u): u is User => !!u)
      if (!users.length) throw new Error('사용자를 찾을 수 없어요')
      if (!a.text.trim()) throw new Error('보낼 내용을 입력해 주세요')
      const names = users.map((u) => u.name).join(', ')
      const ms = useMessenger.getState()
      const ch = ms.openDM(users.map((u) => u.id))
      const msg = ms.sendMessage({ channelId: ch.id, text: a.text.trim() })
      try { respondTo(msg) } catch { /* simulator is best-effort */ }
      toast(`${names}님에게 메시지를 보냈어요`, { variant: 'success', emoji: '💬' })
      return { href: `/messages/${ch.id}`, label: users.length > 1 ? '그룹 DM 열기' : `${names}님과의 DM 열기`, summary: `${names}님에게 보냈어요` }
    }
    case 'post': {
      const ms = useMessenger.getState()
      const ch = ms.channels.find((c) => c.id === a.channelId)
      if (!ch) throw new Error('채널을 찾을 수 없어요')
      if (!a.text.trim()) throw new Error('게시할 내용을 입력해 주세요')
      const msg = ms.sendMessage({ channelId: ch.id, text: a.text.trim() })
      try { respondTo(msg) } catch { /* ignore */ }
      toast(`#${ch.name}에 게시했어요`, { variant: 'success', emoji: '📣' })
      return { href: `/messages/${ch.id}`, label: `#${ch.name} 열기`, summary: `#${ch.name}에 게시했어요` }
    }
    case 'task': {
      const ps = useProjects.getState()
      const project = ps.projects.find((p) => p.id === a.projectId) ?? ps.projects[0]
      if (!project) throw new Error('프로젝트가 없어요')
      const t = ps.createTask({ projectId: project.id, title: a.title, assigneeIds: a.assigneeIds, dueDate: a.dueDate, priority: a.priority, status: 'todo' })
      const key = `${project.key}-${t.number}`
      // assigning to myself already triggers the projects store's "태스크가 할당되었습니다" notification
      if (!t.assigneeIds.includes(getCurrentUserId())) toast(`태스크 ${key}를 만들었어요`, { variant: 'success', emoji: '✅', description: t.title })
      return { href: `/projects/${project.id}?task=${t.id}`, label: `${key} 열기`, summary: `${key} · ${t.title}` }
    }
    case 'event': {
      const ev = useCalendar.getState().createEvent({
        title: a.title,
        start: a.start,
        end: a.end,
        type: 'meeting',
        attendeeIds: a.attendeeIds,
        location: a.location,
        videoLink: a.videoLink,
        description: 'Nexus AI로 만든 일정',
      })
      toast('일정을 추가했어요', { variant: 'success', emoji: '📅', description: ev.title })
      return { href: `/calendar?event=${ev.id}`, label: '캘린더에서 보기', summary: ev.title }
    }
    case 'doc': {
      const ds = useDocs.getState()
      const parentId = a.parentId && ds.docs.some((d) => d.id === a.parentId) ? a.parentId : null
      const d = ds.createDoc({ title: a.title, emoji: a.emoji, content: a.content, parentId })
      toast('문서를 만들었어요', { variant: 'success', emoji: a.emoji, description: d.title })
      return { href: `/docs/${d.id}`, label: '문서 열기', summary: d.title }
    }
  }
}

/* ───────────── doc templates ───────────── */

export function docTemplate(kind: 'meeting' | 'prd' | 'retro' | 'report' | 'blank', title: string, opts: { dateLabel: string; author: string; attendees?: string }): { emoji: string; content: string } {
  switch (kind) {
    case 'meeting':
      return {
        emoji: '📝',
        content: `> [!🗓️] **일시:** ${opts.dateLabel} · **장소:** \n> **참석:** ${opts.attendees ?? ''}\n\n## 아젠다\n1. \n\n## 논의 내용\n- \n\n## 결정 사항\n- [ ] \n\n## 액션 아이템\n- [ ]  — @${opts.author} ()\n`,
      }
    case 'prd':
      return { emoji: '✨', content: `> **상태:** 초안 · **담당:** ${opts.author}\n\n## 배경\n\n## 문제 정의\n- \n\n## 목표 & 성공 지표\n| 지표 | 현재 | 목표 |\n| --- | --- | --- |\n|  |  |  |\n\n## 핵심 기능\n### 1. \n\n## 범위 밖 (Non-goals)\n- \n\n## 일정\n- \n\n## 오픈 이슈\n- \n` }
    case 'retro':
      return { emoji: '🔁', content: `> [!🔁] **Keep · Problem · Try** 를 자유롭게 적어주세요.\n\n## 👍 Keep\n- \n\n## 😓 Problem\n- \n\n## 🚀 Try\n- [ ] \n` }
    case 'report':
      return { emoji: '📊', content: `> **작성:** ${opts.author} · ${opts.dateLabel}\n\n## 이번 주 한 일\n- \n\n## 다음 주 계획\n- \n\n## 이슈 & 도움 요청\n- \n` }
    default:
      return { emoji: '📄', content: '' }
  }
}
