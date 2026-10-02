/**
 * Realtime sync client.
 *
 * Every persisted zustand store registers here (via `syncAcrossTabs`). For each store, SYNC_SPEC lists
 * the *shared* collections — arrays of `{ id }` items that all users see (messages, tasks, docs…).
 * Everything else in the store's data is *per-member* state (drafts, read markers, prefs) and is saved
 * to the server under the logged-in member of the current workspace.
 *
 * Shared collections sync at item granularity: local changes are diffed against the last synced
 * snapshot → `{ upserts, deletes }` ops → WebSocket → server (SQLite) → broadcast to other clients,
 * which apply them. Conflict policy: last write wins per item.
 *
 * Feature code doesn't need to know any of this — it keeps calling its normal store actions.
 * IMPORTANT: this module must not import stores (they import it via lib/persist).
 */
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { getSessionUserId, getSessionScope, setSessionIdentity } from './session'
import { api, type Me, type WorkspaceKind } from './api'
import { useWorkspaceStore } from './workspace'
import { starterItems, STARTER_USER_STATE } from './starter'

export const SYNC_SPEC: Record<string, string[]> = {
  core: ['users'],
  messenger: ['channels', 'messages'],
  projects: ['projects', 'tasks'],
  calendar: ['events'],
  docs: ['docs'],
  files: ['files'],
  workflows: ['workflows'],
  approvals: ['requests'],
  goals: ['objectives', 'announcements'],
  whiteboard: ['boards'],
  people: ['kudos', 'leaves'],
  inbox: ['items'], // cross-user notifications (see lib/inbox.ts)
}

/* ───────────────────────── status store (for UI) ───────────────────────── */

export type SyncMode = 'connecting' | 'server' | 'offline'

interface SyncStatus {
  mode: SyncMode
  connected: boolean
  needsLogin: boolean
  /** logged in, but no workspace yet → onboarding */
  needsWorkspace: boolean
  online: string[] // userIds with an open connection
  aiEnabled: boolean
  aiModel: string
}

export const useSyncStatus = create<SyncStatus>(() => ({
  mode: 'connecting',
  connected: false,
  needsLogin: false,
  needsWorkspace: false,
  online: [],
  aiEnabled: false,
  aiModel: '',
}))

/** True while sync is applying changes that came from another client (lets listeners ignore remote edits). */
export const isApplyingRemote = () => applyingRemote > 0
export const isServerMode = () => useSyncStatus.getState().mode === 'server'
export const isUserOnline = (userId: string) => useSyncStatus.getState().online.includes(userId)

/**
 * One client is the "leader" (lowest online userId) — use it to run workspace-wide simulations
 * (background teammate posts, scheduled workflows) exactly once instead of once per open browser.
 */
export function isSyncLeader(): boolean {
  const s = useSyncStatus.getState()
  if (s.mode !== 'server') return true
  const me = getSessionUserId()
  if (!me) return false
  const sorted = [...s.online].sort()
  return sorted.length === 0 || sorted[0] === me
}

/* ───────────────────────── registry ───────────────────────── */

type AnyStore = UseBoundStore<StoreApi<any>>
const stores = new Map<string, AnyStore>()
/** store → coll → id → JSON of last synced item */
const snapshots = new Map<string, Map<string, Map<string, string>>>()
let applyingRemote = 0
let started = false
type Boot = {
  stores: Record<string, Record<string, { id: string }[]>>
  seeded: Record<string, string[]>
  userState: Record<string, Record<string, unknown>>
  online?: string[]
  workspace: { id: string; name: string; kind: WorkspaceKind; plan: string }
  memberId: string
}
/** Kept (and patched by incoming ops) so stores created later — lazy chunks — still hydrate correctly. */
let bootCache: Boot | null = null

export function registerSyncedStore(name: string, store: AnyStore) {
  stores.set(name, store)
  if (started && bootCache) {
    const user = getSessionUserId()
    if (user) { hydrateFromServer(name, store, bootCache, user); attach(name, store) }
  }
}

