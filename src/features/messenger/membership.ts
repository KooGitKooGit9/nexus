/*
 * Real (non-demo) workspaces: every member belongs to every public channel.
 *
 * Each client only ever adds ITSELF (never other people) — concurrent writers then converge: if another
 * client's write to the same channel item wins and drops our id, the incoming op changes `channels`
 * again and we simply re-add ourselves. Channels the member left on purpose (`leftChannels`) are skipped.
 */
import { getCurrentUserId, useCore } from '@/store/core'
import { isDemoWorkspace } from '@/lib/workspace'
import { useMessenger } from './store'

let started = false
let timer: ReturnType<typeof setTimeout> | null = null

function ensureMembership() {
  timer = null
  if (isDemoWorkspace()) return
  const me = getCurrentUserId()
  // wait until the server-maintained member list knows us
  if (!me || me === 'u_bot' || !useCore.getState().users.some((u) => u.id === me)) return
  const s = useMessenger.getState()
  const left = new Set(s.leftChannels ?? [])
  const missing = new Set(
    s.channels.filter((c) => c.kind === 'public' && !c.archived && !c.isApp && !c.memberIds.includes(me) && !left.has(c.id)).map((c) => c.id),
  )
  if (!missing.size) return
  useMessenger.setState((st) => ({
    channels: st.channels.map((c) => (missing.has(c.id) && !c.memberIds.includes(me) ? { ...c, memberIds: [...c.memberIds, me] } : c)),
  }))
}

function schedule() {
  if (timer) return
  // small jitter so several members' clients don't all write the same item in the same instant
  timer = setTimeout(ensureMembership, 250 + Math.random() * 500)
}

/** Idempotent; called once at app start (messenger simulator bootstrap). */
export function startAutoJoin() {
  if (started || typeof window === 'undefined') return
  started = true
  schedule()
  useCore.subscribe((s, p) => {
    if (s.users !== p.users || s.currentUserId !== p.currentUserId) schedule()
  })
  useMessenger.subscribe((s, p) => {
    if (s.channels !== p.channels) schedule()
  })
}
