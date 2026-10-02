// SQLite schema (multi-tenant). Everything workspace-scoped carries `workspace_id`.
// Times are epoch milliseconds (INTEGER); the API converts them to ISO strings.
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,               -- lowercased; NULL for guests
    name TEXT NOT NULL,
    pw_hash TEXT, pw_salt TEXT,      -- scrypt (hex); NULL for guests
    guest INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER               -- guests only
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,     -- sha256(token) hex; the raw token only lives in the cookie
    account_id TEXT NOT NULL,
    current_workspace_id TEXT,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,              -- 'blank' | 'demo'
    plan TEXT NOT NULL DEFAULT 'free',
    cycle TEXT NOT NULL DEFAULT 'monthly',
    plan_status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'trialing' | 'canceled'
    trial_used INTEGER NOT NULL DEFAULT 0,
    trial_ends_at INTEGER,
    renews_at INTEGER,               -- end of the prepaid period (no auto-renewal)
    icon_color TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memberships (
    workspace_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    role TEXT NOT NULL,              -- 'owner' | 'admin' | 'member'
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, account_id),
    UNIQUE (workspace_id, member_id)
  );
  CREATE INDEX IF NOT EXISTS memberships_account ON memberships(account_id);
  CREATE TABLE IF NOT EXISTS invites (
    token TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT,                      -- NULL = link-only invite (reusable until it expires)
    role TEXT NOT NULL,
    inviter_account_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    accepted_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS invites_ws ON invites(workspace_id);
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS payments (
    order_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    cycle TEXT NOT NULL,
    amount INTEGER NOT NULL,         -- KRW incl. VAT
    status TEXT NOT NULL,            -- 'pending' | 'paid' | 'failed' | 'expired'
    payment_key TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_usage (
    workspace_id TEXT NOT NULL,
    day TEXT NOT NULL,               -- KST 'YYYY-MM-DD'
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (workspace_id, day)
  );
  CREATE TABLE IF NOT EXISTS items (
    workspace_id TEXT NOT NULL,
    store TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL,
    data TEXT NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, store, coll, id)
  );
  CREATE TABLE IF NOT EXISTS seeded (
    workspace_id TEXT NOT NULL, store TEXT NOT NULL, coll TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, store, coll)
  );
  CREATE TABLE IF NOT EXISTS user_state (
    workspace_id TEXT NOT NULL, member_id TEXT NOT NULL, store TEXT NOT NULL,
    data TEXT NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, member_id, store)
  );
  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT, mime TEXT, size INTEGER NOT NULL DEFAULT 0,
    owner TEXT,                      -- member_id of the uploader
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS uploads_ws ON uploads(workspace_id);
`

/**
 * The round-3 dev database had no workspaces. If we find it, move it (and its uploads) aside as
 * `nexus.legacy-<timestamp>.db` and start fresh — it is demo data, not customer data.
 */
function retireLegacy(dataDir, dbFile) {
  if (!fs.existsSync(dbFile)) return
  const probe = new Database(dbFile)
  let legacy = false
  try {
    const cols = probe.prepare("SELECT name FROM pragma_table_info('items')").all().map((r) => r.name)
    legacy = cols.length > 0 && !cols.includes('workspace_id')
    if (legacy) probe.pragma('wal_checkpoint(TRUNCATE)')
  } finally {
    probe.close()
  }
  if (!legacy) return
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = path.join(dataDir, `nexus.legacy-${stamp}.db`)
  fs.renameSync(dbFile, target)
  for (const ext of ['-wal', '-shm']) if (fs.existsSync(dbFile + ext)) fs.rmSync(dbFile + ext)
  const up = path.join(dataDir, 'uploads')
  if (fs.existsSync(up)) fs.renameSync(up, path.join(dataDir, `uploads.legacy-${stamp}`))
  console.log(`[nexus-server] legacy single-workspace DB moved to ${path.basename(target)} — starting fresh`)
}

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, 'nexus.db')
  retireLegacy(dataDir, file)
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')
  db.exec(SCHEMA)
  // additive column migrations (no-op when present)
  const cols = new Set(db.prepare('PRAGMA table_info(accounts)').all().map((c) => c.name))
  if (!cols.has('terms_agreed_at')) db.exec('ALTER TABLE accounts ADD COLUMN terms_agreed_at INTEGER')
  if (!cols.has('marketing_opt_in')) db.exec('ALTER TABLE accounts ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0')
  if (!cols.has('marketing_at')) db.exec('ALTER TABLE accounts ADD COLUMN marketing_at INTEGER')
  return db
}
