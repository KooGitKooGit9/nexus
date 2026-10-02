import { useEffect } from 'react'
import { getCurrentUserId, getUser, notify, toast, useCore } from '@/store/core'
import { pick } from '@/lib/utils'
import { isSyncLeader, isUserOnline } from '@/lib/sync'
import { livePresence } from '@/components/ui/Avatar'
import { useMessenger } from './store'
import { getChannel, isDirect, useChatUI } from './lib'
import type { BotCard, Channel, Message } from './types'
import { plan, typingMsFor, type Convo, type ReplyStep, type SimChannel, type SimUser, type Step } from './sim/engine'
import { notifyRecipients } from './notifications'
import { emitSimTyping, startRealtime } from './realtime'
import { personaAvailable, personaReply, type PersonaResult } from './persona'
import { classify } from './sim/classify'
import { CHANNEL_AMBIENT, DM_AMBIENT, DM_GENERIC, GENERIC_AMBIENT, MENTION_AMBIENT, type AmbientLine } from './sim/ambient'
import { fillTemplate, shortName } from './sim/text'

/*
 * Runtime glue for simulated teammates. All "what to say" logic lives in ./sim (pure, unit-testable);
 * this file only reads the stores, schedules typing indicators / posts, and sends notifications.
 */

const BOT = 'u_bot'
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/* ───────────── Conversation memory (per channel / thread, in-memory) ───────────── */

const convos = new Map<string, Convo>()
/** bumps whenever the current user posts again in a conversation, so stale follow-ups can bail out */
const generation = new Map<string, number>()
const recentLines: string[] = []
function remember(line: string) {
  recentLines.push(line)
  if (recentLines.length > 80) recentLines.splice(0, recentLines.length - 80)
}

function simUsers(): SimUser[] {
  return useCore.getState().users.map((u) => ({ id: u.id, name: u.name, presence: livePresence(u) }))
}
function simChannel(ch: Channel, exclude: string[] = []): SimChannel {
  return { id: ch.id, kind: ch.kind, memberIds: ch.memberIds.filter((id) => !exclude.includes(id)) }
}
/**
 * May this browser speak for `id`? Never for yourself, the bot (it has its own code paths) or a real
 * person who is logged in right now — they answer for themselves.
 */
export function canSimulate(id: string) {
  return id !== getCurrentUserId() && id !== BOT && !isUserOnline(id)
}
function isAvailable(id: string) {
  const u = getUser(id)
  const p = u ? livePresence(u) : 'offline'
  return (p === 'online' || p === 'away') && canSimulate(id)
}

/** Texts recently said in this conversation (persisted history + this session), to avoid repeats. */
function recentFor(channelId: string) {
  const msgs = useMessenger.getState().messages
  const texts: string[] = []
  for (let i = msgs.length - 1; i >= 0 && texts.length < 60; i--) if (msgs[i].channelId === channelId && msgs[i].text) texts.push(msgs[i].text)
  return [...recentLines, ...texts]
}

function alive(id: string) {
  const m = useMessenger.getState().messages.find((x) => x.id === id)
  return !!m && !m.deleted
}

/** Add (never toggle off) a teammate's reaction. */
function addReaction(messageId: string, emoji: string, userId: string) {
  const m = useMessenger.getState().messages.find((x) => x.id === messageId)
  if (!m || m.deleted || m.reactions[emoji]?.includes(userId)) return
  useMessenger.getState().toggleReaction(messageId, emoji, userId)
}

function setSimTyping(key: string, userId: string, on: boolean, channelId: string, threadId?: string) {
  useChatUI.getState().setTyping(key, userId, on)
  emitSimTyping(userId, channelId, threadId, on)
}

/** Post as a simulated teammate (+ bell notifications for whoever it concerns). */
function postAs(userId: string, input: { channelId: string; text: string; threadId?: string }) {
  const msg = useMessenger.getState().sendMessage({ channelId: input.channelId, userId, text: input.text, threadId: input.threadId })
  remember(input.text)
  notifyRecipients(msg, { simulated: true })
  return msg
}

