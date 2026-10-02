/**
 * Nexus AI — a local, rule-based "agent". No network calls: it reads the live zustand stores,
 * detects the intent of a Korean prompt and composes a markdown answer with deep links.
 */
import { addDays, differenceInCalendarDays, endOfDay, format, isSameDay, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useCore, getUser } from '@/store/core'
import { isDemoWorkspace } from '@/lib/workspace'
import { useCalendar } from '@/features/calendar/store'
import { useProjects } from '@/features/projects/store'
import { useMessenger } from '@/features/messenger/store'
import { useApprovals } from '@/features/approvals/store'
import { useGoals } from '@/features/goals/store'
import { isDocStarred, useDocs } from '@/features/docs/store'
import { krProgress, objectiveProgress } from '@/features/goals/lib'
import type { CalEvent } from '@/features/calendar/types'
import type { Task, Priority, TaskStatus } from '@/features/projects/types'
import type { Channel, Message } from '@/features/messenger/types'
import type { ApprovalKind, ApprovalRequest } from '@/features/approvals/types'
import type { Objective } from '@/features/goals/types'
import type { User } from '@/store/types'
import { PRESENCE_LABEL } from '@/components/ui'
import { timeAgo } from '@/lib/utils'
import { searchAll, groupEmoji } from '../palette/catalog'
import { parse, extractBody, composeDM, composePost, isNotice, extractEvent, extractTask, extractDocDraft, type Parsed } from './intent'
import { docQuery, rankDocs, summarizeMarkdown, type DocHit } from './docsum'
import { docTemplate, type AgentAction } from './actions'
import { josa } from './nlp'
import type { Doc } from '@/features/docs/types'
import { joinMeta } from '@/features/people/format'

export interface AgentAnswer {
  steps: string[]
  text: string
  /** an executable action → rendered as a confirm card under the answer */
  action?: AgentAction
}

type P = Parsed<User, Channel>

/* ───────────── helpers ───────────── */

const me = () => useCore.getState().currentUserId
const nameOf = (id?: string | null) => getUser(id)?.name ?? '알 수 없음'
const hm = (iso: string) => format(new Date(iso), 'HH:mm')
const dayLabel = (d: Date) => format(d, 'M월 d일 (EEE)', { locale: ko })
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ')
const clip = (s: string, n = 64) => {
  const t = s.replace(/```[\s\S]*?```/g, '[코드]').replace(/[*_`>#~]/g, '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}
const bar = (pct: number, cells = 10) => {
  const f = Math.round((Math.max(0, Math.min(100, pct)) / 100) * cells)
  return '▰'.repeat(f) + '▱'.repeat(cells - f)
}
const won = (n: number) => `₩${n.toLocaleString('ko-KR')}`
const pick = <T,>(arr: T[], v: number) => arr[Math.abs(v) % arr.length]

function greeting() {
  const h = new Date().getHours()
  const first = (useCore.getState().users.find((u) => u.id === me())?.name ?? '').slice(1) || '팀원'
  if (h < 6) return `늦은 시간까지 수고 많으세요, ${first}님 🌙`
  if (h < 12) return `좋은 아침이에요, ${first}님 ☀️`
  if (h < 18) return `좋은 오후예요, ${first}님 👋`
  return `오늘 하루도 수고 많으셨어요, ${first}님 🌆`
}

/* ───────────── calendar ───────────── */

const EVENT_EMOJI: Record<CalEvent['type'], string> = { meeting: '👥', focus: '🎯', personal: '🙋', deadline: '⏰', holiday: '🎉', ooo: '🌴' }

function myEvents(from: Date, to: Date) {
  const uid = me()
  return useCalendar
    .getState()
    .events.filter((e) => (e.attendeeIds?.includes(uid) || e.organizerId === uid) && new Date(e.end) >= from && new Date(e.start) <= to)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
}

function freeSlots(events: CalEvent[], day: Date) {
  const startWork = new Date(day); startWork.setHours(9, 0, 0, 0)
  const endWork = new Date(day); endWork.setHours(18, 0, 0, 0)
  const from = isSameDay(day, new Date()) ? new Date(Math.max(+startWork, Date.now())) : startWork
  const busy = events.filter((e) => !e.allDay).map((e) => [+new Date(e.start), +new Date(e.end)] as const).sort((a, b) => a[0] - b[0])
  const slots: [Date, Date][] = []
  let cur = +from
  for (const [s, e] of busy) {
    if (s - cur >= 60 * 60_000 && s <= +endWork) slots.push([new Date(cur), new Date(Math.min(s, +endWork))])
    cur = Math.max(cur, e)
  }
  if (+endWork - cur >= 60 * 60_000) slots.push([new Date(cur), endWork])
  return slots
}

function scheduleAnswer(p: P, v: number): AgentAnswer {
  const dayHit = p.dates.find((d) => d.kind === 'day')
  const weekHit = p.dates.find((d) => d.kind === 'week')
  const week = !dayHit && (!!weekHit || /주간|일주일/.test(p.text))
  const base = dayHit ? dayHit.date : weekHit ? weekHit.date : new Date()
  const from = startOfDay(base)
  const to = week ? endOfDay(addDays(base, 6)) : endOfDay(base)
  const events = myEvents(from, to)
  const steps = ['캘린더에 접근하는 중…', '일정을 확인하는 중…', '빈 시간대를 계산하는 중…']
  const rel = differenceInCalendarDays(base, new Date())
  const scope = week
    ? (weekHit?.label.replace(/(에|의|은|는|까지|부터)$/, '').trim() || '이번 주')
    : rel === 0 ? '오늘' : rel === 1 ? '내일' : rel === -1 ? '어제' : format(base, 'M월 d일', { locale: ko })

  if (!events.length) {
    return {
      steps,
      text: `## 📅 ${scope} 일정 — ${week ? `${format(from, 'M/d')} ~ ${format(to, 'M/d')}` : dayLabel(base)}\n\n${josa(scope, '은/는')} 잡힌 일정이 **하나도 없어요**. 🎉\n\n깊이 집중할 수 있는 좋은 기회예요. 중요한 작업에 **집중 시간**을 블록해 두는 건 어떨까요?\n\n- [새 일정 만들기](/calendar?new=1)\n- [캘린더 열기](/calendar)`,
    }
  }

  const lines: string[] = []
  lines.push(`## 📅 ${scope}의 일정 — ${week ? `${format(from, 'M/d')} ~ ${format(to, 'M/d')}` : dayLabel(base)}`)
  const meetMin = events.filter((e) => e.type === 'meeting' && !e.allDay).reduce((s, e) => s + (+new Date(e.end) - +new Date(e.start)) / 60000, 0)
  const focusMin = events.filter((e) => e.type === 'focus').reduce((s, e) => s + (+new Date(e.end) - +new Date(e.start)) / 60000, 0)
  const fmtDur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${Math.round(m % 60)}분` : ''}` : `${Math.round(m)}분`)
  lines.push(`${pick(['', '정리해 드릴게요. ', '확인해 봤어요. '], v)}총 **${events.length}개** 일정 · 회의 **${fmtDur(meetMin)}**${focusMin ? ` · 집중 시간 **${fmtDur(focusMin)}**` : ''}`)
  lines.push('')
  lines.push(week ? '| 날짜 | 시간 | 일정 | 장소 |' : '| 시간 | 일정 | 장소 | 참석 |')
  lines.push(week ? '|---|---|---|---|' : '|---|---|---|---|')
  for (const e of events.slice(0, week ? 14 : 10)) {
    const time = e.allDay ? '종일' : `${hm(e.start)}–${hm(e.end)}`
    const where = cell(e.location ?? (e.videoLink ? '🎥 화상회의' : '-'))
    const title = `${EVENT_EMOJI[e.type] ?? '📌'} [${cell(e.title)}](/calendar?event=${e.id})`
    lines.push(week ? `| ${format(new Date(e.start), 'M/d (EEE)', { locale: ko })} | ${time} | ${title} | ${where} |` : `| ${time} | ${title} | ${where} | ${e.attendeeIds.length}명 |`)
  }
  if (events.length > (week ? 14 : 10)) lines.push(`\n_외 ${events.length - (week ? 14 : 10)}개 일정_`)

  const now = Date.now()
  const next = events.find((e) => !e.allDay && +new Date(e.start) > now)
  if (next && !week) {
    const mins = Math.round((+new Date(next.start) - now) / 60000)
    const until = mins < 60 ? `${mins}분 후` : `${Math.floor(mins / 60)}시간 ${mins % 60}분 후`
    lines.push('')
    lines.push(`**⏭ 다음 일정** · ${hm(next.start)} [${next.title}](/calendar?event=${next.id}) (${until})${next.organizerId ? ` — 주최 ${nameOf(next.organizerId)}` : ''}`)
  }

  const insights: string[] = []
  if (!week) {
    const slots = freeSlots(events, base)
    if (slots.length) insights.push(`비어 있는 시간: ${slots.slice(0, 3).map(([a, b]) => `**${format(a, 'HH:mm')}–${format(b, 'HH:mm')}**`).join(', ')} — 집중 시간으로 블록해 두면 좋아요.`)
    else insights.push('업무 시간이 **꽉 차 있어요**. 우선순위가 낮은 회의는 불참하거나 비동기로 대체해 보세요.')
    let b2b = 0
    const timed = events.filter((e) => !e.allDay)
    for (let i = 1; i < timed.length; i++) if (+new Date(timed[i].start) - +new Date(timed[i - 1].end) <= 5 * 60_000) b2b++
    if (b2b >= 1) insights.push(`연속 회의가 **${b2b + 1}개** 이어져요. 사이에 5분 휴식을 넣는 걸 추천드려요.`)
    if (meetMin >= 240) insights.push(`회의가 ${fmtDur(meetMin)}로 많은 편이에요. 일부는 메신저로 대체할 수 있는지 검토해 보세요.`)
  } else {
    const byDay = new Map<string, number>()
    for (const e of events) byDay.set(format(new Date(e.start), 'M/d (EEE)', { locale: ko }), (byDay.get(format(new Date(e.start), 'M/d (EEE)', { locale: ko })) ?? 0) + 1)
    const busiest = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]
    if (busiest) insights.push(`가장 바쁜 날은 **${busiest[0]}** (일정 ${busiest[1]}개)이에요.`)
  }
  const ooo = events.filter((e) => e.type === 'ooo' || e.type === 'holiday')
  if (ooo.length) insights.push(`휴가/공휴일: ${ooo.map((e) => e.title).join(', ')}`)
  if (insights.length) {
    lines.push('')
    lines.push('### 💡 인사이트')
    insights.forEach((s) => lines.push(`- ${s}`))
  }
  lines.push('')
  lines.push('[캘린더에서 보기 →](/calendar)')
  return { steps, text: lines.join('\n') }
}

