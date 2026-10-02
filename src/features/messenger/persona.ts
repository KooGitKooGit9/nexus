/*
 * Gemini-backed persona replies for simulated teammates.
 *
 * `personaReply()` asks the server's Gemini proxy (`POST /api/ai/generate`) to answer *as* a given
 * workspace member, with the last ~15 messages of the conversation as context. It resolves to
 * `null` whenever the model can't be used (no key, offline, error, 8s timeout, rate limit) so the
 * caller falls back to the rule-based engine in ./sim.
 */
import { useSyncStatus } from '@/lib/sync'
import { getUser } from '@/store/core'
import type { User } from '@/store/types'
import { useMessenger } from './store'
import { getChannel, isDirect } from './lib'
import type { Channel, Message, PollMeta } from './types'

export interface PersonaResult {
  reply?: string
  reaction?: string
}

const TIMEOUT_MS = 8000
const HISTORY = 15

/* ───────────── rate limiting ───────────── */

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 12
const MAX_INFLIGHT = 3
const calls: number[] = []
let inflight = 0
/** after a NO_KEY / auth error, stop trying for a while instead of hammering the proxy */
let disabledUntil = 0

function takeSlot(): boolean {
  const now = Date.now()
  if (now < disabledUntil) return false
  while (calls.length && now - calls[0] > WINDOW_MS) calls.shift()
  if (calls.length >= MAX_PER_WINDOW || inflight >= MAX_INFLIGHT) return false
  calls.push(now)
  return true
}

/** Whether it's worth trying Gemini at all right now. */
export function personaAvailable() {
  const s = useSyncStatus.getState()
  return s.mode === 'server' && s.aiEnabled && Date.now() >= disabledUntil
}

/* ───────────── prompt ───────────── */

function describe(u: User) {
  const lines = [
    `이름: ${u.name} (${u.nameEn})`,
    `직책/부서: ${u.title} · ${u.department}`,
    u.bio ? `소개: ${u.bio}` : '',
    u.skills?.length ? `전문 분야: ${u.skills.join(', ')}` : '',
    u.statusText ? `현재 상태 메시지: ${u.statusEmoji ?? ''} ${u.statusText}`.trim() : '',
    `근무지: ${u.location}`,
  ]
  return lines.filter(Boolean).join('\n')
}

function systemPrompt(speaker: User) {
  return [
    `너는 스타트업 오로라랩스(Aurora Labs)에서 일하는 실제 직원 "${speaker.name}"이다. 사내 메신저 Nexus에서 동료와 채팅 중이다.`,
    '',
    '[내 프로필]',
    describe(speaker),
    '',
    '[말투 규칙]',
    '- 자연스러운 한국어 직장 메신저 말투. 기본은 부드러운 존댓말(~요). 실제 사람처럼 짧게: 보통 1문장, 길어도 2문장.',
    '- 방금 받은 메시지에 직접, 구체적으로 답한다. 제안이면 수락/거절과 시간·장소 같은 디테일을 자연스럽게 덧붙인다.',
    '- 내 직무에 맞는 지식으로 답하고, 모르는 사실(숫자, 일정, 결정)은 지어내지 말고 "확인해보고 알려드릴게요"처럼 답한다.',
    '- 이모지는 가끔, 최대 1개. 마크다운·따옴표·이름표("김하늘:")·해시태그 금지. AI라는 사실을 절대 드러내지 않는다.',
    '- 대화 기록에 이미 한 말을 반복하지 않는다.',
    '- 말이 굳이 필요 없는 메시지(단순 공지, 감사 인사, 사진 공유 등)에는 답장 대신 이모지 반응 하나만 할 수 있다.',
    '',
    '[출력 형식] JSON 하나만 출력: {"reply": "보낼 메시지"} 또는 {"reaction": "👍"} (둘 다 가능).',
  ].join('\n')
}

function lineFor(m: Message, speakerId: string) {
  const name = m.userId === 'u_bot' ? 'Nexus Bot' : getUser(m.userId)?.name ?? '알 수 없음'
  const who = m.userId === speakerId ? `${name}(나)` : name
  let text = m.text?.trim() ?? ''
  if (m.kind === 'poll') {
    const meta = m.meta as unknown as PollMeta | undefined
    if (meta) text = `[투표] ${meta.question} — ${meta.options.map((o) => o.label).join(' / ')}`
  }
  if (m.attachments?.length) text += ` [첨부: ${m.attachments.map((a) => a.name).join(', ')}]`
  if (m.deleted) text = '(삭제된 메시지)'
  return `${who}: ${text.replace(/\s+/g, ' ').slice(0, 400)}`
}