/** Show "typing…" for a duration proportional to the text, then post it. Returns the posted message. */
async function typeAndPost(key: string, userId: string, input: { channelId: string; text: string; threadId?: string }, alreadyTypedMs = 0) {
  setSimTyping(key, userId, true, input.channelId, input.threadId)
  await wait(Math.max(350, typingMsFor(input.text) - alreadyTypedMs))
  setSimTyping(key, userId, false, input.channelId, input.threadId)
  return postAs(userId, input)
}

/** Split a model reply into chat bubbles (max 3). */
function bubblesOf(text: string) {
  return text.split(/\n+/).map((t) => t.trim()).filter(Boolean).slice(0, 3)
}

/**
 * Execute a reply plan: reactions on their own timers, replies one after another with typing indicators.
 * With `ai`, each reply's *text* comes from Gemini (persona of the replier, conversation as context);
 * the rule-based bubbles are the fallback when the model is unavailable / slow / errors.
 */
function runSteps(steps: Step[], target: Message, key: string, opts: { gen?: number; ai?: boolean } = {}) {
  for (const s of steps) {
    if (s.type === 'react') setTimeout(() => canSimulate(s.userId) && addReaction(target.id, s.emoji, s.userId), s.atMs)
  }
  const replies = steps.filter((s): s is ReplyStep => s.type === 'reply')
  if (!replies.length) return
  void (async () => {
    let aiReplies = 0
    for (let i = 0; i < replies.length; i++) {
      const r = replies[i]
      if (i > 0 && opts.gen != null && generation.get(key) !== opts.gen) return
      // ask the model right away (it runs while the teammate is "reading"); later replies see earlier ones
      const useAI = !!opts.ai && aiReplies < 2 && personaAvailable()
      const aiP: Promise<PersonaResult | null> = useAI ? personaReply(r.userId, target) : Promise.resolve(null)
      if (useAI) aiReplies++
      await wait(r.readMs)
      // the user moved the conversation on: later voices drop out (the first answer still lands)
      if (i > 0 && opts.gen != null && generation.get(key) !== opts.gen) return
      if (!alive(target.id) || !getChannel(target.channelId)) return
      // they may have logged in meanwhile — then they answer themselves
      if (!canSimulate(r.userId)) continue

      let bubbles = r.bubbles
      let typedMs = 0
      if (useAI) {
        const t0 = Date.now()
        setSimTyping(key, r.userId, true, target.channelId, target.threadId)
        const res = await aiP
        typedMs = Date.now() - t0
        if (res) {
          if (res.reaction) addReaction(target.id, res.reaction, r.userId)
          bubbles = res.reply ? bubblesOf(res.reply) : []
        }
        if (!bubbles.length) setSimTyping(key, r.userId, false, target.channelId, target.threadId)
      }
      for (let b = 0; b < bubbles.length; b++) {
        if (!canSimulate(r.userId)) break
        await typeAndPost(key, r.userId, { channelId: target.channelId, text: bubbles[b], threadId: target.threadId }, b === 0 ? typedMs : 0)
        if (b < bubbles.length - 1) await wait(rand(350, 900))
      }
    }
  })().catch(() => {
    /* never surface simulator errors */
  })
}

/* ───────────── Replies to the current user ───────────── */

/**
 * Called by the client that just sent a message as the current user: notifies the people it concerns
 * (DM / @mention / thread), then simulated teammates react / reply in context. Real people who are
 * online never get a simulated reply — they answer for themselves. Only this client runs the replies,
 * so there are no duplicates across browsers.
 */
