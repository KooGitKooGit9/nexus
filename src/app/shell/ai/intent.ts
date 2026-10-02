/**
 * Nexus AI intent router — PURE (only imports ./nlp, which has no imports). Store data is passed in.
 *
 * Priority: action (send/post/create) > specific-entity lookup (doc, channel, person) > generic summary.
 * Each intent gets a score; the highest wins and ties are broken by INTENT_ORDER.
 */
import {
  normalize, findPeople, findChannelIn, findDates, findTime, findDuration, toPolite, tidy, escapeRe,
  addDays, startOfDay,
  type PersonLike, type ChannelLike, type PersonHit, type ChannelHit, type DateHit, type TimeHit,
} from './nlp'

export type Intent =
  | 'send_dm' | 'post_channel' | 'create_task' | 'create_event' | 'create_doc'
  | 'template' | 'doc_summary' | 'docs_list' | 'channel_summary' | 'person'
  | 'approvals' | 'okr' | 'tasks' | 'schedule' | 'announcements' | 'briefing'
  | 'greeting' | 'help' | 'fallback'

/** Tie-breaker: earlier wins. Actions first, then specific lookups, then generic ones. */
export const INTENT_ORDER: Intent[] = [
  'send_dm', 'post_channel', 'create_event', 'create_task', 'create_doc', 'template',
  'doc_summary', 'docs_list', 'channel_summary', 'person', 'approvals', 'okr', 'tasks', 'schedule',
  'announcements', 'briefing', 'help', 'greeting', 'fallback',
]

export interface ProjectLike { id: string; key: string; name: string; memberIds: string[]; archived?: boolean }

export interface RouterCtx<U extends PersonLike, C extends ChannelLike> {
  users: U[]
  /** named channels (public/private, not archived) */
  channels: C[]
  meId: string
  now?: Date
  /** doc titles, to recognise "PRD", "온콜 런북"… as doc references */
  docTitles?: string[]
}

export interface Parsed<U extends PersonLike = PersonLike, C extends ChannelLike = ChannelLike> {
  raw: string
  /** normalized text */
  text: string
  intent: Intent
  scores: Partial<Record<Intent, number>>
  /** people mentioned (excluding the current user) */
  people: PersonHit<U>[]
  /** people followed by 한테/에게/께 */
  recipients: PersonHit<U>[]
  channel: ChannelHit<C> | null
  dates: DateHit[]
  time: TimeHit | null
}

/* ───────────── lexicon ───────────── */

const SEND_RE = /(DM(?=[\s.!?~]*$)|보내|보낼|전해|전달|전송|남겨|날려|물어\s*봐|물어봐|물어|여쭤|DM\s*(?:해|좀|보내|날려)|톡\s*(?:해|보내|날려)|메시지\s*(?:해|좀|날려|남겨|보내|전해)|말해\s*(?:줘|주세요|줄래)|말\s*좀\s*해|알려\s*(?:줘|주세요|줄래|라|드려)|공지\s*(?:해|하|좀|올려|띄워|날려)|올려\s*(?:줘|주세요|줄래|봐)|게시해|포스팅|공유\s*(?:해|좀))/i
const RELAY_RE = /(물어|여쭤|전해|알려|말해|부탁해|부탁\s*(?:DM|메시지)|얘기해|이야기해|안부)/
const SAY_RE = /(다고|라고|냐고|자고|달라고|래|냬)\s*(?:좀\s*)?(?:해|전해|말해|얘기해)\s*(?:줘|주세요|줄래|줘요)?/
const MSG_WORD = /(메시지|DM|톡|문자|연락|메일)/i
const CREATE_RE = /(만들(?!었|어진|어졌)|생성(?!된|됐|자)|추가(?!된|됐)|등록(?!된|됐)|잡아|예약(?!된|됐)|넣어|작성(?!된|됐|자|한)|써\s*(?:줘|줄래|주세요)|개설|세팅|셋업|만들기)/
const TASK_NOUN = /(태스크|할\s*일|이슈|티켓|todo|투두)/i
const EVENT_NOUN = /(일정|회의(?!록)|미팅|약속|싱크|1:1|원온원|면담|회식|점심|저녁\s*식사|콜(?![가-힣])|통화|세션|인터뷰|워크숍|데모|스탠드업|캘린더)/i
const DOC_NOUN = /(문서|페이지|위키|노트|회의록|prd|기획서|보고서|런북|가이드|명세|스펙|로드맵|회고|릴리즈\s*노트|정책|아키텍처|디자인\s*시스템|온보딩\s*문서)/i
const SUMMARY_RE = /(요약|정리|내용|핵심|요점|뭐였|뭐라고|뭐야|뭐\s*있|뭐\s*나왔|알려|보여|읽어|간추|tl;?dr|훑어|살펴|어떻게\s*됐|무슨\s*(?:얘기|이야기|내용)|결정|액션)/i
const LIST_DOCS_RE = /((최근|새로운?|업데이트(?:된)?|즐겨찾기|내가\s*쓴|전체)\s*(?:문서|위키|페이지)|(?:문서|위키)\s*(?:목록|리스트|뭐\s*있))/