const dataKeys = (state: Record<string, unknown>) => Object.keys(state).filter((k) => typeof state[k] !== 'function')
const userKeys = (name: string, state: Record<string, unknown>) => dataKeys(state).filter((k) => !(SYNC_SPEC[name] ?? []).includes(k))
const pick = (state: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.map((k) => [k, state[k]]))

function snapOf(name: string, coll: string) {
  let s = snapshots.get(name)
  if (!s) snapshots.set(name, (s = new Map()))
  let c = s.get(coll)
  if (!c) s.set(coll, (c = new Map()))
  return c
}

function setSnapshot(name: string, coll: string, items: { id: string }[]) {
  const c = snapOf(name, coll)
  c.clear()
  for (const it of items) if (it && typeof it.id === 'string') c.set(it.id, JSON.stringify(it))
}

function remoteSet(store: AnyStore, patch: Record<string, unknown>) {
  applyingRemote++
  try { store.setState(patch) } finally { applyingRemote-- }
}

/* ───────────────────────── transport ───────────────────────── */

let ws: WebSocket | null = null
let retry = 0
const outbox: string[] = []
type EventHandler = (msg: Record<string, unknown>) => void
const eventHandlers = new Map<string, Set<EventHandler>>()

function sendRaw(payload: object) {
  const data = JSON.stringify(payload)
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(data)
  else outbox.push(data)
}

/** Ephemeral broadcast to other clients (typing indicators, call invites…). */
export function emitSyncEvent(event: string, payload: Record<string, unknown> = {}) {
  if (!isServerMode()) return
  sendRaw({ type: 'event', event, ...payload })
}

/** Subscribe to ephemeral events from other clients. Returns an unsubscribe fn. */
export function onSyncEvent(event: string, handler: EventHandler) {
  if (!eventHandlers.has(event)) eventHandlers.set(event, new Set())
  eventHandlers.get(event)!.add(handler)
  return () => { eventHandlers.get(event)?.delete(handler) }
}

/** WebRTC signaling relay to a specific user. */
export function sendSignal(to: string, payload: Record<string, unknown>) {
  if (!isServerMode()) return
  sendRaw({ type: 'signal', to, ...payload })
}

function connect() {
  const user = getSessionUserId()
  if (!user) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  // identity comes from the session cookie
  ws = new WebSocket(`${proto}://${location.host}/ws`)
  ws.onopen = () => {
    retry = 0
    useSyncStatus.setState({ connected: true })
    while (outbox.length && ws?.readyState === WebSocket.OPEN) ws.send(outbox.shift()!)
  }
  ws.onclose = (ev) => {
    useSyncStatus.setState({ connected: false })
    // 4001 = session ended (logged out / password changed) · 4003 = removed from the workspace / it was deleted
    if (ev.code === 4001) { location.assign('/login'); return }
    if (ev.code === 4003) { location.assign('/'); return }
    // a rejected upgrade (401) shows up as 1006 — after a few failures, check whether we're still signed in
    if (retry >= 3) void api.me().then((m) => { if (!m.account) location.assign('/login') }).catch(() => {})
    const delay = Math.min(10_000, 500 * 2 ** retry++)
    setTimeout(connect, delay)
  }
  ws.onmessage = (ev) => {
    let msg: Record<string, any>
    try { msg = JSON.parse(ev.data) } catch { return }
    if (msg.type === 'ops') applyRemoteOps(msg.store, msg.coll, msg.upserts ?? [], msg.deletes ?? [])
    else if (msg.type === 'presence') useSyncStatus.setState({ online: msg.online ?? [] })
    else if (msg.type === 'reset') {
      const scope = getSessionScope()
      Object.keys(localStorage).filter((k) => k.startsWith('nexus:') && (!scope || k.endsWith(`@${scope}`))).forEach((k) => localStorage.removeItem(k))
      location.reload()
    } else if (msg.type === 'error') {
      // e.g. { error: 'PLAN_LIMIT', limit: 'workflows', message } — the server also sends a reverting op
      eventHandlers.get('server-error')?.forEach((h) => { try { h(msg) } catch (e) { console.error(e) } })
    } else if (msg.type === 'event' || msg.type === 'signal') {
      const key = msg.type === 'signal' ? 'signal' : String(msg.event)
      eventHandlers.get(key)?.forEach((h) => { try { h(msg) } catch (e) { console.error(e) } })
    }
  }
}

