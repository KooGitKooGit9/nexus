/**
 * Tool-argument validation + entity resolution for the Gemini agent.
 *
 * PURE MODULE (type-only import from ./gemini) so it can be unit-tested with plain node.
 * Models occasionally send "3" for a number, a single string for an array, or a person's name where
 * an id is expected — we coerce what is unambiguous and return a precise error otherwise, so the
 * model can correct itself on the next round.
 */
import type { Schema } from './gemini'

export type ArgResult = { ok: true; args: Record<string, unknown> } | { ok: false; error: string }

function coerce(schema: Schema, value: unknown, path: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: undefined }
  switch (schema.type) {
    case 'STRING': {
      let v: string
      if (typeof value === 'string') v = value
      else if (typeof value === 'number' || typeof value === 'boolean') v = String(value)
      else return { ok: false, error: `'${path}'는 문자열이어야 합니다` }
      if (schema.enum?.length) {
        const hit = schema.enum.find((e) => e === v) ?? schema.enum.find((e) => e.toLowerCase() === v.trim().toLowerCase())
        if (!hit) return { ok: false, error: `'${path}'는 ${schema.enum.map((e) => `"${e}"`).join(', ')} 중 하나여야 합니다 (받은 값: "${v}")` }
        v = hit
      }
      return { ok: true, value: v }
    }
    case 'INTEGER':
    case 'NUMBER': {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value.replace(/[,_\s]/g, '')) : NaN
      if (!Number.isFinite(n)) return { ok: false, error: `'${path}'는 숫자여야 합니다` }
      return { ok: true, value: schema.type === 'INTEGER' ? Math.round(n) : n }
    }
    case 'BOOLEAN': {
      if (typeof value === 'boolean') return { ok: true, value }
      if (value === 'true' || value === 1 || value === '1') return { ok: true, value: true }
      if (value === 'false' || value === 0 || value === '0') return { ok: true, value: false }
      return { ok: false, error: `'${path}'는 true/false여야 합니다` }
    }
    case 'ARRAY': {
      let arr: unknown[]
      if (Array.isArray(value)) arr = value
      else if (typeof value === 'string' && schema.items?.type === 'STRING') arr = value.split(/\s*,\s*/).filter(Boolean)
      else arr = [value]
      const out: unknown[] = []
      for (let i = 0; i < arr.length; i++) {
        const r = schema.items ? coerce(schema.items, arr[i], `${path}[${i}]`) : { ok: true as const, value: arr[i] }
        if (!r.ok) return r
        if (r.value !== undefined) out.push(r.value)
      }
      return { ok: true, value: out }
    }
    case 'OBJECT': {
      if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: `'${path}'는 객체여야 합니다` }
      const r = validateObject(schema, value as Record<string, unknown>, path)
      return r.ok ? { ok: true, value: r.args } : r
    }
  }
}

function validateObject(schema: Schema, obj: Record<string, unknown>, prefix: string): ArgResult {
  const out: Record<string, unknown> = {}
  const props = schema.properties ?? {}
  for (const [k, v] of Object.entries(obj)) {
    const s = props[k]
    if (!s) continue // ignore unknown keys
    const r = coerce(s, v, prefix ? `${prefix}.${k}` : k)
    if (!r.ok) return r
    if (r.value !== undefined) out[k] = r.value
  }
  for (const req of schema.required ?? []) {
    const v = out[req]
    if (v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) {
      return { ok: false, error: `필수 인자 '${prefix ? `${prefix}.` : ''}${req}'가 비어 있습니다` }
    }
  }
  return { ok: true, args: out }
}

/** Validate + coerce raw functionCall args against a declaration's parameter schema. */
export function validateArgs(schema: Schema | undefined, raw: unknown): ArgResult {
  if (!schema) return { ok: true, args: {} }
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return validateObject(schema, obj, '')
}

/* ───────────── entity resolution ───────────── */

export interface PersonRef { id: string; name: string; nameEn: string; title?: string; department?: string }

export type Resolved<T> = { ok: true; value: T } | { ok: false; error: string }

const cleanRef = (s: string) => s.trim().replace(/^@/, '').replace(/\s*(님|씨|에게|한테|께)$/, '').trim()

/**
 * Person by id, full name, English name, given name ("서준"), or a unique partial match.
 * `meId` resolves "me"/"나"/"내".
 */