/* ───────────── parse ───────────── */

export function parse<U extends PersonLike, C extends ChannelLike>(raw: string, ctx: RouterCtx<U, C>): Parsed<U, C> {
  const now = ctx.now ?? new Date()
  const t = normalize(raw)
  const people = findPeople(t, ctx.users).filter((p) => p.user.id !== ctx.meId)
  // "박서준이랑 최지우한테" → both are recipients
  const recipients = people.filter((p, i) => p.recipient || (/(이랑|랑|하고|과|와)$/.test(p.phrase) && people.slice(i + 1).some((q) => q.recipient)))
  const channel = findChannelIn(t, ctx.channels)
  const dates = findDates(t, now)
  const time = findTime(t)
  const lower = t.toLowerCase()

  const scores: Partial<Record<Intent, number>> = {}
  const bump = (k: Intent, v: number) => { scores[k] = Math.max(scores[k] ?? 0, v) }

  const sendVerb = SEND_RE.test(t)
  const createVerb = CREATE_RE.test(t)
  const templateWord = /(템플릿|양식|서식)/.test(t)
  const docTitleHit = (ctx.docTitles ?? []).some((title) => docTitleMentioned(lower, title))
  const docMention = DOC_NOUN.test(t) || docTitleHit

  /* small talk */
  if (/^(안녕|하이|hi\b|hello|헬로|반가)/i.test(t) && t.length < 24) bump('greeting', 7)
  if (/((뭘|무엇을|뭐)\s*(할\s*수|해\s*줄\s*수|도와)|도움말|사용법|기능\s*(?:알려|소개|뭐)|^help$|어떻게\s*써)/i.test(t)) bump('help', 7)

  /* actions: messaging */
  if (recipients.length && (sendVerb || SAY_RE.test(t))) bump('send_dm', 10)
  else if (recipients.length && RELAY_RE.test(t)) bump('send_dm', 9.5)
  else if (people.length && MSG_WORD.test(t) && sendVerb) bump('send_dm', 9.5)
  if (channel && (sendVerb || SAY_RE.test(t))) bump('post_channel', recipients.length ? 9 : 10)
  else if (/공지\s*(?:해|하|좀|올려|띄워|날려)|전사\s*공지\s*(?:올려|보내|해)/.test(t)) bump('post_channel', 8.5)

  /* actions: create */
  if (createVerb) {
    if (TASK_NOUN.test(t)) bump('create_task', 9.6)
    if (EVENT_NOUN.test(t) || (time && !TASK_NOUN.test(t))) bump('create_event', 9 + (time || dates.length ? 0.5 : 0))
    if (/회의록/.test(t) && !templateWord) bump('create_doc', 9.7)
    else if (DOC_NOUN.test(t) && !EVENT_NOUN.test(t.replace(DOC_NOUN, ''))) bump('create_doc', templateWord && /(문서|페이지)/.test(t) ? 9.5 : 8.5)
  } else if (/잡아|예약/.test(t) && time) bump('create_event', 9)
  if (TASK_NOUN.test(t) && /(할당|배정|맡겨|맡기)/.test(t)) bump('create_task', 9.6)
  if (templateWord) bump('template', createVerb || /(작성|보여|줘)/.test(t) ? 9.2 : 7)

  /* docs */
  if (LIST_DOCS_RE.test(t)) bump('docs_list', 8.6)
  // "지난 회의에서 뭐 결정했어?" → the latest meeting notes
  if (!createVerb && /(지난|저번|이전|마지막|최근)\s*(회의|미팅|싱크)/.test(t) && /(결정|논의|얘기|이야기|뭐|내용|요약|정리|액션)/.test(t)) bump('doc_summary', 8.2)
  if (docMention && !createVerb) {
    if (SUMMARY_RE.test(t)) bump('doc_summary', 8 + (dates.length ? 0.5 : 0) + (docTitleHit ? 0.3 : 0))
    else if (dates.length || docTitleHit) bump('doc_summary', 7.5)
    else bump('doc_summary', 5)
  }

  /* channels */
  if (channel) bump('channel_summary', SUMMARY_RE.test(t) || /(무슨|어떤|대화|얘기|이야기|논의|분위기)/.test(t) ? 8 : 6)
  else if (/(채널|대화|메신저|단톡)\s*(?:요약|정리)/.test(t)) bump('channel_summary', 7)

  /* people */
  if (people.length) bump('person', /(누구|연락처|이메일|메일\s*주소|전화|번호|프로필|어디|직책|직급|매니저|소속|정보|담당\s*업무)/.test(t) ? 7 : 4.5)

  /* generic lookups */
  if (/(결재|승인|품의|휴가\s*신청|지출\s*결의)/.test(t)) bump('approvals', 6.5)
  if (/(okr|목표|분기\s*(?:성과|진척|목표)|진척|핵심\s*결과|\bkr\b)/i.test(lower)) bump('okr', 6)
  if (/(할\s*일|태스크|우선순위|todo|마감|이슈|티켓|업무)/i.test(t)) bump('tasks', 5.5)
  if (/(일정|캘린더|스케줄|회의(?!록)|미팅|약속|아젠다|빈\s*시간)/.test(t)) bump('schedule', /(뭐|있|알려|요약|보여|정리|몇\s*시|언제|빈\s*시간)/.test(t) ? 6 : 5)
  if (/공지/.test(t)) bump('announcements', 5.5)
  if (/브리핑/.test(t)) bump('briefing', 7)
  else if (/(하루|오늘\s*(?:뭐|어때|요약|정리)|현황|정리|요약)/.test(t)) bump('briefing', 3.5)

  let intent: Intent = 'fallback'
  let best = 0
  for (const k of INTENT_ORDER) {
    const v = scores[k] ?? 0
    if (v > best) { best = v; intent = k }
  }
  return { raw, text: t, intent, scores, people, recipients, channel, dates, time }
}