function applyRemoteOps(name: string, coll: string, upserts: { id: string }[], deletes: string[]) {
  const store = stores.get(name)
  if (!store) {
    if (bootCache) {
      const arr = ((bootCache.stores[name] ??= {})[coll] ??= [])
      const byId = new Map(arr.map((x) => [x.id, x]))
      for (const it of upserts) byId.set(it.id, it)
      for (const id of deletes) byId.delete(id)
      bootCache.stores[name][coll] = [...byId.values()]
      ;(bootCache.seeded[name] ??= []).includes(coll) || bootCache.seeded[name].push(coll)
    }
    return
  }
  const cur = (store.getState()[coll] as { id: string }[] | undefined) ?? []
  const byId = new Map(cur.map((x) => [x.id, x]))
  const snap = snapOf(name, coll)
  for (const it of upserts) { byId.set(it.id, it); snap.set(it.id, JSON.stringify(it)) }
  for (const id of deletes) { byId.delete(id); snap.delete(id) }
  // keep existing order, append new ones
  const next: { id: string }[] = []
  const seen = new Set<string>()
  for (const x of cur) if (byId.has(x.id)) { next.push(byId.get(x.id)!); seen.add(x.id) }
  for (const it of upserts) if (!seen.has(it.id) && byId.has(it.id)) { next.push(byId.get(it.id)!); seen.add(it.id) }
  remoteSet(store, { [coll]: next })
}

/* ───────────────────────── local → server ───────────────────────── */

const userStateTimers = new Map<string, ReturnType<typeof setTimeout>>()

function attach(name: string, store: AnyStore) {
  const spec = SYNC_SPEC[name] ?? []
  store.subscribe((state: Record<string, unknown>, prev: Record<string, unknown>) => {
    if (applyingRemote || !isServerMode()) return
    for (const coll of spec) {
      if (state[coll] === prev[coll]) continue
      const items = (state[coll] as { id: string }[] | undefined) ?? []
      const snap = snapOf(name, coll)
      const upserts: { id: string }[] = []
      const ids = new Set<string>()
      for (const it of items) {
        if (!it || typeof it.id !== 'string') continue
        ids.add(it.id)
        const json = JSON.stringify(it)
        if (snap.get(it.id) !== json) { upserts.push(it); snap.set(it.id, json) }
      }
      const deletes = [...snap.keys()].filter((id) => !ids.has(id))
      for (const id of deletes) snap.delete(id)
      if (upserts.length || deletes.length) sendRaw({ type: 'ops', store: name, coll, upserts, deletes })
    }
    // per-user state (debounced)
    const uk = userKeys(name, state)
    if (uk.some((k) => state[k] !== prev[k])) {
      clearTimeout(userStateTimers.get(name))
      userStateTimers.set(name, setTimeout(() => pushUserState(name, store), 800))
    }
  })
}

function pushUserState(name: string, store: AnyStore) {
  const user = getSessionUserId()
  if (!user) return
  const state = store.getState() as Record<string, unknown>
  fetch('/api/user-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ store: name, data: pick(state, userKeys(name, state)) }),
    keepalive: true,
  }).catch(() => {})
}

/* ───────────────────────── boot ───────────────────────── */

async function fetchJSON<T>(url: string, init?: RequestInit, timeoutMs = 4000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal })
    if (!r.ok) throw new Error(`${r.status}`)
    return (await r.json()) as T
  } finally {
    clearTimeout(t)
  }
}

/**
 * Called once before the app is even imported (see main.tsx). Detects the backend; if present, resolves the
 * session (account → current workspace → member id), pulls that workspace's shared data + this member's
 * state, seeds empty collections, then starts realtime sync.
 */
