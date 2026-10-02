/*
 * Call identity plumbing. `useUI.startCall()` (core) doesn't carry an id, so whoever starts a call that
 * must be shared with other browsers (a huddle card, an accepted invite) announces the id first with
 * `setNextCallId()`; the CallOverlay claims it when the call window mounts.
 */
import { uid } from '@/lib/utils'

export interface CallIdentity {
  id: string
  /** joining an existing call (accepted invite / huddle card) → announce, don't ring anyone */
  joining: boolean
}

let pending: { id: string; joining: boolean; at: number } | null = null
const byStartedAt = new Map<string, CallIdentity>()

/** The next `startCall()` belongs to this shared call id (huddle message id / invite id). */
export function setNextCallId(id: string, joining = false) {
  pending = { id, joining, at: Date.now() }
}

/** Stable identity for an active call (keyed by its `startedAt`). */
export function callIdentity(startedAt: string): CallIdentity {
  const known = byStartedAt.get(startedAt)
  if (known) return known
  const ident: CallIdentity = pending && Date.now() - pending.at < 3000 ? { id: pending.id, joining: pending.joining } : { id: uid('call'), joining: false }
  pending = null
  byStartedAt.set(startedAt, ident)
  return ident
}
