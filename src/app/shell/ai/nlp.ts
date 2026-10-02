/**
 * Small Korean NLP toolkit for Nexus AI — normalization, entity extraction (people, channels, dates,
 * times, durations, amounts) and indirect-speech → polite-message conversion.
 *
 * PURE MODULE: no imports at all (not even date-fns) so the router can be unit-tested with plain node.
 * Store data (users, channels…) is passed in by the caller.
 */

/* ───────────── tiny date helpers ───────────── */

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const dayDiff = (a: Date, b: Date) => Math.round((+startOfDay(a) - +startOfDay(b)) / 86400000)

export interface PersonLike { id: string; name: string; nameEn: string }
export interface ChannelLike { id: string; name: string }

/* ───────────── normalization ───────────── */

const TYPOS: [RegExp, string][] = [
  [/메세지|메시자|매세지|메새지|메지시|매시지/g, '메시지'],
  [/스케쥴|스캐줄/g, '스케줄'],
  [/테스크|태스트|타스크|테스트크/g, '태스크'],
  [/일졍|일쩡/g, '일정'],
  [/결제\s*(대기|요청|함|올려|상신|현황|라인|문서|할\s*거)/g, '결재 $1'],
  [/회으록|회의룩|회의륵|회의로그/g, '회의록'],
  [/요약헤|요약햬|요약해죠|요약혀/g, '요약해'],
  [/보네|보내져|보내죠/g, '보내'],
  [/디엠|\bdm\b/gi, 'DM'],
  [/알려죠|알려져|알려주라/g, '알려줘'],
  [/만드러|맹글어|만들어죠/g, '만들어'],
  [/잡아죠|잡아져/g, '잡아줘'],
  [/할일/g, '할 일'],
]

export function normalize(raw: string) {
  let s = raw.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [re, to] of TYPOS) s = s.replace(re, to)
  // missing spaces: "오늘지각했냐고메시지보내" → "오늘 지각했냐고 메시지 보내"
  s = s
    .replace(/(오늘|내일|어제|모레|그제)(?!은|는|이|도|의|부터|까지|에|자|날|로|만|중|안|하루)(?=[가-힣])/g, '$1 ')
    .replace(/([가-힣])(메시지|DM)(?=\s*(?:로|를|좀)?\s*(?:보내|전해|남겨|날려))/g, '$1 $2')
    .replace(/(고)(메시지|DM|보내|전해|물어|알려|공지)/g, '$1 $2')
    .replace(/(메시지|DM)(보내|전해|남겨|날려)/g, '$1 $2')
  return s
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* ───────────── hangul helpers ───────────── */

const isHangul = (ch: string) => /[가-힣]/.test(ch)
const decompose = (ch: string) => {
  const c = ch.charCodeAt(0) - 0xac00
  return { l: Math.floor(c / 588), v: Math.floor((c % 588) / 28), t: c % 28 }
}
const compose = (l: number, v: number, t: number) => String.fromCharCode(0xac00 + l * 588 + v * 28 + t)
export const hasBatchim = (word: string) => {
  const last = word.trim().slice(-1)
  if (!last) return false
  if (!isHangul(last)) return /[136780lmnr]$/i.test(last) // 1(일) 3(삼) 6(육) 7(칠) 8(팔) 0(영) + l/m/n/r
  return decompose(last).t !== 0
}
/** Attach the right particle: josa('PRD 리뷰', '을/를') → 'PRD 리뷰를' */
export function josa(word: string, pair: '을/를' | '이/가' | '은/는' | '과/와' | '으로/로' | '이에요/예요' | '이라고/라고') {
  const [withB, without] = pair.split('/')
  const last = word.trim().slice(-1)
  if (pair === '으로/로' && isHangul(last) && decompose(last).t === 8) return word + '로' // ㄹ받침
  return word + (hasBatchim(word) ? withB : without)
}

/* ───────────── people ───────────── */

const ALIASES: Record<string, string[]> = {
  u_ceo: ['대표님', '대표', 'CEO', '사장님'],
  u_cto: ['CTO'],
  u_global: ['에밀리', 'Emily'],
}
const RECIPIENT_P = '(?:님|씨)?\\s*(?:한테|에게|께|께서|더러)'
const AFTER_NAME = '(?=$|[^가-힣]|님|씨|한테|에게|께|이랑|랑|하고|과|와|이|가|은|는|을|를|의|도|만|이나|이가|이는|이를|이의|이한테|이에게)'