/* ───────────── tasks ───────────── */

const PRIORITY: Record<Priority, { w: number; label: string }> = {
  urgent: { w: 4, label: '🔴 긴급' }, high: { w: 3, label: '🟠 높음' }, medium: { w: 2, label: '🟡 보통' }, low: { w: 1, label: '⚪ 낮음' },
}
const STATUS_LABEL: Record<TaskStatus, string> = { backlog: '백로그', todo: '할 일', in_progress: '진행 중', review: '리뷰', done: '완료' }

function taskKey(t: Task) {
  const p = useProjects.getState().projects.find((x) => x.id === t.projectId)
  return `${p?.key ?? 'T'}-${t.number}`
}
const taskLink = (t: Task) => `[${taskKey(t)}](/projects/${t.projectId}?task=${t.id})`

function dueInfo(t: Task) {
  if (!t.dueDate) return { days: Infinity, label: '' }
  const days = differenceInCalendarDays(new Date(t.dueDate), new Date())
  const label = days < 0 ? `⚠️ ${-days}일 지연` : days === 0 ? '⏰ 오늘 마감' : days === 1 ? '내일 마감' : `D-${days}`
  return { days, label }
}

function tasksAnswer(_prompt: string, v: number): AgentAnswer {
  const steps = ['프로젝트 보드를 불러오는 중…', '태스크 분석 중…', '마감일과 우선순위를 비교하는 중…']
  const uid = me()
  const mine = useProjects.getState().tasks.filter((t) => t.assigneeIds.includes(uid) && t.status !== 'done')
  if (!mine.length) {
    return { steps, text: `## ✅ 내 할 일\n\n현재 나에게 할당된 열린 태스크가 **없어요**. 👏\n\n- [프로젝트 보드 열기](/projects)\n- [새 태스크 만들기](/projects?new=1)` }
  }
  const scored = mine
    .map((t) => {
      const d = dueInfo(t)
      let s = PRIORITY[t.priority]?.w ?? 1
      if (d.days < 0) s += 5
      else if (d.days === 0) s += 4
      else if (d.days <= 2) s += 2.5
      else if (d.days <= 7) s += 1
      if (t.status === 'in_progress') s += 1
      if (t.status === 'review') s += 0.5
      if (t.status === 'backlog') s -= 1.5
      return { t, d, s }
    })
    .sort((a, b) => b.s - a.s)

  const now = scored.filter((x) => x.d.days <= 0 || (x.t.priority === 'urgent' && x.t.status !== 'backlog'))
  const week = scored.filter((x) => !now.includes(x) && (x.d.days <= 7 || x.t.priority === 'high'))
  const later = scored.filter((x) => !now.includes(x) && !week.includes(x))
  const fmt = (x: (typeof scored)[number]) => {
    const subs = x.t.subtasks?.length ? ` · 하위 ${x.t.subtasks.filter((s) => s.done).length}/${x.t.subtasks.length}` : ''
    return `**${taskLink(x.t)}** ${cell(x.t.title)} — ${PRIORITY[x.t.priority]?.label ?? ''}${x.d.label ? ` · ${x.d.label}` : ''} · ${STATUS_LABEL[x.t.status]}${subs}`
  }

  const counts = (['in_progress', 'review', 'todo', 'backlog'] as TaskStatus[]).map((s) => `${STATUS_LABEL[s]} ${mine.filter((t) => t.status === s).length}`).join(' · ')
  const overdue = scored.filter((x) => x.d.days < 0).length
  const today = scored.filter((x) => x.d.days === 0).length

  const L: string[] = []
  L.push(`## ✅ 우선순위 정리 — 열린 태스크 ${mine.length}개`)
  L.push(`${pick(['마감일 · 우선순위 · 진행 상태를 종합해 순서를 매겼어요.', '긴급도와 마감 임박도를 기준으로 정리했어요.'], v)}\n${counts}`)
  if (now.length) { L.push('', '### 🔥 지금 바로'); now.slice(0, 5).forEach((x, i) => L.push(`${i + 1}. ${fmt(x)}`)) }
  if (week.length) { L.push('', '### ⏳ 이번 주 안에'); week.slice(0, 5).forEach((x, i) => L.push(`${i + 1}. ${fmt(x)}`)) }
  if (later.length) { L.push('', '### 🧊 여유 있음'); later.slice(0, 4).forEach((x) => L.push(`- ${fmt(x)}`)); if (later.length > 4) L.push(`- _외 ${later.length - 4}개_`) }

  const tips: string[] = []
  if (overdue) tips.push(`지연된 **${overdue}건**은 마감일을 재조정하거나 팀에 상황을 공유해 주세요.`)
  if (today) tips.push(`오늘 마감 **${today}건**을 오전 중에 먼저 끝내는 걸 추천드려요.`)
  const wip = mine.filter((t) => t.status === 'in_progress').length
  if (wip >= 3) tips.push(`진행 중인 작업이 **${wip}개**예요. 새 작업을 시작하기 전에 하나씩 마무리해 보세요 (WIP 제한).`)
  const top = scored[0]
  if (top) tips.push(`가장 먼저 할 일: **${taskKey(top.t)} ${cell(top.t.title)}**`)
  L.push('', '> 💡 ' + tips.join('\n> 💡 '))
  L.push('', '[프로젝트 보드 열기 →](/projects)')
  return { steps, text: L.join('\n') }
}

