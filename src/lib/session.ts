/**
 * Who is using this browser tab. Real multi-user: each person logs in as one of the workspace
 * members; data is shared through the backend, per-user state (drafts, read markers, prefs) is not.
 *
 * - `localStorage['nexus-session']` — the browser's logged-in user
 * - `?as=<userId>` — open a tab as someone else (stored in sessionStorage for that tab only),
 *   handy for testing two people side by side in one browser.
 */
const LS_KEY = 'nexus-session'
const SS_KEY = 'nexus-session-tab'

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

// Pick up `?as=` once, before any store hydrates.
if (typeof window !== 'undefined') {
  const as = new URLSearchParams(location.search).get('as')
  if (as && /^[\w-]+$/.test(as)) {
    safe(() => sessionStorage.setItem(SS_KEY, as), undefined)
    const url = new URL(location.href)
    url.searchParams.delete('as')
    history.replaceState(history.state, '', url.toString())
  }
}

export function getSessionUserId(): string | null {
  return safe(() => sessionStorage.getItem(SS_KEY), null) || safe(() => localStorage.getItem(LS_KEY), null)
}

export function setSessionUserId(userId: string) {
  safe(() => localStorage.setItem(LS_KEY, userId), undefined)
  safe(() => sessionStorage.removeItem(SS_KEY), undefined)
}

export function clearSession() {
  safe(() => localStorage.removeItem(LS_KEY), undefined)
  safe(() => sessionStorage.removeItem(SS_KEY), undefined)
}
