import { persist, createJSONStorage, type PersistOptions, type StateStorage } from 'zustand/middleware'
import type { StateCreator, StoreApi, UseBoundStore } from 'zustand'
import { getSessionUserId } from './session'
import { registerSyncedStore, isServerMode } from './sync'

/**
 * All feature stores persist under the `nexus:` prefix so Settings → "워크스페이스 초기화"
 * can wipe everything. Bump `version` when you change seed data shape.
 *
 * localStorage is a per-user *cache* (`nexus:<store>@<userId>`); when the backend is reachable the
 * source of truth is the server (see `lib/sync.ts`).
 */
export const STORAGE_PREFIX = 'nexus:'

const userScopedStorage: StateStorage = {
  getItem: (name) => {
    const user = getSessionUserId()
    if (user) {
      const scoped = localStorage.getItem(`${name}@${user}`)
      if (scoped !== null) return scoped
    }
    return localStorage.getItem(name) // legacy (pre-login) cache
  },
  setItem: (name, value) => {
    const user = getSessionUserId()
    localStorage.setItem(user ? `${name}@${user}` : name, value)
  },
  removeItem: (name) => {
    const user = getSessionUserId()
    localStorage.removeItem(user ? `${name}@${user}` : name)
  },
}

export function persisted<T>(
  name: string,
  creator: StateCreator<T, [['zustand/persist', unknown]], []>,
  options: Partial<PersistOptions<T, T>> = {},
) {
  return persist<T, [], [], T>(creator, {
    name: STORAGE_PREFIX + name,
    storage: createJSONStorage<T>(() => userScopedStorage),
    version: 1,
    ...options,
  })
}

type PersistedStore = UseBoundStore<StoreApi<any>> & { persist?: { rehydrate: () => unknown; getOptions: () => { name?: string } } }

/**
 * Registers a persisted store for realtime sync. With the backend online, changes flow through the
 * server (WebSocket) to every browser/user. Offline (no server), falls back to cross-tab sync via
 * the `storage` event so the app still works as a single-browser demo.
 */
export function syncAcrossTabs(store: PersistedStore) {
  if (typeof window === 'undefined' || !store.persist) return
  const fullName = store.persist.getOptions().name ?? ''
  registerSyncedStore(fullName.replace(STORAGE_PREFIX, ''), store)
  window.addEventListener('storage', (e) => {
    if (isServerMode()) return // server pushes updates; rehydrating here would echo writes back
    const user = getSessionUserId()
    if (e.key === fullName || (user && e.key === `${fullName}@${user}`)) store.persist!.rehydrate()
  })
}

export function resetWorkspace() {
  const wipeLocal = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k))
    location.reload()
  }
  if (isServerMode()) fetch('/api/reset', { method: 'POST' }).finally(wipeLocal)
  else wipeLocal()
}
