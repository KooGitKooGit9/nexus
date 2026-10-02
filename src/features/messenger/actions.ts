import { daysFromNow, pick } from '@/lib/utils'
import { getCurrentUserId, getUser, toast, useCore, useUI } from '@/store/core'
import { notifyUser } from '@/lib/inbox'
import { isUserOnline } from '@/lib/sync'
import { livePresence } from '@/components/ui/Avatar'
import { useMessenger } from './store'
import { channelLabel, channelPath, getChannel } from './lib'
import { canSimulate, respondTo, scheduleReminder } from './simulator'
import { setNextCallId } from './call/session'
import { searchEmoji } from './emoji'
import type { BotCard, HuddleMeta, PollMeta, TaskMeta } from './types'

export interface SlashCommand {
  name: string
  usage: string
  description: string
  icon: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'poll', usage: '/poll 질문 | 옵션1 | 옵션2', description: '실시간 투표 만들기', icon: '📊' },
  { name: 'task', usage: '/task 제목', description: '태스크 카드 만들기', icon: '✅' },
  { name: 'remind', usage: '/remind 10분 후 회의 준비', description: '리마인더 설정', icon: '⏰' },
  { name: 'huddle', usage: '/huddle', description: '이 채널에서 허들 시작', icon: '🎧' },
  { name: 'giphy', usage: '/giphy 키워드', description: '움짤 보내기', icon: '🎞️' },
  { name: 'shrug', usage: '/shrug 메시지', description: '¯\\_(ツ)_/¯ 붙이기', icon: '🤷' },
  { name: 'status', usage: '/status 🎯 집중 근무 중', description: '내 상태 설정 (비우면 해제)', icon: '💬' },
  { name: 'away', usage: '/away', description: '자리 비움 상태 전환', icon: '🌙' },
  { name: 'topic', usage: '/topic 새 주제', description: '채널 주제 변경', icon: '🏷️' },
  { name: 'invite', usage: '/invite @이름', description: '채널에 멤버 초대', icon: '➕' },
]

/** call.startedAt → huddle message id, so leaving a call closes exactly the right card */
const liveHuddles = new Map<string, string>()

function liveHuddleIn(channelId: string) {
  return [...useMessenger.getState().messages].reverse().find((m) => m.channelId === channelId && m.kind === 'huddle' && !(m.meta as unknown as HuddleMeta).endedAt)
}

export function startHuddle(channelId: string, video = false) {
  const ch = getChannel(channelId)
  if (!ch) return
  const existing = liveHuddleIn(channelId)
  if (existing) return joinHuddle(existing.id, video)
  const me = getCurrentUserId()
  const users = useCore.getState().users
  // real people who are online get a ringing invite (CallOverlay); simulated teammates "join" on their own
  const present = (id: string) => {
    const u = users.find((x) => x.id === id)
    return !!u && livePresence(u) !== 'offline'
  }
  const others = ch.memberIds.filter((id) => id !== me && id !== 'u_bot' && (isUserOnline(id) || present(id)))
  const real = others.filter((id) => isUserOnline(id))
  const participants = [me, ...real, ...others.filter((id) => !real.includes(id)).slice(0, Math.max(0, 5 - real.length))]
  const title = `${channelLabel(ch)} ${video ? '화상 회의' : '허들'}`
  // real invitees are added to the card when they actually join (joinHuddle)
  const meta: HuddleMeta = { startedAt: new Date().toISOString(), participantIds: participants.filter((id) => !real.includes(id)) }
  const msg = useMessenger.getState().sendMessage({ channelId, text: video ? '화상 회의' : '허들', kind: 'huddle', meta: meta as unknown as Record<string, unknown> })
  setNextCallId(msg.id)
  useUI.getState().startCall({ title, participantIds: participants, video, channelId })
  const call = useUI.getState().call
  if (call) liveHuddles.set(call.startedAt, msg.id)
}

/** Join an already-running huddle card (the call id is the card's message id, shared by everyone in it). */
export function joinHuddle(messageId: string, video = false) {
  const m = useMessenger.getState().messages.find((x) => x.id === messageId)
  const ch = m && getChannel(m.channelId)
  if (!m || !ch) return
  const meta = m.meta as unknown as HuddleMeta
  const me = getCurrentUserId()
  const participants = Array.from(new Set([me, ...meta.participantIds]))
  setNextCallId(m.id, true)
  useUI.getState().startCall({ title: `${channelLabel(ch)} ${video ? '화상 회의' : '허들'}`, participantIds: participants, video, channelId: ch.id })
  useMessenger.getState().updateMeta(m.id, { participantIds: participants })
  const call = useUI.getState().call
  if (call) liveHuddles.set(call.startedAt, m.id)
}

