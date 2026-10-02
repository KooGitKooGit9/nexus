import { persist, createJSONStorage, type PersistOptions, type StateStorage } from 'zustand/middleware'
import type { StateCreator, StoreApi, UseBoundStore } from 'zustand'
import { getSessionScope } from './session'
import { registerSyncedStore, isServerMode } from './sync'

/**
 * All feature stores persist under the `nexus:` prefix so Settings → "워크스페이스 초기화"
 * can wipe everything. Bump `version` when you change seed data shape.
 *
 * localStorage is a per-member *cache* (`nexus:<store>@<workspaceId>:<memberId>`); when the backend is reachable the
 * source of truth is the server (see `lib/sync.ts`).
 */
export const STORAGE_PREFIX = 'nexus:'

const userScopedStorage: StateStorage = {
  getItem: (name) => {
    const scope = getSessionScope()
    // Signed in: only this workspace member's cache — never fall back to another workspace's data.
    return scope ? localStorage.getItem(`${name}@${scope}`) : localStorage.getItem(name)
  },
  setItem: (name, value) => {
    const scope = getSessionScope()
    localStorage.setItem(scope ? `${name}@${scope}` : name, value)
  },
  removeItem: (name) => {
    const scope = getSessionScope()
    localStorage.removeItem(scope ? `${name}@${scope}` : name)
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
    const scope = getSessionScope()
    if (e.key === fullName || (scope && e.key === `${fullName}@${scope}`)) store.persist!.rehydrate()
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