export function respondTo(msg: Message) {
  const ch = getChannel(msg.channelId)
  const me = getCurrentUserId()
  if (!ch || msg.userId !== me || msg.userId === BOT) return
  notifyRecipients(msg)
  if (ch.isApp || ch.archived) return
  if (msg.kind === 'system' || msg.kind === 'huddle' || msg.kind === 'event') return
  const others = ch.memberIds.filter(canSimulate)
  if (!others.length) return

  // cards: a couple of reactions / votes are enough
  const card = (msg.meta as { card?: string } | undefined)?.card
  if (card === 'gif' || msg.kind === 'poll' || msg.kind === 'task') {
    const reactors = others.filter(isAvailable).sort(() => Math.random() - 0.5).slice(0, isDirect(ch) ? 1 : 2)
    const emojis = card === 'gif' ? ['😂', '🤣', '🔥', '👍'] : msg.kind === 'task' ? ['👍', '✅', '👀'] : ['🗳️', '👍']
    reactors.forEach((uid, i) => setTimeout(() => addReaction(msg.id, pick(emojis), uid), 1200 + i * 1400 + Math.random() * 1200))
    return
  }

  const images = msg.attachments?.some((a) => a.mime.startsWith('image/'))
  const text = msg.text.trim() || (msg.attachments?.length ? (images ? '이미지 공유드려요' : '파일 공유드려요') : '')
  if (!text) return

  const key = msg.threadId ? `thread:${msg.threadId}` : ch.id
  const gen = (generation.get(key) ?? 0) + 1
  generation.set(key, gen)

  let threadParticipants: string[] | undefined
  if (msg.threadId) {
    const all = useMessenger.getState().messages
    const root = all.find((m) => m.id === msg.threadId)
    threadParticipants = Array.from(new Set([root?.userId, ...all.filter((m) => m.threadId === msg.threadId).map((m) => m.userId)].filter((x): x is string => !!x && x !== BOT && (x === me || canSimulate(x)))))
  }

  const realOnline = ch.memberIds.filter((id) => id !== me && id !== BOT && !canSimulate(id))
  const p = plan({
    text,
    authorId: me,
    channel: simChannel(ch, realOnline),
    users: simUsers(),
    threadParticipants,
    convo: convos.get(key),
    recent: recentFor(ch.id),
  })
  convos.set(key, p.convo)
  p.templates.forEach(remember)
  const steps = p.steps.filter((s) => canSimulate(s.userId))
  // 1:1 DM with a simulated teammate: they always get the chance to answer what was actually said
  // (Gemini decides between a reply and just a reaction)
  if (ch.kind === 'dm' && personaAvailable() && !steps.some((s) => s.type === 'reply')) {
    const other = others[0]
    if (other && isAvailable(other)) steps.push({ type: 'reply', userId: other, bubbles: [], readMs: rand(1200, 3500), slot: 'ai' })
  }
  runSteps(steps, msg, key, { gen, ai: true })
}

/* ───────────── Ambient chatter ───────────── */

const ambientUsed: string[] = []
function noteAmbient(t: string) {
  ambientUsed.push(t)
  if (ambientUsed.length > 60) ambientUsed.splice(0, ambientUsed.length - 60)
}

function pickFresh<T>(items: T[], textOf: (x: T) => string, avoid: string[]): T | undefined {
  const fresh = items.filter((x) => !avoid.includes(textOf(x)) && !ambientUsed.includes(textOf(x)))
  const pool = fresh.length ? fresh : []
  return pool.length ? pick(pool) : undefined
}

function seedConvo(key: string, text: string, author: string) {
  const now = Date.now()
  convos.set(key, { topic: classify(text).topic, at: now, tags: [], repliers: [author], lastReplier: author, lastFirst: author, pendingAsk: { userId: author, at: now } })
}

async function botEvent() {
  const me = getCurrentUserId()
  const store = useMessenger.getState()
  const eng = store.channels.find((c) => c.id === 'c_engineering' && c.memberIds.includes(me))
  if (!eng) return false
  const card: BotCard =
    Math.random() < 0.5
      ? { card: 'deploy', service: pick(['web-app', 'api-gateway', 'search-indexer', 'payments-api']), env: pick(['staging', 'production']), version: `v${3 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 9)}`, status: 'success', durationSec: Math.floor(rand(120, 420)), commit: Math.random().toString(16).slice(2, 9) }
      : { card: 'pr', repo: 'aurora/nexus-web', number: 486 + Math.floor(Math.random() * 40), title: pick(['feat: 알림 설정 페이지 개선', 'fix: 다크모드 대비 이슈', 'perf: 리스트 가상화 적용', 'chore: 의존성 업데이트']), branch: pick(['feat/notification-settings', 'fix/dark-contrast', 'perf/virtual-list', 'chore/deps']), additions: Math.floor(rand(20, 900)), deletions: Math.floor(rand(5, 300)), status: 'review', authorId: pick(['u_fe', 'u_be', 'u_ml']), checks: 'passing' }
  store.sendMessage({ channelId: eng.id, userId: BOT, text: card.card === 'deploy' ? '🚀 배포가 완료되었습니다' : '🔀 새 Pull Request가 열렸습니다', meta: card as unknown as Record<string, unknown> })
  return true
}