/** "온콜 런북" mentioned in "온콜 런북 핵심만"? Matches the title or any distinctive ≥2-char word of it. */
function docTitleMentioned(lower: string, title: string) {
  const tl = title.toLowerCase()
  if (tl.length >= 2 && lower.includes(tl)) return true
  const words = tl.split(/[\s&()·,/-]+/).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !/^(nexus|가이드|문서|개요|정책|노트)$/.test(w))
  return words.some((w) => lower.includes(w))
}

/* ───────────── message bodies ───────────── */

const CMD_RE = new RegExp(
  '(?:(?:메시지|DM|톡|문자|공지|메일)\\s*(?:로|을|를|좀|하나|으로)?\\s*)?(?:좀\\s*)?' +
    '(?:보내|전해|전달|전송|남겨|날려|물어\\s*봐|물어|여쭤\\s*봐|여쭤|말해|알려|공지해|공지|올려|게시해|포스팅해|공유해|DM)' +
    // …but not a verb that is part of the quoted speech ("올려달라고", "보내줬냐고")
    '(?![가-힣]*(?:냐고|다고|라고|자고|는지|달라|달래|래|냬)(?:[\\s.!?~]|$))(?!\\s*(?:달라|달래|주라고))' +
    '(?:\\s*(?:줘|줘요|주세요|줄래|줄래요|주라|드려|드려줘|봐|라|줘봐|줄\\s*수\\s*있어|주실래요|요))*[.!?~\\s]*',
  'gi',
)