export function resolvePerson<U extends PersonRef>(ref: string, users: U[], meId?: string): Resolved<U> {
  const r = cleanRef(ref)
  if (!r) return { ok: false, error: '사람이 지정되지 않았습니다' }
  const lower = r.toLowerCase()
  if (meId && /^(me|나|내|저|본인|myself)$/i.test(r)) {
    const me = users.find((u) => u.id === meId)
    if (me) return { ok: true, value: me }
  }
  const tiers: ((u: U) => boolean)[] = [
    (u) => u.id === r,
    (u) => u.name === r,
    (u) => u.nameEn.toLowerCase() === lower,
    (u) => /^[가-힣]{3,4}$/.test(u.name) && u.name.slice(1) === r,
    (u) => u.nameEn.split(/\s+/)[0]?.toLowerCase() === lower,
    (u) => u.name.includes(r) || r.includes(u.name) || u.nameEn.toLowerCase().includes(lower),
  ]
  for (const t of tiers) {
    const hits = users.filter(t)
    if (hits.length === 1) return { ok: true, value: hits[0] }
    if (hits.length > 1) {
      return { ok: false, error: `"${r}"에 해당하는 사람이 여러 명입니다: ${hits.map((u) => `${u.name}(${u.id}${u.title ? `, ${u.title}` : ''})`).join(', ')}. 사용자에게 누구인지 확인하세요.` }
    }
  }
  return { ok: false, error: `"${r}"라는 구성원을 찾지 못했습니다. list_people로 확인하세요.` }
}

export function resolvePeople<U extends PersonRef>(refs: string[], users: U[], meId?: string): Resolved<U[]> {
  const out: U[] = []
  for (const ref of refs) {
    const r = resolvePerson(ref, users, meId)
    if (!r.ok) return r
    if (!out.some((u) => u.id === r.value.id)) out.push(r.value)
  }
  return { ok: true, value: out }
}

/** Generic id/name lookup: exact id → exact label (case-insensitive) → unique partial. */
export function resolveNamed<T extends { id: string }>(ref: string, items: T[], labels: (t: T) => string[], what: string): Resolved<T> {
  const r = ref.trim().replace(/^#/, '')
  if (!r) return { ok: false, error: `${what}이(가) 지정되지 않았습니다` }
  const lower = r.toLowerCase()
  const byId = items.find((t) => t.id === r)
  if (byId) return { ok: true, value: byId }
  const exact = items.filter((t) => labels(t).some((l) => l.toLowerCase() === lower))
  if (exact.length === 1) return { ok: true, value: exact[0] }
  const partial = exact.length ? exact : items.filter((t) => labels(t).some((l) => l && l.toLowerCase().includes(lower)))
  if (partial.length === 1) return { ok: true, value: partial[0] }
  if (partial.length > 1) {
    return { ok: false, error: `"${r}"에 해당하는 ${what}이(가) 여러 개입니다: ${partial.slice(0, 6).map((t) => `${labels(t)[0]}(${t.id})`).join(', ')}` }
  }
  return { ok: false, error: `"${r}" ${what}을(를) 찾지 못했습니다` }
}

/* ───────────── dates ───────────── */

/**
 * ISO 8601 date-time (with or without offset — without offset = local time) or a plain
 * `YYYY-MM-DD` (local midnight). Returns null when unparseable.
 */
export function parseWhen(s: string | undefined | null): Date | null {
  if (!s) return null
  const t = String(s).trim()
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t)
  if (local) return new Date(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4]), Number(local[5]), Number(local[6] ?? 0))
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

/** End of the local day of `d`. */
export const endOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
export const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** "NX-12" → { key: 'NX', number: 12 } */
export function parseTaskKey(ref: string): { key: string; number: number } | null {
  const m = /^\s*([A-Za-z][A-Za-z0-9]{0,9})-(\d+)\s*$/.exec(ref)
  return m ? { key: m[1].toUpperCase(), number: Number(m[2]) } : null
}

/** Only in-app routes the assistant may navigate to. */
const ROUTES = ['', 'messages', 'projects', 'calendar', 'docs', 'files', 'whiteboard', 'workflows', 'approvals', 'goals', 'announcements', 'people', 'settings']
export function isAllowedPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  const seg = path.slice(1).split(/[/?#]/)[0]
  return ROUTES.includes(seg)
}

export function clip(s: string | undefined, n: number): string {
  if (!s) return ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}
