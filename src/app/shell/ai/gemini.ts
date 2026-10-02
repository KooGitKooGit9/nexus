/**
 * Gemini REST client (via the Nexus server proxy `POST /api/ai/generate` — the API key never reaches
 * the browser) + pure helpers for building / repairing the `contents` history.
 *
 * PURE MODULE: no app imports, so it can be unit-tested with plain node.
 *
 * Gemini 3 gotchas handled here:
 *  - the model's content is appended to the history EXACTLY as returned (every part, including
 *    `thoughtSignature`), never rebuilt;
 *  - every `functionCall` is answered by a `functionResponse` part with the same `name` and `id`,
 *    all in ONE user turn, in the same order as the calls.
 */

/* ───────────── wire types (subset of the Gemini REST API) ───────────── */

export interface FunctionCall {
  name: string
  id?: string
  args?: Record<string, unknown>
}

export interface FunctionResponse {
  name: string
  id?: string
  response: Record<string, unknown>
}

export interface Part {
  text?: string
  /** thought-summary part (only when includeThoughts is on) — never shown as answer text */
  thought?: boolean
  thoughtSignature?: string
  functionCall?: FunctionCall
  functionResponse?: FunctionResponse
  [extra: string]: unknown
}

export interface Content {
  role: 'user' | 'model'
  parts: Part[]
}

export type SchemaType = 'OBJECT' | 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'ARRAY'

export interface Schema {
  type: SchemaType
  description?: string
  enum?: string[]
  items?: Schema
  properties?: Record<string, Schema>
  required?: string[]
  format?: string
  nullable?: boolean
}

export interface FunctionDeclaration {
  name: string
  description: string
  parameters?: Schema
}

export interface GenerateRequest {
  contents: Content[]
  systemInstruction?: { parts: { text: string }[] }
  tools?: { functionDeclarations: FunctionDeclaration[] }[]
  toolConfig?: { functionCallingConfig: { mode: 'AUTO' | 'ANY' | 'NONE' } }
  generationConfig?: Record<string, unknown>
  model?: string
}

export interface GenerateResponse {
  candidates?: { content?: Partial<Content>; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: Record<string, number>
  error?: unknown
  message?: string
}

export interface GenerateResult {
  content: Content
  finishReason?: string
}

/* ───────────── errors ───────────── */

export type GeminiErrorCode =
  | 'NO_KEY' // server has no GEMINI_API_KEY
  | 'AUTH' // key rejected by Google
  | 'RATE_LIMIT' // 429
  | 'OVERLOADED' // 5xx from Google
  | 'NETWORK' // proxy / browser couldn't reach
  | 'SAFETY' // blocked by safety filters
  | 'EMPTY' // no candidates / empty content
  | 'MALFORMED' // model produced an invalid function call
  | 'BAD_REQUEST'
  | 'ABORTED'

export class GeminiError extends Error {
  code: GeminiErrorCode
  status?: number
  constructor(code: GeminiErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'GeminiError'
    this.code = code
    this.status = status
  }
}

/** Korean, user-facing explanation of an error. */
export function errorMessage(err: unknown): string {
  const e = err instanceof GeminiError ? err : null
  switch (e?.code) {
    case 'NO_KEY': return 'Gemini API 키가 설정되지 않았어요. `server/.env`에 `GEMINI_API_KEY`를 넣고 서버를 다시 시작해 주세요.'
    case 'AUTH': return 'Gemini API 키가 거부되었어요. `server/.env`의 `GEMINI_API_KEY`를 확인해 주세요.'
    case 'RATE_LIMIT': return '요청이 너무 많아 Gemini가 잠시 쉬고 있어요 (429). 잠시 후 다시 시도해 주세요.'
    case 'OVERLOADED': return 'Gemini 서버가 혼잡해요. 잠시 후 다시 시도해 주세요.'
    case 'NETWORK': return 'AI 서버에 연결하지 못했어요. 네트워크나 Nexus 서버 상태를 확인해 주세요.'
    case 'SAFETY': return '안전 정책에 따라 이 요청에는 답변할 수 없어요. 표현을 바꿔 다시 요청해 주세요.'
    case 'EMPTY': return 'Gemini가 빈 응답을 보냈어요. 다시 시도해 주세요.'
    case 'MALFORMED': return '요청을 처리하는 중 문제가 생겼어요. 조금 더 구체적으로 다시 말씀해 주세요.'
    case 'ABORTED': return '응답이 중단되었어요.'
    case 'BAD_REQUEST': return `요청이 거부되었어요: ${e.message}`
    default: return `알 수 없는 오류가 발생했어요${err instanceof Error && err.message ? `: ${err.message}` : ''}.`
  }
}

function upstreamMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const b = body as { error?: unknown; message?: unknown }
  if (b.error && typeof b.error === 'object') {
    const m = (b.error as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  if (typeof b.message === 'string') return b.message
  if (typeof b.error === 'string') return b.error
  return ''
}

/** Turn an HTTP status + parsed body into a result or a typed error (pure). */
export function interpretResponse(status: number, body: unknown): GenerateResult | GeminiError {
  const msg = upstreamMessage(body)
  if (status === 503 && body && typeof body === 'object' && (body as { error?: unknown }).error === 'NO_KEY') return new GeminiError('NO_KEY', msg || 'NO_KEY', status)
  if (status === 429) return new GeminiError('RATE_LIMIT', msg || 'rate limited', status)
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(msg))) return new GeminiError('AUTH', msg || 'auth', status)
  if (status === 502 || status === 504) return new GeminiError('NETWORK', msg || 'upstream unreachable', status)
  if (status >= 500) return new GeminiError('OVERLOADED', msg || `HTTP ${status}`, status)
  if (status >= 400) return new GeminiError('BAD_REQUEST', msg || `HTTP ${status}`, status)

