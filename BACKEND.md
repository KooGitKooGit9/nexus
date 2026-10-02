> ⚠️ Superseded by LAUNCH.md (round 4: multi-tenant SaaS). Kept for history.

# Nexus — Backend & "make it real" brief (round 3)

The user wants **no more fake features**: everything that looks like it works must actually work. Nexus now has a real backend. Read this + `AGENTS.md` (conventions) + `QA.md` (LOW-RESOURCE rules still apply: no browser tools, no tsc/vite/npm, no servers — the orchestrator verifies).

## Architecture (already built — read the files)
- `server/index.mjs` — Node HTTP + WebSocket + SQLite (`better-sqlite3`), port 5200. Vite proxies `/api` and `/ws`. `npm run dev` starts both (`scripts/dev.mjs`).
  - `GET /api/health`, `GET /api/bootstrap?user=`, `POST /api/seed`, `PUT /api/user-state`, `POST /api/ops`, `POST /api/upload` (raw body, headers `X-File-Name`, `X-User`) → `{id,url:'/api/files/<id>',name,mime,size}`, `GET /api/files/:id[?download=1]`, `POST /api/reset`.
  - `POST /api/ai/generate` — Gemini proxy. Body = Gemini `generateContent` JSON (`contents`, `systemInstruction`, `tools`, `toolConfig`, `generationConfig`, optional `model`). Returns Gemini's raw JSON. `503 {error:'NO_KEY'}` if `GEMINI_API_KEY` is unset in `server/.env`. `GET /api/ai/status`.
  - WS messages: `ops` (sync), `presence` (online userIds), `event` (ephemeral fan-out), `signal` (WebRTC relay to one user).
- `src/lib/sync.ts` — realtime sync. `SYNC_SPEC` lists each store's **shared** collections (arrays of `{id}`); all other data keys in a store are **per-user** state saved under the logged-in user. Feature code just uses its normal zustand actions; diffs go to the server and other browsers automatically (last-write-wins per item). Exports: `useSyncStatus` (`mode: 'server'|'offline'`, `online`, `aiEnabled`, `aiModel`), `isServerMode()`, `isUserOnline(id)`, `isSyncLeader()` (exactly one client — run workspace-wide simulations/schedulers only there), `emitSyncEvent(event, payload)` / `onSyncEvent(event, handler)` (ephemeral: typing, cursors, call invites), `sendSignal(to, payload)` (WebRTC).
- `src/lib/session.ts` — login identity. `getSessionUserId()`. Login screen = `src/app/Login.tsx`; `?as=u_fe` opens a tab as another member. **The current user is whoever logged in — NOT always `u_me`.** Use `useCore(s => s.currentUserId)` / `getCurrentUserId()` / `useCurrentUser()`; never hard-code `'u_me'` as "me" (seed data may still reference u_me as a person).
- `src/lib/inbox.ts` — `notifyUser(userId, {type,title,body,link,actorId})` delivers a bell notification + toast to **another** member (immediately if online, else at their next login). Use it whenever an action concerns someone else (assignment, mention, DM, approval request/decision, invite, kudos, share…). `notify()` from core is only for the current user.
- `src/lib/upload.ts` — `uploadFile(file, onProgress)` → server-stored file URL (offline fallback: blob URL). `downloadUrl(url)`.
- Offline mode (server not running) still works as the old single-browser demo — keep that path working.

## Rules
- Only edit files you own (your task lists them). If you need a change elsewhere, put it in your report.
- Persisted data must be JSON-serializable. Never store blob: URLs in shared collections.
- Simulated teammates must never act on behalf of a **real online user** (`isUserOnline(id)`), and background simulations must run only on `isSyncLeader()`.
- Keep everything Korean, polished, consistent with the design system.
- Finish with a concise report: what's now real, files changed, cross-dir requests, exact browser checks for the orchestrator.