export interface PersonHit<U extends PersonLike = PersonLike> {
  user: U
  /** "박서준한테" — the whole matched phrase incl. honorific/particle */
  phrase: string
  index: number
  /** followed by 한테/에게/께 */
  recipient: boolean
}

export function findPeople<U extends PersonLike>(text: string, users: U[]): PersonHit<U>[] {
  const hits: PersonHit<U>[] = []
  for (const u of users) {
    const names = [u.name, u.nameEn, u.nameEn.split(' ')[0], ...(ALIASES[u.id] ?? [])]
    if (/^[가-힣]{3}$/.test(u.name)) names.push(u.name.slice(1))
    const sorted = [...new Set(names)].filter((n) => n.length >= 2).sort((a, b) => b.length - a.length)
    for (const n of sorted) {
      const isGiven = n.length === 2 && /^[가-힣]+$/.test(n)
      const before = isGiven || /^[A-Za-z]/.test(n) ? '(?<![가-힣A-Za-z])' : ''
      // "서준이한테" — the vocative/subject 이 after a given name ending in a final consonant
      const yi = isGiven && hasBatchim(n) ? '(?:이(?=\\s*(?:한테|에게|랑|하고|가|는|를|도|의|$)))?' : ''
      const re = new RegExp(`${before}${escapeRe(n)}${isGiven ? AFTER_NAME : ''}${yi}(\\s*(?:대표님|대표|이사님|팀장님|팀장|매니저님|리드님|책임님|선임님|님|씨))?(\\s*(?:한테|에게|께서|께|더러))?((?:이랑|랑|하고|과|와)(?![가-힣]))?`, 'i')
      const m = re.exec(text)
      if (m) {
        if (hits.some((h) => h.user.id === u.id)) break
        // a 2-char given name inside a longer matched full name of someone else is not a hit
        if (hits.some((h) => m.index >= h.index && m.index < h.index + h.phrase.length)) break
        hits.push({ user: u, phrase: m[0], index: m.index, recipient: !!m[2] })
        break
      }
    }
  }
  return hits.sort((a, b) => a.index - b.index)
}
export const RECIPIENT_RE = new RegExp(RECIPIENT_P)

/* ───────────── channels ───────────── */

const CHANNEL_ALIASES: Record<string, string> = { 전사: 'general', 랜덤: 'random', 잡담: 'random', 엔지니어링: 'engineering', 개발: 'engineering', 디자인: 'design', 제품: 'product', 마케팅: 'marketing', 영업: 'sales-wins', 장애: 'incidents', 리더십: 'leadership' }

export interface ChannelHit<C extends ChannelLike = ChannelLike> { channel: C; phrase: string; index: number }

/** `channels` = named (public/private, non-archived) channels. */
export function findChannelIn<C extends ChannelLike>(text: string, named: C[]): ChannelHit<C> | null {
  const byName = (n: string) => named.find((c) => c.name.toLowerCase() === n.toLowerCase())
  const tag = /#([\w가-힣-]+)(\s*채널)?(\s*(?:에다가|에다|에서|에|의|을|를|은|는|로|으로))?/.exec(text)
  if (tag) {
    let name = tag[1]
    let ch = byName(name)
    // "#general에" → strip trailing hangul particles glued to the tag
    while (!ch && /[가-힣]$/.test(name)) { name = name.slice(0, -1); ch = byName(name) }
    if (!ch) ch = named.filter((c) => tag[1].toLowerCase().startsWith(c.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0]
    if (!ch) ch = named.find((c) => c.name.toLowerCase().includes(tag[1].toLowerCase()))
    if (ch) return { channel: ch, phrase: tag[0], index: tag.index }
  }
  for (const c of [...named].sort((a, b) => b.name.length - a.name.length)) {
    const m = new RegExp(`(?<![\\w-])${escapeRe(c.name)}(?![\\w-])(\\s*채널)?(\\s*(?:에다가|에다|에서|에|의|을|를|은|는|로|으로))?`, 'i').exec(text)
    if (m) return { channel: c, phrase: m[0], index: m.index }
  }
  const alias = /([가-힣]+)\s*채널(\s*(?:에다가|에다|에서|에|의|을|를|은|는|로|으로))?/.exec(text)
  if (alias && CHANNEL_ALIASES[alias[1]]) {
    const ch = byName(CHANNEL_ALIASES[alias[1]])
    if (ch) return { channel: ch, phrase: alias[0], index: alias.index }
  }
  return null
}

/* ───────────── dates ───────────── */

export interface DateHit { date: Date; phrase: string; index: number; kind: 'day' | 'week'; label: string }

const WD: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }
const DATE_TAIL = '(?:\\s*(?:부터|까지|에서|에는|에|의|로|은|는|이|가|자|날))?'

