/**
 * Doc lookup + markdown summarizer for Nexus AI — PURE (only imports ./nlp).
 */
import { findDates, normalize, addDays, startOfDay, dayDiff, sameDay, type DateHit } from './nlp'

export interface DocLike { id: string; title: string; content: string; tags?: string[]; parentId: string | null; createdAt: string; updatedAt: string }

/* ───────────── query ───────────── */

export interface DocQuery { keywords: string[]; date?: Date; week?: { from: Date; to: Date }; dateLabel?: string }

const STOP = new Set([
  '요약', '요약해', '요약해줘', '정리', '정리해', '정리해줘', '내용', '핵심', '핵심만', '요점', '알려줘', '알려', '보여줘', '보여', '읽어줘', '좀', '해줘', '줘', '해',
  '문서', '관련', '대해', '대한', '에', '의', '뭐였어', '뭐였지', '뭐야', '뭐', '있어', '어떻게', '됐어', '간단히', '간단하게', '짧게', '한눈에', '그', '그거', '거', '것',
  '지난', '저번', '이전', '마지막', '최근', '최신', '부탁해', '부탁', '주세요', '줄래', '해주세요', '살펴봐줘', '훑어줘', '무슨', '얘기', '이야기', '나왔어', '결정', '사항', '액션', '아이템', '했어', '했던', '했지', '있었던', '지난번',
])
const SYNONYMS: Record<string, string[]> = {
  회의록: ['회의록', '싱크', '회의', '미팅'],
  회의: ['회의록', '싱크', '회의'],
  미팅: ['회의록', '싱크', '미팅'],
  싱크: ['싱크', '회의록'],
  런북: ['런북', '온콜', 'runbook'],
  온콜: ['온콜', '런북'],
  prd: ['prd', '요구사항'],
  기획서: ['prd', '기획'],
  로드맵: ['로드맵', 'roadmap'],
  회고: ['회고', 'kpt', 'retro'],
  릴리즈: ['릴리즈', 'release'],
  릴리즈노트: ['릴리즈', 'release'],
  복지: ['복지', '휴가'],
  휴가: ['휴가', '복지'],
  디자인시스템: ['디자인 시스템', '디자인'],
  아키텍처: ['아키텍처', 'architecture'],
  코드리뷰: ['코드 리뷰'],
}

