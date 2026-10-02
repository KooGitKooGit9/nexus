/* Reply planner: given a message + context, decide who answers what (pure — no store access). */
import { classify, type Act, type Intent, type Topic } from './classify'
import { ACT_BANK, ACT_REACTIONS, BANK, DINNERS, EN_BANK, EXPERTS, LATE_PREFIX, MENUS, MENU_RE, ROLES, SUBS, TOPIC_REACTIONS, type Line, type Role } from './bank'
import { fillTemplate, pickOne, shortName, shuffle } from './text'

export type Presence = 'online' | 'away' | 'dnd' | 'offline'
export interface SimUser {
  id: string
  name: string
  presence: Presence
}
export interface SimChannel {
  id: string
  kind: 'public' | 'private' | 'dm' | 'group'
  memberIds: string[]
}

/** Per-conversation memory (keyed by channel id or `thread:<rootId>`). */
export interface Convo {
  topic: Topic
  at: number
  /** things suggested so far (menus, places…) — last one is the "current" proposal */
  tags: string[]
  repliers: string[]
  lastReplier?: string
  /** who answered first last time (so the same person doesn't always lead) */
  lastFirst?: string
  lastSlot?: string
  /** a teammate asked the author something and is waiting for an answer */
  pendingAsk?: { userId: string; at: number }
}

export interface ReplyStep {
  type: 'reply'
  userId: string
  bubbles: string[]
  /** wait after the previous reply was posted (or after the trigger for the first one) */
  readMs: number
  slot: string
}
export interface ReactStep {
  type: 'react'
  userId: string
  emoji: string
  /** absolute delay from the trigger */
  atMs: number
}
export type Step = ReplyStep | ReactStep

export interface Plan {
  intent: Intent
  topic: Topic
  followup: boolean
  steps: Step[]
  convo: Convo
  /** raw templates used (feed back via `recent` so the same template isn't reused with a different filler) */
  templates: string[]
}

export interface PlanInput {
  text: string
  authorId: string
  channel: SimChannel
  users: SimUser[]
  /** ids of people already in this thread (root author first), when replying in a thread */
  threadParticipants?: string[]
  convo?: Convo
  now?: number
  /** lines used recently (avoid repeating) */
  recent?: string[]
  rnd?: () => number
}

const FOLLOWUP_MS = 5 * 60_000
const FOOD_FAMILY: Topic[] = ['food', 'coffee', 'dinner', 'snack']
const BOT = 'u_bot'
const SOCIAL_ACTS: Act[] = ['thanks', 'apology', 'greeting', 'laugh', 'tired', 'congrats', 'praise']

const roleOf = (id: string): Role[] => ROLES[id] ?? []
const available = (u?: SimUser) => !!u && (u.presence === 'online' || u.presence === 'away')

function daypart(now: number) {
  const h = new Date(now).getHours()
  if (h < 11) return '좋은 아침이에요'
  if (h < 17) return '좋은 오후예요'
  return '좋은 저녁이에요'
}

function extractTime(text: string): string | undefined {
  const m = /(오전|오후)?\s*(\d{1,2})\s*시(\s*(\d{1,2})\s*분|\s*반)?/.exec(text)
  if (m) return `${m[1] ? m[1] + ' ' : ''}${m[2]}시${m[3] ? m[3].replace(/\s+/g, '') : ''}`
  const c = /\b(\d{1,2}):(\d{2})\b/.exec(text)
  return c ? `${c[1]}:${c[2]}` : undefined
}

function extractTags(text: string): string[] {
  const out: string[] = []
  for (const [re, tag] of MENU_RE) if (re.test(text) && !out.includes(tag)) out.push(tag)
  return out
}

/** Every `{var}` in the line must be defined for it to be usable. */
function usable(t: string, vars: Record<string, string | undefined>) {
  const keys = [...t.matchAll(/\{(\w+)(?::[^}]+)?\}/g)].map((m) => m[1])
  return keys.every((k) => vars[k] != null && vars[k] !== '')
}

interface Chosen {
  text: string
  /** the unfilled template (so the same template isn't reused with different fillers) */
  tpl?: string
  tag?: string
}