/** Is this message a huddle card that's still running? */
export function isLiveHuddle(messageId: string) {
  const m = useMessenger.getState().messages.find((x) => x.id === messageId)
  return !!m && m.kind === 'huddle' && !(m.meta as unknown as HuddleMeta).endedAt
}

/**
 * Close the huddle card that belongs to a call (called by CallOverlay when the call ends).
 * `othersRemain` → real people are still talking: the huddle stays live, only our seat is freed.
 */
export function endHuddle(startedAt: string, participantIds: string[], othersRemain = false) {
  const id = liveHuddles.get(startedAt)
  if (!id) return
  liveHuddles.delete(startedAt)
  // switching audio ↔ video re-starts the call on the same card: keep it live
  const cur = useUI.getState().call
  if (cur && liveHuddles.get(cur.startedAt) === id) return
  const s = useMessenger.getState()
  const m = s.messages.find((x) => x.id === id)
  if (!m) return
  const meta = m.meta as unknown as HuddleMeta
  if (othersRemain) {
    s.updateMeta(id, { participantIds: Array.from(new Set([...meta.participantIds, ...participantIds])) })
    return
  }
  const begun = meta.startedAt ?? startedAt
  const durationSec = Math.max(1, Math.round((Date.now() - new Date(begun).getTime()) / 1000))
  s.updateMeta(id, { endedAt: new Date().toISOString(), durationSec, participantIds: Array.from(new Set([...meta.participantIds, ...participantIds])) })
}

/**
 * On boot no call is active in this browser, so "live" huddle cards whose participants are all gone are
 * stale (left over from a closed tab). Cards with a real participant still online are left alone.
 */
export function closeStaleHuddles() {
  const s = useMessenger.getState()
  const me = getCurrentUserId()
  const current = useUI.getState().call
  for (const m of s.messages) {
    const meta = m.meta as unknown as HuddleMeta | undefined
    if (m.kind !== 'huddle' || !meta || meta.endedAt) continue
    if (current?.channelId === m.channelId) continue
    if (meta.participantIds.some((id) => id !== me && isUserOnline(id))) continue
    s.updateMeta(m.id, { endedAt: new Date().toISOString(), durationSec: Math.max(60, Math.round((Date.now() - new Date(meta.startedAt).getTime()) / 1000) % 5400) })
  }
}

const GIF_FALLBACK = ['🎉', '😂', '🔥', '🚀', '🐱', '🙌', '💃', '🦄']

function parseDuration(text: string): { ms: number; rest: string } {
  const re = /(\d+)\s*(초|분|시간|s|m|h)\s*(후에|후|뒤에|뒤)?/
  const m = re.exec(text)
  if (!m) return { ms: 60_000, rest: text.trim() }
  const n = Number(m[1])
  const unit = m[2]
  const ms = unit === '초' || unit === 's' ? n * 1000 : unit === '시간' || unit === 'h' ? n * 3_600_000 : n * 60_000
  const rest = text.replace(m[0], '').replace(/^\s*(에|in)\s+/, '').trim()
  return { ms, rest }
}

/**
 * Executes a slash command. Returns true if the input was handled (composer should clear).
 */