async function ambientTick() {
  const me = getCurrentUserId()
  const meName = getUser(me)?.name ?? ''
  const store = useMessenger.getState()
  const live = (c: Channel) => !c.isApp && !c.archived && c.memberIds.includes(me) && c.memberIds.some((id) => id !== me && id !== BOT && isAvailable(id))
  const channels = store.channels.filter((c) => live(c) && !isDirect(c))
  const directs = store.channels.filter((c) => live(c) && isDirect(c))

  if (Math.random() < 0.12 && (await botEvent())) return

  const useDM = directs.length > 0 && (Math.random() < 0.2 || !channels.length)
  const ch = useDM ? pick(directs) : pick(channels)
  if (!ch) return
  const avoid = recentFor(ch.id)
  const avail = ch.memberIds.filter((id) => id !== me && id !== BOT && isAvailable(id))
  if (!avail.length) return

  let author: string
  let text: string
  let mention = false
  let picked: AmbientLine | undefined
  if (isDirect(ch)) {
    author = pick(avail)
    const own = (DM_AMBIENT[author] ?? []).map((t) => fillTemplate(t, { me: shortName(meName) }))
    const generic = DM_GENERIC.map((t) => fillTemplate(t, { me: shortName(meName) }))
    const line = pickFresh(own, (x) => x, avoid) ?? pickFresh(generic, (x) => x, avoid)
    if (!line) return
    text = line
  } else if (Math.random() < 0.15) {
    mention = true
    author = pick(avail)
    const line = pickFresh(MENTION_AMBIENT.map((t) => fillTemplate(t, { name: meName })), (x) => x, avoid)
    if (!line) return
    text = line
  } else {
    const lines = (CHANNEL_AMBIENT[ch.id] ?? GENERIC_AMBIENT).filter((l) => !l.who || l.who.some((id) => avail.includes(id)))
    const line = pickFresh(lines, (l) => l.t, avoid)
    if (!line) return
    picked = line
    const speakers = line.who ? line.who.filter((id) => avail.includes(id)) : avail
    author = pick(speakers)
    text = line.t
  }
  noteAmbient(text)

  const posted = await typeAndPost(ch.id, author, { channelId: ch.id, text })

  // direct asks to the user: remember who's waiting, so the user's short answer goes back to them
  if (isDirect(ch) || mention) {
    seedConvo(ch.id, text, author)
    return
  }
  if (picked) followUpAmbient(ch, posted, picked, author)
}

/**
 * Teammates react to / answer a background post — only with hand-written replies that fit it
 * (an improvised reply to chatter is the easiest place to sound like a bot).
 */