function chooseLine(lines: Line[] | undefined, userId: string, vars: Record<string, string | undefined>, recent: string[], rnd: () => number, first = false, dm = false): Chosen | null {
  if (!lines?.length) return null
  const roles = roleOf(userId)
  const norm: Exclude<Line, string>[] = lines.map((l) => (typeof l === 'string' ? { t: l } : l))
  const ok = norm.filter(
    (l) =>
      (!l.r || l.r.some((r) => roles.includes(r))) &&
      (!l.who || l.who.includes(userId)) &&
      (!l.not || !l.not.includes(userId)) &&
      !(first && l.alt) &&
      // "저요 🙋" only makes sense in a room; "좋아요, 1층에서 봬요" only 1:1
      (!l.ctx || (l.ctx === 'dm') === dm) &&
      // nobody talks about themselves in the third person ("배수아님이 정리 중이실 거예요")
      !(vars.self && l.t.includes(`${vars.self}님`)) &&
      usable(l.t, vars),
  )
  if (!ok.length) return null
  // role-specific lines first (more "in character"), then avoid recently used
  const specific = ok.filter((l) => l.r || l.who || l.t.includes('{time}'))
  const pool0 = specific.length && rnd() < 0.75 ? specific : ok
  const fresh = pool0.filter((l) => !recent.includes(l.t) && !recent.includes(fillTemplate(l.t, { ...vars, tag: l.tag ?? vars.tag })))
  const pool = fresh.length ? fresh : pool0
  const l = pickOne(pool, rnd)
  return { text: fillTemplate(l.t, { ...vars, tag: l.tag ?? vars.tag }), tpl: l.t, tag: l.tag }
}

/** Ordered slot candidates for a message. */
function slotChain(topic: Topic, intent: Intent, followup: boolean, convo: Convo | undefined, recruit: boolean): string[] {
  const t = topic
  const a = intent.primary
  // sub-slots may have an act-specific variant, e.g. `meeting.notes.request` ("회의록 정리 부탁해요") vs `meeting.notes` ("회의록 공유드려요")
  const subs = (SUBS[t] ?? [])
    .filter(([s, re]) => re.test(intent.text) && !(s === 'ok' && !intent.yesno))
    .flatMap(([s]) => [`${t}.${s}.${intent.primary}`, `${t}.${s}`])
  const chain: string[] = []
  const add = (...k: string[]) => chain.push(...k)

  // "제가 준비할까요?" — an offer gets accepted, whatever the topic
  if (intent.offer) chain.push('act.offer')
  if (t !== 'none') {
    if (followup && (a === 'statement' || a === 'ack' || a === 'announce') && /\d\s*시|로비|1층|출발|내려|예약|자리/.test(intent.text)) add(`${t}.followup`)
    if (followup && (a === 'ack' || a === 'statement') && convo?.tags.length) add(`${t}.agree`)
    if (a === 'cancel') add(`${t}.cancel`, 'act.cancel')
    // an inherited topic + a bare yes/no question ("이거 오늘 가능할까요?") → answer the question itself first
    if (followup && intent.topic === 'none' && intent.yesno) {
      if (/가능|될까|되나요|할\s*수|돼요\?|되죠/.test(intent.text)) add('act.yesno.can')
      if (/보셨|확인하셨|읽으셨|받으셨|봤어요\?|보셨나/.test(intent.text)) add('act.yesno.seen')
    }
    if (followup && (a === 'statement' || a === 'ack' || a === 'announce') && /그럼|그걸로|으로\s*가|로\s*가/.test(intent.text)) add(`${t}.followup`, `${t}.agree`)
    // "치맥 콜?" — a concrete proposal: people vote for it first
    if (recruit && extractTags(intent.text).length) add(`${t}.chime`)
    if (recruit) add(`${t}.recruit`)
    if (intent.ideas) add(...subs.map((k) => `${k}.ideas`), `${t}.ideas`, ...(/기능|제품|서비스|개선|프로덕트|로드맵|검색|온보딩/.test(intent.text) ? ['act.ideas.product'] : []), 'act.ideas')
    if (SOCIAL_ACTS.includes(a) || a === 'praise') add(`${t}.${a}`)
    if (a === 'request' && intent.feedback) add(`${t}.feedback`)
    add(...subs)
    if (a === 'goodnews') add(`${t}.goodnews`, 'act.goodnews')
    if (a === 'farewell') add(`${t}.farewell`)
    if (intent.question || a === 'request' || a === 'opinion') {
      if (intent.youRef && intent.question) add(`${t}.you`)
      if (intent.howTo) add(`${t}.howto`)
      if (intent.when) add(`${t}.when`)
      if (!intent.yesno && /누가|누구/.test(intent.text)) add('act.q.who')
      if (!intent.yesno && /언제|며칠/.test(intent.text)) add('act.q.when')
      const fb = a === 'request' && intent.feedback
      // the topic's own answer to a request ("PR 리뷰 부탁해요" → "지금 볼게요 👀") beats the generic feedback line
      if (a === 'request') add(`${t}.request`)
      if (fb) add('act.feedback')
      if (a === 'proposal') add(`${t}.proposal`)
      // "검토 부탁드려요" wants a review, not the topic's generic answers
      if (!fb) add(`${t}.ask`)
    }
    if (a === 'proposal') add(`${t}.proposal`)
    if (a === 'announce') add(`${t}.announce`)
    if (intent.selfRef) add(`${t}.self`)
    if (followup && (a === 'ack' || a === 'statement')) add(`${t}.agree`, `${t}.followup`)
    if (![...SOCIAL_ACTS, 'ack', 'goodnews', 'farewell', 'cancel'].includes(a) && !(a === 'request' && intent.feedback)) add(`${t}.statement`)
  }
  // act-level fallbacks
  if (recruit) add('act.recruit')
  if (intent.ideas) {
    if (/기능|제품|서비스|개선|프로덕트|로드맵|검색|온보딩/.test(intent.text)) add('act.ideas.product')
    add('act.ideas')
  }
  if (a === 'request' && intent.question && /가능|될까|되나요/.test(intent.text)) add('act.yesno.can')
  if (a === 'question' || ((a === 'request' || a === 'opinion') && intent.question && a !== 'request')) {
    if (intent.lend) add('act.lend')
    if (intent.yesno) {
      if (/맞죠|맞나요|맞아요\?|이죠\?|거죠\?|거 맞|게 맞/.test(intent.text)) add('act.yesno.confirm')
      if (/보셨|확인하셨|읽으셨|받으셨|봤어요\?|보셨나|보신\s*분/.test(intent.text)) add('act.yesno.seen')
      if (/가능|될까|되나요|할\s*수|돼요\?|되죠/.test(intent.text)) add('act.yesno.can')
      if (/있으세요|있나요|있어요\?|가지고/.test(intent.text)) add('act.yesno.have')
      add('act.yesno')
    } else {
      if (/누가|누구/.test(intent.text)) add('act.q.who')
      if (/언제|몇\s*시|며칠/.test(intent.text)) add('act.q.when')
      if (/어디/.test(intent.text)) add('act.q.where')
      if (/왜/.test(intent.text)) add('act.q.why')
      if (/어떻게/.test(intent.text)) add('act.q.how')
      if (intent.youRef || isDMish(intent)) {
        if (/뭐\s*(해요|하세요|하실|할\s*거|하시나|했어요|하셨|하고\s*계)|계획|약속\s*있/.test(intent.text)) add('act.q.plans')
      }
      add('act.question')
    }
  }
  if (a === 'request' && intent.feedback) add('act.feedback')
  if (intent.link && (a === 'statement' || a === 'announce')) add('act.link')
  if (!(a === 'request' && intent.feedback)) add(`act.${a}`)
  if (a === 'opinion' || a === 'proposal') add('act.opinion')
  if (intent.question) add('act.question')
  add('act.statement')
  return chain
}