export function runSlashCommand(raw: string, channelId: string, threadId?: string): boolean {
  const m = /^\/(\w+)\s*([\s\S]*)$/.exec(raw.trim())
  if (!m) return false
  const cmd = m[1].toLowerCase()
  const rest = m[2].trim()
  const store = useMessenger.getState()
  const me = getCurrentUserId()
  const post = (text: string, extra: Partial<Parameters<typeof store.sendMessage>[0]> = {}) => {
    const msg = store.sendMessage({ channelId, threadId, text, ...extra })
    return msg
  }

  switch (cmd) {
    case 'poll': {
      const parts = rest.split('|').map((p) => p.trim()).filter(Boolean)
      if (parts.length < 3) {
        toast('투표에는 질문과 2개 이상의 옵션이 필요해요', { variant: 'warning', emoji: '📊', description: '예: /poll 점심 뭐 먹지? | 김치찌개 | 파스타' })
        return false
      }
      const meta: PollMeta = { question: parts[0], options: parts.slice(1, 9).map((label, i) => ({ id: `o${i + 1}`, label, voterIds: [] })) }
      const msg = post('', { kind: 'poll', meta: meta as unknown as Record<string, unknown> })
      // teammates trickle in votes
      const ch = getChannel(channelId)
      // simulated teammates trickle in votes (real people vote themselves)
      const voters = (ch?.memberIds ?? []).filter(canSimulate).sort(() => Math.random() - 0.5).slice(0, 5)
      voters.forEach((v, i) =>
        setTimeout(() => {
          if (!canSimulate(v)) return
          const cur = useMessenger.getState().messages.find((x) => x.id === msg.id)
          const opts = (cur?.meta as unknown as PollMeta | undefined)?.options
          if (!opts || opts.some((o) => o.voterIds.includes(v))) return
          useMessenger.getState().votePoll(msg.id, pick(opts).id, v)
        }, 2500 + i * 1800 + Math.random() * 1500),
      )
      return true
    }
    case 'task': {
      if (!rest) {
        toast('태스크 제목을 입력해주세요', { variant: 'warning', emoji: '✅', description: '예: /task 온보딩 카피 검토' })
        return false
      }
      const mentioned = useCore.getState().users.find((u) => rest.includes(`@${u.name}`))
      const title = mentioned ? rest.replace(`@${mentioned.name}`, '').trim() : rest
      const meta: TaskMeta = { title, done: false, assigneeId: mentioned?.id ?? me, due: daysFromNow(3, 18), key: `NX-${160 + Math.floor(Math.random() * 80)}` }
      const taskMsg = post('태스크를 만들었습니다', { kind: 'task', meta: meta as unknown as Record<string, unknown> })
      toast('태스크가 생성되었습니다', { emoji: '✅', variant: 'success', description: title })
      if (mentioned && mentioned.id !== me && mentioned.id !== 'u_bot') {
        notifyUser(mentioned.id, { type: 'task', title: `${getUser(me)?.name ?? '동료'}님이 태스크를 배정했습니다`, body: title, link: channelPath(channelId, { message: taskMsg.id }), actorId: me })
      }
      return true
    }
    case 'remind': {
      const { ms, rest: what } = parseDuration(rest)
      const text = what || '리마인더'
      scheduleReminder(text, ms)
      const mins = Math.round(ms / 60000)
      toast('리마인더를 설정했어요', { emoji: '⏰', variant: 'success', description: `${ms < 60000 ? `${Math.round(ms / 1000)}초` : mins >= 60 ? `${Math.round(mins / 60)}시간` : `${mins}분`} 후 "${text}" 알림` })
      return true
    }
    case 'huddle': {
      startHuddle(channelId, false)
      return true
    }
    case 'giphy': {
      const q = rest || '축하'
      const emoji = searchEmoji(q)[0]?.e ?? pick(GIF_FALLBACK)
      const card: BotCard = { card: 'gif', query: q, emoji }
      const msg = post(`/giphy ${q}`, { meta: card as unknown as Record<string, unknown> })
      respondTo(msg)
      return true
    }
    case 'shrug': {
      const msg = post(`${rest} ¯\\\\_(ツ)_/¯`.trim())
      respondTo(msg)
      return true
    }
    case 'status': {
      const em = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u.exec(rest)
      if (!rest) {
        useCore.getState().setStatus(undefined, undefined)
        toast('상태를 지웠어요', { emoji: '🧹' })
      } else {
        useCore.getState().setStatus(em ? em[1] : '💬', em ? em[2] : rest)
        toast('상태를 업데이트했어요', { emoji: em ? em[1] : '💬', description: em ? em[2] : rest })
      }
      return true
    }
    case 'away': {
      const cur = getUser(me)?.presence
      const next = cur === 'away' ? 'online' : 'away'
      useCore.getState().setPresence(next)
      toast(next === 'away' ? '자리 비움으로 설정했어요' : '다시 온라인 상태예요', { emoji: next === 'away' ? '🌙' : '🟢' })
      return true
    }
    case 'topic': {
      store.setTopic(channelId, rest)
      return true
    }
    case 'invite': {
      const users = useCore.getState().users.filter((u) => rest.includes(`@${u.name}`))
      if (!users.length) {
        toast('초대할 사람을 @멘션해주세요', { variant: 'warning', emoji: '➕' })
        return false
      }
      store.addMembers(channelId, users.map((u) => u.id))
      return true
    }
    default:
      toast(`알 수 없는 명령어: /${cmd}`, { variant: 'warning', emoji: '🤔', description: '/ 를 입력하면 사용 가능한 명령어를 볼 수 있어요' })
      return false
  }
}