/* ───────────── messenger ───────────── */

function findChannel(p: P): Channel | undefined {
  const { channels, messages } = useMessenger.getState()
  const named = channels.filter((c) => c.kind === 'public' || c.kind === 'private')
  if (p.channel) return p.channel.channel
  // most active in last 24h
  const since = Date.now() - 24 * 3600_000
  const counts = new Map<string, number>()
  for (const m of messages) if (+new Date(m.createdAt) > since) counts.set(m.channelId, (counts.get(m.channelId) ?? 0) + 1)
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => named.find((c) => c.id === id)).find(Boolean)
  return best ?? named[0]
}

function channelAnswer(p: P, v: number): AgentAnswer {
  const ch = findChannel(p)
  const label = ch ? `#${ch.name}` : '채널'
  const steps = [`${label} 메시지를 읽는 중…`, '핵심 논의를 추출하는 중…', '액션 아이템을 정리하는 중…']
  if (!ch) return { steps, text: '아직 요약할 수 있는 채널이 없어요. [메신저](/messages)에서 대화를 시작해 보세요.' }

  const all = useMessenger.getState().messages.filter((m) => m.channelId === ch.id)
  const top = all.filter((m) => !m.threadId && m.kind !== 'system').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
  const recent = top.slice(-40)
  if (!recent.length) return { steps, text: `## 💬 ${label} 요약\n\n최근 대화가 없어요. [채널 열기](/messages/${ch.id})` }

  const replies = (m: Message) => all.filter((x) => x.threadId === m.id).length
  const reacts = (m: Message) => Object.values(m.reactions ?? {}).reduce((s, arr) => s + arr.length, 0)
  const posters = new Map<string, number>()
  recent.forEach((m) => posters.set(m.userId, (posters.get(m.userId) ?? 0) + 1))
  const topPosters = [...posters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  const highlights = [...recent].sort((a, b) => reacts(b) + replies(b) * 1.5 - (reacts(a) + replies(a) * 1.5)).slice(0, 3).filter((m) => reacts(m) + replies(m) > 0)
  const actionRe = /(부탁|해\s?주|확인\s?(해|부탁|좀)|리뷰|검토|공유\s?(해|부탁)|까지|TODO|필요해|진행해|머지|배포)/i
  const actions = recent.filter((m) => actionRe.test(m.text)).slice(-4)
  const questions = recent.filter((m) => /\?\s*$|\?\s/.test(m.text) && replies(m) === 0).slice(-2)
  const myName = useCore.getState().users.find((u) => u.id === me())?.name ?? ''
  const mentionsMe = recent.filter((m) => m.text.includes(`@${myName}`) || m.text.includes(`<@${me()}>`) || m.text.includes(`@${me()}`))
  const firstAt = recent[0].createdAt

  const L: string[] = []
  L.push(`## 💬 ${ch.emoji ? ch.emoji + ' ' : ''}${label} 채널 요약`)
  L.push(`${pick(['', '요점만 정리했어요. ', '최근 대화를 읽어봤어요. '], v)}${timeAgo(firstAt)}부터 **메시지 ${recent.length}개** · 참여자 **${posters.size}명**${ch.topic ? `\n주제: _${clip(ch.topic, 60)}_` : ''}`)
  L.push('', '### 🔑 주요 논의')
  const keyMsgs = highlights.length ? highlights : recent.slice(-3)
  keyMsgs.forEach((m) => {
    const meta = [reacts(m) ? `반응 ${reacts(m)}` : '', replies(m) ? `답글 ${replies(m)}` : ''].filter(Boolean).join(' · ')
    L.push(`- **${nameOf(m.userId)}**: "${clip(m.text, 80)}"${meta ? ` _(${meta})_` : ''}`)
  })
  if (actions.length) {
    L.push('', '### 📌 액션 아이템')
    actions.forEach((m) => L.push(`- ${nameOf(m.userId)} — ${clip(m.text, 70)}`))
  }
  if (questions.length) {
    L.push('', '### ❓ 답변을 기다리는 질문')
    questions.forEach((m) => L.push(`- **${nameOf(m.userId)}**: ${clip(m.text, 70)}`))
  }
  if (mentionsMe.length) L.push('', `> 👋 회원님이 **${mentionsMe.length}번** 멘션되었어요. 확인이 필요해요!`)
  L.push('', `**가장 활발한 멤버**: ${topPosters.map(([id, n]) => `${nameOf(id)} (${n})`).join(', ')}`)
  L.push('', `[${label} 열기 →](/messages/${ch.id})`)
  return { steps, text: L.join('\n') }
}

/* ───────────── approvals ───────────── */

const KIND: Record<ApprovalKind, string> = { leave: '🌴 휴가', expense: '💳 경비', purchase: '🛒 구매', travel: '✈️ 출장', access: '🔐 권한', general: '📄 일반' }

function approvalsAnswer(_p: string, v: number): AgentAnswer {
  const steps = ['결재함을 확인하는 중…', '결재선을 분석하는 중…']
  const uid = me()
  const reqs = useApprovals.getState().requests
  const current = (r: ApprovalRequest) => r.steps.find((s) => s.status === 'pending')
  const waiting = reqs.filter((r) => r.status === 'pending' && current(r)?.approverId === uid).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
  const mineOpen = reqs.filter((r) => r.requesterId === uid && r.status === 'pending')
  const mineDone = reqs.filter((r) => r.requesterId === uid && r.status !== 'pending').sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 3)
  const teamPending = reqs.filter((r) => r.status === 'pending').length
  const detail = (r: ApprovalRequest) => (r.amount ? won(r.amount) : r.startDate ? `${format(new Date(r.startDate), 'M/d')}${r.endDate ? `~${format(new Date(r.endDate), 'M/d')}` : ''}` : '-')

  const L: string[] = []
  L.push('## 🖋️ 결재 대기 현황')
  if (!waiting.length) L.push(`${pick(['좋은 소식이에요!', '확인해 봤어요.'], v)} 내가 처리해야 할 결재가 **없어요**. ✨`)
  else {
    L.push(`회원님의 결재를 기다리는 문서가 **${waiting.length}건** 있어요.`)
    L.push('', '| 문서 | 기안자 | 유형 | 금액/기간 | 대기 |', '|---|---|---|---|---|')
    waiting.slice(0, 8).forEach((r) => L.push(`| [${cell(r.title)}](/approvals?id=${r.id}) | ${nameOf(r.requesterId)} | ${KIND[r.kind] ?? r.kind} | ${detail(r)} | ${timeAgo(r.createdAt)} |`))
    const total = waiting.reduce((s, r) => s + (r.amount ?? 0), 0)
    if (total) L.push('', `대기 중인 금액 합계: **${won(total)}**`)
    const stale = waiting.filter((r) => Date.now() - +new Date(r.createdAt) > 2 * 86400_000)
    if (stale.length) L.push('', `> ⚠️ 2일 이상 대기 중인 결재가 **${stale.length}건** 있어요. 기안자가 기다리고 있어요!`)
  }
  if (mineOpen.length) {
    L.push('', '### 📤 내가 올린 결재 (진행 중)')
    mineOpen.forEach((r) => {
      const idx = r.steps.findIndex((s) => s.status === 'pending')
      L.push(`- [${r.title}](/approvals?id=${r.id}) — ${idx + 1}/${r.steps.length}단계 · ${nameOf(r.steps[idx]?.approverId)} 검토 중`)
    })
  }
  if (mineDone.length) {
    L.push('', '### 📥 최근 처리 결과')
    mineDone.forEach((r) => L.push(`- ${r.status === 'approved' ? '✅ 승인' : r.status === 'rejected' ? '❌ 반려' : '↩️ 취소'} · ${r.title}`))
  }
  L.push('', `팀 전체 진행 중 결재: ${teamPending}건 · [전자결재 열기 →](/approvals)`)
  return { steps, text: L.join('\n') }
}