function mondayOf(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay()
  return addDays(x, day === 0 ? -6 : 1 - day)
}

/** All date mentions in order of appearance. */
export function findDates(text: string, now = new Date()): DateHit[] {
  const today = startOfDay(now)
  const out: DateHit[] = []
  const taken: [number, number][] = []
  const push = (m: RegExpExecArray, date: Date, kind: DateHit['kind'] = 'day') => {
    const s = m.index, e = m.index + m[0].length
    if (taken.some(([a, b]) => s < b && e > a)) return
    taken.push([s, e])
    out.push({ date, phrase: m[0], index: s, kind, label: m[0].trim() })
  }
  const each = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = g.exec(text))) fn(m)
  }
  const valid = (y: number, mo: number, d: number) => mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && new Date(y, mo - 1, d).getMonth() === mo - 1

  each(new RegExp(`(\\d{4})[-./](\\d{1,2})[-./](\\d{1,2})${DATE_TAIL}`), (m) => {
    if (valid(+m[1], +m[2], +m[3])) push(m, new Date(+m[1], +m[2] - 1, +m[3]))
  })
  each(new RegExp(`(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일${DATE_TAIL}`), (m) => {
    if (valid(now.getFullYear(), +m[1], +m[2])) push(m, new Date(now.getFullYear(), +m[1] - 1, +m[2]))
  })
  each(new RegExp(`(?<![\\d./:v])(\\d{1,2})[/.](\\d{1,2})(?![\\d./:%]|\\s*(?:시간|배|점|만|억|천|원|개|명|kg|km|GB|MB|%))${DATE_TAIL}`), (m) => {
    if (valid(now.getFullYear(), +m[1], +m[2])) push(m, new Date(now.getFullYear(), +m[1] - 1, +m[2]))
  })
  const rel: [RegExp, number][] = [[/오늘|금일|today/i, 0], [/내일|낼(?=\s|$|[^가-힣])|tomorrow/i, 1], [/모레/, 2], [/글피/, 3], [/어제|yesterday/i, -1], [/그저께|그제/, -2]]
  for (const [re, n] of rel) each(new RegExp(`(?:${re.source})${DATE_TAIL}`, re.flags), (m) => push(m, addDays(today, n)))
  each(new RegExp(`(이번|다음|담|다다음|지난|저번)\\s*주\\s*([월화수목금토일])(?:요일)?${DATE_TAIL}`), (m) => {
    const off = { 이번: 0, 다음: 7, 담: 7, 다다음: 14, 지난: -7, 저번: -7 }[m[1]] ?? 0
    const wd = WD[m[2]]
    push(m, addDays(mondayOf(now), off + (wd === 0 ? 6 : wd - 1)))
  })
  each(new RegExp(`(?<![가-힣])([월화수목금토일])요일${DATE_TAIL}`), (m) => {
    const wd = WD[m[1]]
    const diff = (wd - today.getDay() + 7) % 7
    push(m, addDays(today, diff))
  })
  each(new RegExp(`(\\d{1,2})\\s*(일|주|달|개월)\\s*(?:후|뒤)${DATE_TAIL}`), (m) => {
    const n = +m[1]
    push(m, m[2] === '일' ? addDays(today, n) : m[2] === '주' ? addDays(today, n * 7) : addMonths(today, n))
  })
  each(new RegExp(`(이번|다음|담|지난)\\s*주(?![가-힣])${DATE_TAIL}`), (m) => {
    const off = { 이번: 0, 다음: 7, 담: 7, 지난: -7 }[m[1]] ?? 0
    push(m, addDays(mondayOf(now), off), 'week')
  })
  each(new RegExp(`(?<![\\d가-힣/.])(\\d{1,2})\\s*일(?!\\s*(?:후|뒤|간|동안|지연|째|치|이내|전))${DATE_TAIL}`), (m) => {
    if (valid(now.getFullYear(), now.getMonth() + 1, +m[1])) push(m, new Date(now.getFullYear(), now.getMonth(), +m[1]))
  })
  return out.sort((a, b) => a.index - b.index)
}

/* ───────────── times / durations ───────────── */

export interface TimeHit { h: number; m: number; phrase: string; index: number }

