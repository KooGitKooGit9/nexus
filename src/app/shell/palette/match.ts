const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

/** "프로젝트" → "ㅍㄹㅈㅌ" (non-Hangul chars pass through) */
export function toChosung(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00
    out += c >= 0 && c <= 11171 ? CHOSUNG[Math.floor(c / 588)] : ch
  }
  return out
}

const JAMO_ONLY = /^[ㄱ-ㅎ\s]+$/

/**
 * Score a candidate against a query. 0 = no match. Higher is better.
 * Supports substring, word-prefix, Korean initial-consonant (초성) search and loose subsequence.
 */
export function scoreMatch(query: string, ...fields: (string | undefined)[]): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  let best = 0
  for (const raw of fields) {
    if (!raw) continue
    const f = raw.toLowerCase()
    if (f === q) best = Math.max(best, 100)
    else if (f.startsWith(q)) best = Math.max(best, 80)
    else if (f.includes(' ' + q)) best = Math.max(best, 65)
    else if (f.includes(q)) best = Math.max(best, 50)
    else if (JAMO_ONLY.test(q) && toChosung(f).replace(/\s/g, '').includes(q.replace(/\s/g, ''))) best = Math.max(best, 40)
    else if (q.length >= 2 && isSubsequence(q.replace(/\s/g, ''), f)) best = Math.max(best, 10)
  }
  return best
}

function isSubsequence(q: string, s: string) {
  let i = 0
  for (const ch of s) if (ch === q[i]) i++
  return i === q.length
}
