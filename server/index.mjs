// Nexus backend — multi-tenant HTTP API + WebSocket realtime sync + SQLite persistence + Gemini proxy.
// Dev:  node server/index.mjs          (port NEXUS_API_PORT || 5200; Vite proxies /api and /ws to it)
// Prod: node server/index.mjs --prod   (or NODE_ENV=production; port PORT || 8080; also serves ./dist)
// Contract: LAUNCH.md. Identity always comes from the `nexus_sid` cookie — never from request bodies.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { loadEnv } from './env.mjs'
import { handleAI } from './ai.mjs'
import { openDb } from './db.mjs'
import { createStatic } from './static.mjs'
import {
  COOKIE, SESSION_MS, clearCookie, clientIp, hashPassword, newToken, normEmail, normName, parseCookies,
  publicUrl, randomId, rateLimit, sendMail, sessionCookie, sha256, sweepRateLimits, validPassword, verifyPassword,
} from './auth.mjs'
import { PLAN_LIMITS, TRIAL_DAYS, addMonths, isCycle, isPaidPlan, kstDay, quote } from './plans.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
loadEnv(path.join(ROOT, '.env'))
const PROD = process.env.NODE_ENV === 'production' || process.argv.includes('--prod')
if (PROD) process.env.NODE_ENV = 'production'
// Dev: NEXUS_API_PORT (dev tools often set PORT for the web server). Prod: PORT (what hosts inject).
const PORT = Number(PROD ? process.env.PORT || process.env.NEXUS_API_PORT || 8080 : process.env.NEXUS_API_PORT || 5200)
const DATA_DIR = path.resolve(process.env.NEXUS_DATA_DIR || path.join(ROOT, 'data'))
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const DIST_DIR = path.resolve(ROOT, '..', 'dist')

const db = openDb(DATA_DIR)
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const DAY = 24 * 3600_000
const GUEST_MS = DAY
const INVITE_MS = 7 * DAY
const RESET_MS = 3600_000
const JSON_LIMIT = 1024 * 1024
const UPLOAD_LIMIT = 60 * 1024 * 1024
const ROLES = ['owner', 'admin', 'member']
const NAME_RE = /^[\w-]{1,64}$/
const now = () => Date.now()
const iso = (ms) => (ms ? new Date(ms).toISOString() : undefined)

/* ───────────────────────── statements ───────────────────────── */

const q = {
  // accounts / sessions
  account: db.prepare('SELECT * FROM accounts WHERE id = ?'),
  accountByEmail: db.prepare('SELECT * FROM accounts WHERE email = ?'),
  insertAccount: db.prepare('INSERT INTO accounts (id, email, name, pw_hash, pw_salt, guest, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  upgradeGuest: db.prepare('UPDATE accounts SET email = ?, name = ?, pw_hash = ?, pw_salt = ?, guest = 0, expires_at = NULL WHERE id = ?'),
  // 약관·개인정보 동의 시각 + 마케팅 수신 동의(선택) 기록
  recordConsent: db.prepare('UPDATE accounts SET terms_agreed_at = ?, marketing_opt_in = ?, marketing_at = ? WHERE id = ?'),
  setAccountName: db.prepare('UPDATE accounts SET name = ? WHERE id = ?'),
  setPassword: db.prepare('UPDATE accounts SET pw_hash = ?, pw_salt = ? WHERE id = ?'),
  deleteAccount: db.prepare('DELETE FROM accounts WHERE id = ?'),
  expiredGuests: db.prepare('SELECT id FROM accounts WHERE guest = 1 AND expires_at IS NOT NULL AND expires_at < ?'),
  session: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, account_id, current_workspace_id, created_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?, ?)'),
  touchSession: db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?'),
  extendSession: db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?'),
  setCurrent: db.prepare('UPDATE sessions SET current_workspace_id = ? WHERE token_hash = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  sessionsOf: db.prepare('SELECT token_hash FROM sessions WHERE account_id = ?'),
  deleteSessionsOf: db.prepare('DELETE FROM sessions WHERE account_id = ?'),
  lastWorkspaceOf: db.prepare('SELECT current_workspace_id AS id FROM sessions WHERE account_id = ? AND current_workspace_id IS NOT NULL ORDER BY last_seen DESC LIMIT 1'),
  clearCurrentFor: db.prepare('UPDATE sessions SET current_workspace_id = NULL WHERE current_workspace_id = ? AND account_id = ?'),
  clearCurrentAll: db.prepare('UPDATE sessions SET current_workspace_id = NULL WHERE current_workspace_id = ?'),
  expireSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  insertReset: db.prepare('INSERT INTO password_resets (token_hash, account_id, expires_at, used) VALUES (?, ?, ?, 0)'),
  reset: db.prepare('SELECT * FROM password_resets WHERE token_hash = ?'),
  useResetsOf: db.prepare('UPDATE password_resets SET used = 1 WHERE account_id = ?'),
  deleteResetsOf: db.prepare('DELETE FROM password_resets WHERE account_id = ?'),
  expireResets: db.prepare('DELETE FROM password_resets WHERE expires_at < ? OR used = 1'),

  // workspaces / memberships
  workspace: db.prepare('SELECT * FROM workspaces WHERE id = ?'),
  insertWorkspace: db.prepare("INSERT INTO workspaces (id, name, kind, plan, cycle, plan_status, trial_used, created_at) VALUES (?, ?, ?, 'free', 'monthly', 'active', 0, ?)"),
  renameWorkspace: db.prepare('UPDATE workspaces SET name = ? WHERE id = ?'),
  setIconColor: db.prepare('UPDATE workspaces SET icon_color = ? WHERE id = ?'),
  downgrade: db.prepare("UPDATE workspaces SET plan = 'free', cycle = 'monthly', plan_status = 'active', trial_ends_at = NULL, renews_at = NULL WHERE id = ?"),
  downgradeExpired: db.prepare("UPDATE workspaces SET plan = 'free', cycle = 'monthly', plan_status = 'active', trial_ends_at = NULL, renews_at = NULL WHERE plan != 'free' AND COALESCE(renews_at, trial_ends_at) IS NOT NULL AND COALESCE(renews_at, trial_ends_at) <= ?"),
  startTrial: db.prepare("UPDATE workspaces SET plan = ?, plan_status = 'trialing', trial_used = 1, trial_ends_at = ?, renews_at = NULL WHERE id = ?"),
  activatePlan: db.prepare("UPDATE workspaces SET plan = ?, cycle = ?, plan_status = 'active', trial_ends_at = NULL, renews_at = ? WHERE id = ?"),
  setPlanStatus: db.prepare('UPDATE workspaces SET plan_status = ? WHERE id = ?'),
  membership: db.prepare('SELECT * FROM memberships WHERE workspace_id = ? AND account_id = ?'),
  membershipByMember: db.prepare('SELECT * FROM memberships WHERE workspace_id = ? AND member_id = ?'),
  membershipsOf: db.prepare('SELECT * FROM memberships WHERE account_id = ? ORDER BY joined_at'),
  firstMembership: db.prepare('SELECT * FROM memberships WHERE account_id = ? ORDER BY joined_at LIMIT 1'),
  insertMembership: db.prepare('INSERT INTO memberships (workspace_id, account_id, member_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'),
  setRole: db.prepare('UPDATE memberships SET role = ? WHERE workspace_id = ? AND member_id = ?'),
  deleteMembership: db.prepare('DELETE FROM memberships WHERE workspace_id = ? AND account_id = ?'),
  memberCount: db.prepare('SELECT COUNT(*) AS n FROM memberships WHERE workspace_id = ?'),
  ownerCount: db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE workspace_id = ? AND role = 'owner'"),
  oldestMember: db.prepare('SELECT * FROM memberships WHERE workspace_id = ? ORDER BY joined_at LIMIT 1'),
  membersOf: db.prepare(`SELECT m.member_id, m.account_id, m.role, m.joined_at, a.name, a.email
    FROM memberships m JOIN accounts a ON a.id = m.account_id WHERE m.workspace_id = ? ORDER BY m.joined_at`),
  ownedCount: db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE account_id = ? AND role = 'owner'"),

  // invites
  invite: db.prepare('SELECT * FROM invites WHERE token = ?'),
  insertInvite: db.prepare('INSERT INTO invites (token, workspace_id, email, role, inviter_account_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  pendingInvites: db.prepare('SELECT * FROM invites WHERE workspace_id = ? AND expires_at > ? AND (email IS NULL OR accepted_at IS NULL) ORDER BY created_at'),
  deleteInvite: db.prepare('DELETE FROM invites WHERE token = ? AND workspace_id = ?'),
  deletePendingFor: db.prepare('DELETE FROM invites WHERE workspace_id = ? AND email = ? AND accepted_at IS NULL'),
  acceptInvite: db.prepare('UPDATE invites SET accepted_at = ? WHERE token = ?'),
  expireInvites: db.prepare('DELETE FROM invites WHERE expires_at < ?'),

  // workspace data
  items: db.prepare('SELECT store, coll, data FROM items WHERE workspace_id = ? ORDER BY rowid'),
  collItems: db.prepare('SELECT data FROM items WHERE workspace_id = ? AND store = ? AND coll = ? ORDER BY rowid'),
  item: db.prepare('SELECT data FROM items WHERE workspace_id = ? AND store = ? AND coll = ? AND id = ?'),
  countColl: db.prepare('SELECT COUNT(*) AS n FROM items WHERE workspace_id = ? AND store = ? AND coll = ?'),
  upsertItem: db.prepare(`INSERT INTO items (workspace_id, store, coll, id, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, store, coll, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
  deleteItem: db.prepare('DELETE FROM items WHERE workspace_id = ? AND store = ? AND coll = ? AND id = ?'),
  isSeeded: db.prepare('SELECT 1 FROM seeded WHERE workspace_id = ? AND store = ? AND coll = ?'),
  markSeeded: db.prepare('INSERT OR IGNORE INTO seeded (workspace_id, store, coll, at) VALUES (?, ?, ?, ?)'),
  seededOf: db.prepare('SELECT store, coll FROM seeded WHERE workspace_id = ?'),
  userState: db.prepare('SELECT store, data FROM user_state WHERE workspace_id = ? AND member_id = ?'),
  putUserState: db.prepare(`INSERT INTO user_state (workspace_id, member_id, store, data, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, member_id, store) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
  deleteUserStateOf: db.prepare('DELETE FROM user_state WHERE workspace_id = ? AND member_id = ?'),
  insertUpload: db.prepare('INSERT INTO uploads (id, workspace_id, name, mime, size, owner, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  upload: db.prepare('SELECT * FROM uploads WHERE id = ?'),
  uploadsOf: db.prepare('SELECT id FROM uploads WHERE workspace_id = ?'),
  storageUsed: db.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM uploads WHERE workspace_id = ?'),

  // billing / quota
  insertPayment: db.prepare("INSERT INTO payments (order_id, workspace_id, plan, cycle, amount, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"),
  paymentById: db.prepare('SELECT * FROM payments WHERE order_id = ?'),
  claimPayment: db.prepare("UPDATE payments SET status = 'confirming' WHERE order_id = ? AND status = 'pending'"),
  finishPayment: db.prepare('UPDATE payments SET status = ?, payment_key = ? WHERE order_id = ?'),
  expirePayments: db.prepare("UPDATE payments SET status = 'expired' WHERE status = 'pending' AND created_at < ?"),
  aiUsage: db.prepare('SELECT count FROM ai_usage WHERE workspace_id = ? AND day = ?'),
  aiInc: db.prepare('INSERT INTO ai_usage (workspace_id, day, count) VALUES (?, ?, 1) ON CONFLICT(workspace_id, day) DO UPDATE SET count = count + 1'),
  aiDec: db.prepare('UPDATE ai_usage SET count = MAX(0, count - 1) WHERE workspace_id = ? AND day = ?'),
  expireAiUsage: db.prepare('DELETE FROM ai_usage WHERE day < ?'),
}

/** Every workspace-scoped table (except payments — kept as accounting records). */
const WIPE_TABLES = ['items', 'seeded', 'user_state', 'uploads', 'invites', 'ai_usage', 'memberships']

/* ───────────────────────── errors / http helpers ───────────────────────── */

class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }
}
const fail = (status, code, message, extra) => { throw new HttpError(status, code, message, extra) }

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(JSON.stringify(body))
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0)
    if (declared > limit) { reject(new HttpError(413, 'TOO_LARGE', '요청이 너무 커요.')); req.resume(); return }
    const chunks = []
    let size = 0
    let done = false
    req.on('data', (c) => {
      if (done) return
      size += c.length
      if (size > limit) { done = true; reject(new HttpError(413, 'TOO_LARGE', '요청이 너무 커요.')); req.resume(); return }
      chunks.push(c)
    })
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks)) } })
    req.on('error', (e) => { if (!done) { done = true; reject(e) } })
  })
}