export function findTime(text: string): TimeHit | null {
  const re = /(오전|오후|아침|점심|저녁|밤|낮|새벽|am|pm)?\s*(\d{1,2})\s*시(?!간|쯤에?\s*끝)\s*(?:(\d{1,2})\s*분|(반))?(?:\s*(?:쯤|경|정각))?(?:\s*(?:부터|까지|에|으로|로))?/i
  const m = re.exec(text)
  if (m) {
    let h = +m[2]
    const min = m[4] ? 30 : m[3] ? +m[3] : 0
    const ap = (m[1] ?? '').toLowerCase()
    if (/오후|저녁|밤|pm/.test(ap) && h < 12) h += 12
    else if (/점심|낮/.test(ap) && h < 6) h += 12
    else if (!ap && h >= 1 && h <= 7) h += 12 // "3시" → 15:00 during business hours
    if (/오전|새벽|아침|am/.test(ap) && h === 12) h = 0
    if (h > 23 || min > 59) return null
    return { h, m: min, phrase: m[0], index: m.index }
  }
  const c = /(?<!\d)(\d{1,2}):(\d{2})(?!\d)(?:\s*(?:부터|까지|에|으로|로))?/.exec(text)
  if (c && +c[1] < 24 && +c[2] < 60) return { h: +c[1], m: +c[2], phrase: c[0], index: c.index }
  const noon = /정오(?:\s*(?:에|부터))?/.exec(text)
  if (noon) return { h: 12, m: 0, phrase: noon[0], index: noon.index }
  return null
}

export function findDuration(text: string): { minutes: number; phrase: string } | null {
  const m = /(\d+(?:\.\d+)?)\s*시간(?:\s*(\d+)\s*분)?(?:\s*(?:동안|짜리|정도|간))?(?!\s*(?:전|후|뒤))/.exec(text)
  if (m) return { minutes: Math.round(+m[1] * 60 + (m[2] ? +m[2] : 0)), phrase: m[0] }
  const n = /(\d+)\s*분\s*(?:동안|짜리|정도|간)/.exec(text)
  if (n) return { minutes: +n[1], phrase: n[0] }
  return null
}

/* ───────────── amounts ───────────── */

export function findAmount(text: string): { amount: number; phrase: string } | null {
  const m = /(?:(\d[\d,]*)\s*만)?\s*(?:(\d[\d,]*)\s*천)?\s*(\d[\d,]*)?\s*원/.exec(text)
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  const n = (s?: string) => (s ? +s.replace(/,/g, '') : 0)
  const amount = n(m[1]) * 10000 + n(m[2]) * 1000 + n(m[3])
  return amount > 0 ? { amount, phrase: m[0] } : null
}

/* ───────────── indirect speech → polite message ───────────── */

const VERB_A: Record<string, string> = { 오: '와', 가: '가', 보: '봐', 주: '줘', 하: '해', 되: '돼', 두: '둬', 쓰: '써', 끄: '꺼', 서: '서', 사: '사', 자: '자', 켜: '켜', 보내: '보내', 알리: '알려', 기다리: '기다려', 내리: '내려', 마시: '마셔' }
const QUESTION_WORD = /(언제|어디|뭐|무엇|무슨|누구|왜|어떻게|몇\s*\S*|얼마)/

function conjugateA(stem: string) {
  for (const k of Object.keys(VERB_A).sort((a, b) => b.length - a.length)) if (stem.endsWith(k)) return stem.slice(0, -k.length) + VERB_A[k]
  const last = stem.slice(-1)
  if (!isHangul(last)) return stem + ' 해'
  const { v } = decompose(last)
  return stem + (v === 0 || v === 8 ? '아' : '어') // ㅏ, ㅗ → 아
}

function politeQuestion(stem: string) {
  const s = stem.trim()
  if (/했$/.test(s)) return s.slice(0, -1) + '하셨나요?'
  const past: [RegExp, string][] = [[/먹었$/, '드셨'], [/봤$/, '보셨'], [/왔$/, '오셨'], [/갔$/, '가셨'], [/받았$/, '받으셨'], [/잤$/, '주무셨'], [/줬$/, '주셨'], [/썼$/, '쓰셨'], [/읽었$/, '읽으셨']]
  for (const [re, to] of past) if (re.test(s)) return s.replace(re, to) + '나요?'
  const lastCh = s.slice(-1)
  if (isHangul(lastCh) && (decompose(lastCh).t === 20 || /겠$/.test(s))) return s + '나요?' // past/ㅆ: 끝났 → 끝났나요?
  if (/있$/.test(s)) return s + '으신가요?'
  if (/없$/.test(s)) return s + '으신가요?'
  if (/(이|하)$/.test(s) && /하$/.test(s)) return s + '시나요?'
  if (QUESTION_WORD.test(s.split(' ').slice(-1)[0]) || /(시|날|때|곳|건|거)$/.test(s)) return s.replace(/이$/, '') + '인가요?'
  const last = s.slice(-1)
  if (!isHangul(last)) return s + '인가요?'
  const { t } = decompose(last)
  if (t === 0) return s + '시나요?'
  if (t === 8) return s.slice(0, -1) + compose(decompose(last).l, decompose(last).v, 0) + '시나요?' // ㄹ탈락: 만들 → 만드시나요
  return s + '으시나요?'
}

