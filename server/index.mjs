// Nexus backend — HTTP API + WebSocket realtime sync + SQLite persistence + Gemini proxy.
// Run: node server/index.mjs   (port 5200; Vite proxies /api and /ws to it)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { WebSocketServer } from 'ws'
import Database from 'better-sqlite3'
import { loadEnv } from './env.mjs'
import { handleAI } from './ai.mjs'

const ROOT = path.dirname(new URL(import.meta.url).pathname)
loadEnv(path.join(ROOT, '.env'))
// NEXUS_API_PORT (not PORT — dev tools often set PORT for the web server)
const PORT = Number(process.env.NEXUS_API_PORT || 5200)
const DATA_DIR = path.join(ROOT, 'data')
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

/* ───────────────────────── Database ───────────────────────── */

const db = new Database(path.join(DATA_DIR, 'nexus.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    store TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL,
    data TEXT NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (store, coll, id)
  );
  CREATE TABLE IF NOT EXISTS seeded (store TEXT NOT NULL, coll TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (store, coll));
  CREATE TABLE IF NOT EXISTS user_state (user_id TEXT NOT NULL, store TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, store));
  CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, name TEXT, mime TEXT, size INTEGER, owner TEXT, created_at INTEGER);
`)

const q = {
  allItems: db.prepare('SELECT store, coll, id, data FROM items ORDER BY rowid'),
  upsert: db.prepare('INSERT INTO items (store, coll, id, data, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(store, coll, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'),
  del: db.prepare('DELETE FROM items WHERE store = ? AND coll = ? AND id = ?'),
  isSeeded: db.prepare('SELECT 1 FROM seeded WHERE store = ? AND coll = ?'),
  markSeeded: db.prepare('INSERT OR IGNORE INTO seeded (store, coll, at) VALUES (?, ?, ?)'),
  allSeeded: db.prepare('SELECT store, coll FROM seeded'),
  getUserState: db.prepare('SELECT store, data FROM user_state WHERE user_id = ?'),
  putUserState: db.prepare('INSERT INTO user_state (user_id, store, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, store) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'),
  addUpload: db.prepare('INSERT INTO uploads (id, name, mime, size, owner, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  getUpload: db.prepare('SELECT * FROM uploads WHERE id = ?'),
}

const applyOps = db.transaction((store, coll, upserts = [], deletes = []) => {
  const now = Date.now()
  for (const item of upserts) if (item && typeof item.id === 'string') q.upsert.run(store, coll, item.id, JSON.stringify(item), now)
  for (const id of deletes) q.del.run(store, coll, id)
})

const seedColl = db.transaction((store, coll, items) => {
  if (q.isSeeded.get(store, coll)) return false
  applyOps(store, coll, items, [])
  q.markSeeded.run(store, coll, Date.now())
  return true
})

function snapshot() {
  const stores = {}
  for (const row of q.allItems.iterate()) {
    const s = (stores[row.store] ??= {})
    ;(s[row.coll] ??= []).push(JSON.parse(row.data))
  }
  const seeded = {}
  for (const row of q.allSeeded.iterate()) (seeded[row.store] ??= []).push(row.coll)
  return { stores, seeded }
}

/* ───────────────────────── Realtime ───────────────────────── */

/** userId -> Set<ws> */
const sockets = new Map()
const onlineUsers = () => [...sockets.entries()].filter(([, set]) => set.size > 0).map(([id]) => id)

function broadcast(msg, except) {
  const data = JSON.stringify(msg)
  for (const set of sockets.values()) for (const ws of set) if (ws !== except && ws.readyState === 1) ws.send(data)
}

/* ───────────────────────── HTTP ───────────────────────── */

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body)
  res.writeHead(status, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json; charset=utf-8', ...headers })
  res.end(isBuf ? body : JSON.stringify(body))
}

function readBody(req, limit = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
const readJSON = async (req) => JSON.parse((await readBody(req)).toString('utf8') || '{}')

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname
  try {
    if (p === '/api/health') return send(res, 200, { ok: true, online: onlineUsers(), ai: !!process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-3.8-flash' })

    if (p === '/api/bootstrap' && req.method === 'GET') {
      const user = url.searchParams.get('user') || ''
      const userState = {}
      for (const row of q.getUserState.all(user)) userState[row.store] = JSON.parse(row.data)
      return send(res, 200, { ...snapshot(), userState, online: onlineUsers() })
    }

    // First client to run seeds a collection once.
    if (p === '/api/seed' && req.method === 'POST') {
      const { store, coll, items } = await readJSON(req)
      if (!store || !coll || !Array.isArray(items)) return send(res, 400, { error: 'bad request' })
      const did = seedColl(store, coll, items)
      if (!did) {
        const current = q.allItems.all().filter((r) => r.store === store && r.coll === coll).map((r) => JSON.parse(r.data))
        return send(res, 200, { seeded: false, items: current })
      }
      broadcast({ type: 'ops', store, coll, upserts: items, deletes: [], from: 'seed' })
      return send(res, 200, { seeded: true })
    }

    if (p === '/api/user-state' && req.method === 'PUT') {
      const { user, store, data } = await readJSON(req)
      if (!user || !store) return send(res, 400, { error: 'bad request' })
      q.putUserState.run(user, store, JSON.stringify(data ?? {}), Date.now())
      return send(res, 200, { ok: true })
    }

    // HTTP fallback for ops (used if the socket is down)
    if (p === '/api/ops' && req.method === 'POST') {
      const { store, coll, upserts, deletes, from } = await readJSON(req)
      applyOps(store, coll, upserts, deletes)
      broadcast({ type: 'ops', store, coll, upserts, deletes, from })
      return send(res, 200, { ok: true })
    }

    if (p === '/api/upload' && req.method === 'POST') {
      const name = decodeURIComponent(req.headers['x-file-name'] || 'file')
      const mime = String(req.headers['content-type'] || 'application/octet-stream')
      const owner = String(req.headers['x-user'] || '')
      const buf = await readBody(req)
      const id = crypto.randomUUID()
      fs.writeFileSync(path.join(UPLOAD_DIR, id), buf)
      q.addUpload.run(id, name, mime, buf.length, owner, Date.now())
      return send(res, 200, { id, url: `/api/files/${id}`, name, mime, size: buf.length })
    }

    const fileMatch = /^\/api\/files\/([\w-]+)$/.exec(p)
    if (fileMatch && req.method === 'GET') {
      const meta = q.getUpload.get(fileMatch[1])
      if (!meta) return send(res, 404, { error: 'not found' })
      const buf = fs.readFileSync(path.join(UPLOAD_DIR, meta.id))
      const disposition = url.searchParams.get('download') ? 'attachment' : 'inline'
      res.writeHead(200, {
        'Content-Type': meta.mime,
        'Content-Length': buf.length,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        'Cache-Control': 'private, max-age=31536000, immutable',
      })
      return res.end(buf)
    }

    if (p.startsWith('/api/ai/')) return handleAI(p, req, res, { readJSON, send })

    // Dev helper: wipe everything (Settings → 워크스페이스 초기화)
    if (p === '/api/reset' && req.method === 'POST') {
      db.exec('DELETE FROM items; DELETE FROM seeded; DELETE FROM user_state;')
      broadcast({ type: 'reset' })
      return send(res, 200, { ok: true })
    }

    send(res, 404, { error: 'not found' })
  } catch (err) {
    console.error('[api]', p, err)
    send(res, 500, { error: String(err?.message || err) })
  }
})

/* ───────────────────────── WebSocket ───────────────────────── */

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname !== '/ws') return socket.destroy()
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, url.searchParams.get('user') || 'anon'))
})

wss.on('connection', (ws, user) => {
  if (!sockets.has(user)) sockets.set(user, new Set())
  const wasOnline = sockets.get(user).size > 0
  sockets.get(user).add(ws)
  ws.isAlive = true
  ws.on('pong', () => { ws.isAlive = true })
  if (!wasOnline) broadcast({ type: 'presence', online: onlineUsers() })
  else ws.send(JSON.stringify({ type: 'presence', online: onlineUsers() }))

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }
    if (msg.type === 'ops' && msg.store && msg.coll) {
      applyOps(msg.store, msg.coll, msg.upserts || [], msg.deletes || [])
      broadcast({ type: 'ops', store: msg.store, coll: msg.coll, upserts: msg.upserts || [], deletes: msg.deletes || [], from: user }, ws)
    } else if (msg.type === 'signal' && msg.to) {
      // WebRTC signaling relay for huddles / calls
      const targets = sockets.get(msg.to)
      if (targets) for (const t of targets) if (t.readyState === 1) t.send(JSON.stringify({ ...msg, from: user }))
    } else if (msg.type === 'event') {
      // Ephemeral fan-out (typing indicators, cursors, call invites…) — not persisted
      broadcast({ ...msg, from: user }, ws)
    }
  })

  ws.on('close', () => {
    const set = sockets.get(user)
    set?.delete(ws)
    if (set && set.size === 0) broadcast({ type: 'presence', online: onlineUsers() })
  })
})

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue }
    ws.isAlive = false
    ws.ping()
  }
}, 30_000).unref()

server.listen(PORT, () => {
  console.log(`[nexus-server] http://localhost:${PORT}  (AI: ${process.env.GEMINI_API_KEY ? 'Gemini ' + (process.env.GEMINI_MODEL || 'gemini-3.8-flash') : 'no key — set GEMINI_API_KEY in server/.env'})`)
})