/* ───────────── goals ───────────── */

const OKR_STATUS: Record<Objective['status'], string> = { on_track: '🟢 순항', at_risk: '🟡 주의', off_track: '🔴 위험', done: '✅ 완료' }
const krPct = (k: Objective['keyResults'][number]) => Math.round(krProgress(k))
const objPct = (o: Objective) => objectiveProgress(o)

function okrAnswer(_p: string, v: number): AgentAnswer {
  const steps = ['OKR 데이터를 불러오는 중…', '핵심 결과 진척도를 계산하는 중…', '리스크를 평가하는 중…']
  const objs = useGoals.getState().objectives
  if (!objs.length) return { steps, text: '## 🎯 OKR 진척도\n\n등록된 목표가 아직 없어요. [새 목표 만들기](/goals?new=1)' }
  const now = new Date()
  const curQ = `${now.getFullYear()} Q${Math.floor(now.getMonth() / 3) + 1}`
  const inQ = objs.filter((o) => o.quarter === curQ)
  const list = inQ.length ? inQ : objs
  const quarter = inQ.length ? curQ : '전체 기간'
  const avg = Math.round(list.reduce((s, o) => s + objPct(o), 0) / list.length)
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
  const elapsed = Math.round(((+now - +qStart) / (91 * 86400_000)) * 100)

  const L: string[] = []
  L.push(`## 🎯 ${quarter} OKR 진척도`)
  L.push(`${pick(['', '분기 목표를 점검했어요. '], v)}전체 평균 **${avg}%** ${bar(avg)} · 분기 경과 **${Math.min(100, elapsed)}%**`)
  L.push(avg >= elapsed ? '> 📈 일정 대비 **앞서가고** 있어요. 지금 페이스를 유지하세요!' : `> 📉 분기 경과 대비 **${Math.min(100, elapsed) - avg}%p 뒤처져** 있어요. 리스크 목표에 집중이 필요해요.`)
  L.push('', '| 목표 | 팀 | 진척 | 상태 |', '|---|---|---|---|')
  ;[...list].sort((a, b) => objPct(b) - objPct(a)).slice(0, 10).forEach((o) => L.push(`| [${cell(o.title)}](/goals?id=${o.id}) | ${o.team} | ${bar(objPct(o), 6)} ${objPct(o)}% | ${OKR_STATUS[o.status]} |`))

  const risky = list.filter((o) => o.status === 'at_risk' || o.status === 'off_track')
  if (risky.length) {
    L.push('', '### ⚠️ 주의가 필요한 목표')
    risky.slice(0, 4).forEach((o) => {
      const weakest = [...o.keyResults].sort((a, b) => krPct(a) - krPct(b))[0]
      L.push(`- **${o.title}** (${nameOf(o.ownerId)})${weakest ? ` — 가장 낮은 KR: _${weakest.title}_ ${weakest.current}/${weakest.target}${weakest.unit} (${krPct(weakest)}%)` : ''}`)
    })
  }
  const uid = me()
  const myKrs = list.flatMap((o) => o.keyResults.filter((k) => k.ownerId === uid).map((k) => ({ o, k })))
  if (myKrs.length) {
    L.push('', '### 🙋 내가 담당하는 핵심 결과')
    myKrs.slice(0, 5).forEach(({ o, k }) => L.push(`- ${k.title} — **${krPct(k)}%** (${k.current}/${k.target}${k.unit}) · [${o.title}](/goals?id=${o.id})`))
  }
  L.push('', '[목표 & OKR 열기 →](/goals)')
  return { steps, text: L.join('\n') }
}

/* ───────────── meeting template ───────────── */

function templateAnswer(): AgentAnswer {
  const steps = ['다가오는 회의를 확인하는 중…', '템플릿을 작성하는 중…']
  const next = myEvents(new Date(), addDays(new Date(), 7)).find((e) => e.type === 'meeting' && +new Date(e.start) > Date.now())
  const title = next?.title ?? '회의 제목'
  const when = next ? format(new Date(next.start), 'yyyy.MM.dd (EEE) HH:mm', { locale: ko }) : format(new Date(), 'yyyy.MM.dd (EEE) HH:mm', { locale: ko })
  const people = next ? next.attendeeIds.map((id) => nameOf(id)).join(', ') : '참석자'
  const tpl = [
    `# 📝 ${title} 회의록`,
    '',
    `- **일시**: ${when}`,
    `- **장소**: ${next?.location ?? (next?.videoLink ? '화상회의' : '')}`,
    `- **참석자**: ${people}`,
    `- **작성자**: ${nameOf(me())}`,
    '',
    '## 🎯 회의 목적',
    '- ',
    '',
    '## 📋 안건',
    '1. ',
    '2. ',
    '',
    '## 💬 논의 내용',
    '- ',
    '',
    '## ✅ 결정 사항',
    '- ',
    '',
    '## 📌 액션 아이템',
    '| 담당자 | 내용 | 기한 |',
    '|---|---|---|',
    '|  |  |  |',
    '',
    '## 🗓 다음 회의',
    '- ',
  ].join('\n')
  return {
    steps,
    text: `## 📝 회의록 템플릿\n\n${next ? `다가오는 **${next.title}** (${format(new Date(next.start), 'M/d HH:mm')}) 정보로 미리 채워 두었어요.` : '바로 쓸 수 있는 회의록 템플릿이에요.'} 복사해서 문서에 붙여 넣으세요.\n\n\`\`\`markdown\n${tpl}\n\`\`\`\n\n- [새 문서로 만들기 →](/docs?new=1)\n- 팁: 회의 중 **결정 사항**과 **액션 아이템**만 확실히 적어도 회의록의 80%는 완성이에요.`,
  }
}