function politeStatement(stem: string) {
  // stem = text before the final "다" (e.g. "늦는", "간", "있", "했", "바쁘")
  const s = stem.trim()
  if (/는$/.test(s)) return s.slice(0, -1) + '습니다.'
  const last = s.slice(-1)
  if (!isHangul(last)) return s + '입니다.'
  const { l, v, t } = decompose(last)
  if (t === 4) return s.slice(0, -1) + compose(l, v, 17) + '니다.' // ㄴ다 → ㅂ니다 (간다 → 갑니다)
  if (t === 0) return s.slice(0, -1) + compose(l, v, 17) + '니다.' // 바쁘다 → 바쁩니다
  return s + '습니다.'
}

/**
 * Turns an indirect-speech fragment from a command into a natural polite message.
 *  "오늘 지각했냐고" → { text: "혹시 오늘 지각하셨나요?" }
 *  "내일 회의 10분 늦는다고" → "내일 회의 10분 늦습니다."
 *  "PR 리뷰 좀 해달라고" → "PR 리뷰 좀 해 주실 수 있을까요?"
 */
export function toPolite(fragment: string): { text: string; question: boolean } {
  let s = fragment.trim().replace(/^[,.\s]+|[,\s]+$/g, '')
  if (!s) return { text: '', question: false }
  let m: RegExpExecArray | null
  // request: "~해 달라고", "~해 줄 수 있냐고"
  if ((m = /^(.*?)(\s*해)?\s*(?:줄\s*수\s*있(?:냐|느냐|는지|으신지)고?|달라고|달래|주실\s*수\s*있는지)$/.exec(s))) {
    const base = m[1].trim()
    const joiner = m[2] ? (/(좀|빨리|꼭|다시|한번|한 번)$/.test(base) || m[2].startsWith(' ') ? ' 해' : '해') : ''
    return { text: `${base}${joiner} 주실 수 있을까요?`.trim(), question: true }
  }
  if ((m = /^(.*?)지\s*말라고$/.exec(s))) return { text: `${m[1]}지 말아 주세요.`, question: false }
  // question: "~했냐고", "~하는지"
  if ((m = /^(.*?)(?:느냐고|냐고|냐구|냐|는지|은지|나고)$/.exec(s))) {
    const q = politeQuestion(m[1])
    const prefix = QUESTION_WORD.test(s) || /^혹시/.test(s) ? '' : '혹시 '
    return { text: prefix + q, question: true }
  }
  // command: "~하라고", "~(으)라고"
  if ((m = /^(.*?)(?:하라고|하래)$/.exec(s))) return { text: `${conjugateA(m[1] + '하')} 주세요.`, question: false }
  if ((m = /^(.*?)으라고$/.exec(s))) return { text: `${conjugateA(m[1])} 주세요.`, question: false }
  if ((m = /^(.*?)(이)?라고$/.exec(s))) {
    const stem = m[1].trim()
    const lastWord = stem.split(' ').pop() ?? ''
    if (!m[2] && VERB_A[lastWord]) return { text: `${conjugateA(stem)} 주세요.`, question: false }
    return { text: `${stem}입니다.`, question: false }
  }
  // statement: "~한다고", "~했다고"
  if ((m = /^(.*?)(?:다고|다구|대)$/.exec(s))) return { text: politeStatement(m[1]), question: false }
  s = s.replace(/\s*(좀|부탁)$/, ' 부탁드립니다')
  if (!/[.!?~]$/.test(s) && /(요|다|죠|니다)$/.test(s)) s += '.'
  return { text: s, question: /\?$/.test(s) }
}

/** Strip glue particles / punctuation left over at the edges after removing entities. */
export function tidy(s: string) {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:·\-–—]+|[\s,:·\-–—]+$/g, '')
    .replace(/^(?:그리고|그럼|음|저기|혹시\s+(?=.*(?:보내|만들|잡아)))\s*/, '')
    .trim()
}