export interface Body { text: string; verbatim: boolean }

/** Pulls the message content out of a command ("박서준한테 오늘 지각했냐고 메시지 보내" → "오늘 지각했냐고"). */
export function extractBody(p: Parsed): Body {
  const quoted = /["“”'‘’「『]([^"“”'‘’「」『』]{1,400})["“”'‘’」』]/.exec(p.text)
  if (quoted) return { text: quoted[1].trim(), verbatim: true }
  let s = p.text
  // "…: 내용" form — text after a colon is the body
  const colon = /^[^:]{2,40}(?:보내|전해|공지|올려|남겨)[^:]*[:：]\s*(.+)$/.exec(s)
  if (colon) return { text: colon[1].trim(), verbatim: false }
  for (const h of p.recipients.length ? p.recipients : p.people) s = s.replace(h.phrase, ' ')
  if (p.channel) s = s.replace(p.channel.phrase, ' ')
  s = s.replace(/(?:DM|메시지|톡|문자)\s*(?:으로|로|좀)?\s*해(?:\s*(?:줘|주세요|줄래|줘요))?/gi, ' ')
  s = s.replace(CMD_RE, ' ')
  s = s.replace(/(?<=고)\s*(?:좀\s*)?(?:해|얘기해)(?:\s*(?:줘|주세요|줄래|줘요))?(?=[\s.!?~]*$)/, '')
  s = s.replace(/(?:^|\s)(?:채널|채널에|에|에다|에다가|에게|한테|님)(?=\s|$)/g, ' ')
  return { text: tidy(s), verbatim: false }
}

export function givenName(name: string) {
  if (/^[가-힣]{3}$/.test(name)) return name.slice(1)
  if (/^[가-힣]{4}$/.test(name)) return name.slice(2)
  return name.split(' ')[0]
}

const pickV = <T,>(arr: T[], v: number) => arr[Math.abs(v) % arr.length]

/** Natural, polite DM: "서준님, 혹시 오늘 지각하셨나요?" */
export function composeDM(recipientNames: string[], body: Body, variant = 0) {
  const given = recipientNames.map(givenName).join('님, ')
  if (body.verbatim) return body.text
  const { text, question } = toPolite(body.text)
  if (!text) return pickV([`${given}님, 안녕하세요! 잠깐 이야기 나눌 수 있을까요?`, `${given}님, 시간 괜찮으실 때 잠깐 연락 부탁드려요 🙏`, `${given}님 안녕하세요, 잠시 여쭤볼 게 있어요.`], variant)
  const core = text.replace(/^혹시\s+/, '')
  return pickV(
    [
      `${given}님, ${text}`,
      `${given}님 안녕하세요! ${question ? '혹시 ' + core : text}`,
      `${given}님, ${text}${question ? '' : ' 🙏'}`,
    ],
    variant,
  )
}

/** Channel post. Announcements get a 📢 prefix. */
export function composePost(body: Body, notice: boolean) {
  if (body.verbatim) return notice ? `📢 ${body.text}` : body.text
  const { text } = toPolite(body.text)
  if (!text) return ''
  return notice ? `📢 [공지] ${text}` : text
}

export const isNotice = (p: Parsed) => /공지/.test(p.text)

/* ───────────── shared cleaning ───────────── */

function strip(s: string, phrases: (string | undefined)[]) {
  let out = s
  for (const ph of phrases) if (ph) out = out.replace(ph, ' ')
  return out
}
const CREATE_TAIL = /(?:을|를|으로|로|좀|하나|새로|새)?\s*(?:만들어|만들|생성해|생성|추가해|추가|등록해|등록|잡아|예약해|예약|넣어|작성해|작성|써|개설해|세팅해|셋업해)(?:\s*(?:줘|줘요|주세요|줄래|줄래요|주라|봐|줘봐|놔|둬|줄\s*수\s*있어|주실래요|요))*[.!?~\s]*/g

