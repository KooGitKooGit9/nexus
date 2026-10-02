/* Small Korean text helpers for the reply simulator (pure, no app imports). */

const HANGUL_BASE = 0xac00
const HANGUL_END = 0xd7a3

/** Does the last syllable have a final consonant (받침)? Non-Hangul: guess by common English/number endings. */
export function hasBatchim(word: string): boolean {
  const s = word.replace(/[\s\p{Extended_Pictographic}️‍!?.~)]+$/gu, '')
  const ch = s.charCodeAt(s.length - 1)
  if (Number.isNaN(ch)) return false
  if (ch >= HANGUL_BASE && ch <= HANGUL_END) return (ch - HANGUL_BASE) % 28 !== 0
  const last = s[s.length - 1].toLowerCase()
  if (/[0-9]/.test(last)) return '013678'.includes(last)
  return /[lmnr]/.test(last)
}

/** Final consonant is ㄹ (for 으로/로). */
function batchimIsRieul(word: string) {
  const ch = word.charCodeAt(word.length - 1)
  return ch >= HANGUL_BASE && ch <= HANGUL_END && (ch - HANGUL_BASE) % 28 === 8
}

/** Attach a particle pair like "이/가", "은/는", "을/를", "과/와", "으로/로", "이에요/예요", "이면/면", "이랑/랑". */
export function josa(word: string, pair: string): string {
  const [a, b] = pair.split('/')
  if (b === undefined) return word + a
  if (a === '으로') return word + (hasBatchim(word) && !batchimIsRieul(word) ? '으로' : '로')
  return word + (hasBatchim(word) ? a : b)
}

/** "김하늘" → "하늘", "Emily Carter" → "Emily". */
export function shortName(full: string): string {
  if (!full) return ''
  if (/^[A-Za-z]/.test(full)) return full.split(' ')[0]
  return full.length >= 3 ? full.slice(1) : full
}

/**
 * Template filling. `{key}` → value, `{key:이/가}` → value + particle.
 * Unknown keys are left as-is so we can detect them in tests.
 */
export function fillTemplate(t: string, vars: Record<string, string | undefined>): string {
  return t.replace(/\{(\w+)(?::([^}]+))?\}/g, (whole, key: string, pair?: string) => {
    const v = vars[key]
    if (v == null) return whole
    return pair ? josa(v, pair) : v
  })
}

export function pickOne<T>(arr: readonly T[], rnd = Math.random): T {
  return arr[Math.floor(rnd() * arr.length)]
}

export function shuffle<T>(arr: readonly T[], rnd = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Strip markdown / mentions / urls / emoji so classification only sees words. */
export function plain(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' 코드 ')
    .replace(/`[^`]*`/g, ' 코드 ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_~>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