/** casual "what are you up to" questions are about the listener even without honorific markers */
const isDMish = (intent: Intent) => /뭐\s*(해요|하세요|하실|할\s*거|하시나|하고\s*계)/.test(intent.text)

function bankFor(key: string): Line[] | undefined {
  if (key.startsWith('act.')) return ACT_BANK[key.slice(4)]
  return BANK[key]
}

function englishLine(topic: Topic, a: Act, intent: Intent, vars: Record<string, string | undefined>, rnd: () => number): string {
  const key = (FOOD_FAMILY.includes(topic) && topic) || (topic === 'sales' && 'sales') || (topic === 'weekend' && 'weekend') || (topic === 'late' && intent.youRef && 'late') || (a === 'question' ? (intent.yesno ? 'yesno' : 'question') : a)
  const lines = EN_BANK[key] ?? EN_BANK[intent.question ? 'question' : 'statement']
  return fillTemplate(pickOne(lines, rnd), vars)
}

function reactionFor(topic: Topic, intent: Intent, rnd: () => number, recruit = false): string {
  const a = intent.primary
  // "같이 가실 분?" → 🙋 (I'm in); "점심 뭐 먹을까요?" → 😋 (a question isn't a sign-up sheet)
  if (recruit) return pickOne(['🙋', '🙋‍♀️', '🙋‍♂️'], rnd)
  // social acts dominate; otherwise topic flavour; requests get 👍✅
  if (topic === 'hiring' && /입사|합류|새로\s*(왔|오신)|잘\s*부탁/.test(intent.text)) return pickOne(['🎉', '👋', '🙌'], rnd)
  if (topic === 'health') return pickOne(TOPIC_REACTIONS.health ?? ['🙏'], rnd)
  const actFirst: Act[] = ['goodnews', 'congrats', 'praise', 'thanks', 'greeting', 'farewell', 'laugh', 'tired', 'apology']
  if (actFirst.includes(a)) return pickOne(ACT_REACTIONS[a], rnd)
  if (topic === 'review' || (topic === 'design' && a === 'request')) return pickOne(['👀', '👍'], rnd)
  if (a === 'request' && !FOOD_FAMILY.includes(topic)) return pickOne(ACT_REACTIONS.request, rnd)
  if (intent.question && !FOOD_FAMILY.includes(topic)) return '👀'
  if (a === 'announce' && !FOOD_FAMILY.includes(topic)) return pickOne(ACT_REACTIONS.announce, rnd)
  if (topic === 'weather') return /춥|추워|쌀쌀/.test(intent.text) ? pickOne(['🥶', '🧣'], rnd) : /비|우산|☔/.test(intent.text) ? '☔' : pickOne(['☀️', '😎'], rnd)
  if (topic === 'incident' && /해결|복구|정상화|고쳤|수정했|픽스/.test(intent.text)) return pickOne(['🙌', '✅', '🙏'], rnd)
  const t = TOPIC_REACTIONS[topic]
  if (t) return pickOne(t, rnd)
  return pickOne(ACT_REACTIONS[a] ?? ACT_REACTIONS.statement, rnd)
}