/* ───────────── events ───────────── */

export interface EventDraft { title: string; start: Date; end: Date; attendeeIds: string[]; location?: string; video: boolean; guessedTime: boolean }

export function extractEvent(p: Parsed, now = new Date()): EventDraft {
  const day = p.dates.find((d) => d.kind === 'day') ?? p.dates[0]
  let start: Date
  let guessedTime = false
  if (day) start = new Date(day.date)
  else if (p.time) {
    start = startOfDay(now)
    const probe = new Date(start); probe.setHours(p.time.h, p.time.m, 0, 0)
    if (+probe < +now) start = addDays(start, 1)
  } else start = addDays(startOfDay(now), 1)
  if (p.time) start.setHours(p.time.h, p.time.m, 0, 0)
  else {
    guessedTime = true
    start.setHours(10, 0, 0, 0)
    if (+start < +now) { start = new Date(now); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1) }
  }
  const shortM = /(\d+)\s*분\s*(?:짜리|동안|간)?\s*(?=회의|미팅|싱크|통화|콜|면담|1:1)/.exec(p.text)
  const dur = findDuration(p.text)?.minutes ?? (shortM ? +shortM[1] : 60)
  const end = new Date(+start + dur * 60000)

  const locM = /((?:회의실\s*[A-Za-z가-힣0-9]+)|(?:[A-Za-z가-힣0-9]+\s*회의실))(?:\s*(?:에서|으로|로))?/.exec(p.text)
  const video = /(화상|줌|zoom|구글\s*밋|google\s*meet|meet|온라인|비대면)/i.test(p.text)

  let s = strip(p.text, [...p.dates.map((d) => d.phrase), p.time?.phrase, findDuration(p.text)?.phrase, locM?.[0], ...p.people.map((h) => h.phrase)])
  s = s.replace(CREATE_TAIL, ' ')
  s = s
    .replace(/(화상|줌|zoom|구글\s*밋|google\s*meet|온라인|비대면)\s*(?:으로|로)?/gi, ' ')
    .replace(/(?:^|\s)(?:캘린더에|캘린더|일정을|일정으로|일정|같이|함께|다\s*같이|모두|좀|에|에서|으로|로|랑|하고|과|와|님|씨|(\d+)\s*분(?:짜리|동안|간)?)(?=\s|$)/g, ' ')
  let title = tidy(s).replace(/\s*(을|를)$/, '')
  const names = p.people.map((h) => givenName(h.user.name) + '님')
  if (!title || /^(회의|미팅|약속|일정|싱크|통화|콜|1:1|원온원|면담|점심|저녁|회식)$/i.test(title)) title = names.length ? `${names.slice(0, 2).join(', ')}과 ${title || '미팅'}` : title || '새 회의'
  return { title, start, end, attendeeIds: p.people.map((h) => h.user.id), location: locM?.[1]?.trim(), video, guessedTime }
}

/* ───────────── tasks ───────────── */

export interface TaskDraft { title: string; assigneeIds: string[]; due?: Date; priority: 'urgent' | 'high' | 'medium' | 'low'; projectId?: string }