async function readJSON(req, limit = JSON_LIMIT) {
  const raw = (await readBody(req, limit)).toString('utf8')
  if (!raw.trim()) return {}
  let v
  try { v = JSON.parse(raw) } catch { fail(400, 'BAD_JSON', '요청 형식이 올바르지 않아요.') }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function hostnameOf(value) {
  try { return new URL(value.includes('://') ? value : `http://${value}`).hostname.toLowerCase() } catch { return null }
}

/** CSRF / CSWSH: a browser-sent Origin must be our own host (port ignored — same-site anyway, and Vite's proxy rewrites Host). */
function originOk(req) {
  const origin = req.headers.origin
  if (!origin) return true
  const oh = hostnameOf(origin)
  if (!oh || origin === 'null') return false
  if (oh === hostnameOf(String(req.headers.host || ''))) return true
  if (process.env.NEXUS_PUBLIC_URL && oh === hostnameOf(process.env.NEXUS_PUBLIC_URL)) return true
  return false
}

/** Absolute base URL for links we hand out (invite links). */
function baseUrl(req) {
  if (process.env.NEXUS_PUBLIC_URL) return publicUrl()
  const origin = req.headers.origin
  if (origin && origin !== 'null' && originOk(req)) return origin.replace(/\/+$/, '')
  return publicUrl()
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)')
  if (PROD && String(process.env.NEXUS_PUBLIC_URL || '').startsWith('https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }
}

function limitAuth(req, action, email) {
  const ip = clientIp(req)
  const ok = rateLimit(`${action}:${ip}:${String(email || '').toLowerCase().slice(0, 254)}`, 10, 10 * 60_000)
    && rateLimit(`auth-ip:${ip}`, 60, 10 * 60_000) // coarse per-IP cap against email spraying
  if (!ok) fail(429, 'RATE_LIMIT', '요청이 너무 많아요. 10분 후에 다시 시도해 주세요.')
}

/* ───────────────────────── sessions / identity ───────────────────────── */

function getSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE]
  if (!token || token.length > 128) return null
  const hash = sha256(token)
  const session = q.session.get(hash)
  if (!session) return null
  const t = now()
  if (session.expires_at < t) { q.deleteSession.run(hash); return null }
  const account = q.account.get(session.account_id)
  if (!account || (account.guest && account.expires_at && account.expires_at < t)) return null
  if (t - session.last_seen > 60_000) q.touchSession.run(t, hash)
  return { hash, session, account }
}

function createSession(accountId, ttl = SESSION_MS) {
  const token = newToken()
  const t = now()
  const last = q.lastWorkspaceOf.get(accountId)?.id ?? null
  q.insertSession.run(sha256(token), accountId, last, t, t, t + ttl)
  return sessionCookie(token, ttl)
}

/** Drop the caller's previous session (if any) when logging in as someone else. */
function dropSession(ctx) {
  if (!ctx) return
  q.deleteSession.run(ctx.hash)
  closeSockets((c) => c.hash === ctx.hash, 4001, 'logged out')
}

function requireAuth(ctx) {
  if (!ctx) fail(401, 'AUTH', '로그인이 필요해요.')
  return ctx
}

/** Current workspace membership of the session (falls back to another membership if it's gone). */
function currentMembership(ctx) {
  const cur = ctx.session.current_workspace_id
  let m = cur ? q.membership.get(cur, ctx.account.id) : null
  if (!m) {
    m = q.firstMembership.get(ctx.account.id) ?? null
    const id = m?.workspace_id ?? null
    if (id !== cur) { q.setCurrent.run(id, ctx.hash); ctx.session.current_workspace_id = id }
  }
  return m
}

function setCurrent(ctx, workspaceId) {
  q.setCurrent.run(workspaceId, ctx.hash)
  ctx.session.current_workspace_id = workspaceId
}

/** Workspace row with lazy plan expiry (trial / prepaid period over → free). */
function loadWorkspace(id) {
  const w = q.workspace.get(id)
  if (!w) return null
  if (w.plan !== 'free') {
    const end = w.renews_at ?? w.trial_ends_at
    if (end && end <= now()) { q.downgrade.run(id); return q.workspace.get(id) }
  }
  return w
}

/** Session + current workspace, or 401/409. */
function requireWs(ctx) {
  requireAuth(ctx)
  const m = currentMembership(ctx)
  if (!m) fail(409, 'NO_WORKSPACE', '아직 워크스페이스가 없어요. 새 워크스페이스를 만들거나 초대를 수락해 주세요.')
  const w = loadWorkspace(m.workspace_id)
  if (!w) fail(409, 'NO_WORKSPACE', '워크스페이스를 찾을 수 없어요.')
  return { m, w }
}

/** Membership in a specific workspace (404 when not a member — don't reveal existence). */
function requireMember(ctx, workspaceId) {
  requireAuth(ctx)
  const m = q.membership.get(workspaceId, ctx.account.id)
  const w = m && loadWorkspace(workspaceId)
  if (!m || !w) fail(404, 'NOT_FOUND', '워크스페이스를 찾을 수 없어요.')
  return { m, w }
}

