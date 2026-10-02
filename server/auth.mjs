// Auth primitives: password hashing, tokens, cookies, validation, rate limiting, transactional mail.
import crypto from 'node:crypto'

/* ───────────────────────── passwords ───────────────────────── */

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEYLEN = 64

function scrypt(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize('NFKC'), salt, KEYLEN, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt)
  return { hash: key.toString('hex'), salt: salt.toString('hex') }
}

/** Constant-time check. A missing hash still runs scrypt so timing doesn't reveal unknown emails. */
export async function verifyPassword(password, hashHex, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16)
  const key = await scrypt(String(password ?? ''), salt)
  if (!hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  return expected.length === key.length && crypto.timingSafeEqual(expected, key)
}

/* ───────────────────────── tokens / ids ───────────────────────── */

export const newToken = () => crypto.randomBytes(32).toString('base64url')
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')

const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789'
/** Random lowercase alphanumeric id (unbiased). */
export function randomId(len = 12) {
  let out = ''
  while (out.length < len) {
    for (const b of crypto.randomBytes(len * 2)) {
      if (b < 252) out += ALPHA[b % 36] // 252 = 36*7 → no modulo bias
      if (out.length === len) break
    }
  }
  return out
}

/* ───────────────────────── cookies ───────────────────────── */

export const COOKIE = 'nexus_sid'
export const SESSION_MS = 30 * 24 * 3600_000

export function parseCookies(header) {
  const out = {}
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k || k in out) continue
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()) } catch { out[k] = part.slice(i + 1).trim() }
  }
  return out
}

const secure = () => String(process.env.NEXUS_PUBLIC_URL || '').startsWith('https')

export function sessionCookie(token, maxAgeMs = SESSION_MS) {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure() ? '; Secure' : ''}`
}
export const clearCookie = () => `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure() ? '; Secure' : ''}`

/* ───────────────────────── validation ───────────────────────── */

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/
export function normEmail(v) {
  if (typeof v !== 'string') return null
  const e = v.trim().toLowerCase()
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null
}
export function normName(v, max = 40) {
  if (typeof v !== 'string') return null
  // strip control chars, collapse whitespace
  const n = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  return n.length >= 1 && n.length <= max ? n : null
}
export const validPassword = (v) => typeof v === 'string' && v.length >= 8 && v.length <= 128

/* ───────────────────────── rate limiting ───────────────────────── */

const buckets = new Map() // key -> number[] (timestamps)

/** Sliding-window limiter. Returns true when the call is allowed (and records it). */
export function rateLimit(key, max = 10, windowMs = 10 * 60_000) {
  const now = Date.now()
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= max) { buckets.set(key, arr); return false }
  arr.push(now)
  buckets.set(key, arr)
  return true
}
export function sweepRateLimits(windowMs = 60 * 60_000) {
  const now = Date.now()
  for (const [k, arr] of buckets) if (!arr.some((t) => now - t < windowMs)) buckets.delete(k)
}

/** Client IP. Behind a reverse proxy (Fly, Railway, Caddy…) set NEXUS_TRUST_PROXY=1 to use X-Forwarded-For. */
export function clientIp(req) {
  if (process.env.NEXUS_TRUST_PROXY === '1') {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (xff.length) return xff[xff.length - 1] // the hop our proxy appended — the leftmost entries are client-controlled
  }
  return req.socket.remoteAddress || 'unknown'
}

/* ───────────────────────── mail ───────────────────────── */

export const publicUrl = () =>
  (process.env.NEXUS_PUBLIC_URL ||
    (process.env.NODE_ENV === 'production' ? `http://localhost:${process.env.PORT || 8080}` : 'http://localhost:5199')).replace(/\/+$/, '')

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Sends via Resend when RESEND_API_KEY + MAIL_FROM are set; otherwise logs the message (and link) to the
 * server console so self-hosters / dev can still complete the flow. Never throws.
 */
export async function sendMail({ to, subject, text, link, linkLabel }) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM
  if (!key || !from) {
    console.log(`[mail] (RESEND_API_KEY/MAIL_FROM 미설정 — 콘솔 출력) to=${to} · ${subject}\n        ${link}`)
    return false
  }
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<p style="font-size:15px;line-height:1.6;white-space:pre-line">${esc(text)}</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(linkLabel)}</a></p>
<p style="font-size:12px;color:#666;word-break:break-all">버튼이 동작하지 않으면 이 주소를 브라우저에 붙여 넣으세요:<br>${esc(link)}</p>
</div>`
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text: `${text}\n\n${link}` }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) console.warn(`[mail] Resend ${r.status}: ${(await r.text()).slice(0, 300)}`)
    return r.ok
  } catch (err) {
    console.warn('[mail] send failed:', err?.message || err)
    return false
  }
}
