import { useEffect, useMemo, useReducer, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, Hand, Headphones, Loader2, Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneCall, PhoneOff, Smile, Users, Video, VideoOff,
} from 'lucide-react'
import { cn, gradientFor, hashIndex } from '@/lib/utils'
import { isUserOnline, onSyncEvent, useSyncStatus } from '@/lib/sync'
import { getCurrentUserId, getUser, toast, useCore, useUI, type ActiveCall } from '@/store/core'
import { Avatar, Tooltip } from '@/components/ui'
import { closeStaleHuddles, endHuddle } from './actions'
import { useMessengerSimulator } from './simulator'
import { callIdentity } from './call/session'
import { disposeMesh, meshFor, releaseMesh, retainMesh, routeSignal, type RemotePeer } from './call/mesh'
import { useSpeaking } from './call/media'
import { IncomingCalls, handledElsewhere, missed, receiveInvite, useIncoming } from './call/IncomingCall'

const REACTIONS = ['👍', '👏', '😂', '❤️', '🎉', '🔥', '😮', '🙌']

function fmtElapsed(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

interface Floating {
  id: number
  emoji: string
  x: number
  by: string
}

/**
 * Global huddle / call overlay. Mounted once by the app layout; also boots the messenger simulator and
 * listens for call signaling (invites from real people ring here even outside the messenger).
 *
 * Real participants (logged-in members who are online) are connected with a WebRTC mesh (see call/mesh.ts);
 * everyone else in the call is a simulated tile.
 */
export function CallOverlay() {
  useMessengerSimulator()
  const call = useUI((s) => s.call)
  const prev = useRef<ActiveCall | null>(null)
  const joinedRef = useRef<string[]>([])
  const othersRef = useRef(false)

  // huddle cards left "live" by closed tabs — wait for presence so live huddles of others aren't closed
  useEffect(() => {
    const t = setTimeout(() => closeStaleHuddles(), 4000)
    return () => clearTimeout(t)
  }, [])

  // call signaling: invites ring here, everything else goes to the call it belongs to
  useEffect(() => {
    const offSignal = onSyncEvent('signal', (msg) => {
      const from = typeof msg.from === 'string' ? msg.from : ''
      if (!from || from === getCurrentUserId()) return
      if (msg.kind === 'invite') {
        const cur = useUI.getState().call
        if (cur && callIdentity(cur.startedAt).id === msg.callId) return
        receiveInvite(from, msg)
        return
      }
      if (msg.kind === 'leave' && typeof msg.callId === 'string' && useIncoming.getState().invites.some((i) => i.callId === msg.callId && i.from === from)) {
        missed(msg.callId)
      }
      routeSignal(from, msg)
    })
    // another tab of mine answered / declined → stop ringing here
    const offHandled = onSyncEvent('call-handled', (msg) => {
      if (msg.from === getCurrentUserId() && typeof msg.callId === 'string') handledElsewhere(msg.callId)
    })
    // closing the tab mid-call: tell the others
    const onHide = () => {
      const c = useUI.getState().call
      if (c) disposeMesh(c.startedAt)
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      offSignal()
      offHandled()
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

  // bookkeeping when a call ends (from anywhere)
  useEffect(() => {
    const p = prev.current
    if (p && (!call || call.startedAt !== p.startedAt)) {
      const othersRemain = othersRef.current
      disposeMesh(p.startedAt)
      endHuddle(p.startedAt, joinedRef.current.length ? joinedRef.current : p.participantIds, othersRemain)
      othersRef.current = false
      // switching audio ↔ video in the same channel restarts the call — that's not "leaving"
      const switched = !!call && !!p.channelId && call.channelId === p.channelId
      if (!switched) {
        const sec = Math.round((Date.now() - new Date(p.startedAt).getTime()) / 1000)
        toast(`${p.video ? '화상 회의' : '허들'}에서 나왔어요`, { emoji: '👋', description: `${p.title} · ${fmtElapsed(sec)}` })
      }
    }
    prev.current = call
  }, [call])

  return createPortal(
    <>
      <AnimatePresence>{call && <CallWindow key={call.startedAt} call={call} joinedRef={joinedRef} othersRef={othersRef} />}</AnimatePresence>
      <IncomingCalls />
    </>,
    document.body,
  )
}

function CallWindow({ call, joinedRef, othersRef }: { call: ActiveCall; joinedRef: MutableRefObject<string[]>; othersRef: MutableRefObject<boolean> }) {
  const me = useCore((s) => s.currentUserId)
  const endCall = useUI((s) => s.endCall)
  const ident = useMemo(() => callIdentity(call.startedAt), [call.startedAt])
  const [mesh] = useState(() => meshFor(call.startedAt, ident.id, me))
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [expanded, setExpanded] = useState(call.video)
  const [reactOpen, setReactOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [simSpeaking, setSimSpeaking] = useState<string[]>([])
  const [floating, setFloating] = useState<Floating[]>([])
  const [busy, setBusy] = useState<null | 'mic' | 'camera' | 'screen'>(null)
  const bounds = useRef<HTMLDivElement>(null)

  const everyone = useMemo(() => Array.from(new Set([me, ...call.participantIds])).filter((id) => id !== 'u_bot'), [call.participantIds, me])
  // real people (logged in right now) connect over WebRTC; everyone else in the call is simulated
  const [realIds] = useState(() => everyone.filter((id) => id !== me && isUserOnline(id)))
  const simIds = useMemo(() => everyone.filter((id) => id !== me && !realIds.includes(id)), [everyone, realIds])
  const [simJoined, setSimJoined] = useState<string[]>(() => simIds.slice(0, 1))

  const spawn = (emoji: string, by: string) => {
    const id = Date.now() + Math.random()
    setFloating((f) => [...f, { id, emoji, x: 10 + Math.random() * 80, by }])
    setTimeout(() => setFloating((f) => f.filter((x) => x.id !== id)), 2800)
  }
  const spawnRef = useRef(spawn)
  spawnRef.current = spawn

  // start-up: camera/mic, ring real participants (or announce that we joined) — once per call
  useEffect(() => {
    retainMesh(call.startedAt)
    mesh.onChange = bump
    mesh.onReact = (from, emoji) => spawnRef.current(emoji, from)
    mesh.onGone = (id, reason) => {
      const name = getUser(id)?.name ?? '동료'
      const title = reason === 'declined' ? `${name}님이 통화를 거절했어요` : reason === 'timeout' ? `${name}님이 응답하지 않아요` : `${name}님이 통화에서 나갔어요`
      toast(title, { emoji: reason === 'left' ? '👋' : '📵', actorId: id })
    }
    if (!mesh.started) {
      mesh.started = true
      void mesh.startMedia(call.video)
      // after this commit: a previous call instance (audio ↔ video switch) must say "leave" before we say "join"
      setTimeout(() => {
        if (mesh.isClosed) return
        if (ident.joining) mesh.announce()
        else if (realIds.length) mesh.invite(realIds, { title: call.title, video: call.video, channelId: call.channelId, participantIds: everyone })
      }, 30)
    }
    return () => releaseMesh(call.startedAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // real people who disconnect from the workspace leave the call
  useEffect(() => useSyncStatus.subscribe((s, p) => { if (s.online !== p.online && s.mode === 'server') mesh.dropOffline(s.online) }), [mesh])

  // camera / mic problems (permission denied, no device…) → one clear message
  const shownError = useRef<string | null>(null)
  useEffect(() => {
    if (mesh.mediaError && shownError.current !== mesh.mediaError) {
      shownError.current = mesh.mediaError
      toast('카메라/마이크를 사용할 수 없어요', { variant: 'warning', emoji: '🎙️', description: mesh.mediaError, duration: 7000 })
    }
  })

  const peers = mesh.peers()
  const connected = peers.filter((p) => p.status === 'connected').map((p) => p.userId)
  const joined = [me, ...simJoined, ...connected]
  // (an exiting window — audio↔video switch — must not overwrite the new call's bookkeeping)
  if (!mesh.isClosed && useUI.getState().call?.startedAt === call.startedAt) {
    joinedRef.current = joined
    othersRef.current = connected.length > 0
  }
  const flags = mesh.localFlags

  // 1:1 / ad-hoc calls end when the other side is gone (channel huddles stay open for others to join)
  const hadOthers = useRef(false)
  useEffect(() => {
    if (peers.length) hadOthers.current = true
    else if (hadOthers.current && !simIds.length && !call.channelId && !mesh.isClosed && useUI.getState().call?.startedAt === call.startedAt) endCall()
  }, [peers.length, simIds.length, call.channelId, call.startedAt, endCall, mesh])

  // remaining simulated participants trickle in
  useEffect(() => {
    const pendingSim = simIds.filter((id) => !simJoined.includes(id))
    if (!pendingSim.length) return
    const t = setTimeout(() => setSimJoined((j) => [...j, pendingSim[0]]), 1400 + Math.random() * 2200)
    return () => clearTimeout(t)
  }, [simIds, simJoined])

  // timer
  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [call.startedAt])

  // simulated participants "talk" (real ones light up from their actual audio level)
  useEffect(() => {
    if (!simJoined.length) return
    const t = setInterval(() => {
      const pool = simJoined.filter((id) => !isMutedPeer(id))
      const n = Math.random() < 0.25 ? 2 : Math.random() < 0.3 ? 0 : 1
      setSimSpeaking([...pool].sort(() => Math.random() - 0.5).slice(0, n))
    }, 1300)
    return () => clearInterval(t)
  }, [simJoined])

  // simulated participants occasionally react
  useEffect(() => {
    if (!simJoined.length) return
    const t = setInterval(() => {
      if (Math.random() < 0.3) spawnRef.current(REACTIONS[Math.floor(Math.random() * REACTIONS.length)], simJoined[Math.floor(Math.random() * simJoined.length)])
    }, 7000)
    return () => clearInterval(t)
  }, [simJoined])

  const report = (err: string | null, title: string) => {
    if (err) toast(title, { variant: 'error', emoji: '⚠️', description: err, duration: 6000 })
  }
  const run = async (kind: 'mic' | 'camera' | 'screen', fn: () => Promise<string | null>, title: string) => {
    if (busy) return
    setBusy(kind)
    try {
      report(await fn(), title)
    } finally {
      setBusy(null)
    }
  }

  const controls = (
    <Controls
      compact={!expanded}
      muted={flags.muted}
      camera={flags.camera}
      sharing={flags.sharing}
      hand={flags.hand}
      busy={busy}
      reactOpen={reactOpen}
      onMute={() => void run('mic', () => mesh.setMuted(!flags.muted), '마이크를 켤 수 없어요')}
      onCamera={() => void run('camera', () => mesh.setCamera(!flags.camera), '카메라를 켤 수 없어요')}
      onShare={() =>
        void run('screen', async () => {
          const turningOn = !flags.sharing
          const err = await mesh.setSharing(turningOn)
          if (!err && turningOn) setExpanded(true)
          return err
        }, '화면 공유를 시작할 수 없어요')
      }
      onHand={() => {
        mesh.setHand(!flags.hand)
        if (!flags.hand) toast('손을 들었어요', { emoji: '✋' })
      }}
      onReactToggle={() => setReactOpen((v) => !v)}
      onReact={(e) => {
        spawn(e, me)
        mesh.sendReaction(e)
        setReactOpen(false)
      }}
      onLeave={endCall}
    />
  )

  const localTile = (
    <TileFrame
      key={me}
      userId={me}
      me
      compact={!expanded}
      muted={flags.muted}
      hand={flags.hand}
      camera={flags.camera}
      video={flags.camera ? <StreamVideo stream={mesh.local} version={mesh.localVersion} mirror /> : null}
      speakingStream={mesh.local}
    />
  )
  const tiles = [
    localTile,
    ...peers.map((p) => <RemoteTile key={p.userId} peer={p} compact={!expanded} />),
    ...simJoined.map((id) => (
      <TileFrame key={id} userId={id} compact={!expanded} speaking={simSpeaking.includes(id)} muted={isMutedPeer(id)} camera={call.video && !isMutedPeer(id)} hand={false} simulated />
    )),
  ]

  // screen share stage: mine, else the first remote person sharing
  const myScreen = flags.sharing ? mesh.screenTrack : null
  const myScreenStream = useMemo(() => (myScreen ? new MediaStream([myScreen]) : null), [myScreen])
  const remoteSharer = peers.find((p) => p.status === 'connected' && p.sharing && p.stream)
  const stage = myScreenStream ? (
    <ScreenStage stream={myScreenStream} version={0} label="내 화면을 공유하고 있어요" compact={!expanded} />
  ) : remoteSharer?.stream ? (
    <ScreenStage stream={remoteSharer.stream} version={remoteSharer.version} label={`${getUser(remoteSharer.userId)?.name ?? ''}님의 화면`} compact={!expanded} />
  ) : null

  const audioSinks = peers.map((p) => (p.stream ? <RemoteAudio key={p.userId} stream={p.stream} version={p.version} /> : null))

  const floatLayer = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {floating.map((f) => (
          <motion.div
            key={f.id}
            initial={{ y: 0, opacity: 0, scale: 0.4 }}
            animate={{ y: expanded ? -420 : -220, opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1.1, 1], x: [0, 14, -10, 6] }}
            transition={{ duration: 2.6, ease: 'easeOut' }}
            className="absolute bottom-16 flex flex-col items-center"
            style={{ left: `${f.x}%` }}
          >
            <span className={expanded ? 'text-5xl' : 'text-3xl'}>{f.emoji}</span>
            {expanded && <span className="mt-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">{getUser(f.by)?.name}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )

  const live = connected.length > 0
  const header = (
    <div className={cn('flex items-center gap-2.5', expanded ? 'px-6 py-4' : 'cursor-grab px-3.5 py-2.5 active:cursor-grabbing')}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-xl bg-success/20 text-success">
        <span className="absolute inset-0 rounded-xl bg-success/30 animate-pulse-ring" />
        {call.video ? <Video className="relative h-3.5 w-3.5" /> : <Headphones className="relative h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate font-semibold text-white', expanded ? 'text-[16px]' : 'text-[13px]')}>{call.title}</div>
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          <span className="font-mono tabular-nums text-success">{fmtElapsed(elapsed)}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{joined.length}명</span>
          {live && <span className="rounded bg-success/25 px-1 text-[9.5px] font-bold text-success">실시간 연결</span>}
          {flags.sharing && <span className="rounded bg-danger/80 px-1 text-[9.5px] font-bold text-white">화면 공유 중</span>}
        </div>
      </div>
      <Tooltip content={expanded ? '작게 보기' : '전체 화면'} side="bottom">
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setExpanded((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white">
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </Tooltip>
    </div>
  )

  const errorBanner = mesh.mediaError ? (
    <div className={cn('flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 text-warning', expanded ? 'mx-6 mb-3 px-3 py-2 text-[12.5px]' : 'mx-3 mb-2 px-2.5 py-1.5 text-[11px]')}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">{mesh.mediaError}</span>
    </div>
  ) : null

  if (expanded) {
    const n = tiles.length
    const cols = n <= 1 ? 'grid-cols-1' : n <= 4 ? 'grid-cols-2' : n <= 6 ? 'grid-cols-3' : 'grid-cols-4'
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-[85] flex flex-col overflow-hidden bg-[#06070f] text-white"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/25 blur-[120px] animate-aurora-1" />
          <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-cyan-500/20 blur-[120px] animate-aurora-2" />
        </div>
        <div className="relative">{header}</div>
        {errorBanner && <div className="relative">{errorBanner}</div>}
        <div className="relative flex min-h-0 flex-1 gap-4 px-6 pb-4">
          {stage ? (
            <>
              {stage}
              <div className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto">{tiles}</div>
            </>
          ) : (
            <div className={cn('grid min-h-0 flex-1 auto-rows-fr gap-4', cols)}>{tiles}</div>
          )}
          {floatLayer}
        </div>
        <div className="relative flex justify-center pb-6">{controls}</div>
        <div className="hidden">{audioSinks}</div>
      </motion.div>
    )
  }

  return (
    <>
      <div ref={bounds} className="pointer-events-none fixed inset-4 z-[84]" />
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={bounds}
        dragElastic={0.08}
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="fixed bottom-6 right-6 z-[85] w-[min(340px,calc(100vw-48px))] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d1a]/95 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(139,92,246,0.25)] backdrop-blur-2xl"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="relative">{header}</div>
        {errorBanner && <div className="relative">{errorBanner}</div>}
        <div className="relative px-3">
          {stage ? (
            <div className="h-32">{stage}</div>
          ) : (
            <div className={cn('grid max-h-[46vh] gap-2 overflow-y-auto', tiles.length <= 2 ? 'grid-cols-2' : 'grid-cols-3')}>{tiles}</div>
          )}
          {floatLayer}
        </div>
        <div className="relative flex justify-center px-3 pb-3 pt-3" onPointerDown={(e) => e.stopPropagation()}>{controls}</div>
        <div className="hidden">{audioSinks}</div>
      </motion.div>
    </>
  )
}

function isMutedPeer(id: string) {
  return hashIndex(id, 5) === 0
}

/* ───────────── media elements ───────────── */

function StreamVideo({ stream, version, mirror, contain }: { stream: MediaStream; version: number; mirror?: boolean; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (v.srcObject !== stream) v.srcObject = stream
    void v.play().catch(() => {})
  }, [stream, version])
  // audio is played by <RemoteAudio>; video elements stay muted (no echo of my own mic either)
  return <video ref={ref} autoPlay playsInline muted className={cn('absolute inset-0 h-full w-full', contain ? 'object-contain' : 'object-cover', mirror && '-scale-x-100')} />
}

function RemoteAudio({ stream, version }: { stream: MediaStream; version: number }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const a = ref.current
    if (!a) return
    if (a.srcObject !== stream) a.srcObject = stream
    void a.play().catch(() => {})
  }, [stream, version])
  return <audio ref={ref} autoPlay />
}

function ScreenStage({ stream, version, label, compact }: { stream: MediaStream; version: number; label: string; compact: boolean }) {
  return (
    <div className={cn('relative flex-1 overflow-hidden border border-white/10 bg-black', compact ? 'h-full rounded-2xl' : 'rounded-3xl')}>
      <StreamVideo stream={stream} version={version} contain />
      <span className="absolute left-3 top-2 flex items-center gap-1 rounded-full bg-danger/90 px-2 py-0.5 text-[10px] font-bold">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
      </span>
      {!compact && <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur">{label}</span>}
    </div>
  )
}

/* ───────────── tiles ───────────── */

function RemoteTile({ peer, compact }: { peer: RemotePeer; compact: boolean }) {
  const hasVideo = !!peer.stream && peer.stream.getVideoTracks().length > 0
  const showVideo = peer.status === 'connected' && (peer.camera || peer.sharing) && hasVideo
  return (
    <TileFrame
      userId={peer.userId}
      compact={compact}
      muted={peer.muted}
      hand={peer.hand}
      camera={showVideo}
      video={showVideo && peer.stream ? <StreamVideo stream={peer.stream} version={peer.version} contain={peer.sharing} /> : null}
      speakingStream={peer.status === 'connected' ? peer.stream : null}
      status={peer.status === 'connected' ? undefined : peer.status}
    />
  )
}

function TileFrame({
  userId, me, speaking: simSpeaking, speakingStream, muted, camera, hand, compact, video, status, simulated,
}: {
  userId: string
  me?: boolean
  speaking?: boolean
  /** real audio → speaking ring */
  speakingStream?: MediaStream | null
  muted: boolean
  camera: boolean
  hand: boolean
  compact: boolean
  video?: ReactNode
  status?: 'ringing' | 'connecting'
  simulated?: boolean
}) {
  const u = getUser(userId)
  const grad = gradientFor(u?.color ?? userId)
  const liveSpeaking = useSpeaking(speakingStream ?? null, !muted && !!speakingStream)
  const speaking = (simSpeaking ?? false) || liveSpeaking
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={cn(
        'relative overflow-hidden border transition-[box-shadow,border-color] duration-300',
        compact ? 'aspect-square rounded-2xl' : 'min-h-[140px] rounded-3xl',
        speaking ? 'border-success/70 shadow-[0_0_0_2px_rgb(var(--success)/0.6),0_0_30px_-6px_rgb(var(--success)/0.7)]' : 'border-white/[0.07]',
      )}
    >
      {video ? (
        <div className="absolute inset-0 bg-black">{video}</div>
      ) : (
        <>
          {/* animated gradient backdrop (simulated participants' "video") */}
          <div className={cn('absolute inset-0 bg-gradient-to-br', grad, camera && simulated ? 'opacity-90' : 'opacity-25')} />
          <motion.div
            className="absolute -inset-1/4 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.25),transparent_55%)]"
            animate={{ x: ['-10%', '12%', '-6%'], y: ['-8%', '10%', '-10%'] }}
            transition={{ duration: camera && simulated ? 6 : 12, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
          {camera && simulated && <div className="absolute inset-0 noise" />}
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn('relative', status && 'opacity-70')}>
              {(speaking || status === 'ringing') && (
                <>
                  <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', status === 'ringing' ? 'bg-white/30' : 'bg-success/40')} />
                  {speaking && <span className="absolute -inset-1.5 rounded-full border-2 border-success/80" />}
                </>
              )}
              <Avatar userId={userId} size={compact ? 'md' : camera && simulated ? '2xl' : 'xl'} className="relative" />
            </div>
          </div>
        </>
      )}

      {status && (
        <div className={cn('absolute inset-x-0 top-0 flex items-center justify-center gap-1 bg-gradient-to-b from-black/50 to-transparent text-white/85', compact ? 'pt-1 text-[9px]' : 'pt-2 text-[11.5px]')}>
          {status === 'ringing' ? <PhoneCall className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} /> : <Loader2 className={cn('animate-spin', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />}
          {status === 'ringing' ? '호출 중…' : '연결 중…'}
        </div>
      )}

      {hand && (
        <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: [0, 15, -10, 0] }} transition={{ rotate: { repeat: Infinity, duration: 1.4 } }} className={cn('absolute right-2 top-2', compact ? 'text-base' : 'text-2xl')}>
          ✋
        </motion.span>
      )}

      <div className={cn('absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent', compact ? 'px-1.5 pb-1 pt-4' : 'px-3 pb-2.5 pt-8')}>
        {muted ? (
          <span className={cn('flex items-center justify-center rounded-full bg-danger/90', compact ? 'h-4 w-4' : 'h-5 w-5')}><MicOff className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} /></span>
        ) : (
          <AudioBars active={speaking} compact={compact} />
        )}
        <span className={cn('truncate font-medium', compact ? 'text-[10px]' : 'text-[13px]')}>
          {u?.name}
          {me && ' (나)'}
        </span>
      </div>
    </motion.div>
  )
}

function AudioBars({ active, compact }: { active: boolean; compact: boolean }) {
  return (
    <span className={cn('flex items-end gap-[2px]', compact ? 'h-2.5' : 'h-3.5')}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-success"
          animate={active ? { height: ['30%', '100%', '45%', '85%', '30%'] } : { height: '25%' }}
          transition={active ? { duration: 0.8, repeat: Infinity, delay: i * 0.12 } : { duration: 0.2 }}
        />
      ))}
    </span>
  )
}


function Controls(p: {
  compact: boolean
  muted: boolean
  camera: boolean
  sharing: boolean
  hand: boolean
  busy: null | 'mic' | 'camera' | 'screen'
  reactOpen: boolean
  onMute: () => void
  onCamera: () => void
  onShare: () => void
  onHand: () => void
  onReactToggle: () => void
  onReact: (e: string) => void
  onLeave: () => void
}) {
  const btn = (active: boolean, danger = false) =>
    cn(
      'flex items-center justify-center rounded-2xl transition active:scale-90',
      p.compact ? 'h-9 w-9' : 'h-12 w-12',
      danger ? 'bg-danger/90 text-white hover:bg-danger' : active ? 'bg-white text-zinc-900' : 'bg-white/10 text-white hover:bg-white/20',
    )
  const ic = p.compact ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <div className={cn('relative flex items-center gap-1.5 rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl', p.compact ? 'p-1' : 'gap-2.5 p-2')}>
      <Tooltip content={p.muted ? '음소거 해제' : '음소거'}>
        <button onClick={p.onMute} disabled={p.busy === 'mic'} aria-label={p.muted ? '음소거 해제' : '음소거'} className={btn(p.muted, p.muted)}>{p.busy === 'mic' ? <Loader2 className={cn(ic, 'animate-spin')} /> : p.muted ? <MicOff className={ic} /> : <Mic className={ic} />}</button>
      </Tooltip>
      <Tooltip content={p.camera ? '카메라 끄기' : '카메라 켜기'}>
        <button onClick={p.onCamera} disabled={p.busy === 'camera'} aria-label={p.camera ? '카메라 끄기' : '카메라 켜기'} className={btn(p.camera)}>{p.busy === 'camera' ? <Loader2 className={cn(ic, 'animate-spin')} /> : p.camera ? <Video className={ic} /> : <VideoOff className={ic} />}</button>
      </Tooltip>
      <Tooltip content={p.sharing ? '공유 중지' : '화면 공유'}>
        <button onClick={p.onShare} disabled={p.busy === 'screen'} aria-label={p.sharing ? '공유 중지' : '화면 공유'} className={btn(p.sharing)}>{p.busy === 'screen' ? <Loader2 className={cn(ic, 'animate-spin')} /> : <MonitorUp className={ic} />}</button>
      </Tooltip>
      <div className="relative">
        <Tooltip content="반응">
          <button onClick={p.onReactToggle} className={btn(p.reactOpen)}><Smile className={ic} /></button>
        </Tooltip>
        <AnimatePresence>
          {p.reactOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-0.5 rounded-2xl border border-white/10 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl"
            >
              {REACTIONS.map((e) => (
                <button key={e} onClick={() => p.onReact(e)} className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:scale-125 hover:bg-white/10">
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {!p.compact && (
        <Tooltip content={p.hand ? '손 내리기' : '손 들기'}>
          <button onClick={p.onHand} className={btn(p.hand)}><Hand className={ic} /></button>
        </Tooltip>
      )}
      <span className="mx-0.5 h-6 w-px bg-white/10" />
      <Tooltip content="나가기">
        <button onClick={p.onLeave} className={cn(btn(false, true), p.compact ? 'w-12' : 'w-16')}><PhoneOff className={ic} /></button>
      </Tooltip>
    </div>
  )
}
