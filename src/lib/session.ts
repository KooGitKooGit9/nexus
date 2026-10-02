/**
 * Who is using this browser tab. The real session is an httpOnly cookie (see LAUNCH.md); this module only
 * caches the *identity inside the current workspace* (workspaceId + memberId) so persisted stores can
 * namespace their localStorage cache synchronously at import time.
 *
 * `main.tsx` awaits `initSync()` (which calls `setSessionIdentity`) BEFORE importing the app, so every
 * store hydrates under the right namespace. Offline mode (no server) = the local demo as member `u_me`.
 */
let identity: { workspaceId: string; memberId: string } | null = null

export function setSessionIdentity(workspaceId: string, memberId: string) {
  identity = { workspaceId, memberId }
}

/** The current member id inside the current workspace (`User.id` in the workspace data). */
export function getSessionUserId(): string | null {
  return identity?.memberId ?? null
}

export function getSessionWorkspaceId(): string | null {
  return identity?.workspaceId ?? null
}

/** localStorage namespace for per-member caches (`nexus:<store>@<scope>`). */
export function getSessionScope(): string | null {
  return identity ? `${identity.workspaceId}:${identity.memberId}` : null
}

/** Log out on the server, then go back to the public site. */
export async function clearSession() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } catch {
    /* offline — nothing to clear */
  }
  identity = null
  location.assign('/login')
}