/* ───────────── docs / people / briefing / help ───────────── */

function docsAnswer(): AgentAnswer {
  const steps = ['문서 & 위키를 살펴보는 중…', '최근 변경 사항을 정리하는 중…']
  const docs = [...useDocs.getState().docs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  if (!docs.length) return { steps, text: '아직 문서가 없어요. [새 문서 만들기](/docs?new=1)' }
  const L = ['## 📄 최근 업데이트된 문서', '']
  docs.slice(0, 6).forEach((d) => L.push(`- ${d.emoji} [${d.title}](/docs/${d.id}) — ${nameOf(d.lastEditedBy)} · ${timeAgo(d.updatedAt)}`))
  const starred = docs.filter((d) => isDocStarred(d))
  if (starred.length) { L.push('', '### ⭐ 즐겨찾기'); starred.slice(0, 5).forEach((d) => L.push(`- ${d.emoji} [${d.title}](/docs/${d.id})`)) }
  const mine = docs.filter((d) => d.authorId === me()).length
  L.push('', `전체 문서 **${docs.length}개** · 내가 작성한 문서 **${mine}개** · [문서 & 위키 열기 →](/docs)`)
  return { steps, text: L.join('\n') }
}

function announcementsAnswer(): AgentAnswer {
  const steps = ['공지사항을 확인하는 중…']
  const uid = me()
  const list = [...useGoals.getState().announcements].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || +new Date(b.createdAt) - +new Date(a.createdAt))
  if (!list.length) return { steps, text: '등록된 공지가 없어요.' }
  const unread = list.filter((a) => !a.readBy.includes(uid))
  const L = ['## 📣 공지사항', unread.length ? `읽지 않은 공지가 **${unread.length}개** 있어요.` : '모든 공지를 확인했어요 ✅', '']
  list.slice(0, 6).forEach((a) => L.push(`- ${a.pinned ? '📌 ' : ''}${a.readBy.includes(uid) ? '' : '🆕 '}**[${a.title}](/announcements?id=${a.id})** — ${a.category} · ${nameOf(a.authorId)} · ${timeAgo(a.createdAt)}`))
  L.push('', '[공지사항 열기 →](/announcements)')
  return { steps, text: L.join('\n') }
}

function personAnswer(p: P): AgentAnswer | null {
  const u = p.people[0]?.user
  if (!u) return null
  const steps = ['구성원 디렉터리를 조회하는 중…', `${u.name}님의 정보를 모으는 중…`]
  const users = useCore.getState().users
  const reports = users.filter((x) => x.managerId === u.id)
  let local = ''
  try { local = new Date().toLocaleTimeString('ko-KR', { timeZone: u.timezone, hour: '2-digit', minute: '2-digit' }) } catch { /* ignore */ }
  const openTasks = useProjects.getState().tasks.filter((t) => t.assigneeIds.includes(u.id) && t.status !== 'done').length
  const nextMeet = useCalendar.getState().events.filter((e) => e.attendeeIds.includes(u.id) && e.attendeeIds.includes(me()) && +new Date(e.start) > Date.now()).sort((a, b) => +new Date(a.start) - +new Date(b.start))[0]
  const L = [
    `## 👤 ${u.name} (${u.nameEn})`,
    `${joinMeta(u.title && `**${u.title}**`, u.department, PRESENCE_LABEL[u.presence])}${u.statusText ? ` — ${u.statusEmoji ?? ''} ${u.statusText}` : ''}`,
    '',
    '| 항목 | 정보 |', '|---|---|',
    `| 📧 이메일 | \`${u.email}\` |`,
    `| 📞 전화 | ${u.phone} |`,
    `| 📍 위치 | ${u.location}${local ? ` (현지 ${local})` : ''} |`,
    `| 🧭 매니저 | ${u.managerId ? nameOf(u.managerId) : '-'} |`,
    `| 👥 팀원 | ${reports.length ? reports.map((r) => r.name).join(', ') : '-'} |`,
    `| ✅ 진행 중 태스크 | ${openTasks}개 |`,
  ]
  if (u.skills?.length) L.push('', `**전문 분야**: ${u.skills.map((s) => `\`${s}\``).join(' ')}`)
  if (nextMeet) L.push('', `📅 함께하는 다음 일정: **${nextMeet.title}** · ${format(new Date(nextMeet.start), 'M/d (EEE) HH:mm', { locale: ko })}`)
  L.push('', `[프로필 보기 →](/people/${u.id})`)
  return { steps, text: L.join('\n') }
}

function briefingAnswer(_p: string, v: number): AgentAnswer {
  const steps = ['일정을 확인하는 중…', '태스크 분석 중…', '결재 · 알림을 모으는 중…', '브리핑을 작성하는 중…']
  const uid = me()
  const events = myEvents(startOfDay(new Date()), endOfDay(new Date()))
  const next = events.find((e) => !e.allDay && +new Date(e.start) > Date.now())
  const tasks = useProjects.getState().tasks.filter((t) => t.assigneeIds.includes(uid) && t.status !== 'done')
  const overdue = tasks.filter((t) => t.dueDate && differenceInCalendarDays(new Date(t.dueDate), new Date()) < 0)
  const dueToday = tasks.filter((t) => t.dueDate && differenceInCalendarDays(new Date(t.dueDate), new Date()) === 0)
  const approvals = useApprovals.getState().requests.filter((r) => r.status === 'pending' && r.steps.find((s) => s.status === 'pending')?.approverId === uid)
  const unreadNotifs = useCore.getState().notifications.filter((n) => !n.read).length
  const ms = useMessenger.getState() as unknown as { unreadTotal?: (id: string) => number }
  let unreadMsgs = 0
  try { unreadMsgs = typeof ms.unreadTotal === 'function' ? ms.unreadTotal(uid) : 0 } catch { /* ignore */ }
  const risky = useGoals.getState().objectives.filter((o) => o.status === 'at_risk' || o.status === 'off_track')
  const announcements = useGoals.getState().announcements.filter((a) => !a.readBy.includes(uid))

  const L: string[] = []
  L.push(`## ${greeting()}`)
  L.push(`${dayLabel(new Date())} 브리핑이에요. ${pick(['오늘 챙겨야 할 것들을 정리했어요.', '한눈에 볼 수 있게 모아봤어요.'], v)}`)
  L.push('', '| 영역 | 현황 |', '|---|---|')
  L.push(`| 📅 일정 | **${events.length}개**${next ? ` · 다음 ${hm(next.start)} ${cell(next.title)}` : ''} |`)
  L.push(`| ✅ 태스크 | 열린 **${tasks.length}개** · 오늘 마감 ${dueToday.length} · 지연 ${overdue.length} |`)
  L.push(`| 🖋️ 결재 | 내 승인 대기 **${approvals.length}건** |`)
  L.push(`| 💬 메시지 | 안 읽은 메시지 ${unreadMsgs}개 · 알림 ${unreadNotifs}개 |`)
  if (announcements.length) L.push(`| 📣 공지 | 읽지 않은 공지 ${announcements.length}개 |`)
  if (risky.length) L.push(`| 🎯 OKR | 주의 필요 목표 ${risky.length}개 |`)

  const acts: string[] = []
  if (overdue.length) acts.push(`지연된 태스크 **${taskKey(overdue[0])} ${cell(overdue[0].title)}** 먼저 처리하기 → ${taskLink(overdue[0])}`)
  if (dueToday.length) acts.push(`오늘 마감 **${dueToday.length}건** 마무리하기 → [보드](/projects)`)
  if (approvals.length) acts.push(`결재 **${approvals.length}건** 검토하기 → [전자결재](/approvals)`)
  if (next) acts.push(`${hm(next.start)} **${next.title}** 준비하기 → [일정](/calendar?event=${next.id})`)
  if (announcements.length) acts.push(`새 공지 확인: [${announcements[0].title}](/announcements?id=${announcements[0].id})`)
  if (!acts.length) acts.push('급한 일이 없어요. 장기 과제에 집중할 좋은 날이에요 🌿')
  L.push('', '### 🚀 추천 액션')
  acts.slice(0, 5).forEach((a, i) => L.push(`${i + 1}. ${a}`))
  return { steps, text: L.join('\n') }
}