export async function initSync(): Promise<void> {
  let health: { ok: boolean; ai: boolean; model: string }
  try {
    health = await fetchJSON('/api/health', undefined, 1500)
  } catch {
    useSyncStatus.setState({ mode: 'offline' })
    return
  }
  useSyncStatus.setState({ aiEnabled: !!health.ai, aiModel: health.model ?? '' })

  let me: Me
  try {
    me = await api.me()
  } catch {
    useSyncStatus.setState({ mode: 'offline' })
    return
  }
  useWorkspaceStore.getState().setMe(me)
  if (!me.account) {
    useSyncStatus.setState({ mode: 'server', needsLogin: true })
    return
  }
  const ws = me.workspaces.find((w) => w.id === me.currentWorkspaceId)
  if (!ws) {
    useSyncStatus.setState({ mode: 'server', needsWorkspace: true })
    return
  }
  setSessionIdentity(ws.id, ws.memberId)

  const boot = await fetchJSON<Boot>('/api/bootstrap', { credentials: 'same-origin' }, 15_000).catch((e: Error) => e)
  if (boot instanceof Error && boot.message === '401') {
    useSyncStatus.setState({ mode: 'server', needsLogin: true })
    return
  }
  if (boot instanceof Error && boot.message === '409') {
    useSyncStatus.setState({ mode: 'server', needsWorkspace: true })
    return
  }
  if (boot instanceof Error) {
    useSyncStatus.setState({ mode: 'offline' })
    return
  }
  // the server is authoritative about who we are in this workspace
  if (boot.memberId && boot.memberId !== ws.memberId) setSessionIdentity(boot.workspace.id, boot.memberId)

  bootCache = boot
  useSyncStatus.setState({ mode: 'server', online: boot.online ?? [] })
  const user = getSessionUserId()!
  for (const [name, store] of stores) hydrateFromServer(name, store, boot, user)
  started = true
  for (const [name, store] of stores) attach(name, store)
  connect()
}

/**
 * Applies the server snapshot to a store. Synchronous on purpose (lazy feature chunks register while
 * rendering — they must never paint local sample data first). Seeding an empty collection is posted in the
 * background; if another client won the race, its data replaces ours when the reply arrives.
 */
function hydrateFromServer(name: string, store: AnyStore, boot: Boot, user: string) {
  const spec = SYNC_SPEC[name] ?? []
  const state = store.getState() as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  const toSeed: { coll: string; items: { id: string }[] }[] = []

  for (const coll of spec) {
    if (boot.seeded[name]?.includes(coll)) {
      patch[coll] = boot.stores[name]?.[coll] ?? []
    } else {
      // First client in this workspace: demo workspaces upload the built-in sample data; real (blank)
      // workspaces start from the minimal starter content only.
      const items =
        boot.workspace.kind === 'demo'
          ? ((state[coll] as { id: string }[] | undefined) ?? []).filter((x) => x && typeof x.id === 'string')
          : starterItems(name, coll, { workspaceName: boot.workspace.name, memberId: user })
      patch[coll] = items
      toSeed.push({ coll, items })
      ;((boot.stores[name] ??= {})[coll] = items)
      ;(boot.seeded[name] ??= []).push(coll)
    }
    setSnapshot(name, coll, patch[coll] as { id: string }[])
  }

  const us = boot.userState[name]
  if (us) {
    for (const k of userKeys(name, state)) if (k in us) patch[k] = us[k]
  } else if (boot.workspace.kind !== 'demo') {
    Object.assign(patch, STARTER_USER_STATE[name] ?? {})
  }
  if (name === 'core') patch.currentUserId = user

  remoteSet(store, patch)
  if (!us) pushUserState(name, store)

  for (const { coll, items } of toSeed) {
    void fetchJSON<{ seeded: boolean; items?: { id: string }[] }>(
      '/api/seed',
      { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store: name, coll, items }) },
      15_000,
    )
      .then((res) => {
        if (res.seeded || !res.items) return
        const theirs = res.items
        setSnapshot(name, coll, theirs)
        if (bootCache?.stores[name]) bootCache.stores[name][coll] = theirs
        remoteSet(store, { [coll]: theirs })
      })
      .catch(() => {})
  }
}
