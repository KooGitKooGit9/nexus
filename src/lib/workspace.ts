/**
 * The logged-in account and its current workspace (from `GET /api/auth/me`, loaded by `initSync`).
 * Offline mode (no server) = the local single-browser demo: `account` is null and the workspace is a demo.
 */
import { create } from 'zustand'
import { api, type Me, type WorkspaceSummary } from './api'

interface WorkspaceState {
  me: Me | null
  setMe: (me: Me | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  me: null,
  setMe: (me) => set({ me }),
}))

const OFFLINE_DEMO: WorkspaceSummary = { id: 'local', name: 'Aurora Labs', kind: 'demo', role: 'owner', plan: 'free', memberId: 'u_me' }

export function currentWorkspace(me: Me | null = useWorkspaceStore.getState().me): WorkspaceSummary {
  if (!me) return OFFLINE_DEMO
  return me.workspaces.find((w) => w.id === me.currentWorkspaceId) ?? OFFLINE_DEMO
}

/** Current workspace summary (name, kind, role, plan…). */
export const useWorkspace = () => useWorkspaceStore((s) => currentWorkspace(s.me))
export const useMe = () => useWorkspaceStore((s) => s.me)

/** Demo workspaces carry the Aurora Labs personas + simulated teammates; real ones never do. */
export const isDemoWorkspace = () => currentWorkspace().kind === 'demo'
export const canAdminWorkspace = () => ['owner', 'admin'].includes(currentWorkspace().role)

/** Re-fetch `me` (after renames, role changes…). Use `reloadInto()` when the workspace itself changes. */
export async function refreshMe() {
  const me = await api.me()
  useWorkspaceStore.getState().setMe(me)
  return me
}

/** After login / workspace switch the whole app must re-bootstrap — simplest and safest is a reload. */
export function reloadInto(path = '/') {
  location.assign(path)
}
