// Gemini proxy. The API key never leaves the server; the browser sends Gemini-shaped request bodies
// (contents / systemInstruction / tools / toolConfig / generationConfig) and gets the raw response back.
// Tool *execution* happens in the browser (it owns the workspace stores) — the client loops
// generate → functionCall → run tool → functionResponse → generate … until the model answers in text.
//
// GEMINI_API_KEY=mock  → no network: a tiny deterministic script returns Gemini-shaped responses so the
// whole loop (function calls, thought-signature echo, function responses) can be tested end-to-end.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const model = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const isMock = () => process.env.GEMINI_API_KEY === 'mock'

export async function handleAI(p, req, res, { readJSON, send }) {
  if (p === '/api/ai/status') {
    return send(res, 200, { enabled: !!process.env.GEMINI_API_KEY, provider: 'gemini', model: model(), mock: isMock() })
  }

  if (p === '/api/ai/generate' && req.method === 'POST') {
    const key = process.env.GEMINI_API_KEY
    if (!key) return send(res, 503, { error: 'NO_KEY', message: 'server/.env 에 GEMINI_API_KEY 를 설정하세요.' })
    const body = await readJSON(req)
    const { model: requested, ...payload } = body

    if (isMock()) {
      await new Promise((r) => setTimeout(r, 350 + Math.floor(Math.random() * 400)))
      const out = mockGenerate(payload)
      return send(res, out.status, out.body)
    }

    const m = typeof requested === 'string' && /^[\w.-]+$/.test(requested) ? requested : model()
    // Google returns transient 503 (overloaded) / 500 / 429 now and then — retry a couple of times with backoff.
    const RETRYABLE = new Set([429, 500, 502, 503, 504])
    const delays = [800, 2000]
    let lastErr
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const r = await fetch(`${BASE}/${m}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(90_000),
        })
        const text = await r.text()
        if (RETRYABLE.has(r.status) && attempt < delays.length) {
          console.warn(`[ai] Gemini ${r.status} — retrying (${attempt + 1}/${delays.length})`)
          await new Promise((ok) => setTimeout(ok, delays[attempt]))
          continue
        }
        res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8' })
        return res.end(text)
      } catch (err) {
        lastErr = err
        if (attempt < delays.length) { await new Promise((ok) => setTimeout(ok, delays[attempt])); continue }
      }
    }
    return send(res, 502, { error: 'UPSTREAM', message: String(lastErr?.message || lastErr || 'upstream error') })
  }

  return send(res, 404, { error: 'not found' })
}

/* ───────────────────────── mock model ───────────────────────── */

let seq = 0
const geminiError = (status, code, message) => ({ status, body: { error: { code: status, message, status: code } } })
const reply = (parts) => ({
  status: 200,
  body: {
    candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
    modelVersion: 'mock',
  },
})

/** Users listed in the system prompt as "- 이름 (u_id) · …". */
function usersFrom(system) {
  const out = []
  const re = /^- (.+?) \((u_[\w-]+)\)/gm
  let m
  while ((m = re.exec(system))) out.push({ name: m[1].trim(), id: m[2], me: /사용자 본인/.test(system.slice(m.index, system.indexOf('\n', m.index))) })
  return out
}

const givenName = (name) => (/^[가-힣]{3}$/.test(name) ? name.slice(1) : name)

/**
 * Deterministic stand-in for Gemini (pure — exported for tests).
 * - validates the Gemini 3 rules: model function-call parts must carry their thoughtSignature back,
 *   and each functionCall must be answered (same name + id, same order) in the next user turn;
 * - last turn = function responses → a text summary of them;
 * - last user text mentions DM/메시지/보내 → functionCall send_dm (recipient parsed from the system prompt);
 * - mentions 일정/스케줄 → functionCall get_schedule;
 * - otherwise → a friendly text echo.
 */
export function mockGenerate(payload) {
  const contents = Array.isArray(payload?.contents) ? payload.contents : []
  if (!contents.length) return geminiError(400, 'INVALID_ARGUMENT', 'contents is not specified')

  // Gemini 3 contract checks
  for (let i = 0; i < contents.length; i++) {
    const c = contents[i]
    if (c.role !== 'model') continue
    const calls = (c.parts || []).filter((p) => p.functionCall)
    if (!calls.length) continue
    if (!c.parts[0]?.thoughtSignature) return geminiError(400, 'INVALID_ARGUMENT', 'Function call is missing a thought_signature in functionCall parts. (mock: model content must be echoed back unchanged)')
    const next = contents[i + 1]
    const responses = (next?.parts || []).filter((p) => p.functionResponse)
    if (next && next.role === 'user' && responses.length) {
      if (responses.length < calls.length) return geminiError(400, 'INVALID_ARGUMENT', 'Please ensure that the number of function response parts is equal to the number of function call parts of the function call turn.')
      for (let k = 0; k < calls.length; k++) {
        const fc = calls[k].functionCall
        const fr = responses[k].functionResponse
        if (fr.name !== fc.name || (fc.id && fr.id !== fc.id)) return geminiError(400, 'INVALID_ARGUMENT', `functionResponse #${k} does not match functionCall ${fc.name}/${fc.id}`)
      }
    } else if (i + 1 < contents.length) {
      return geminiError(400, 'INVALID_ARGUMENT', 'A function call turn must be followed by a function response turn.')
    }
  }

  const last = contents[contents.length - 1]
  const sig = `mock-sig-${++seq}`
  const lastResponses = (last.parts || []).filter((p) => p.functionResponse)
  // the newest text part only (earlier parts may be context notes merged into the same turn)
  const userText = ((last.parts || []).filter((p) => typeof p.text === 'string').pop()?.text || '').trim()

  if (last.role === 'user' && lastResponses.length && !userText) {
    const lines = lastResponses.map(({ functionResponse: fr }) => {
      const r = fr.response || {}
      if (r.error) return `- ⚠️ \`${fr.name}\` 실패: ${r.error}`
      if (r.cancelled) return `- 🚫 \`${fr.name}\`은(는) 취소되었어요.`
      if (fr.name === 'send_dm') return `- 💬 ${r.sentTo}님에게 DM을 보냈어요.${r.link ? ` [대화 열기](${r.link})` : ''}`
      if (fr.name === 'get_schedule') {
        const evs = Array.isArray(r.events) ? r.events : []
        return evs.length ? `- 📅 일정 ${evs.length}개:\n${evs.slice(0, 5).map((e) => `  - ${e.when} · [${e.title}](${e.link})`).join('\n')}` : '- 📅 해당 기간에 일정이 없어요.'
      }
      return `- ✅ \`${fr.name}\` 완료${r.link ? ` · [열기](${r.link})` : ''}`
    })
    return reply([{ text: `(mock) 처리 결과예요:\n${lines.join('\n')}`, thoughtSignature: sig }])
  }

  // Persona replies (messenger teammates) ask for JSON — answer like a teammate would.
  if (payload.generationConfig?.responseMimeType === 'application/json' && !payload.tools) {
    const t = contents.map((c) => (c.parts || []).map((p) => p.text || '').join(' ')).join(' ')
    const pickReply = /담배/.test(t) ? '좋아요 ㅎㅎ 5분 뒤에 1층에서 봬요 🚬'
      : /점심|밥|메뉴/.test(t) ? '좋아요! 12시에 로비에서 봬요 🍱'
      : /커피/.test(t) ? '콜입니다 ☕ 지금 내려갈게요'
      : /회의|미팅|일정/.test(t) ? '네 그 시간 괜찮아요. 캘린더 확인해볼게요 📅'
      : /\?|까요|나요/.test(t) ? '확인해보고 바로 말씀드릴게요!'
      : '넵 확인했습니다 👍'
    return reply([{ text: JSON.stringify({ reply: pickReply }), thoughtSignature: sig }])
  }

  const system = (payload.systemInstruction?.parts || []).map((p) => p.text || '').join('\n')
  const users = usersFrom(system)
  const mode = payload.toolConfig?.functionCallingConfig?.mode
  const toolsOn = mode !== 'NONE' && Array.isArray(payload.tools) && payload.tools.length > 0

  if (toolsOn && (/DM|디엠|메시지|메세지|보내/i.test(userText) || /(한테|에게|께)\s.*(해|전해)/.test(userText))) {
    const others = users.filter((u) => !u.me)
    const target =
      others.find((u) => userText.includes(u.name)) ||
      others.find((u) => /^[가-힣]{3}$/.test(u.name) && userText.includes(givenName(u.name)))
    if (!target) return reply([{ text: '(mock) 누구에게 보낼까요? 받는 분 이름을 알려주세요.', thoughtSignature: sig }])
    {
      const g = givenName(target.name)
      const text = /담배/.test(userText)
        ? `${g}님, 담배 한 대 하러 가실래요? 🚬`
        : /점심|밥/.test(userText)
          ? `${g}님, 오늘 점심 같이 하실래요? 🍱`
          : `${g}님, ${userText.replace(target.name, '').replace(/(한테|에게|께|님)\s*/g, '').replace(/(DM|디엠|메시지|메세지)\s*(로)?\s*/gi, '').replace(/(라고|고)?\s*(보내|전해)[가-힣]*\s*$/, '').trim() || '잠깐 시간 괜찮으세요?'} 🙂`
      return reply([{ functionCall: { name: 'send_dm', id: `call_${seq}`, args: { recipients: [target.id], text } }, thoughtSignature: sig }])
    }
  }

  if (toolsOn && /일정|스케줄|캘린더/.test(userText)) {
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    return reply([{ functionCall: { name: 'get_schedule', id: `call_${seq}`, args: { from: today, to: today } }, thoughtSignature: sig }])
  }

  const me = users.find((u) => u.me)
  return reply([
    {
      text: `안녕하세요${me ? `, ${givenName(me.name)}님` : ''}! 🙂 (mock 모드)\n\n"${userText.slice(0, 120)}"라고 하셨네요. 지금은 \`GEMINI_API_KEY=mock\`이라 정해진 스크립트로만 답해요. 실제 키를 넣으면 Gemini가 자연스럽게 대화하고 업무를 처리해 드려요.\n\n- "박서준한테 담배피자고 해" → DM 전송 흐름\n- "오늘 일정 알려줘" → 일정 조회 흐름`,
      thoughtSignature: sig,
    },
  ])
}