function placeOf(ch: Channel, speakerId: string) {
  if (isDirect(ch)) {
    const others = ch.memberIds.filter((id) => id !== speakerId).map((id) => getUser(id)?.name ?? '')
    return ch.kind === 'dm' ? `${others[0]}님과의 1:1 DM` : `그룹 DM (${others.join(', ')})`
  }
  return `#${ch.name} 채널${ch.topic ? ` (주제: ${ch.topic})` : ''}${ch.description ? ` — ${ch.description}` : ''}`
}

function buildRequest(speakerId: string, trigger: Message) {
  const speaker = getUser(speakerId)
  const ch = getChannel(trigger.channelId)
  if (!speaker || !ch) return null
  const all = useMessenger.getState().messages
  // the conversation the reply goes into: the thread, or the channel timeline
  const convo = all
    .filter((m) => m.channelId === ch.id && m.kind !== 'system' && (trigger.threadId ? m.id === trigger.threadId || m.threadId === trigger.threadId : !m.threadId || m.alsoInChannel))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  const upTo = convo.findIndex((m) => m.id === trigger.id)
  const history = (upTo >= 0 ? convo.slice(0, upTo) : convo.filter((m) => m.id !== trigger.id)).slice(-HISTORY)
  // anything posted after the trigger (e.g. a colleague already answered) is context too
  const after = upTo >= 0 ? convo.slice(upTo + 1).slice(-5) : []
  const asker = getUser(trigger.userId)

  const user = [
    `[대화 장소] ${placeOf(ch, speakerId)}${trigger.threadId ? ' · 스레드 안' : ''}`,
    '',
    '[최근 대화]',
    history.length ? history.map((m) => lineFor(m, speakerId)).join('\n') : '(이전 대화 없음)',
    '',
    `[방금 ${asker?.name ?? '동료'}(${asker?.title ?? ''})님이 보낸 메시지]`,
    lineFor(trigger, speakerId),
    ...(after.length ? ['', '[그 뒤에 올라온 메시지]', ...after.map((m) => lineFor(m, speakerId))] : []),
    '',
    `${speaker.name}로서 답하세요. JSON만 출력.`,
  ].join('\n')

  return {
    systemInstruction: { parts: [{ text: systemPrompt(speaker) }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { reply: { type: 'STRING' }, reaction: { type: 'STRING' } },
      },
    },
  }
}

/* ───────────── response parsing ───────────── */

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
}

const EMOJI_RE = /^\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u

export function parsePersona(raw: GeminiResponse, speakerName = ''): PersonaResult | null {
  const text = (raw.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim()
  if (!text) return null
  let obj: { reply?: unknown; reaction?: unknown } | null = null
  const fenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    obj = JSON.parse(fenced)
  } catch {
    const m = /\{[\s\S]*\}/.exec(fenced)
    if (m) try { obj = JSON.parse(m[0]) } catch { obj = null }
  }
  if (!obj || typeof obj !== 'object') {
    // We asked for JSON. Accept a plain-text answer only if it looks like a single short chat line —
    // never post something that echoes the prompt (context headers, transcripts, debug text).
    const looksLikePrompt = /\[(대화 장소|최근 대화|요청|페르소나)[^\]]*\]|mock/i.test(fenced)
    if (looksLikePrompt || fenced.length > 220 || /\n\s*\n/.test(fenced)) return null
    obj = { reply: fenced }
  }
  let reply = typeof obj.reply === 'string' ? obj.reply.trim() : ''
  // strip a leading "이름:" label and wrapping quotes the model sometimes adds
  if (speakerName) {
    const esc = speakerName.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')
    reply = reply.replace(new RegExp('^' + esc + '\\s*(\\(나\\))?\\s*[:：]\\s*'), '')
  }
  reply = reply.replace(/^["“'](.*)["”']$/s, '$1').trim()
  if (reply.length > 400) reply = reply.slice(0, 400).replace(/\s+\S*$/, '') + '…'
  const reaction = typeof obj.reaction === 'string' && EMOJI_RE.test(obj.reaction.trim()) ? obj.reaction.trim() : undefined
  if (!reply && !reaction) return null
  return { reply: reply || undefined, reaction }
}

/* ───────────── call ───────────── */

/**
 * Generate what `speakerId` would say in reply to `trigger`. Resolves `null` on any failure
 * (caller falls back to the rule-based engine). Never throws.
 */
export async function personaReply(speakerId: string, trigger: Message): Promise<PersonaResult | null> {
  if (!personaAvailable() || !takeSlot()) return null
  const body = buildRequest(speakerId, trigger)
  if (!body) return null
  inflight++
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!r.ok) {
      // missing key / bad key / quota: pause Gemini for a bit, the rule engine takes over
      if (r.status === 503 || r.status === 401 || r.status === 403) disabledUntil = Date.now() + 5 * 60_000
      else if (r.status === 429) disabledUntil = Date.now() + 60_000
      return null
    }
    const json = (await r.json()) as GeminiResponse
    return parsePersona(json, getUser(speakerId)?.name)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    inflight--
  }
}
