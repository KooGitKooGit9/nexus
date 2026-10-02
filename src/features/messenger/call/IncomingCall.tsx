/* Incoming call invites from real people: ringing card with 수락 / 거절. */
import { useEffect } from 'react'
import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { emitSyncEvent, sendSignal } from '@/lib/sync'
import { getCurrentUserId, getUser, notify, useUI } from '@/store/core'
import { Avatar } from '@/components/ui'
import { getChannel, channelLabel, channelPath } from '../lib'
import { isLiveHuddle, joinHuddle } from '../actions'
import { setNextCallId } from './session'

export interface Invite {
  callId: string
  from: string
  title: string
  video: boolean
  channelId?: string
  participantIds: string[]
  at: number
}

interface IncomingState {
  invites: Invite[]
  add: (i: Invite) => void
  remove: (callId: string) => void
}

export const useIncoming = create<IncomingState>()((set) => ({
  invites: [],
  add: (i) => set((s) => (s.invites.some((x) => x.callId === i.callId) ? s : { invites: [...s.invites, i] })),
  remove: (callId) => set((s) => ({ invites: s.invites.filter((x) => x.callId !== callId) })),
}))

const RING_MS = 30_000
const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Called for every `invite` signal. */
export function receiveInvite(from: string, msg: Record<string, unknown>) {
  const callId = typeof msg.callId === 'string' ? msg.callId : ''
  if (!callId || from === getCurrentUserId()) return
  const invite: Invite = {
    callId,
    from,
    title: typeof msg.title === 'string' ? msg.title : '통화',
    video: !!msg.video,
    channelId: typeof msg.channelId === 'string' ? msg.channelId : undefined,
    participantIds: Array.isArray(msg.participantIds) ? msg.participantIds.filter((x): x is string => typeof x === 'string') : [],
    at: Date.now(),
  }
  useIncoming.getState().add(invite)
  clearTimeout(timers.get(callId))
  timers.set(callId, setTimeout(() => missed(callId, true), RING_MS))
}

function drop(callId: string) {
  clearTimeout(timers.get(callId))
  timers.delete(callId)
  useIncoming.getState().remove(callId)
}

/** The caller hung up / we didn't answer in time → "부재중 통화" in the bell. */
export function missed(callId: string, timeout = false) {
  const inv = useIncoming.getState().invites.find((i) => i.callId === callId)
  if (!inv) return
  drop(callId)
  if (timeout) sendSignal(inv.from, { kind: 'decline', callId, reason: 'timeout' })
  const name = getUser(inv.from)?.name ?? '동료'
  notify({
    type: 'message',
    title: `${name}님의 부재중 ${inv.video ? '화상 통화' : '통화'}`,
    body: inv.channelId && getChannel(inv.channelId) ? `${channelLabel(getChannel(inv.channelId)!)}에서 걸려온 통화` : undefined,
    link: inv.channelId ? channelPath(inv.channelId) : undefined,
    actorId: inv.from,
  })
}

/** Another tab of the same user answered / declined. */
export function handledElsewhere(callId: string) {
  drop(callId)
}

function displayTitle(inv: Invite) {
  const me = getCurrentUserId()
  const ch = inv.channelId ? getChannel(inv.channelId) : undefined
  const kind = inv.video ? '화상 회의' : '허들'
  if (ch) return `${channelLabel(ch)} ${kind}`
  const others = inv.participantIds.filter((id) => id !== me && id !== inv.from)
  return others.length ? inv.title : getUser(inv.from)?.name ?? inv.title
}

export function acceptInvite(inv: Invite) {
  const me = getCurrentUserId()
  drop(inv.callId)
  emitSyncEvent('call-handled', { callId: inv.callId })
  const ui = useUI.getState()
  if (ui.call) ui.endCall()
  if (inv.channelId && isLiveHuddle(inv.callId)) {
    joinHuddle(inv.callId, inv.video)
    return
  }
  setNextCallId(inv.callId, true)
  ui.startCall({
    title: displayTitle(inv),
    participantIds: Array.from(new Set([me, inv.from, ...inv.participantIds])),
    video: inv.video,
    channelId: inv.channelId,
  })
}

export function declineInvite(inv: Invite) {
  drop(inv.callId)
  sendSignal(inv.from, { kind: 'decline', callId: inv.callId })
  emitSyncEvent('call-handled', { callId: inv.callId })
}

/* ───────────── ring tone (soft, WebAudio) ───────────── */

function useRingTone(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    let ctx: AudioContext | null = null
    try { ctx = new AC() } catch { return }
    const ring = () => {
      if (!ctx || ctx.state === 'closed') return
      const t0 = ctx.currentTime
      for (const [i, f] of [660, 880].entries()) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = f
        g.gain.setValueAtTime(0, t0 + i * 0.22)
        g.gain.linearRampToValueAtTime(0.06, t0 + i * 0.22 + 0.03)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.2)
        o.connect(g).connect(ctx.destination)
        o.start(t0 + i * 0.22)
        o.stop(t0 + i * 0.22 + 0.22)
      }
    }
    ring()
    const t = setInterval(ring, 2200)
    return () => {
      clearInterval(t)
      void ctx?.close().catch(() => {})
    }
  }, [active])
}

/* ───────────── UI ───────────── */

export function IncomingCalls() {
  const invites = useIncoming((s) => s.invites)
  const inv = invites[0]
  useRingTone(!!inv)
  return (
    <AnimatePresence>
      {inv && (
        <motion.div
          key={inv.callId}
          initial={{ opacity: 0, y: -24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          role="alertdialog"
          aria-label="수신 통화"
          className="fixed right-4 top-4 z-[90] w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d1a]/95 p-4 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(139,92,246,0.3)] backdrop-blur-2xl"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-600/30 blur-3xl" />
          <div className="relative flex items-center gap-3.5">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-success/40 animate-pulse-ring" />
              <Avatar userId={inv.from} size="lg" className="relative" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{getUser(inv.from)?.name ?? '동료'}</div>
              <div className="flex items-center gap-1.5 truncate text-[12.5px] text-white/65">
                {inv.video ? <Video className="h-3.5 w-3.5 shrink-0" /> : <Phone className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{displayTitle(inv)} · {inv.video ? '화상 통화' : '음성 통화'} 요청</span>
              </div>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => declineInvite(inv)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-danger/90 text-[13.5px] font-semibold text-white transition hover:bg-danger active:scale-95"
            >
              <PhoneOff className="h-4 w-4" /> 거절
            </button>
            <button
              onClick={() => acceptInvite(inv)}
              className="flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-success text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgb(var(--success)/0.7)] transition hover:brightness-110 active:scale-95"
            >
              {inv.video ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />} 수락
            </button>
          </div>
          {invites.length > 1 && <div className="relative mt-2 text-center text-[11px] text-white/50">대기 중인 통화 {invites.length - 1}건 더</div>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