function requireRole(m, roles, message = '이 작업을 할 권한이 없어요.') {
  if (!roles.includes(m.role)) fail(403, 'FORBIDDEN', message)
}

function requireNotGuest(ctx, message) {
  if (ctx.account.guest) fail(403, 'GUEST', message || '게스트 체험에서는 사용할 수 없는 기능이에요. 무료로 회원가입하면 바로 쓸 수 있어요.')
}

function buildMe(ctx) {
  if (!ctx) return { account: null, workspaces: [], currentWorkspaceId: null }
  const cur = currentMembership(ctx)
  const workspaces = []
  for (const m of q.membershipsOf.all(ctx.account.id)) {
    const w = loadWorkspace(m.workspace_id)
    if (!w) continue
    workspaces.push({
      id: w.id, name: w.name, kind: w.kind, role: m.role, plan: w.plan, memberId: m.member_id,
      ...(w.icon_color ? { iconColor: w.icon_color } : {}),
    })
  }
  const a = ctx.account
  return {
    account: { id: a.id, name: a.name, email: a.email ?? '', guest: !!a.guest },
    workspaces,
    currentWorkspaceId: cur?.workspace_id ?? null,
  }
}

/** Re-read the account row (after updates) and build `me`. */
const freshMe = (ctx) => buildMe({ ...ctx, account: q.account.get(ctx.account.id), session: q.session.get(ctx.hash) ?? ctx.session })

/* ───────────────────────── realtime rooms ───────────────────────── */

/** workspaceId -> memberId -> Set<ws> */
const rooms = new Map()

function onlineIn(wsId) {
  const room = rooms.get(wsId)
  if (!room) return []
  return [...room.entries()].filter(([, set]) => set.size > 0).map(([id]) => id)
}

function broadcastWs(wsId, msg, except) {
  const room = rooms.get(wsId)
  if (!room) return
  const data = JSON.stringify(msg)
  for (const set of room.values()) for (const s of set) if (s !== except && s.readyState === 1) s.send(data)
}

function sendTo(sock, msg) {
  if (sock && sock.readyState === 1) sock.send(JSON.stringify(msg))
}

function closeSockets(pred, code = 4001, reason = '') {
  for (const room of rooms.values()) for (const set of room.values()) for (const s of set) if (pred(s.ctx)) s.close(code, reason)
}

/* ───────────────────────── workspace data ───────────────────────── */

function snapshot(wsId) {
  const stores = {}
  for (const row of q.items.iterate(wsId)) {
    const s = (stores[row.store] ??= {})
    ;(s[row.coll] ??= []).push(JSON.parse(row.data))
  }
  const seeded = {}
  for (const row of q.seededOf.iterate(wsId)) (seeded[row.store] ??= []).push(row.coll)
  return { stores, seeded }
}

const applyOps = db.transaction((wsId, store, coll, upserts, deletes) => {
  const t = now()
  for (const item of upserts) q.upsertItem.run(wsId, store, coll, item.id, JSON.stringify(item), t)
  for (const id of deletes) q.deleteItem.run(wsId, store, coll, id)
})

function publishOps(wsId, store, coll, upserts, deletes, from, except) {
  if (!upserts.length && !deletes.length) return
  applyOps(wsId, store, coll, upserts, deletes)
  broadcastWs(wsId, { type: 'ops', store, coll, upserts, deletes, from }, except)
}

const seedColl = db.transaction((wsId, store, coll, items) => {
  if (q.isSeeded.get(wsId, store, coll)) return false
  applyOps(wsId, store, coll, items, [])
  q.markSeeded.run(wsId, store, coll, now())
  return true
})

const getItem = (wsId, store, coll, id) => {
  const row = q.item.get(wsId, store, coll, id)
  return row ? JSON.parse(row.data) : null
}

/** Validates an ops payload's shape. Returns cleaned arrays or null. */
function cleanOps(store, coll, upserts, deletes) {
  if (typeof store !== 'string' || typeof coll !== 'string' || !NAME_RE.test(store) || !NAME_RE.test(coll)) return null
  const ups = Array.isArray(upserts) ? upserts : []
  const dels = Array.isArray(deletes) ? deletes : []
  if (ups.length + dels.length > 5000) return null
  return {
    upserts: ups.filter((x) => x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 200),
    deletes: dels.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 200),
  }
}

/* ── server-owned member directory (core/users) ── */

// The Nexus bot (u_bot) is not a member: clients resolve it via BOT_USER, so it never shows up in people lists.

/** Full `User` object for a member; merges into the existing item so profile edits (title, status…) survive. */
function memberUser(memberId, account, joinedAt, existing) {
  const name = account.name
  if (existing) {
    const nameEn = !existing.nameEn || existing.nameEn === existing.name ? name : existing.nameEn
    return { ...existing, id: memberId, name, nameEn, email: account.email ?? '' }
  }
  return {
    id: memberId, name, nameEn: name, title: '', department: '제품', email: account.email ?? '', phone: '', location: '',
    timezone: 'Asia/Seoul', managerId: null, presence: 'offline', skills: [], joinedAt: kstDay(joinedAt), birthday: '',
  }
}

/** The demo persona `u_me` (김하늘) belongs to the client's seed — the server never rewrites it. */
const serverOwnsUser = (memberId) => memberId !== 'u_me'

function upsertCoreUser(wsId, memberId, account, joinedAt) {
  if (!serverOwnsUser(memberId)) return
  const user = memberUser(memberId, account, joinedAt, getItem(wsId, 'core', 'users', memberId))
  publishOps(wsId, 'core', 'users', [user], [], 'server')
}

function removeCoreUser(wsId, memberId) {
  if (!serverOwnsUser(memberId)) return
  if (getItem(wsId, 'core', 'users', memberId)) publishOps(wsId, 'core', 'users', [], [memberId], 'server')
}

/**
 * Applies ops sent by a client, enforcing:
 *  - blank workspaces: members may only edit their own `core/users` entry (email stays server-owned), no deletes;
 *  - workflow count limit (non-demo workspaces).
 * Rejected parts are reverted on the sender with a corrective `ops` message.
 */
function handleClientOps(c, msg, senderSocket) {
  const ops = cleanOps(msg.store, msg.coll, msg.upserts, msg.deletes)
  if (!ops) return { ok: false }
  const { store, coll } = msg
  let { upserts, deletes } = ops
  const fixUps = []
  const fixDels = []
  let limitHit = null
  const w = loadWorkspace(c.wsId)
  if (!w) return { ok: false }

  if (store === 'core' && coll === 'users' && w.kind === 'blank') {
    const allowed = []
    for (const u of upserts) {
      const cur = getItem(c.wsId, store, coll, u.id)
      if (u.id === c.memberId && cur) allowed.push({ ...u, id: cur.id, email: cur.email })
      else if (cur) fixUps.push(cur)
      else fixDels.push(u.id)
    }
    upserts = allowed
    for (const id of deletes) { const cur = getItem(c.wsId, store, coll, id); if (cur) fixUps.push(cur) }
    deletes = []
  }

  if (store === 'workflows' && coll === 'workflows' && w.kind !== 'demo') {
    const lim = PLAN_LIMITS[w.plan].workflows
    if (lim != null) {
      let count = q.countColl.get(c.wsId, store, coll).n - deletes.filter((id) => q.item.get(c.wsId, store, coll, id)).length
      const allowed = []
      for (const u of upserts) {
        if (q.item.get(c.wsId, store, coll, u.id)) { allowed.push(u); continue }
        if (count < lim) { allowed.push(u); count++ } else { fixDels.push(u.id); limitHit = lim }
      }
      upserts = allowed
    }
  }

  publishOps(c.wsId, store, coll, upserts, deletes, c.memberId, senderSocket)
  if (senderSocket && (fixUps.length || fixDels.length)) {
    sendTo(senderSocket, { type: 'ops', store, coll, upserts: fixUps, deletes: fixDels, from: 'server' })
  }
  if (limitHit != null) {
    const err = { error: 'PLAN_LIMIT', limit: 'workflows', message: `무료 요금제에서는 워크플로를 ${limitHit}개까지 만들 수 있어요. 요금제를 업그레이드하면 제한 없이 쓸 수 있어요.` }
    if (senderSocket) sendTo(senderSocket, { type: 'error', ...err })
    return { ok: true, limitError: err }
  }
  return { ok: true }
}

/* ── lifecycle ── */

function createWorkspace(account, name, kind) {
  const id = 'w_' + randomId(12)
  const memberId = kind === 'demo' ? 'u_me' : 'u_' + randomId(12)
  const t = now()
  db.transaction(() => {
    q.insertWorkspace.run(id, name, kind, t)
    q.insertMembership.run(id, account.id, memberId, 'owner', t)
    if (kind === 'blank') {
      applyOps(id, 'core', 'users', [memberUser(memberId, account, t, null)], [])
      q.markSeeded.run(id, 'core', 'users', t)
    }
  })()
  return { id, memberId }
}