/* ───────────── doc summary ───────────── */

const relDay = (d: Date) => {
  const n = differenceInCalendarDays(d, new Date())
  return n === 0 ? '오늘' : n === -1 ? '어제' : n === 1 ? '내일' : n === -2 ? '그저께' : ''
}
const mdDate = (d: Date) => `${format(d, 'M월 d일 (EEE)', { locale: ko })}${relDay(d) ? ` · ${relDay(d)}` : ''}`

function docSummaryAnswer(p: P, v: number): AgentAnswer {
  const { docs, recentIds } = useDocs.getState()
  const q = docQuery(p.raw)
  const ranked = rankDocs(q, docs)
  const generic = !q.keywords.length && !q.date && !q.week
  let hit: DocHit<Doc> | undefined = ranked[0] && ranked[0].score >= 3 ? ranked[0] : undefined
  if (!hit && generic) {
    const recent = recentIds.map((id) => docs.find((d) => d.id === id)).find((d): d is Doc => !!d && !!d.content.trim())
    if (recent) hit = { doc: recent, score: 0, exactDate: false }
  }
  const steps = ['문서 & 위키를 검색하는 중…', hit ? `「${clip(hit.doc.title, 24)}」 문서를 읽는 중…` : '비슷한 문서를 찾는 중…', '핵심 내용과 액션 아이템을 추출하는 중…']

  if (!hit) {
    const near = ranked.filter((h) => h.score > 0).slice(0, 5)
    const list = (near.length ? near : ranked.slice(0, 5)).map((h) => `- ${h.doc.emoji} [${h.doc.title}](/docs/${h.doc.id})${h.date ? ` — ${format(h.date, 'M/d')}` : ''} · ${timeAgo(h.doc.updatedAt)} 수정`)
    return {
      steps,
      text: [`## 🔎 문서를 찾지 못했어요`, `${q.dateLabel ? `**${q.dateLabel}** ` : ''}${q.keywords.length ? `"${q.keywords[0]}" ` : ''}조건에 정확히 맞는 문서가 없어요. 가장 비슷한 문서들이에요:`, '', ...list, '', '문서 제목의 일부를 말씀해 주시면 바로 요약해 드릴게요. 예: "PRD 요약해줘"'].join('\n'),
    }
  }

  const d = hit.doc
  const sum = summarizeMarkdown(d.content)
  const L: string[] = []
  L.push(`## ${d.emoji} ${d.title} — 요약`)
  if ((q.date || q.week) && !hit.exactDate) {
    L.push(`> 🔎 요청하신 **${q.dateLabel}** ${/회의|싱크|미팅/.test(q.keywords.join(' ')) ? '회의록은' : '문서는'} 아직 없어요. 가장 가까운${hit.date ? ` **${mdDate(hit.date)}**` : ''} 문서를 요약했어요.`)
  }
  const metaBits: string[] = []
  if (hit.date && !sum.meta.some((m) => /^일시/.test(m))) metaBits.push(`🗓️ ${mdDate(hit.date)}`)
  metaBits.push(`✍️ ${nameOf(d.authorId)}`)
  metaBits.push(`🕒 ${timeAgo(d.updatedAt)} 수정`)
  L.push(metaBits.join(' · '))
  for (const m of sum.meta.slice(0, 2)) L.push(`- ${m.replace(/^(일시|참석|장소|작성자|날짜)\s*[:：]\s*/, (_x, k: string) => `**${k}** `)}`)
  if (sum.intro && !sum.meta.length) L.push('', `_${clip(sum.intro, 120)}_`)

  const agenda = sum.sections.find((x) => x.kind === 'agenda')
  const body = sum.sections.filter((x) => x.kind !== 'agenda')
  if (agenda) L.push('', `**안건** · ${agenda.points.slice(0, 5).map((x, i) => `${i + 1}) ${clip(x, 28)}`).join('  ')}`)
  if (body.length) {
    L.push('', `### 🔑 ${pick(['핵심 내용', '주요 논의', '한눈에 보기'], v)}`)
    body.slice(0, 5).forEach((x) => L.push(`- **${clip(x.title, 28)}** — ${x.points.slice(0, 2).map((pt) => clip(pt, 70)).join(' · ')}${x.points.length > 2 ? ` _(+${x.points.length - 2})_` : ''}`))
    if (body.length > 5) L.push(`- _외 ${body.length - 5}개 섹션: ${body.slice(5, 9).map((x) => x.title).join(', ')}${body.length > 9 ? '…' : ''}_`)
  }
  if (sum.decisions.length) {
    L.push('', '### ✅ 결정 사항')
    sum.decisions.slice(0, 6).forEach((x) => L.push(`- ${clip(x, 90)}`))
  }
  const myName = nameOf(me())
  if (sum.actions.length) {
    L.push('', '### 📌 액션 아이템')
    sum.actions.slice(0, 8).forEach((a) => {
      const owner = a.owner ? (a.owner === myName ? `**나(${a.owner})**` : `**${a.owner}**`) : ''
      const text = a.done ? `~~${clip(a.text, 60)}~~` : clip(a.text, 60)
      L.push(`- ${a.done ? '☑' : '☐'} ${owner ? owner + ' · ' : ''}${text}${a.due ? ` _(~${a.due})_` : ''}`)
    })
  }
  if (sum.quotes.length) L.push('', `> 💬 ${clip(sum.quotes[0], 110)}`)
  const open = sum.actions.filter((a) => !a.done)
  const mine = open.filter((a) => a.owner === myName)
  const tl: string[] = []
  if (sum.decisions.length) tl.push(`결정 **${sum.decisions.length}건**`)
  if (sum.actions.length) tl.push(`액션 **${sum.actions.length}건** (미완료 ${open.length})`)
  if (mine.length) tl.push(`내 담당 **${mine.length}건**: ${mine.map((a) => clip(a.text, 30)).join(', ')}`)
  if (!tl.length) tl.push(`섹션 ${sum.sections.length}개 · 약 ${Math.max(1, Math.round(sum.words / 200))}분 분량`)
  L.push('', `> 💡 ${tl.join(' · ')}`)
  const others = ranked.filter((h) => h.doc.id !== d.id && h.score >= 6 && !docs.some((x) => x.parentId === h.doc.id)).slice(0, 3)
  L.push('', `[문서 열기 →](/docs/${d.id})${others.length ? `  ·  다른 후보: ${others.map((h) => `[${h.doc.title}](/docs/${h.doc.id})`).join(', ')}` : ''}`)
  return { steps, text: L.join('\n') }
}