export function extractTask(p: Parsed, projects: ProjectLike[], meId: string): TaskDraft {
  const priority: TaskDraft['priority'] = /(긴급|급한|급하게|asap|당장|최우선)/i.test(p.text) ? 'urgent' : /(중요|높은\s*우선|우선순위\s*높)/.test(p.text) ? 'high' : /(낮은\s*우선|여유|나중에|천천히)/.test(p.text) ? 'low' : 'medium'
  const live = projects.filter((x) => !x.archived)
  let projectPhrase: string | undefined
  let project = live.find((x) => {
    const m = new RegExp(`(?:${escapeRe(x.name)}|(?<![A-Za-z])${escapeRe(x.key)}(?![A-Za-z]))(?:\\s*프로젝트)?(?:\\s*(?:에|에다|으로|로|의))?`, 'i').exec(p.text)
    if (m) projectPhrase = m[0]
    return !!m
  })
  if (!project) project = live.find((x) => x.memberIds.includes(meId)) ?? live[0]

  const day = p.dates.find((d) => d.kind === 'day')
  const week = p.dates.find((d) => d.kind === 'week')
  let due: Date | undefined
  if (day) { due = new Date(day.date); due.setHours(18, 0, 0, 0) } else if (week) { due = addDays(week.date, 4); due.setHours(18, 0, 0, 0) }

  const assigneeIds = p.people.map((h) => h.user.id)
  let s = strip(p.text, [...p.dates.map((d) => d.phrase), p.time?.phrase, projectPhrase, ...p.people.map((h) => h.phrase)])
  s = s.replace(CREATE_TAIL, ' ')
  s = s
    .replace(/(긴급|급한|급하게|asap|당장|최우선|중요한?|높은\s*우선순위로?|낮은\s*우선순위로?|여유\s*있게|나중에|천천히)/gi, ' ')
    .replace(/(?:^|\s)(?:담당(?:으로|자는|자로)?|할당(?:해서|하고|해\s*줘|해줘|해)?|배정(?:해서|하고|해\s*줘|해줘|해)?|맡겨(?:서|\s*줘|줘)?|까지|마감(?:으로)?|프로젝트(?:에|에다)?)(?=\s|$)/g, ' ')
    .replace(/(태스크|할\s*일|이슈|티켓|todo|투두)\s*(?:로|으로|을|를|하나|에)?/gi, ' ')
    .replace(/(?:^|\s)(?:좀|에|으로|로|내|나|제|새|새로운)(?=\s|$)/g, ' ')
  const title = tidy(s).replace(/\s*(을|를|은|는)$/, '')
  return { title: title || '새 태스크', assigneeIds: assigneeIds.length ? assigneeIds : [meId], due, priority, projectId: project?.id }
}

/* ───────────── docs (create) ───────────── */

export type DocKind = 'meeting' | 'prd' | 'retro' | 'report' | 'blank'
export interface DocDraft { title: string; kind: DocKind; date?: Date }

export function extractDocDraft(p: Parsed, now = new Date()): DocDraft {
  const kind: DocKind = /회의록/.test(p.text) ? 'meeting' : /(prd|기획서|요구사항)/i.test(p.text) ? 'prd' : /(회고|kpt)/i.test(p.text) ? 'retro' : /(주간\s*보고|보고서|위클리)/.test(p.text) ? 'report' : 'blank'
  const quoted = /["“”'‘’「『]([^"“”'‘’「」『』]{1,80})["“”'‘’」』]/.exec(p.text)
  const day = p.dates.find((d) => d.kind === 'day')
  if (quoted) return { title: quoted[1].trim(), kind, date: day?.date }
  let s = strip(p.text, [...p.dates.map((d) => d.phrase), ...p.people.map((h) => h.phrase)])
  s = s.replace(CREATE_TAIL, ' ')
  s = s.replace(/(?:템플릿|양식|서식)\s*(?:으로|로)?/g, ' ').replace(/(?:^|\s)(?:새\s*)?(?:문서|페이지|노트)(?:\s*(?:를|을|로|으로|하나))?(?=\s|$)/g, ' ').replace(/(?:^|\s)(?:좀|에|으로|로|새|새로운|하나)(?=\s|$)/g, ' ')
  let title = tidy(s).replace(/\s*(을|를)$/, '')
  const d = day?.date ?? now
  const md = `${d.getMonth() + 1}/${d.getDate()}`
  if (kind === 'meeting') title = /회의록/.test(title) ? (title === '회의록' ? `회의록 ${md}` : `${title} ${md}`) : `${title || '회의록'} ${md}`.trim()
  if (!title) title = kind === 'prd' ? '새 PRD' : kind === 'retro' ? '회고' : kind === 'report' ? `주간 보고 ${md}` : '제목 없는 문서'
  return { title, kind, date: day?.date }
}