function unlinkUploads(ids) {
  for (const id of ids) fs.rm(path.join(UPLOAD_DIR, id), { force: true }, () => {})
}

function deleteWorkspaceFully(wsId) {
  closeSockets((c) => c.wsId === wsId, 4003, 'workspace deleted')
  const files = q.uploadsOf.all(wsId).map((r) => r.id)
  db.transaction(() => {
    for (const t of WIPE_TABLES) db.prepare(`DELETE FROM ${t} WHERE workspace_id = ?`).run(wsId)
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(wsId)
    q.clearCurrentAll.run(wsId)
  })()
  unlinkUploads(files)
}

/** Removes a membership (leave / kick / account deletion). Promotes someone if no owner would remain. */
function removeMembership(wsId, accountId) {
  const m = q.membership.get(wsId, accountId)
  if (!m) return
  db.transaction(() => {
    q.deleteMembership.run(wsId, accountId)
    q.deleteUserStateOf.run(wsId, m.member_id)
    q.clearCurrentFor.run(wsId, accountId)
    if (m.role === 'owner' && q.ownerCount.get(wsId).n === 0) {
      const heir = q.oldestMember.get(wsId)
      if (heir) q.setRole.run('owner', wsId, heir.member_id)
    }
  })()
  removeCoreUser(wsId, m.member_id)
  closeSockets((c) => c.wsId === wsId && c.memberId === m.member_id, 4003, 'removed')
}

/** Sole owner of a workspace that still has other members? (Account deletion must refuse.) */
function soleOwnerBlocker(accountId) {
  for (const m of q.membershipsOf.all(accountId)) {
    if (m.role !== 'owner') continue
    if (q.ownerCount.get(m.workspace_id).n === 1 && q.memberCount.get(m.workspace_id).n > 1) return q.workspace.get(m.workspace_id)
  }
  return null
}

function deleteAccountFully(accountId) {
  for (const m of q.membershipsOf.all(accountId)) {
    if (q.memberCount.get(m.workspace_id).n <= 1) deleteWorkspaceFully(m.workspace_id)
    else removeMembership(m.workspace_id, accountId)
  }
  closeSockets((c) => c.accountId === accountId, 4001, 'account deleted')
  db.transaction(() => {
    q.deleteSessionsOf.run(accountId)
    q.deleteResetsOf.run(accountId)
    q.deleteAccount.run(accountId)
  })()
}

/** Rename everywhere the server owns the member's `User` object. */
function propagateAccountName(account) {
  for (const m of q.membershipsOf.all(account.id)) upsertCoreUser(m.workspace_id, m.member_id, account, m.joined_at)
}

/* ───────────────────────── billing ───────────────────────── */

const tossEnabled = () => !!(process.env.TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY)

function billingView(w) {
  const limits = PLAN_LIMITS[w.plan]
  return {
    plan: w.plan,
    cycle: w.cycle,
    status: w.plan_status,
    ...(w.trial_ends_at ? { trialEndsAt: iso(w.trial_ends_at) } : {}),
    ...(w.renews_at ? { renewsAt: iso(w.renews_at) } : {}),
    limits,
    usage: {
      members: q.memberCount.get(w.id).n,
      storageBytes: q.storageUsed.get(w.id).n,
      aiToday: q.aiUsage.get(w.id, kstDay())?.count ?? 0,
      workflows: q.countColl.get(w.id, 'workflows', 'workflows').n,
    },
    provider: tossEnabled() ? 'toss' : 'none',
    trialUsed: !!w.trial_used,
    autoRenew: false, // prepaid — nothing is charged automatically
  }
}

function requireBillingAdmin(ctx, workspaceId) {
  const { m, w } = workspaceId ? requireMember(ctx, workspaceId) : requireWs(ctx)
  requireNotGuest(ctx, '게스트 체험에서는 요금제를 바꿀 수 없어요. 회원가입 후 팀 워크스페이스에서 이용해 주세요.')
  requireRole(m, ['owner', 'admin'], '요금제는 소유자 또는 관리자만 변경할 수 있어요.')
  if (w.kind === 'demo') fail(400, 'DEMO', '데모 워크스페이스에는 요금제를 적용할 수 없어요. 새 워크스페이스를 만들어 주세요.')
  return { m, w }
}

function planLimitError(limit, message) {
  return new HttpError(402, 'PLAN_LIMIT', message, { limit })
}

/* ───────────────────────── AI quota ───────────────────────── */

const consumeAi = db.transaction((wsId, day, limit) => {
  if ((q.aiUsage.get(wsId, day)?.count ?? 0) >= limit) return false
  q.aiInc.run(wsId, day)
  return true
})

/* ───────────────────────── files ───────────────────────── */

const INLINE_SAFE = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf|text\/plain)$/i