/* ───────────── actions (confirm cards) ───────────── */

const CONFIRM_HINT = '아래 카드에서 내용을 확인해 주세요.'

function dmAnswer(p: P, v: number): AgentAnswer {
  const targets = (p.recipients.length ? p.recipients : p.people).map((h) => h.user)
  const names = targets.map((u) => u.name)
  const text = composeDM(names, extractBody(p), v)
  const steps = ['요청을 이해하는 중…', `${names.join(', ')}님을 찾는 중…`, '메시지를 자연스럽게 다듬는 중…']
  const L = [`💬 **${names.join(', ')}**님에게 ${targets.length > 1 ? '그룹 DM으로 ' : ''}이렇게 보낼게요. ${CONFIRM_HINT} 문장은 바로 수정할 수 있어요.`]
  const away = targets.filter((u) => u.presence === 'dnd' || u.presence === 'offline' || u.presence === 'away')
  if (away.length) L.push('', `> ${away.map((u) => `${u.name}님은 지금 **${PRESENCE_LABEL[u.presence]}**`).join(', ')} 상태예요. 답장이 늦을 수 있어요.`)
  return { steps, text: L.join('\n'), action: { kind: 'dm', userIds: targets.map((u) => u.id), text } }
}

function postAnswer(p: P): AgentAnswer {
  const ch = p.channel?.channel ?? useMessenger.getState().channels.find((c) => c.name === 'general')
  const steps = ['요청을 이해하는 중…', ch ? `#${ch.name} 채널을 확인하는 중…` : '채널을 찾는 중…', '게시글을 다듬는 중…']
  if (!ch) return { steps, text: '게시할 채널을 찾지 못했어요. 예: "#general에 내일 타운홀 3시로 변경됐다고 공지해줘"' }
  const text = composePost(extractBody(p), isNotice(p))
  if (!text) return { steps, text: `**#${ch.name}**에 어떤 내용을 올릴까요?\n\n예: "#${ch.name}에 금요일 배포 프리즈 시작한다고 공지해줘"` }
  const members = ch.memberIds.length
  return { steps, text: `📣 **#${ch.name}** 채널(멤버 ${members}명)에 아래 내용으로 게시할게요. ${CONFIRM_HINT}`, action: { kind: 'post', channelId: ch.id, text } }
}

function taskCreateAnswer(p: P): AgentAnswer {
  const { projects } = useProjects.getState()
  const d = extractTask(p, projects, me())
  const project = projects.find((x) => x.id === d.projectId)
  const steps = ['요청을 이해하는 중…', '담당자와 마감일을 확인하는 중…', '태스크 초안을 만드는 중…']
  if (!project) return { steps, text: '태스크를 만들 프로젝트가 없어요. [프로젝트 만들기](/projects?new=1)' }
  const notes: string[] = []
  if (!p.dates.length) notes.push('마감일은 비워 뒀어요.')
  if (!p.people.length) notes.push('담당자는 회원님으로 지정했어요.')
  return {
    steps,
    text: `✅ **${project.emoji} ${project.name}** 프로젝트에 태스크를 만들게요. ${CONFIRM_HINT}${notes.length ? `\n\n_${notes.join(' ')}_` : ''}`,
    action: { kind: 'task', projectId: project.id, title: d.title, assigneeIds: d.assigneeIds, dueDate: d.due?.toISOString(), priority: d.priority },
  }
}

function eventCreateAnswer(p: P): AgentAnswer {
  const e = extractEvent(p, new Date())
  const steps = ['요청을 이해하는 중…', '날짜와 시간을 해석하는 중…', '참석자 일정을 확인하는 중…']
  const attendeeIds = Array.from(new Set([me(), ...e.attendeeIds]))
  const busy = useCalendar.getState().events.filter((x) => !x.allDay && +new Date(x.start) < +e.end && +new Date(x.end) > +e.start)
  const conflicts = attendeeIds.map((id) => ({ id, ev: busy.find((x) => x.attendeeIds.includes(id) || x.organizerId === id) })).filter((x) => x.ev)
  const L = [`📅 **${format(e.start, 'M월 d일 (EEE) HH:mm', { locale: ko })}–${format(e.end, 'HH:mm')}**에 일정을 추가할게요. ${CONFIRM_HINT}`]
  if (e.guessedTime) L.push('', '_시간을 말씀하지 않으셔서 기본 시간으로 잡았어요._')
  if (conflicts.length) {
    L.push('', '> ⚠️ 이 시간에 겹치는 일정이 있어요:')
    conflicts.slice(0, 3).forEach((c) => L.push(`> - ${c.id === me() ? '나' : nameOf(c.id)} — ${c.ev!.title} (${hm(c.ev!.start)}–${hm(c.ev!.end)})`))
  }
  return {
    steps,
    text: L.join('\n'),
    action: { kind: 'event', title: e.title, start: e.start.toISOString(), end: e.end.toISOString(), attendeeIds, location: e.location ?? (e.video ? 'Google Meet' : undefined), videoLink: e.video ? `https://meet.google.com/nxs-${Math.random().toString(36).slice(2, 6)}-ai` : undefined },
  }
}

function docCreateAnswer(p: P): AgentAnswer {
  const d = extractDocDraft(p, new Date())
  const { docs } = useDocs.getState()
  const when = d.date ?? new Date()
  const tpl = docTemplate(d.kind, d.title, { dateLabel: format(when, 'M월 d일 (EEE)', { locale: ko }), author: nameOf(me()), attendees: [nameOf(me()), ...p.people.map((h) => h.user.name)].join(', ') })
  const folder = d.kind === 'meeting' ? docs.find((x) => x.parentId === null && x.title === '회의록') : d.kind === 'prd' ? docs.find((x) => x.parentId === null && x.title === '제품') : undefined
  const kindLabel = { meeting: '회의록 템플릿', prd: 'PRD 템플릿', retro: 'KPT 회고 템플릿', report: '주간 보고 템플릿', blank: '빈 문서' }[d.kind]
  return {
    steps: ['요청을 이해하는 중…', '알맞은 템플릿을 고르는 중…', '문서 초안을 준비하는 중…'],
    text: `📄 **${kindLabel}**${josa(kindLabel, '으로/로').slice(kindLabel.length)} 새 문서를 만들게요${folder ? ` (위치: ${folder.emoji} ${folder.title})` : ''}. ${CONFIRM_HINT}`,
    action: { kind: 'doc', title: d.title, emoji: tpl.emoji, content: tpl.content, parentId: folder?.id ?? null },
  }
}