function followUpAmbient(ch: Channel, posted: Message, line: AmbientLine, author: string) {
  const me = getCurrentUserId()
  const others = ch.memberIds.filter((id) => id !== me && id !== author && id !== BOT && isAvailable(id))
  if (!others.length) return
  const steps: Step[] = []
  const asks = /\?\s*\S{0,3}$/.test(line.t)
  const options = (line.replies ?? []).map((r) => ({ t: r.t, who: (r.who ?? others).filter((id) => others.includes(id)) })).filter((r) => r.who.length && !ambientUsed.includes(r.t))
  const replyCount = !options.length ? 0 : Math.random() < (asks ? 0.9 : 0.45) ? (options.length > 1 && Math.random() < 0.3 ? 2 : 1) : 0
  const used: string[] = []
  for (const o of options.sort(() => Math.random() - 0.5)) {
    if (steps.length >= replyCount) break
    const uid = pick(o.who.filter((id) => !used.includes(id)))
    if (!uid) continue
    used.push(uid)
    noteAmbient(o.t)
    steps.push({ type: 'reply', userId: uid, bubbles: [o.t], readMs: (steps.length ? 1500 : 4000) + Math.random() * 4000, slot: 'ambient' })
  }
  // a couple of fitting reactions from people who didn't reply
  if (line.react?.length) {
    const reactors = others.filter((id) => !used.includes(id)).sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3))
    let first: string | undefined
    reactors.forEach((uid, i) => {
      const emoji = first && Math.random() < 0.6 ? first : pick(line.react!)
      first = first ?? emoji
      steps.push({ type: 'react', userId: uid, emoji, atMs: 2500 + i * 1800 + Math.random() * 2500 })
    })
  }
  // the user may jump in next — their reply continues this post's topic
  seedConvo(ch.id, line.t, author)
  if (steps.length) runSteps(steps, posted, ch.id)
}

/* ───────────── Reminders ───────────── */

/** The current user's own "Nexus Bot" app conversation (created on demand for members other than the seed user). */
export function botChannelFor(me = getCurrentUserId()) {
  const s = useMessenger.getState()
  const own = s.channels.find((c) => c.isApp && c.name === 'Nexus Bot' && c.memberIds.includes(me))
  if (own) return own.id
  const id = me === 'u_me' ? 'a_nexusbot' : `a_nexusbot_${me}`
  const existing = s.channels.find((c) => c.id === id)
  if (existing) {
    s.updateChannel(id, { memberIds: Array.from(new Set([...existing.memberIds, me, BOT])) })
  } else {
    const ch: Channel = { id, name: 'Nexus Bot', kind: 'dm', isApp: true, emoji: '🤖', memberIds: [me, BOT], createdBy: BOT, createdAt: new Date().toISOString(), description: '리마인더, 일정 요약, 워크스페이스 알림' }
    useMessenger.setState((st) => ({ channels: [...st.channels, ch] }))
  }
  return id
}

export function scheduleReminder(text: string, ms: number) {
  const at = new Date(Date.now() + ms).toISOString()
  const me = getCurrentUserId()
  setTimeout(() => {
    // the user may have switched accounts in this tab meanwhile — the reminder is still theirs
    if (getCurrentUserId() !== me) return
    const channelId = botChannelFor(me)
    const card: BotCard = { card: 'reminder', text, at }
    const m = useMessenger.getState().sendMessage({ channelId, userId: BOT, text: `⏰ 리마인더: ${text}`, meta: card as unknown as Record<string, unknown> })
    notify({ type: 'system', title: '⏰ 리마인더', body: text, link: `/messages/${channelId}?m=${m.id}`, actorId: BOT })
  }, ms)
  return at
}

/* ───────────── Singleton bootstrap ───────────── */

let started = false

export function startSimulator() {
  if (started || typeof window === 'undefined') return
  started = true
  startRealtime()

  // scheduled messages are per-user state: they're released by the scheduling user's own client
  setInterval(() => {
    const sent = useMessenger.getState().releaseDue()
    if (sent.length > 0) {
      toast('예약 메시지가 전송되었습니다', { emoji: '📨', variant: 'success' })
      sent.forEach(respondTo)
    }
  }, 5000)

  // ambient teammate activity every ~50–100s — workspace-wide, so only on the sync leader (one browser)
  const loop = () => {
    setTimeout(async () => {
      if (document.visibilityState === 'visible' && isSyncLeader()) {
        try {
          await ambientTick()
        } catch {
          /* never break the loop */
        }
      }
      loop()
    }, rand(50_000, 100_000))
  }
  loop()
}

/** Mount once (globally) — StrictMode-safe thanks to the module-level guard. */
export function useMessengerSimulator() {
  useEffect(() => {
    startSimulator()
  }, [])
}