function serveUpload(req, res, meta, download) {
  const file = path.join(UPLOAD_DIR, meta.id)
  if (!fs.existsSync(file)) return send(res, 404, { error: 'NOT_FOUND', message: '파일을 찾을 수 없어요.' })
  const size = fs.statSync(file).size
  const inline = !download && INLINE_SAFE.test(meta.mime || '')
  const headers = {
    'Content-Type': meta.mime || 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    // user content must never run script on our origin (uploaded HTML/SVG…)
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''))
  if (range && (range[1] || range[2])) {
    let start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1])
    let end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1)
    if (start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` })
      return res.end()
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 })
    return fs.createReadStream(file, { start, end }).pipe(res)
  }
  res.writeHead(200, { ...headers, 'Content-Length': size })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}

/* ───────────────────────── routes ───────────────────────── */

const serveStatic = PROD ? createStatic(DIST_DIR) : null

async function route(req, res, url, p) {
  const method = req.method
  const ctx = getSession(req)
  const ok = (body, headers) => send(res, 200, body, headers)
  let mm

  if (p === '/api/health') return ok({ ok: true, ai: !!process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-3.8-flash' })

  /* ── auth ── */
  if (p === '/api/auth/me' && method === 'GET') return ok(buildMe(ctx))

  if (p === '/api/auth/signup' && method === 'POST') {
    const b = await readJSON(req)
    limitAuth(req, 'signup', b.email)
    const name = normName(b.name)
    const email = normEmail(b.email)
    if (!name) fail(400, 'INVALID_NAME', '이름은 1~40자로 입력해 주세요.')
    if (!email) fail(400, 'INVALID_EMAIL', '올바른 이메일 주소를 입력해 주세요.')
    if (!validPassword(b.password)) fail(400, 'WEAK_PASSWORD', '비밀번호는 8자 이상 128자 이하로 입력해 주세요.')
    if (q.accountByEmail.get(email)) fail(409, 'EMAIL_TAKEN', '이미 가입된 이메일이에요. 로그인해 주세요.')
    const { hash, salt } = await hashPassword(b.password)
    try {
      if (ctx?.account.guest) {
        // Upgrade the guest in place: same account, same session, the demo workspace stays a demo.
        q.upgradeGuest.run(email, name, hash, salt, ctx.account.id)
        q.recordConsent.run(now(), b.marketingOptIn === true ? 1 : 0, b.marketingOptIn === true ? now() : null, ctx.account.id)
        q.extendSession.run(now() + SESSION_MS, ctx.hash)
        const token = parseCookies(req.headers.cookie)[COOKIE]
        propagateAccountName(q.account.get(ctx.account.id))
        return ok({ me: freshMe(ctx) }, { 'Set-Cookie': sessionCookie(token) })
      }
      const id = 'a_' + randomId(16)
      q.insertAccount.run(id, email, name, hash, salt, 0, now(), null)
      q.recordConsent.run(now(), b.marketingOptIn === true ? 1 : 0, b.marketingOptIn === true ? now() : null, id)
      dropSession(ctx)
      const cookie = createSession(id)
      const fresh = getSession({ headers: { cookie: cookie.split(';')[0] } })
      return ok({ me: buildMe(fresh) }, { 'Set-Cookie': cookie })
    } catch (err) {
      if (String(err?.code || '').startsWith('SQLITE_CONSTRAINT')) fail(409, 'EMAIL_TAKEN', '이미 가입된 이메일이에요. 로그인해 주세요.')
      throw err
    }
  }

  if (p === '/api/auth/login' && method === 'POST') {
    const b = await readJSON(req)
    limitAuth(req, 'login', b.email)
    const email = normEmail(b.email)
    const acc = email ? q.accountByEmail.get(email) : null
    const valid = await verifyPassword(typeof b.password === 'string' ? b.password.slice(0, 256) : '', acc?.pw_hash, acc?.pw_salt)
    if (!acc || !valid || acc.guest) fail(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않아요.')
    dropSession(ctx)
    const cookie = createSession(acc.id)
    const fresh = getSession({ headers: { cookie: cookie.split(';')[0] } })
    return ok({ me: buildMe(fresh) }, { 'Set-Cookie': cookie })
  }

  if (p === '/api/auth/logout' && method === 'POST') {
    dropSession(ctx)
    return ok({ ok: true }, { 'Set-Cookie': clearCookie() })
  }

  if (p === '/api/auth/password/forgot' && method === 'POST') {
    const b = await readJSON(req)
    limitAuth(req, 'forgot', b.email)
    const email = normEmail(b.email)
    const acc = email ? q.accountByEmail.get(email) : null
    if (acc && !acc.guest) {
      const token = newToken()
      q.insertReset.run(sha256(token), acc.id, now() + RESET_MS)
      const link = `${publicUrl()}/reset/${token}`
      void sendMail({
        to: acc.email,
        subject: '[Nexus] 비밀번호 재설정 안내',
        text: `${acc.name}님, 비밀번호 재설정을 요청하셨어요.\n아래 버튼을 눌러 1시간 안에 새 비밀번호를 설정해 주세요.\n직접 요청하지 않으셨다면 이 메일은 무시하셔도 돼요.`,
        link,
        linkLabel: '비밀번호 재설정',
      })
    }
    return ok({ ok: true })
  }

  if (p === '/api/auth/password/reset' && method === 'POST') {
    const b = await readJSON(req)
    limitAuth(req, 'reset', '')
    if (!validPassword(b.password)) fail(400, 'WEAK_PASSWORD', '비밀번호는 8자 이상 128자 이하로 입력해 주세요.')
    const row = typeof b.token === 'string' && b.token.length <= 128 ? q.reset.get(sha256(b.token)) : null
    if (!row || row.used || row.expires_at < now()) fail(400, 'INVALID_TOKEN', '재설정 링크가 만료되었거나 이미 사용되었어요. 다시 요청해 주세요.')
    const acc = q.account.get(row.account_id)
    if (!acc) fail(400, 'INVALID_TOKEN', '재설정 링크가 만료되었거나 이미 사용되었어요. 다시 요청해 주세요.')
    const { hash, salt } = await hashPassword(b.password)
    closeSockets((c) => c.accountId === acc.id, 4001, 'password reset')
    db.transaction(() => {
      q.setPassword.run(hash, salt, acc.id)
      q.useResetsOf.run(acc.id)
      q.deleteSessionsOf.run(acc.id) // sign out everywhere
    })()
    if (ctx && ctx.account.id !== acc.id) dropSession(ctx)
    const cookie = createSession(acc.id)
    const fresh = getSession({ headers: { cookie: cookie.split(';')[0] } })
    return ok({ me: buildMe(fresh) }, { 'Set-Cookie': cookie })
  }

  if (p === '/api/account' && method === 'PATCH') {
    requireAuth(ctx)
    const b = await readJSON(req)
    if (b.name !== undefined) {
      const name = normName(b.name)
      if (!name) fail(400, 'INVALID_NAME', '이름은 1~40자로 입력해 주세요.')
      if (ctx.account.guest) fail(403, 'GUEST', '게스트 체험에서는 이름을 바꿀 수 없어요. 회원가입하면 내 이름으로 이용할 수 있어요.')
      q.setAccountName.run(name, ctx.account.id)
      propagateAccountName(q.account.get(ctx.account.id))
    }
    if (b.newPassword !== undefined) {
      requireNotGuest(ctx)
      if (!rateLimit(`pwchange:${ctx.account.id}`, 10, 10 * 60_000)) fail(429, 'RATE_LIMIT', '요청이 너무 많아요. 10분 후에 다시 시도해 주세요.')
      if (!validPassword(b.newPassword)) fail(400, 'WEAK_PASSWORD', '새 비밀번호는 8자 이상 128자 이하로 입력해 주세요.')
      const valid = await verifyPassword(typeof b.currentPassword === 'string' ? b.currentPassword.slice(0, 256) : '', ctx.account.pw_hash, ctx.account.pw_salt)
      if (!valid) fail(400, 'WRONG_PASSWORD', '현재 비밀번호가 올바르지 않아요.')
      const { hash, salt } = await hashPassword(b.newPassword)
      q.setPassword.run(hash, salt, ctx.account.id)
      // sign out other devices
      for (const s of q.sessionsOf.all(ctx.account.id)) {
        if (s.token_hash === ctx.hash) continue
        q.deleteSession.run(s.token_hash)
        closeSockets((c) => c.hash === s.token_hash, 4001, 'password changed')
      }
    }
    return ok({ me: freshMe(ctx) })
  }

  if (p === '/api/account' && method === 'DELETE') {
    requireAuth(ctx)
    const b = await readJSON(req)
    if (!ctx.account.guest) {
      if (!rateLimit(`delete:${ctx.account.id}`, 10, 10 * 60_000)) fail(429, 'RATE_LIMIT', '요청이 너무 많아요. 10분 후에 다시 시도해 주세요.')
      const valid = await verifyPassword(typeof b.password === 'string' ? b.password.slice(0, 256) : '', ctx.account.pw_hash, ctx.account.pw_salt)
      if (!valid) fail(400, 'WRONG_PASSWORD', '비밀번호가 올바르지 않아요.')
    }
    const blocker = soleOwnerBlocker(ctx.account.id)
    if (blocker) {
      fail(409, 'SOLE_OWNER', `'${blocker.name}' 워크스페이스의 유일한 소유자예요. 다른 멤버를 소유자로 지정하거나 워크스페이스를 삭제한 뒤 탈퇴해 주세요.`, { workspaceId: blocker.id })
    }
    deleteAccountFully(ctx.account.id)
    return ok({ ok: true }, { 'Set-Cookie': clearCookie() })
  }

  if (p === '/api/demo' && method === 'POST') {
    if (!rateLimit(`demo:${clientIp(req)}`, 20, 60 * 60_000)) fail(429, 'RATE_LIMIT', '체험 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.')
    if (ctx) {
      // Already signed in: reuse an existing demo workspace or add one.
      const existing = q.membershipsOf.all(ctx.account.id).find((m) => q.workspace.get(m.workspace_id)?.kind === 'demo')
      const id = existing?.workspace_id ?? (ctx.account.guest ? null : createWorkspace(ctx.account, 'Aurora Labs', 'demo').id)
      if (id) {
        setCurrent(ctx, id)
        return ok({ me: freshMe(ctx) })
      }
    }
    const t = now()
    const id = 'a_' + randomId(16)
    q.insertAccount.run(id, null, '게스트', null, null, 1, t, t + GUEST_MS)
    const account = q.account.get(id)
    const wsId = createWorkspace(account, 'Aurora Labs', 'demo').id
    dropSession(ctx)
    const token = newToken()
    q.insertSession.run(sha256(token), id, wsId, t, t, t + GUEST_MS)
    const fresh = getSession({ headers: { cookie: `${COOKIE}=${token}` } })
    return ok({ me: buildMe(fresh) }, { 'Set-Cookie': sessionCookie(token, GUEST_MS) })
  }

  /* ── workspaces ── */
  if (p === '/api/workspaces' && method === 'POST') {
    requireAuth(ctx)
    requireNotGuest(ctx, '게스트 체험에서는 새 워크스페이스를 만들 수 없어요. 무료로 회원가입하면 우리 팀 워크스페이스를 만들 수 있어요.')
    const b = await readJSON(req)
    const name = normName(b.name)
    if (!name) fail(400, 'INVALID_NAME', '워크스페이스 이름은 1~40자로 입력해 주세요.')
    const kind = b.kind === 'demo' ? 'demo' : b.kind === 'blank' || b.kind === undefined ? 'blank' : null
    if (!kind) fail(400, 'BAD_REQUEST', '워크스페이스 종류가 올바르지 않아요.')
    if (q.ownedCount.get(ctx.account.id).n >= 20) fail(400, 'TOO_MANY', '한 계정으로 만들 수 있는 워크스페이스는 20개까지예요.')
    const { id } = createWorkspace(ctx.account, name, kind)
    setCurrent(ctx, id)
    return ok({ me: freshMe(ctx) })
  }

  if ((mm = /^\/api\/workspaces\/([\w-]+)\/switch$/.exec(p)) && method === 'POST') {
    requireMember(ctx, mm[1])
    setCurrent(ctx, mm[1])
    return ok({ me: freshMe(ctx) })
  }

  if ((mm = /^\/api\/workspaces\/([\w-]+)$/.exec(p)) && (method === 'PATCH' || method === 'DELETE')) {
    const { m, w } = requireMember(ctx, mm[1])
    const b = await readJSON(req)
    if (method === 'PATCH') {
      requireRole(m, ['owner', 'admin'], '워크스페이스 설정은 소유자 또는 관리자만 바꿀 수 있어요.')
      if (b.name !== undefined) {
        const name = normName(b.name)
        if (!name) fail(400, 'INVALID_NAME', '워크스페이스 이름은 1~40자로 입력해 주세요.')
        q.renameWorkspace.run(name, w.id)
      }
      if (b.iconColor !== undefined) {
        const c = b.iconColor === null || b.iconColor === '' ? null : String(b.iconColor)
        if (c !== null && !/^[#\w-]{1,32}$/.test(c)) fail(400, 'BAD_REQUEST', '아이콘 색상이 올바르지 않아요.')
        q.setIconColor.run(c, w.id)
      }
      return ok({ me: freshMe(ctx) })
    }
    requireRole(m, ['owner'], '워크스페이스는 소유자만 삭제할 수 있어요.')
    if (typeof b.confirmName !== 'string' || b.confirmName.trim() !== w.name) fail(400, 'CONFIRM_MISMATCH', '워크스페이스 이름이 일치하지 않아요.')
    deleteWorkspaceFully(w.id)
    return ok({ me: freshMe(ctx) })
  }

  if ((mm = /^\/api\/workspaces\/([\w-]+)\/members$/.exec(p)) && method === 'GET') {
    const { m, w } = requireMember(ctx, mm[1])
    const online = new Set(onlineIn(w.id))
    const members = q.membersOf.all(w.id).map((r) => ({
      memberId: r.member_id, accountId: r.account_id, name: r.name, email: r.email ?? '', role: r.role,
      joinedAt: iso(r.joined_at), online: online.has(r.member_id),
    }))
    const base = baseUrl(req)
    const invites = ['owner', 'admin'].includes(m.role)
      ? q.pendingInvites.all(w.id, now()).map((i) => inviteView(i, base))
      : []
    return ok({ members, invites })
  }

  if ((mm = /^\/api\/workspaces\/([\w-]+)\/members\/([\w-]+)$/.exec(p)) && (method === 'PATCH' || method === 'DELETE')) {
    const { m, w } = requireMember(ctx, mm[1])
    const target = q.membershipByMember.get(w.id, mm[2])
    if (!target) fail(404, 'NOT_FOUND', '멤버를 찾을 수 없어요.')
    const self = target.account_id === ctx.account.id
    const lastOwner = target.role === 'owner' && q.ownerCount.get(w.id).n <= 1

    if (method === 'PATCH') {
      const b = await readJSON(req)
      if (!ROLES.includes(b.role)) fail(400, 'BAD_REQUEST', '역할이 올바르지 않아요.')
      requireRole(m, ['owner', 'admin'], '역할은 소유자 또는 관리자만 바꿀 수 있어요.')
      if (m.role === 'admin' && (target.role === 'owner' || b.role === 'owner')) fail(403, 'FORBIDDEN', '소유자 권한은 소유자만 변경할 수 있어요.')
      if (lastOwner && b.role !== 'owner') fail(409, 'LAST_OWNER', '마지막 소유자의 역할은 바꿀 수 없어요. 먼저 다른 멤버를 소유자로 지정해 주세요.')
      q.setRole.run(b.role, w.id, target.member_id)
      return ok({ ok: true })
    }

    if (!self) {
      requireRole(m, ['owner', 'admin'], '멤버 내보내기는 소유자 또는 관리자만 할 수 있어요.')
      if (m.role === 'admin' && target.role === 'owner') fail(403, 'FORBIDDEN', '관리자는 소유자를 내보낼 수 없어요.')
    }
    if (lastOwner) fail(409, 'LAST_OWNER', '마지막 소유자는 나갈 수 없어요. 다른 멤버를 소유자로 지정하거나 워크스페이스를 삭제해 주세요.')
    removeMembership(w.id, target.account_id)
    return ok({ ok: true })
  }

  if ((mm = /^\/api\/workspaces\/([\w-]+)\/invites$/.exec(p)) && method === 'POST') {
    const { m, w } = requireMember(ctx, mm[1])
    requireNotGuest(ctx, '게스트 체험에서는 팀원을 초대할 수 없어요. 무료로 회원가입하면 동료를 초대할 수 있어요.')
    requireRole(m, ['owner', 'admin'], '초대는 소유자 또는 관리자만 할 수 있어요.')
    const b = await readJSON(req)
    const role = b.role ?? 'member'
    if (!ROLES.includes(role)) fail(400, 'BAD_REQUEST', '역할이 올바르지 않아요.')
    if (role === 'owner' && m.role !== 'owner') fail(403, 'FORBIDDEN', '소유자로 초대하는 것은 소유자만 할 수 있어요.')
    const raw = Array.isArray(b.emails) ? b.emails : []
    if (raw.length > 50) fail(400, 'BAD_REQUEST', '한 번에 50명까지 초대할 수 있어요.')
    const emails = []
    for (const e of raw) {
      const ne = normEmail(e)
      if (!ne) fail(400, 'INVALID_EMAIL', `올바르지 않은 이메일 주소예요: ${String(e).slice(0, 80)}`)
      if (!emails.includes(ne)) emails.push(ne)
    }
    // skip people who are already members
    const memberEmails = new Set(q.membersOf.all(w.id).map((r) => r.email).filter(Boolean))
    const targets = raw.length ? emails.filter((e) => !memberEmails.has(e)) : [null]
    if (!rateLimit(`invite:${ctx.account.id}`, 200, DAY)) fail(429, 'RATE_LIMIT', '오늘 보낼 수 있는 초대 수를 넘었어요. 내일 다시 시도해 주세요.')

    const lim = PLAN_LIMITS[w.plan].members
    if (lim != null) {
      const pending = q.pendingInvites.all(w.id, now()).filter((i) => !(i.email && targets.includes(i.email))).length
      const total = q.memberCount.get(w.id).n + pending + targets.length
      if (total > lim) {
        throw planLimitError('members', `무료 요금제는 멤버(대기 중인 초대 포함) ${lim}명까지예요. 요금제를 업그레이드하면 인원 제한 없이 초대할 수 있어요.`)
      }
    }

    const t = now()
    const base = baseUrl(req)
    const created = []
    db.transaction(() => {
      for (const email of targets) {
        if (email) q.deletePendingFor.run(w.id, email)
        const token = newToken()
        q.insertInvite.run(token, w.id, email, role, ctx.account.id, t, t + INVITE_MS)
        created.push(q.invite.get(token))
      }
    })()
    for (const i of created) {
      if (!i.email) continue
      void sendMail({
        to: i.email,
        subject: `[Nexus] ${ctx.account.name}님이 '${w.name}' 워크스페이스에 초대했어요`,
        text: `${ctx.account.name}님이 Nexus의 '${w.name}' 워크스페이스에 초대했어요.\n초대는 7일 동안 유효해요.`,
        link: `${base}/invite/${i.token}`,
        linkLabel: '초대 수락하기',
      })
    }
    return ok({ invites: created.map((i) => inviteView(i, base)) })
  }

  if ((mm = /^\/api\/workspaces\/([\w-]+)\/invites\/([\w-]+)$/.exec(p)) && method === 'DELETE') {
    const { m, w } = requireMember(ctx, mm[1])
    requireRole(m, ['owner', 'admin'], '초대 취소는 소유자 또는 관리자만 할 수 있어요.')
    q.deleteInvite.run(mm[2], w.id)
    return ok({ ok: true })
  }

  if ((mm = /^\/api\/invites\/([\w-]+)$/.exec(p)) && method === 'GET') {
    if (!rateLimit(`invite-view:${clientIp(req)}`, 120, 10 * 60_000)) fail(429, 'RATE_LIMIT', '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.')
    const i = q.invite.get(mm[1])
    const w = i && q.workspace.get(i.workspace_id)
    if (!i || !w) fail(404, 'NOT_FOUND', '초대를 찾을 수 없어요. 링크를 다시 확인해 주세요.')
    const inviter = q.account.get(i.inviter_account_id)
    return ok({
      workspace: { name: w.name, memberCount: q.memberCount.get(w.id).n },
      inviter: { name: inviter?.name ?? '알 수 없음' },
      ...(i.email ? { email: i.email } : {}),
      expired: inviteExpired(i),
    })
  }

  if ((mm = /^\/api\/invites\/([\w-]+)\/accept$/.exec(p)) && method === 'POST') {
    requireAuth(ctx)
    const i = q.invite.get(mm[1])
    const w = i && loadWorkspace(i.workspace_id)
    if (!i || !w) fail(404, 'NOT_FOUND', '초대를 찾을 수 없어요. 링크를 다시 확인해 주세요.')
    if (q.membership.get(w.id, ctx.account.id)) {
      setCurrent(ctx, w.id)
      return ok({ me: freshMe(ctx) })
    }
    requireNotGuest(ctx, '초대를 수락하려면 회원가입이 필요해요. 게스트 체험은 24시간 뒤 삭제돼요.')
    if (inviteExpired(i)) fail(410, 'INVITE_EXPIRED', '만료되었거나 이미 사용된 초대예요. 초대한 분께 새 링크를 요청해 주세요.')
    if (i.email && i.email !== ctx.account.email) {
      fail(403, 'INVITE_EMAIL_MISMATCH', `이 초대는 ${i.email} 계정용이에요. 해당 이메일로 로그인하거나 가입해 주세요.`, { email: i.email })
    }
    const lim = PLAN_LIMITS[w.plan].members
    if (lim != null && q.memberCount.get(w.id).n >= lim) {
      throw planLimitError('members', `이 워크스페이스는 무료 요금제 최대 인원(${lim}명)에 도달했어요. 워크스페이스 관리자에게 요금제 업그레이드를 요청해 주세요.`)
    }
    const memberId = 'u_' + randomId(12)
    const t = now()
    db.transaction(() => {
      q.insertMembership.run(w.id, ctx.account.id, memberId, i.role, t)
      q.acceptInvite.run(t, i.token) // email invites become used; link invites stay reusable (records last use)
    })()
    upsertCoreUser(w.id, memberId, ctx.account, t)
    setCurrent(ctx, w.id)
    return ok({ me: freshMe(ctx) })
  }

  /* ── billing ── */
  if (p === '/api/billing' && method === 'GET') {
    const { w } = requireWs(ctx)
    return ok(billingView(w))
  }

  if (p === '/api/billing/checkout' && method === 'POST') {
    const { w } = requireBillingAdmin(ctx)
    const b = await readJSON(req)
    if (!isPaidPlan(b.plan)) fail(400, 'BAD_REQUEST', '요금제가 올바르지 않아요.')
    const cycle = b.cycle ?? 'monthly'
    if (!isCycle(cycle)) fail(400, 'BAD_REQUEST', '결제 주기가 올바르지 않아요.')
    if (!tossEnabled()) return ok({ provider: 'none' })
    const qt = quote(b.plan, cycle, q.memberCount.get(w.id).n)
    const orderId = 'nx_' + randomId(24)
    q.insertPayment.run(orderId, w.id, b.plan, cycle, qt.amount, now())
    return ok({
      provider: 'toss',
      clientKey: process.env.TOSS_CLIENT_KEY,
      orderId,
      amount: qt.amount,
      orderName: qt.orderName,
      customerKey: w.id,
      supplyAmount: qt.supplyAmount,
      vat: qt.vat,
      seats: qt.seats,
      months: qt.months,
    })
  }

  if (p === '/api/billing/confirm' && method === 'POST') {
    requireAuth(ctx)
    const b = await readJSON(req)
    if (typeof b.orderId !== 'string' || typeof b.paymentKey !== 'string' || b.paymentKey.length > 200) fail(400, 'BAD_REQUEST', '결제 정보가 올바르지 않아요.')
    // The Toss redirect may land after a workspace switch — authorize against the order's workspace.
    const pay = q.paymentById.get(b.orderId)
    if (!pay || !q.membership.get(pay.workspace_id, ctx.account.id)) fail(404, 'NOT_FOUND', '주문을 찾을 수 없어요.')
    const { w } = requireBillingAdmin(ctx, pay.workspace_id)
    if (pay.status === 'paid' && pay.payment_key === b.paymentKey) return ok(billingView(loadWorkspace(w.id)))
    if (Number(b.amount) !== pay.amount) fail(400, 'AMOUNT_MISMATCH', '결제 금액이 주문 금액과 달라요. 결제가 승인되지 않았어요.')
    if (!tossEnabled()) fail(400, 'NO_PROVIDER', '결제 설정이 되어 있지 않아요.')
    if (q.claimPayment.run(pay.order_id).changes !== 1) fail(409, 'ALREADY_PROCESSED', '이미 처리된 주문이에요.')
    let data = {}
    let okToss = false
    try {
      const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64'),
          'Content-Type': 'application/json',
          'Idempotency-Key': pay.order_id,
        },
        body: JSON.stringify({ paymentKey: b.paymentKey, orderId: pay.order_id, amount: pay.amount }),
        signal: AbortSignal.timeout(30_000),
      })
      data = await r.json().catch(() => ({}))
      okToss = r.ok && data.status === 'DONE' && Number(data.totalAmount) === pay.amount
    } catch (err) {
      data = { message: String(err?.message || err) }
    }
    if (!okToss) {
      q.finishPayment.run('failed', b.paymentKey, pay.order_id)
      fail(400, 'PAYMENT_FAILED', data.message ? `결제 승인에 실패했어요: ${data.message}` : '결제 승인에 실패했어요. 잠시 후 다시 시도해 주세요.', { tossCode: data.code })
    }
    const cur = loadWorkspace(w.id)
    const months = pay.cycle === 'yearly' ? 12 : 1
    // Same plan still prepaid → extend from the current end date; otherwise start today.
    const start = cur.plan === pay.plan && cur.plan_status !== 'trialing' && cur.renews_at && cur.renews_at > now() ? cur.renews_at : now()
    db.transaction(() => {
      q.finishPayment.run('paid', b.paymentKey, pay.order_id)
      q.activatePlan.run(pay.plan, pay.cycle, addMonths(start, months), w.id)
    })()
    return ok(billingView(loadWorkspace(w.id)))
  }

  if (p === '/api/billing/trial' && method === 'POST') {
    const { w } = requireBillingAdmin(ctx)
    const b = await readJSON(req)
    if (!isPaidPlan(b.plan)) fail(400, 'BAD_REQUEST', '요금제가 올바르지 않아요.')
    if (w.trial_used) fail(409, 'TRIAL_USED', '이 워크스페이스는 이미 무료 체험을 사용했어요.')
    if (w.plan !== 'free') fail(409, 'ALREADY_SUBSCRIBED', '이미 유료 요금제를 이용 중이에요.')
    q.startTrial.run(b.plan, now() + TRIAL_DAYS * DAY, w.id)
    return ok(billingView(loadWorkspace(w.id)))
  }

  if (p === '/api/billing/cancel' && method === 'POST') {
    const { m, w } = requireWs(ctx)
    requireRole(m, ['owner'], '요금제 해지는 소유자만 할 수 있어요.')
    if (w.plan === 'free') fail(400, 'NOT_SUBSCRIBED', '해지할 유료 요금제가 없어요.')
    q.setPlanStatus.run('canceled', w.id)
    return ok(billingView(loadWorkspace(w.id)))
  }

  /* ── workspace data (sync) ── */
  if (p === '/api/bootstrap' && method === 'GET') {
    const { m, w } = requireWs(ctx)
    const userState = {}
    for (const row of q.userState.all(w.id, m.member_id)) userState[row.store] = JSON.parse(row.data)
    return ok({
      ...snapshot(w.id),
      userState,
      online: onlineIn(w.id),
      workspace: { id: w.id, name: w.name, kind: w.kind, plan: w.plan },
      memberId: m.member_id,
      me: buildMe(ctx),
    })
  }

  if (p === '/api/seed' && method === 'POST') {
    const { w } = requireWs(ctx)
    const b = await readJSON(req, 4 * JSON_LIMIT)
    const ops = Array.isArray(b.items) ? cleanOps(b.store, b.coll, b.items, []) : null
    if (!ops) fail(400, 'BAD_REQUEST', '요청 형식이 올바르지 않아요.')
    const did = seedColl(w.id, b.store, b.coll, ops.upserts)
    if (!did) return ok({ seeded: false, items: q.collItems.all(w.id, b.store, b.coll).map((r) => JSON.parse(r.data)) })
    broadcastWs(w.id, { type: 'ops', store: b.store, coll: b.coll, upserts: ops.upserts, deletes: [], from: 'seed' })
    return ok({ seeded: true })
  }

  if (p === '/api/user-state' && method === 'PUT') {
    const { m, w } = requireWs(ctx)
    const b = await readJSON(req)
    if (typeof b.store !== 'string' || !NAME_RE.test(b.store)) fail(400, 'BAD_REQUEST', '요청 형식이 올바르지 않아요.')
    q.putUserState.run(w.id, m.member_id, b.store, JSON.stringify(b.data ?? {}), now())
    return ok({ ok: true })
  }

  if (p === '/api/ops' && method === 'POST') {
    const { m, w } = requireWs(ctx)
    const b = await readJSON(req)
    const r = handleClientOps({ wsId: w.id, memberId: m.member_id }, b, null)
    if (!r.ok) fail(400, 'BAD_REQUEST', '요청 형식이 올바르지 않아요.')
    if (r.limitError) throw planLimitError('workflows', r.limitError.message)
    return ok({ ok: true })
  }

  if (p === '/api/upload' && method === 'POST') {
    const { m, w } = requireWs(ctx)
    const lim = PLAN_LIMITS[w.plan].storageBytes
    const used = q.storageUsed.get(w.id).n
    const storageErr = () => planLimitError('storage', `저장 공간(${Math.round(lim / 1024 ** 3)}GB)이 가득 찼어요. 파일을 정리하거나 요금제를 업그레이드해 주세요.`)
    if (used + Number(req.headers['content-length'] || 0) > lim) { req.resume(); throw storageErr() }
    let buf
    try {
      buf = await readBody(req, UPLOAD_LIMIT)
    } catch (err) {
      if (err instanceof HttpError && err.status === 413) fail(413, 'FILE_TOO_LARGE', `파일은 ${UPLOAD_LIMIT / 1024 / 1024}MB까지 올릴 수 있어요.`)
      throw err
    }
    if (q.storageUsed.get(w.id).n + buf.length > lim) throw storageErr()
    let name = 'file'
    try { name = decodeURIComponent(String(req.headers['x-file-name'] || 'file')) } catch { /* keep default */ }
    name = name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 200) || 'file'
    const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    const mime = /^[\w.+-]+\/[\w.+-]+$/.test(ct) ? ct : 'application/octet-stream'
    const id = crypto.randomUUID()
    fs.writeFileSync(path.join(UPLOAD_DIR, id), buf)
    q.insertUpload.run(id, w.id, name, mime, buf.length, m.member_id, now())
    return ok({ id, url: `/api/files/${id}`, name, mime, size: buf.length })
  }

  if ((mm = /^\/api\/files\/([\w-]+)$/.exec(p)) && (method === 'GET' || method === 'HEAD')) {
    requireAuth(ctx)
    const meta = q.upload.get(mm[1])
    if (!meta || !q.membership.get(meta.workspace_id, ctx.account.id)) fail(404, 'NOT_FOUND', '파일을 찾을 수 없어요.')
    return serveUpload(req, res, meta, !!url.searchParams.get('download'))
  }

  if (p.startsWith('/api/ai/')) {
    if (p === '/api/ai/generate' && method === 'POST') {
      const { w } = requireWs(ctx)
      if (process.env.GEMINI_API_KEY) {
        const day = kstDay()
        const limit = PLAN_LIMITS[w.plan].aiPerDay
        if (!consumeAi(w.id, day, limit)) {
          throw planLimitError('ai', `오늘의 AI 사용량(${limit.toLocaleString('ko-KR')}회)을 모두 사용했어요. 요금제를 업그레이드하면 더 쓸 수 있어요.`)
        }
        try {
          await handleAI(p, req, res, { readJSON: (r) => readJSON(r, 4 * JSON_LIMIT), send })
        } catch (err) {
          q.aiDec.run(w.id, day)
          throw err
        }
        if (res.statusCode >= 500) q.aiDec.run(w.id, day) // upstream failure doesn't count
        return
      }
    }
    return handleAI(p, req, res, { readJSON, send })
  }

  // Demo only: wipe this workspace back to its seed (Settings → 워크스페이스 초기화)
  if (p === '/api/reset' && method === 'POST') {
    const { m, w } = requireWs(ctx)
    if (w.kind !== 'demo' || m.role !== 'owner') fail(403, 'FORBIDDEN', '초기화는 데모 워크스페이스의 소유자만 할 수 있어요.')
    const files = q.uploadsOf.all(w.id).map((r) => r.id)
    db.transaction(() => {
      for (const t of ['items', 'seeded', 'user_state', 'uploads']) db.prepare(`DELETE FROM ${t} WHERE workspace_id = ?`).run(w.id)
    })()
    unlinkUploads(files)
    broadcastWs(w.id, { type: 'reset' })
    return ok({ ok: true })
  }

  fail(404, 'NOT_FOUND', '요청한 API를 찾을 수 없어요.')
}

function inviteExpired(i) {
  return i.expires_at < now() || (!!i.email && !!i.accepted_at)
}

function inviteView(i, base) {
  return {
    token: i.token,
    url: `${base}/invite/${i.token}`,
    ...(i.email ? { email: i.email } : {}),
    role: i.role,
    createdAt: iso(i.created_at),
    expiresAt: iso(i.expires_at),
  }
}

/* ───────────────────────── HTTP server ───────────────────────── */

const server = http.createServer(async (req, res) => {
  securityHeaders(res)
  let p = '/'
  try {
    const url = new URL(req.url, 'http://localhost')
    p = url.pathname
    if (p.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store')
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !originOk(req)) {
        fail(403, 'CSRF', '허용되지 않은 출처의 요청이에요.')
      }
      return await route(req, res, url, p)
    }
    if (serveStatic && (req.method === 'GET' || req.method === 'HEAD') && p !== '/ws' && serveStatic(req, res, p)) return
    send(res, 404, { error: 'NOT_FOUND', message: '페이지를 찾을 수 없어요.' })
  } catch (err) {
    if (res.headersSent) { res.destroy(); return }
    if (err instanceof HttpError) return send(res, err.status, { error: err.code, message: err.message, ...err.extra })
    console.error('[api]', req.method, p, err)
    send(res, 500, { error: 'SERVER', message: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' })
  }
})

/* ───────────────────────── WebSocket ───────────────────────── */

const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 })

function rejectUpgrade(socket, status, text) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.destroy()
}

server.on('upgrade', (req, socket, head) => {
  let url
  try { url = new URL(req.url, 'http://localhost') } catch { return socket.destroy() }
  if (url.pathname !== '/ws') return socket.destroy()
  if (!originOk(req)) return rejectUpgrade(socket, 403, 'Forbidden')
  let ctx, m
  try {
    ctx = getSession(req)
    m = ctx && currentMembership(ctx)
  } catch (err) {
    console.error('[ws] auth', err)
    return rejectUpgrade(socket, 500, 'Internal Server Error')
  }
  if (!ctx) return rejectUpgrade(socket, 401, 'Unauthorized')
  if (!m) return rejectUpgrade(socket, 403, 'Forbidden')
  const c = { hash: ctx.hash, accountId: ctx.account.id, wsId: m.workspace_id, memberId: m.member_id }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, c))
})

wss.on('connection', (ws, c) => {
  ws.ctx = c
  if (!rooms.has(c.wsId)) rooms.set(c.wsId, new Map())
  const room = rooms.get(c.wsId)
  if (!room.has(c.memberId)) room.set(c.memberId, new Set())
  const set = room.get(c.memberId)
  const wasOnline = set.size > 0
  set.add(ws)
  ws.isAlive = true
  ws.on('pong', () => { ws.isAlive = true })
  if (!wasOnline) broadcastWs(c.wsId, { type: 'presence', online: onlineIn(c.wsId) })
  else sendTo(ws, { type: 'presence', online: onlineIn(c.wsId) })

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }
    if (!msg || typeof msg !== 'object') return
    try {
      if (msg.type === 'ops') {
        handleClientOps(c, msg, ws)
      } else if (msg.type === 'signal' && typeof msg.to === 'string') {
        // WebRTC signaling relay — only to a member of the same workspace
        const targets = rooms.get(c.wsId)?.get(msg.to)
        if (targets) for (const t of targets) sendTo(t, { ...msg, from: c.memberId })
      } else if (msg.type === 'event') {
        // Ephemeral fan-out (typing, cursors, call invites…) — not persisted
        broadcastWs(c.wsId, { ...msg, from: c.memberId }, ws)
      }
    } catch (err) {
      console.error('[ws] message', err)
    }
  })

  ws.on('close', () => {
    set.delete(ws)
    if (set.size === 0) {
      room.delete(c.memberId)
      if (room.size === 0) rooms.delete(c.wsId)
      broadcastWs(c.wsId, { type: 'presence', online: onlineIn(c.wsId) })
    }
  })
})

// Heartbeat + revalidate sockets (session expired / membership gone → close).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue }
    const c = ws.ctx
    const s = c && q.session.get(c.hash)
    if (!s || s.expires_at < now() || !q.membership.get(c.wsId, c.accountId)) { ws.close(4001, 'session ended'); continue }
    ws.isAlive = false
    ws.ping()
  }
}, 30_000).unref()

/* ───────────────────────── housekeeping ───────────────────────── */

function cleanup() {
  try {
    const t = now()
    for (const { id } of q.expiredGuests.all(t)) deleteAccountFully(id)
    q.expireSessions.run(t)
    q.expireResets.run(t)
    q.expireInvites.run(t - 30 * DAY)
    q.expirePayments.run(t - DAY)
    q.expireAiUsage.run(kstDay(t - 60 * DAY))
    q.downgradeExpired.run(t)
    sweepRateLimits()
  } catch (err) {
    console.error('[cleanup]', err)
  }
}
cleanup()
setInterval(cleanup, 3600_000).unref()

server.listen(PORT, () => {
  const ai = process.env.GEMINI_API_KEY ? 'Gemini ' + (process.env.GEMINI_MODEL || 'gemini-3.8-flash') : 'no key — set GEMINI_API_KEY in server/.env'
  console.log(`[nexus-server] http://localhost:${PORT}  ${PROD ? '(production, serving dist/)' : '(dev API)'}  data=${DATA_DIR}  AI: ${ai}  pay: ${tossEnabled() ? 'toss' : 'none'}`)
})

function shutdown() {
  for (const ws of wss.clients) ws.close(1001, 'server shutting down')
  server.close(() => { db.close(); process.exit(0) })
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