  const r = (body ?? {}) as GenerateResponse
  if (r.promptFeedback?.blockReason) return new GeminiError('SAFETY', r.promptFeedback.blockReason, status)
  const cand = r.candidates?.[0]
  if (!cand) return new GeminiError('EMPTY', 'no candidates', status)
  const reason = cand.finishReason
  const parts = Array.isArray(cand.content?.parts) ? (cand.content!.parts as Part[]) : []
  if (!parts.length) {
    if (reason && /SAFETY|BLOCKLIST|PROHIBITED|SPII|RECITATION/.test(reason)) return new GeminiError('SAFETY', reason, status)
    if (reason && /MALFORMED_FUNCTION_CALL|UNEXPECTED_TOOL_CALL/.test(reason)) return new GeminiError('MALFORMED', reason, status)
    return new GeminiError('EMPTY', reason || 'empty content', status)
  }
  // Keep the content exactly as returned (only default the role, which Gemini always sets to "model").
  const content = { ...(cand.content as Content), role: 'model' as const, parts }
  return { content, finishReason: reason }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ status: number; text: () => Promise<string> }>

/** One `generateContent` round trip through the server proxy. Throws GeminiError. */
export async function generate(req: GenerateRequest, signal?: AbortSignal, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<GenerateResult> {
  let status = 0
  let raw = ''
  try {
    const r = await fetchImpl('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    })
    status = r.status
    raw = await r.text()
  } catch (err) {
    if (signal?.aborted || (err as { name?: string })?.name === 'AbortError') throw new GeminiError('ABORTED', 'aborted')
    throw new GeminiError('NETWORK', err instanceof Error ? err.message : String(err))
  }
  let body: unknown = null
  try { body = raw ? JSON.parse(raw) : null } catch { body = { message: raw.slice(0, 200) } }
  // Vite returns an HTML 404/502 page when the API server isn't running.
  if (status === 404 && !body) throw new GeminiError('NETWORK', 'AI endpoint not found', status)
  const out = interpretResponse(status, body)
  if (out instanceof GeminiError) throw out
  return out
}

/* ───────────── content helpers ───────────── */

export function functionCallsOf(c: Content | undefined): FunctionCall[] {
  return (c?.parts ?? []).filter((p) => p.functionCall && typeof p.functionCall.name === 'string').map((p) => p.functionCall!)
}

/** Answer text of a model turn (thought summaries excluded). */
export function visibleText(c: Content | undefined): string {
  return (c?.parts ?? [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text!)
    .join('')
    .trim()
}

const isFnResponseTurn = (c: Content) => c.role === 'user' && c.parts.some((p) => p.functionResponse)
const isUserTextTurn = (c: Content) => c.role === 'user' && !c.parts.some((p) => p.functionResponse) && c.parts.some((p) => typeof p.text === 'string')

/** One user turn with a functionResponse per call — same order, same name/id. */
export function functionResponseTurn(calls: FunctionCall[], results: Record<string, unknown>[]): Content {
  return {
    role: 'user',
    parts: calls.map((call, i) => ({
      functionResponse: {
        name: call.name,
        ...(call.id ? { id: call.id } : {}),
        response: results[i] ?? { error: 'no result' },
      },
    })),
  }
}

/**
 * Append the user's message. If the history already ends with a user turn (e.g. function responses
 * of a stopped run), the text joins that turn so roles keep alternating.
 */
export function appendUserText(contents: Content[], text: string, notes: string[] = []): Content[] {
  const parts: Part[] = [...notes.map((n) => ({ text: n })), { text }]
  const last = contents[contents.length - 1]
  if (last?.role === 'user') return [...contents.slice(0, -1), { ...last, parts: [...last.parts, ...parts] }]
  return [...contents, { role: 'user', parts }]
}

/** A model turn whose function calls were never answered (stopped run / reload) gets "cancelled" responses. */
export function repairContents(contents: Content[]): Content[] {
  const last = contents[contents.length - 1]
  if (!last || last.role !== 'model') return contents
  const calls = functionCallsOf(last)
  if (!calls.length) return contents
  return [...contents, functionResponseTurn(calls, calls.map(() => ({ error: '사용자가 응답을 중단해 실행되지 않았습니다.' })))]
}

const sizeOf = (c: Content) => JSON.stringify(c).length

/**
 * Keep the history bounded. Drops whole exchanges from the front so the history always starts with a
 * plain user text turn (never with an orphaned function response or model turn).
 */
export function trimContents(contents: Content[], opts: { maxItems?: number; maxChars?: number } = {}): Content[] {
  const maxItems = opts.maxItems ?? 48
  const maxChars = opts.maxChars ?? 120_000
  let start = 0
  // first valid start
  while (start < contents.length && !isUserTextTurn(contents[start])) start++
  let total = contents.slice(start).reduce((s, c) => s + sizeOf(c), 0)
  const fits = () => contents.length - start <= maxItems && total <= maxChars
  while (!fits()) {
    // advance to the next user text turn
    let next = start + 1
    while (next < contents.length && !isUserTextTurn(contents[next])) next++
    if (next >= contents.length) break // keep at least the latest exchange
    for (let i = start; i < next; i++) total -= sizeOf(contents[i])
    start = next
  }
  return start === 0 ? contents : contents.slice(start)
}

/**
 * For "regenerate": cut the history back to just before the user turn that asked `prompt`
 * (searching from the end). Function responses merged into that turn are kept.
 */
export function rollbackTo(contents: Content[], prompt: string): Content[] {
  for (let i = contents.length - 1; i >= 0; i--) {
    const c = contents[i]
    if (c.role !== 'user') continue
    const idx = c.parts.findIndex((p) => p.text === prompt)
    if (idx < 0) continue
    const kept = c.parts.filter((p) => p.functionResponse)
    const before = contents.slice(0, i)
    return kept.length ? [...before, { ...c, parts: kept }] : before
  }
  return contents
}

/** Keep tool results small so the history doesn't explode. */
export function compactResult(result: Record<string, unknown>, maxChars = 9000): Record<string, unknown> {
  const s = JSON.stringify(result)
  if (s.length <= maxChars) return result
  return { truncated: true, note: `결과가 길어 앞부분 ${maxChars}자만 포함했습니다. 더 좁은 조건으로 다시 조회하세요.`, partial: s.slice(0, maxChars) }
}

/** "gemini-3.8-flash" → "Gemini 3.8 Flash" */
export function prettyModel(model: string): string {
  const m = model.replace(/^models\//, '').replace(/^mock:/, '')
  if (!m) return 'Gemini'
  return m
    .split('-')
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\bPreview\b.*$/, 'Preview')
    .trim()
}