/** How long a teammate takes to type `text`. */
export function typingMsFor(text: string, rnd = Math.random) {
  const base = 700 + text.length * 55
  return Math.round(Math.min(6500, Math.max(1100, base)) * (0.85 + rnd() * 0.3))
}

export function plan(input: PlanInput): Plan {
  const rnd = input.rnd ?? Math.random
  const now = input.now ?? Date.now()
  const recent = input.recent ?? []
  const { channel, users, authorId } = input
  const byId = new Map(users.map((u) => [u.id, u]))
  const author = byId.get(authorId)
  const mentionNames = users.map((u) => u.name)
  const intent = classify(input.text, mentionNames)
  const isDM = channel.kind === 'dm'
  // in a 1:1 DM a bare yes/no question is about the partner ("오늘 지각했어요?")
  // …and so is a question that opens with their name ("지우님 온보딩 언제쯤 끝나요?")
  if (isDM && intent.question && !intent.selfRef && !intent.offer && (intent.yesno || /^\S+님\s/.test(intent.text))) intent.youRef = true
  const isGroup = channel.kind === 'group'
  const members = channel.memberIds.filter((id) => id !== authorId && id !== BOT && byId.has(id))
  const steps: Step[] = []

  /* ── topic continuity ── */
  const prev = input.convo && now - input.convo.at < FOLLOWUP_MS ? input.convo : undefined
  let topic = intent.topic
  let followup = false
  if (prev && prev.topic !== 'none') {
    const sameFamily = FOOD_FAMILY.includes(prev.topic) && FOOD_FAMILY.includes(topic)
    // only short or anaphoric messages continue the previous topic ("이거 오늘 가능할까요?", "그럼 12시에 봬요")
    const anaphoric = /그럼|그러면|그걸로|그거|그건|이거|이건|거기|저기|좋아요|콜|넵|네\b|저도|저는|전\s|몇\s*시|언제|어디|\d+\s*시|로비|1층|출발|봬요|뵐게요|만나요|가요!?$/.test(intent.text) || intent.text.length <= 14
    // a message with no topic of its own (and not small talk) inside an active conversation continues it ("A안이랑 B안 중에 뭐가 나아요?")
    // …but a fresh ask to the room ("검색 개선 아이디어 있으신 분?", "충전기 빌려주실 분?") starts a new one
    const bare =
      topic === 'none' && !SOCIAL_ACTS.includes(intent.primary) && intent.primary !== 'farewell' && intent.primary !== 'goodnews' && !intent.ideas && !intent.lend && !intent.toAll
    if ((topic === 'none' && (anaphoric || bare)) || (intent.topicScore <= 3 && topic !== prev.topic && !sameFamily && /그럼|그러면|그걸로|그거|거기|좋아요|콜|넵|네\b/.test(intent.text))) {
      topic = prev.topic
      followup = true
    } else if (topic === prev.topic || sameFamily) {
      followup = true
    }
  }
  // small talk (thanks, ㅋㅋ, 피곤해…) answers the act, not the previous work topic
  if (SOCIAL_ACTS.includes(intent.primary) && intent.topic === 'none' && intent.primary !== 'praise') {
    topic = 'none'
    followup = false
  }

  const textTags = extractTags(intent.text)
  const tags = [...(followup ? prev?.tags ?? [] : []), ...textTags]
  const recruit =
    (/(갈|먹을|드실|가실|하실|마실|뛰실|오실|참여하실|함께하실|할)\s*분|같이\s*(가|먹|드|하|마시|뛰)(실|시|요|ㄹ)/.test(intent.text) && (FOOD_FAMILY.includes(topic) || topic === 'hobby' || intent.toAll)) ||
    (FOOD_FAMILY.includes(topic) && /콜\s*\?|ㄱㄱ|고고|가실래요|가요\s*\?|갈래요\s*\?|어때요\s*\?/.test(intent.text) && textTags.length > 0)
  const welcome = topic === 'hiring' && /입사한|입사했|새로\s*(왔|합류|입사|오게)|합류했|합류하게|첫\s*출근/.test(intent.text)
  const mentioned = users.filter((u) => u.id !== authorId && u.id !== BOT && (input.text.includes(`@${u.name}`))).map((u) => u.id)

  const vars: Record<string, string | undefined> = {
    me: shortName(author?.name ?? ''),
    // answer "좋은 아침이에요" in kind rather than correcting the time of day
    daypart: /아침|굿모닝|모닝/.test(intent.text) ? '좋은 아침이에요' : daypart(now),
    time: extractTime(intent.text),
    tag: tags[tags.length - 1],
  }
  const someoneFor = (exclude: string[]) => {
    const pool = members.filter((id) => !exclude.includes(id))
    const id = pool.length ? pickOne(pool, rnd) : undefined
    return id ? shortName(byId.get(id)!.name) : undefined
  }

  /* ── who answers ── */
  const chain = slotChain(topic, intent, followup, prev, recruit)
  const subKeys = (SUBS[topic] ?? []).filter(([, re]) => re.test(intent.text)).map(([s]) => `${topic}.${s}`)
  const experts = EXPERTS[topic] ?? []

  const a0 = intent.primary
  // answering/acknowledging inside an ongoing exchange ("저 아아요", "이거 오늘 가능할까요?") → the person you were talking to answers;
  // a fresh question ("메뉴 추천 받습니다") → let someone new speak first
  const continuing = followup && (intent.topic === 'none' || !(intent.question || a0 === 'request' || a0 === 'opinion' || a0 === 'proposal'))
  const isExpert = (id: string) => roleOf(id).some((r) => experts.includes(r))
  const score = (id: string) => {
    let s = rnd() * 1.5
    if (isExpert(id)) s += 3
    // the first-listed role is the owner of the topic (마케팅 → 마케터, 휴가 → 피플팀)
    if (experts[0] && roleOf(id).includes(experts[0])) s += 1.2
    if (followup && prev?.repliers.includes(id)) s += 1.5
    if (input.threadParticipants?.includes(id)) s += 2.5
    if (input.threadParticipants?.[0] === id) s += 1.5
    if (continuing && prev?.lastFirst === id) s += 4
    else if (!continuing) {
      // vary who speaks — but a work question still goes to the person who actually knows
      const k = isExpert(id) && (intent.question || a0 === 'request') ? 0.4 : 1
      if (prev?.lastReplier === id) s -= 2.5 * k
      if (prev?.lastFirst === id) s -= 2 * k
    }
    if (byId.get(id)?.presence === 'away') s -= 0.8
    return s
  }
  /** best-scored candidates first (scores computed once — `score` is randomised) */
  const rank = (pool: string[]) => pool.map((id) => [id, score(id)] as const).sort((x, y) => y[1] - x[1]).map(([id]) => id)

  let responders: string[] = []
  const covers: { userId: string; about: string; kind: 'coverOffline' | 'coverDnd' | 'coverAbsent' }[] = []
  let replyCount = 1
  const a = intent.primary

  // a bare yes/no answer ("네 그렇게 해주세요", "아뇨 괜찮아요") goes back to whoever asked/offered a moment ago
  const yesNoReply =
    !intent.question && intent.topic === 'none' && !vars.time &&
    /^(네|넵|넹|예|아니|아뇨|좋아요|좋습니다|오케이|ㅇㅋ|그래요|그렇게|부탁|괜찮아요|괜찮습니다|ok)/i.test(intent.text)
  // only when someone actually asked/offered something a moment ago — a bare "넵" otherwise is just an ack
  const asker = prev?.pendingAsk && now - prev.pendingAsk.at < 10 * 60_000 ? prev.pendingAsk.userId : undefined
  const pending = yesNoReply && asker && members.includes(asker) ? asker : undefined
  const answerSlot = pending
    ? /아니|아뇨|안\s*돼|안돼|보류|다음에|잠깐만|어려울|힘들|안\s*될|말고|취소|괜찮아요|괜찮습니다/.test(intent.text) && !/네\s*괜찮/.test(intent.text)
      ? 'act.answeredNo'
      : // "네 그렇게 해주세요" approves their offer → they proceed; "네 볼게요" agrees to their request → they thank you
        // "네 그렇게 할게요" — the author takes it on themselves → they just thank you
        /(할게요|하겠습니다|볼게요|드릴게요|해둘게요|갈게요)\s*[!~.🙏👍]*$/.test(intent.text) ? 'act.answeredThanks'
        : /해\s*주세요|해주세요|부탁|진행|그렇게|하세요|해도\s*돼/.test(intent.text) ? 'act.answeredYes' : 'act.answeredThanks'
    : undefined

  if (isDM) {
    responders = members.slice(0, 1)
  } else {
    const avail = members.filter((id) => available(byId.get(id)))
    // @mentions: the mentioned person answers; if they can't, someone covers for them
    const mentionedMembers = mentioned.filter((id) => channel.memberIds.includes(id))
    const absent = isGroup ? [] : mentioned.filter((id) => !channel.memberIds.includes(id))
    for (const id of mentionedMembers) {
      const u = byId.get(id)!
      if (available(u) || isGroup) responders.push(id)
      else covers.push({ userId: '', about: id, kind: u.presence === 'dnd' ? 'coverDnd' : 'coverOffline' })
    }
    for (const id of absent.slice(0, 1)) covers.push({ userId: '', about: id, kind: 'coverAbsent' })

    if (pending && answerSlot && !mentionedMembers.length) responders = [pending]

    if (!responders.length && !covers.length) {
      // thanks → whoever helped last
      if (a === 'thanks' && prev?.lastReplier && avail.includes(prev.lastReplier)) responders = [prev.lastReplier]
      else {
        const pool = avail.length ? avail : isGroup ? members : []
        const ranked = rank(pool)
        responders = ranked.slice(0, 1)
      }
    }

    // how many people chime in
    const social = FOOD_FAMILY.includes(topic) && (intent.question || recruit || a === 'request' || a === 'opinion')
    if (a === 'goodnews' || a === 'praise') replyCount = 2
    else if (a === 'congrats') replyCount = mentionedMembers.length ? 2 : 1
    else if (social) replyCount = rnd() < 0.45 ? 3 : 2
    else if (intent.toAll && intent.question) replyCount = rnd() < 0.3 ? 3 : 2
    else if (a === 'greeting' || a === 'farewell') replyCount = rnd() < 0.5 ? 2 : 1
    else if (intent.howTo && experts.length) replyCount = 1
    else if (a === 'question' || a === 'request' || a === 'opinion' || a === 'proposal') replyCount = rnd() < 0.4 ? 2 : 1
    else if (a === 'announce') replyCount = rnd() < 0.5 ? 1 : 0
    else if (a === 'ack') replyCount = followup && topic !== 'none' && rnd() < 0.6 ? 1 : 0
    else if (a === 'laugh') replyCount = rnd() < 0.5 ? 1 : 0
    else if (a === 'statement' && topic === 'none') replyCount = intent.text.replace(/[^가-힣a-z0-9]/gi, '').length < 6 ? 0 : rnd() < 0.45 ? 1 : 0
    if (input.threadParticipants) replyCount = Math.min(replyCount, 2)
    if (isGroup) replyCount = Math.min(Math.max(replyCount, 1), 2)
    if (answerSlot) replyCount = 1
    if (welcome) replyCount = rnd() < 0.5 ? 3 : 2
    if (mentionedMembers.length || pending) replyCount = Math.max(replyCount, responders.length)
    // only a cover note ("○○님 오프라인이세요") — nobody else needs to pile on
    if (covers.length && !responders.length) replyCount = 0

    if (responders.length > replyCount) {
      // mentioned folks always answer
      if (!mentionedMembers.length && !pending) responders = responders.slice(0, replyCount)
    }
    if (replyCount === 0 && !mentionedMembers.length) responders = []
    // work questions get a second voice only from someone who knows the area
    const expertOnly = !FOOD_FAMILY.includes(topic) && experts.length > 0 && !welcome && !['goodnews', 'congrats', 'greeting', 'farewell', 'praise'].includes(a)
    while (responders.length < replyCount) {
      const pool = avail.filter((id) => !responders.includes(id) && (!expertOnly || isExpert(id)))
      if (!pool.length) break
      responders.push(rank(pool)[0])
    }
    // cover notes come from an available teammate
    for (const c of covers) {
      const pool = avail.filter((id) => id !== c.about && !responders.includes(id))
      c.userId = pool.length ? rank(pool)[0] : ''
    }
  }

  const factual = intent.question && !intent.ideas && !FOOD_FAMILY.includes(topic) && (intent.when || intent.yesno || /어디|누가|누구|몇|얼마|언제/.test(intent.text))

  /* ── what they say ── */
  const used = [...recent]
  let lastText = ''
  let lastUser: string | undefined
  let firstUser: string | undefined
  let currentTag = vars.tag
  let firstSlot = ''
  let readOffset = 0
  const replySteps: ReplyStep[] = []
  const templates: string[] = []

  for (const c of covers) {
    if (!c.userId) continue
    const line = chooseLine(ACT_BANK[c.kind], c.userId, { ...vars, name: shortName(byId.get(c.about)?.name ?? '') }, used, rnd, false, isDM)
    if (!line) continue
    used.push(line.text)
    replySteps.push({ type: 'reply', userId: c.userId, bubbles: [line.text], readMs: 900 + rnd() * 1600, slot: `act.${c.kind}` })
    lastUser = c.userId
  }

  responders.forEach((uid, idx) => {
    const u = byId.get(uid)!
    const isMentioned = mentioned.includes(uid)
    const lineVars: Record<string, string | undefined> = {
      ...vars,
      tag: currentTag,
      // "{prevName}님 말씀대로…" refers to the substantive first answer, not to the last "+1"
      prevName: firstUser ? shortName(byId.get(firstUser)?.name ?? '') : lastUser ? shortName(byId.get(lastUser)?.name ?? '') : undefined,
      self: shortName(u.name),
      someone: someoneFor([uid, authorId]),
      name: mentioned[0] ? shortName(byId.get(mentioned[0])?.name ?? '') : undefined,
      menu: pickOne(MENUS, rnd).tag,
    }
    const altPool = (topic === 'dinner' ? DINNERS : MENUS).filter((m) => m.tag !== currentTag)
    lineVars.menu2 = altPool.length ? pickOne(altPool, rnd).tag : undefined

    let chosen: Chosen | null = null
    let slot = ''
    const tryKeys = (keys: string[]) => {
      for (const k of keys) {
        const c = chooseLine(bankFor(k), uid, lineVars, used, rnd, replySteps.length === 0, isDM)
        if (c) {
          chosen = c
          slot = k
          return true
        }
      }
      return false
    }

    if (uid === 'u_global') {
      const text = englishLine(topic, a, intent, lineVars, rnd)
      chosen = { text }
      slot = 'en'
    } else if (idx === 0 && answerSlot && uid === pending) {
      tryKeys([answerSlot])
    } else if (a === 'congrats' && isMentioned) {
      tryKeys(['act.thanked'])
    } else if (a === 'congrats' && mentioned.length) {
      tryKeys(['act.congratsChime'])
    } else if (idx > 0 || replySteps.length > 0) {
      // second voice: agree with / build on what was just said
      const chimeKeys: string[] = []
      if (currentTag && (topic === 'food' || topic === 'dinner')) {
        // at most one person counter-proposes; the rest vote
        const countered = replySteps.some((r) => r.slot.endsWith('.counter'))
        chimeKeys.push(!countered && rnd() < 0.3 ? `${topic}.counter` : `${topic}.chime`, `${topic}.chime`)
      } else if (recruit) chimeKeys.push(`${topic}.recruit`, 'act.recruit')
      else if (welcome) chimeKeys.push('hiring.intro', 'hiring.announce')
      // "다들 점심 드셨어요?" / "주말 잘 보내셨어요?" to the room → everyone answers for themselves
      else if (intent.youRef && intent.question && !factual) chimeKeys.push(...chain.filter((k) => k.endsWith('.you') || k.endsWith('.past')), `${topic}.chime`)
      else if (a === 'goodnews' || a === 'farewell' || a === 'greeting' || a === 'congrats' || a === 'thanks' || a === 'praise') chimeKeys.push(`${topic}.${a}`, `act.${a}`)
      // a sub-topic with its own chime lines ("회식 언제예요?" → "장소는 아직 투표 중이래요")
      else if (subKeys.some((k) => BANK[`${k}.chime`])) chimeKeys.push(...subKeys.map((k) => `${k}.chime`))
      else if (FOOD_FAMILY.includes(topic) && intent.question) chimeKeys.push(`${topic}.ask`)
      // "주말 잘 보내셨어요?" to the room → everyone answers for themselves
      else if (intent.youRef && intent.question) chimeKeys.push(...chain.filter((k) => k.endsWith('.you') || k.endsWith('.past')), ...chain)
      // a specific sub-topic ("CI 느려요") → another take on the same thing rather than the generic topic chime
      // a factual question ("언제 나와요?", "몇 시예요?") has one answer — later voices only chime in, never give a second (contradicting) fact
      else if (factual) chimeKeys.push(...subKeys.map((k) => `${k}.chime`), `${topic}.chime`)
      // (never the same factual slot twice — two different "배포 시간" answers contradict each other)
      else if (subKeys.length) chimeKeys.push(...subKeys.map((k) => `${k}.chime`), ...chain.filter((k) => k !== firstSlot && !subKeys.includes(k)), 'act.chime')
      else chimeKeys.push(`${topic}.chime`, ...chain.filter((k) => k !== firstSlot), 'act.chime')
      tryKeys(chimeKeys)
    } else {
      tryKeys(chain)
    }
    if (!chosen) tryKeys(isDM ? ['act.dmStatement'] : ['act.statement'])
    const pick = chosen as Chosen | null
    if (!pick) return
    if (pick.tag) currentTag = pick.tag
    // keep text sensible: never echo the exact previous line
    if (pick.text === lastText) return
    // a second voice with nothing specific to add stays quiet ("오 그렇군요 👀" adds nothing)
    if (replySteps.length > 0 && (slot === 'act.statement' || slot === 'act.dmStatement') && !isDM) return
    used.push(pick.text)
    if (pick.tpl) {
      used.push(pick.tpl)
      templates.push(pick.tpl)
    }
    if (!firstSlot) firstSlot = slot

    const bubbles = pick.text.split('|').map((s) => s.trim()).filter(Boolean)
    // late readers in DMs apologise first
    if (isDM || isGroup) {
      if (u.presence === 'offline') bubbles.unshift(uid === 'u_global' ? EN_BANK.prefix[0] : pickOne(LATE_PREFIX.offline, rnd))
      else if (u.presence === 'dnd') bubbles.unshift(pickOne(LATE_PREFIX.dnd, rnd))
    }
    let readMs = idx === 0 && !replySteps.length ? 900 + rnd() * 1500 : 900 + rnd() * 1800
    if (u.presence === 'away') readMs += 2500 + rnd() * 3000
    if (u.presence === 'dnd') readMs += 6000 + rnd() * 4000
    if (u.presence === 'offline') readMs += 7000 + rnd() * 5000
    replySteps.push({ type: 'reply', userId: uid, bubbles, readMs, slot })
    readOffset += readMs
    lastText = pick.text
    lastUser = uid
    if (!firstUser && !slot.startsWith('act.cover')) firstUser = uid
  })

  steps.push(...replySteps)

  /* ── reactions from others (match the sentiment) ── */
  if (!isDM) {
    const avail = members.filter((id) => available(byId.get(id)))
    const repliers = replySteps.map((s) => s.userId)
    let n = 0
    if (a === 'goodnews' || a === 'congrats' || a === 'praise' || welcome) n = 2 + Math.floor(rnd() * 3)
    else if (a === 'announce') n = 2 + Math.floor(rnd() * 2)
    else if (recruit || (FOOD_FAMILY.includes(topic) && intent.question)) n = 1 + Math.floor(rnd() * 2)
    else if (a === 'greeting' || a === 'farewell' || a === 'laugh') n = 1 + Math.floor(rnd() * 2)
    // "ㅇㅋ", "흠.." — nothing to react to
    else if ((a === 'ack' || a === 'statement') && topic === 'none' && intent.text.replace(/[^가-힣a-z0-9]/gi, '').length < 6) n = 0
    else if (a === 'ack' || a === 'statement') n = replySteps.length ? Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 2)
    else if (a === 'request' || a === 'proposal') n = Math.floor(rnd() * 2)
    else n = rnd() < 0.3 ? 1 : 0
    if (input.threadParticipants) n = Math.min(n, 1)
    const reactors = shuffle(avail.filter((id) => !repliers.includes(id)), rnd).slice(0, n)
    // first reactor picks; others mostly pile onto the same emoji, like real people do
    let first: string | undefined
    reactors.forEach((uid, i) => {
      const emoji = first && rnd() < 0.6 ? first : reactionFor(topic, intent, rnd, recruit)
      first = first ?? emoji
      steps.push({ type: 'react', userId: uid, emoji, atMs: 1200 + i * (700 + rnd() * 1600) + rnd() * 1500 })
    })
    // a replier sometimes also leaves a reaction on the original (e.g. 🙋 + "저요")
    if (replySteps[0] && rnd() < 0.35 && a !== 'thanks' && !intent.question && !covers.length) steps.push({ type: 'react', userId: replySteps[0].userId, emoji: reactionFor(topic, intent, rnd, recruit), atMs: 500 + rnd() * 800 })
  } else if (rnd() < 0.25 && replySteps[0] && (a === 'thanks' || a === 'goodnews' || a === 'request')) {
    steps.push({ type: 'react', userId: replySteps[0].userId, emoji: reactionFor(topic, intent, rnd, recruit), atMs: 600 + rnd() * 800 })
  }

  /* ── memory ── */
  const repliers = replySteps.map((s) => s.userId)
  const convo: Convo = {
    topic: topic !== 'none' ? topic : prev?.topic ?? 'none',
    at: now,
    tags: currentTag && !tags.includes(currentTag) ? [...tags, currentTag] : tags,
    repliers: Array.from(new Set([...(followup ? prev?.repliers ?? [] : []), ...repliers])),
    lastReplier: repliers[repliers.length - 1] ?? prev?.lastReplier,
    lastFirst: repliers[0] ?? prev?.lastFirst,
    lastSlot: firstSlot,
    // a teammate's reply ended with a question ("몇 시에 나가요?") → the author's next short answer goes back to them
    pendingAsk: replySteps[0] && /\?\s*\S{0,3}$/.test(replySteps[0].bubbles[replySteps[0].bubbles.length - 1]) ? { userId: replySteps[0].userId, at: now } : undefined,
  }
  if (topic === 'none' && !followup) convo.topic = 'none'
  return { intent, topic, followup, steps, convo, templates }
}