export function docQuery(raw: string, now = new Date()): DocQuery {
  const t = normalize(raw)
  const dates: DateHit[] = findDates(t, now)
  let s = t
  for (const d of dates) s = s.replace(d.phrase, ' ')
  s = s.replace(/디자인\s*시스템/g, '디자인시스템').replace(/코드\s*리뷰/g, '코드리뷰').replace(/릴리즈\s*노트/g, '릴리즈노트')
  const words = s
    .replace(/[?!.,"'“”‘’()[\]:]/g, ' ')
    .split(/\s+/)
    .map((w) => { const x = w.replace(/(이랑|에서|으로|에는|이란|이라는|라는|까지|부터|은|는|이|가|을|를|에|의|로|와|과|랑|도|만)$/, ''); return x.length >= 2 ? x : w })
    .map((w) => w.replace(/(요약해줘|요약해|정리해줘|정리해|알려줘|보여줘|해줘|좀)$/, ''))
    .filter((w) => w.length >= 2 && !STOP.has(w) && !/^(요약|정리|알려|보여|읽어)/.test(w) && !/(했어|했지|했나|했는지|됐어|됐지|있어|없어|였어|이야|해줘|줘)$/.test(w))
  const keywords = [...new Set(words.flatMap((w) => SYNONYMS[w.toLowerCase()] ?? [w.toLowerCase()]))]
  const day = dates.find((d) => d.kind === 'day')
  const week = dates.find((d) => d.kind === 'week')
  if (day) return { keywords, date: day.date, dateLabel: `${day.date.getMonth() + 1}월 ${day.date.getDate()}일` }
  if (week) return { keywords, week: { from: week.date, to: addDays(week.date, 6) }, dateLabel: week.label.replace(/(에|의|은|는)$/, '') }
  return { keywords }
}

/* ───────────── ranking ───────────── */

/** Best-effort date of a doc: title "… 10/1", then "10월 1일" near the top of the content. */
export function docDate(d: DocLike, now = new Date()): Date | undefined {
  const fromTitle = findDates(d.title, now).find((x) => x.kind === 'day')
  if (fromTitle) return fixYear(fromTitle.date, now)
  const head = d.content.slice(0, 240)
  const m = /(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(head)
  if (m) return m[1] ? new Date(+m[1], +m[2] - 1, +m[3]) : fixYear(new Date(now.getFullYear(), +m[4] - 1, +m[5]), now)
  return undefined
}
/** "12/28" mentioned in early January means last year. */
const fixYear = (d: Date, now: Date) => (dayDiff(d, now) > 60 ? new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()) : d)

export interface DocHit<D extends DocLike> { doc: D; score: number; date?: Date; exactDate: boolean }

export function rankDocs<D extends DocLike>(q: DocQuery, docs: D[], now = new Date()): DocHit<D>[] {
  const byId = new Map(docs.map((d) => [d.id, d]))
  const hasChildren = new Set(docs.map((d) => d.parentId).filter(Boolean) as string[])
  const out: DocHit<D>[] = []
  for (const d of docs) {
    const title = d.title.toLowerCase()
    const tags = (d.tags ?? []).map((x) => x.toLowerCase())
    const parent = d.parentId ? byId.get(d.parentId)?.title.toLowerCase() ?? '' : ''
    const content = d.content.toLowerCase()
    let score = 0
    let kwHits = 0
    for (const k of q.keywords) {
      let s = 0
      if (title.includes(k)) s = 6
      else if (tags.some((x) => x.includes(k))) s = 4
      else if (parent.includes(k)) s = 3
      else if (k.length >= 2 && content.includes(k)) s = 1
      if (s) kwHits++
      score += s
    }
    if (q.keywords.length && !kwHits) score -= 3
    const date = docDate(d, now)
    let exactDate = false
    if (q.date) {
      if (date) {
        const diff = Math.abs(dayDiff(date, q.date))
        exactDate = diff === 0
        score += exactDate ? 12 : Math.max(0, 7 - diff)
      } else if (sameDay(new Date(d.createdAt), q.date) || sameDay(new Date(d.updatedAt), q.date)) score += 3
    } else if (q.week) {
      const ref = date ?? new Date(d.createdAt)
      exactDate = +ref >= +startOfDay(q.week.from) && +ref < +addDays(startOfDay(q.week.to), 1)
      if (exactDate) score += date ? 10 : 4
    } else if (date && q.keywords.length) {
      // "회의록 요약" with no date → prefer the most recent dated doc
      score += Math.max(0, 2 - Math.abs(dayDiff(date, now)) / 7)
    }
    // folders / index pages are rarely what people want summarized
    if (hasChildren.has(d.id) && d.content.length < 400) score -= 4
    if (!d.content.trim()) score -= 2
    // tiny recency tie-breaker
    score += Math.max(0, 0.5 - (+now - +new Date(d.updatedAt)) / (86400000 * 30))
    out.push({ doc: d, score, date, exactDate })
  }
  return out.sort((a, b) => b.score - a.score)
}

/* ───────────── markdown summarizer ───────────── */

export interface ActionItem { text: string; owner?: string; due?: string; done: boolean }
export interface DocSection { title: string; points: string[]; kind: 'agenda' | 'normal' }
export interface DocSummary {
  meta: string[]
  intro?: string
  sections: DocSection[]
  decisions: string[]
  actions: ActionItem[]
  quotes: string[]
  words: number
}

/** Strip inline markdown: **b**, `c`, [l](u), callout markers. */
export function plain(s: string) {
  return s
    .replace(/\[!([^\]]*)\]\s*/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

const DECISION_H = /(결정|합의|확정|decision|결론)/i
const ACTION_H = /(액션|action|todo|할\s*일|후속|next\s*step|다음\s*단계|try)/i
const AGENDA_H = /(아젠다|안건|agenda)/i
const SKIP_H = /^(목차|toc|table of contents)$/i

function parseAction(raw: string, done: boolean): ActionItem {
  let text = plain(raw)
  let owner: string | undefined
  let due: string | undefined
  const o = /@([^\s,()·—–-]+)/.exec(text)
  if (o) { owner = o[1]; text = text.replace(o[0], '') }
  const d = /\(([^)]*(?:\d{1,2}\/\d{1,2}|\d{1,2}월\s*\d{1,2}일|까지|오늘|내일|금요일|월요일)[^)]*)\)/.exec(text)
  if (d) { due = d[1].trim(); text = text.replace(d[0], '') }
  text = text.replace(/\s*[—–-]\s*$/, '').replace(/\s*[—–-]\s*(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim()
  return { text, owner, due, done }
}

export function summarizeMarkdown(md: string): DocSummary {
  const lines = md.replace(/\r/g, '').split('\n')
  const meta: string[] = []
  const decisions: string[] = []
  const actions: ActionItem[] = []
  const quotes: string[] = []
  const sections: DocSection[] = []
  let intro: string | undefined
  let cur: DocSection | null = null
  type Mode = 'normal' | 'decision' | 'action' | 'agenda'
  let mode = 'normal' as Mode
  let h2Mode = 'normal' as Mode
  let inCode = false
  let inTable = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const isRow = /^\s*\|/.test(line)
    const header = isRow && !inTable
    inTable = isRow
    if (/^\s*```/.test(line)) { inCode = !inCode; continue }
    if (inCode || !line.trim()) continue
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      const title = plain(h[2]).replace(/^[^\p{L}\p{N}]+/u, '').trim() || plain(h[2])
      const level = h[1].length
      const m: Mode = DECISION_H.test(title) ? 'decision' : ACTION_H.test(title) ? 'action' : AGENDA_H.test(title) ? 'agenda' : 'normal'
      if (level <= 2) h2Mode = m
      mode = m === 'normal' && level >= 3 ? h2Mode : m
      if (SKIP_H.test(title) || level === 1) { cur = null; continue }
      cur = { title, points: [], kind: mode === 'agenda' ? 'agenda' : 'normal' }
      if (mode === 'normal' || mode === 'agenda') sections.push(cur)
      continue
    }
    const q = /^\s*>\s?(.*)$/.exec(line)
    if (q) {
      const text = plain(q[1])
      if (!text) continue
      if (/(일시|참석|장소|작성자|날짜)\s*[:：]/.test(text)) meta.push(text)
      else if (/[—–-]\s*[가-힣A-Za-z]{2,10}\s*$/.test(text) && cur) quotes.push(text)
      else if (!cur && !intro) intro = text
      else if (cur) cur.points.push(text)
      continue
    }
    const cb = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line)
    if (cb) {
      const done = cb[1].toLowerCase() === 'x'
      if (mode === 'decision') decisions.push(plain(cb[2]))
      else if (mode === 'action' || /@[가-힣A-Za-z]/.test(cb[2])) actions.push(parseAction(cb[2], done))
      else cur?.points.push(`${done ? '✓ ' : ''}${plain(cb[2])}`)
      continue
    }
    const li = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line)
    if (li) {
      if (mode === 'decision') decisions.push(plain(li[1]))
      else if (mode === 'action') actions.push(parseAction(li[1], false))
      else if (cur) cur.points.push(plain(li[1]))
      else if (!intro) intro = plain(li[1])
      continue
    }
    if (isRow) {
      if (header || /^\s*\|?\s*:?-{2,}/.test(line)) continue
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => plain(c))
      if (cur && cells.length >= 2 && cells[0]) cur.points.push(cells.join(' · '))
      continue
    }
    const text = plain(line)
    if (!cur) { if (!intro) intro = text }
    else if (mode === 'decision') decisions.push(text)
    else cur.points.push(text)
  }
  const words = md.replace(/[#>*`|\-[\]()]/g, ' ').split(/\s+/).filter(Boolean).length
  return { meta, intro, sections: sections.filter((s) => s.points.length), decisions, actions, quotes, words }
}