/** Real workspaces: help examples must not name the demo's people / channels / documents. */
function neutralExamples(text: string): string {
  if (isDemoWorkspace()) return text
  const self = me()
  const mate = useCore.getState().users.find((u) => u.id !== self && u.id !== 'u_bot')?.name
  const who = mate ?? '동료'
  return text
    .replace(/박서준|최지우|서현우|한소희/g, who)
    .replace(/#engineering/g, '#general')
    .replace(/"PRD 핵심만", "온콜 런북 정리"/g, '"회의록 핵심만 정리해줘"')
    .replace(/검색 성능 개선 태스크/g, '랜딩 페이지 개편 태스크')
    .replace(/로드맵 회의/g, '주간 회의')
}

function helpAnswer(): AgentAnswer {
  return {
    steps: ['가능한 기능을 정리하는 중…'],
    text: neutralExamples([
      '## ✨ Nexus AI가 도와드릴 수 있는 일',
      '워크스페이스의 실제 데이터(일정 · 태스크 · 메신저 · 결재 · OKR · 문서 · 구성원)를 읽고 답하고, **직접 실행**도 해요.',
      '',
      '### ⚡ 실행',
      '- **메시지** — "박서준한테 오늘 지각했냐고 메시지 보내", "최지우에게 PR 리뷰 좀 해달라고 전해줘"',
      '- **공지** — "#general에 내일 타운홀 3시로 변경됐다고 공지해줘"',
      '- **일정** — "내일 오후 3시에 서현우랑 로드맵 회의 잡아줘"',
      '- **태스크** — "검색 성능 개선 태스크 만들어줘 최지우 담당 금요일까지"',
      '- **문서** — "제품 싱크 회의록 만들어줘"',
      '',
      '### 🔎 조회 · 요약',
      '- **문서** — "어제 회의록 요약해줘", "PRD 핵심만", "온콜 런북 정리"',
      '- **일정 · 태스크** — "오늘 일정 요약", "내 할 일 우선순위 정리"',
      '- **메신저** — "#engineering 채널 요약"',
      '- **결재 · OKR** — "결재 대기 현황", "이번 분기 OKR 진척도"',
      '- **사람** — "최지우 연락처", "한소희는 누구야?"',
      '- **브리핑** — "오늘 브리핑"',
      '',
      '> 🔒 모든 분석은 브라우저 안에서 로컬로 처리돼요. 실행 전에는 항상 확인을 받아요.',
    ].join('\n')),
  }
}

function fallbackAnswer(prompt: string): AgentAnswer {
  const steps = ['질문을 이해하는 중…', '워크스페이스 전체를 검색하는 중…']
  const STOP = /^(좀|어떻게|뭐|무엇|알려줘|찾아줘|보여줘|관련|대해|대한|있어|있나요|해줘|주세요)$/
  let results = searchAll(prompt.trim())
  if (!results.length) {
    const words = prompt.replace(/[?!.,"']/g, ' ').split(/\s+/).map((w) => w.replace(/(은|는|이|가|을|를|에|의|에서|으로|로|와|과|랑)$/, '')).filter((w) => w.length >= 2 && !STOP.test(w))
    const seen = new Set<string>()
    for (const w of words) for (const r of searchAll(w)) if (!seen.has(r.href + r.title)) { seen.add(r.href + r.title); results.push(r) }
  }
  results = results.slice(0, 8)
  if (results.length) {
    const L = [`## 🔎 "${clip(prompt, 30)}" 관련 항목`, `워크스페이스에서 **${results.length}개**의 관련 항목을 찾았어요.`, '']
    results.forEach((r) => L.push(`- ${r.emoji ?? groupEmoji(r.group)} [${r.title}](${r.href})${r.subtitle ? ` — ${r.subtitle}` : ''} _(${r.group})_`))
    L.push('', '더 구체적으로 물어보시면 요약이나 분석도 해드릴게요. 예: "오늘 일정 요약", "결재 대기 현황"')
    return { steps, text: L.join('\n') }
  }
  return {
    steps,
    text: [
      '음, 이 질문은 제가 아직 정확히 이해하지 못했어요. 🤔',
      '',
      '저는 워크스페이스 데이터를 기반으로 답하는 **로컬 어시스턴트**예요. 이런 질문을 잘 해요:',
      '',
      '- "오늘 일정 요약"',
      '- "내 할 일 우선순위 정리"',
      '- "#engineering 채널 요약"',
      '- "이번 분기 OKR 진척도"',
      '',
      '또는 [⌘K 커맨드 팔레트](/)에서 직접 검색해 보세요.',
    ].join('\n').replace('#engineering', isDemoWorkspace() ? '#engineering' : '#general'),
  }
}

/* ───────────── router ───────────── */

function routerCtx() {
  const users = useCore.getState().users
  const channels = useMessenger.getState().channels.filter((c) => (c.kind === 'public' || c.kind === 'private') && !c.archived)
  const docTitles = useDocs.getState().docs.map((d) => d.title)
  return { users, channels, meId: me(), now: new Date(), docTitles }
}

const GREETING = () => ({ steps: ['인사 준비 중…'], text: `${greeting()}\n\n저는 **Nexus AI**예요. 일정 정리, 할 일 우선순위, 회의록 요약은 물론 **메시지 보내기 · 일정 잡기 · 태스크 만들기**까지 도와드려요.\n\n"오늘 브리핑"이라고 말씀해 보세요! ✨` })

export function runAgent(prompt: string, variant = 0): AgentAnswer {
  try {
    const p: P = parse(prompt, routerCtx())
    switch (p.intent) {
      case 'send_dm': return dmAnswer(p, variant)
      case 'post_channel': return postAnswer(p)
      case 'create_event': return eventCreateAnswer(p)
      case 'create_task': return taskCreateAnswer(p)
      case 'create_doc': return docCreateAnswer(p)
      case 'template': return templateAnswer()
      case 'doc_summary': return docSummaryAnswer(p, variant)
      case 'docs_list': return docsAnswer()
      case 'channel_summary': return channelAnswer(p, variant)
      case 'person': return personAnswer(p) ?? fallbackAnswer(p.text)
      case 'approvals': return approvalsAnswer(p.text, variant)
      case 'okr': return okrAnswer(p.text, variant)
      case 'tasks': return tasksAnswer(p.text, variant)
      case 'schedule': return scheduleAnswer(p, variant)
      case 'announcements': return announcementsAnswer()
      case 'briefing': return briefingAnswer(p.text, variant)
      case 'greeting': return GREETING()
      case 'help': return helpAnswer()
      default: return fallbackAnswer(p.text)
    }
  } catch (err) {
    console.error('[Nexus AI]', err)
    return { steps: ['분석 중…'], text: '앗, 데이터를 분석하는 중에 문제가 생겼어요. 잠시 후 다시 시도해 주세요. 🙏' }
  }
}

export const SUGGESTIONS = [
  { emoji: '📅', text: '오늘 일정 요약' },
  { emoji: '✅', text: '내 할 일 우선순위 정리' },
  { emoji: '📝', text: '어제 회의록 요약해줘' },
  { emoji: '💬', text: '#engineering 채널 요약' },
  { emoji: '✉️', text: '현우님께 PRD 리뷰 부탁한다고 DM 보내줘' },
  { emoji: '🗓️', text: '내일 오후 3시 디자인 리뷰 잡아줘' },
  { emoji: '🖋️', text: '결재 대기 현황' },
  { emoji: '🎯', text: '이번 분기 OKR 진척도' },
]

/** Local-agent suggestions for real (non-demo) workspaces — no demo people / channels. */
export const SUGGESTIONS_STARTER = [
  { emoji: '📅', text: '오늘 일정 요약' },
  { emoji: '✅', text: '내 할 일 우선순위 정리' },
  { emoji: '🗓️', text: '내일 오후 3시 팀 회의 잡아줘' },
  { emoji: '💬', text: '#general 채널 요약' },
  { emoji: '🖋️', text: '결재 대기 현황' },
  { emoji: '🎯', text: '이번 분기 OKR 진척도' },
]
