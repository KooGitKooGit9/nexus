/*
 * WebRTC full-mesh for calls with real people.
 *
 * Signaling goes through the sync server (`sendSignal(to, payload)` → `onSyncEvent('signal', …)` on the
 * other side). Payload: `{ kind, callId, … }` with kind
 *   invite   — ring someone (handled by the IncomingCall UI, not here)
 *   decline  — invitee said no
 *   join     — "I'm in call <callId>": everyone already in it creates a connection and offers
 *   offer / answer / ice — SDP + candidates (perfect negotiation, so glare & renegotiation are safe)
 *   state    — mic / camera / screen / hand flags for the tile
 *   react    — floating emoji
 *   leave    — hung up (or cancelled the invite)
 *
 * Every connection carries one audio + one video transceiver from the start; turning the camera or
 * screen share on/off is just `replaceTrack` (no renegotiation needed).
 */
import { sendSignal, useSyncStatus } from '@/lib/sync'
import { ICE_SERVERS, getCameraTrack, getLocalMedia, getMicTrack, getScreenTrack, mediaErrorMessage } from './media'

export interface PeerFlags {
  muted: boolean
  camera: boolean
  sharing: boolean
  hand: boolean
}

export interface RemotePeer extends PeerFlags {
  userId: string
  status: 'ringing' | 'connecting' | 'connected'
  stream: MediaStream | null
  /** bumps when the remote stream's tracks change (re-attach srcObject) */
  version: number
}

interface Conn {
  userId: string
  pc: RTCPeerConnection
  stream: MediaStream
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  pendingIce: RTCIceCandidateInit[]
  connected: boolean
  version: number
  flags: PeerFlags
}

type Signal = Record<string, unknown>

const DEFAULT_FLAGS: PeerFlags = { muted: false, camera: false, sharing: false, hand: false }

export class CallMesh {
  readonly callId: string
  readonly me: string
  private conns = new Map<string, Conn>()
  /** invited but not answered yet → ringing tiles */
  private ringing = new Map<string, ReturnType<typeof setTimeout>>()
  private audio: MediaStreamTrack | null = null
  private video: MediaStreamTrack | null = null
  private flags: PeerFlags = { ...DEFAULT_FLAGS }
  private closed = false
  /** one-time start-up (invites / announce / media) already done — StrictMode mounts twice */
  started = false

  /* local media */
  readonly local = new MediaStream()
  localVersion = 0
  mediaError: string | null = null
  private mic: MediaStreamTrack | null = null
  private camera: MediaStreamTrack | null = null
  private screen: MediaStreamTrack | null = null

  onChange: () => void = () => {}
  onReact: (from: string, emoji: string) => void = () => {}
  /** someone stopped being part of the call: reason 'declined' | 'timeout' | 'left' */
  onGone: (userId: string, reason: 'declined' | 'timeout' | 'left') => void = () => {}

  constructor(callId: string, me: string) {
    this.callId = callId
    this.me = me
  }

  /* ───────────── public API ───────────── */

  peers(): RemotePeer[] {
    const out: RemotePeer[] = []
    for (const c of this.conns.values()) {
      out.push({ userId: c.userId, status: c.connected ? 'connected' : 'connecting', stream: c.stream, version: c.version, ...c.flags })
    }
    for (const id of this.ringing.keys()) if (!this.conns.has(id)) out.push({ userId: id, status: 'ringing', stream: null, version: 0, ...DEFAULT_FLAGS })
    return out
  }

  /** userIds with a live connection */
  connectedIds() {
    return [...this.conns.values()].filter((c) => c.connected).map((c) => c.userId)
  }

  /** anyone (connected, connecting or still ringing) besides me */
  hasOthers() {
    return this.conns.size > 0 || this.ringing.size > 0
  }

  setTracks(audio: MediaStreamTrack | null, video: MediaStreamTrack | null) {
    this.audio = audio
    this.video = video
    for (const c of this.conns.values()) this.attachLocal(c)
  }

  setFlags(patch: Partial<PeerFlags>) {
    this.flags = { ...this.flags, ...patch }
    for (const c of this.conns.values()) this.send(c.userId, { kind: 'state', ...this.flags })
  }

  /** Ring real people. They show as "호출 중" until they join / decline / time out. */
  invite(userIds: string[], info: { title: string; video: boolean; channelId?: string; participantIds: string[] }) {
    for (const id of userIds) {
      if (id === this.me || this.conns.has(id) || this.ringing.has(id)) continue
      this.send(id, { kind: 'invite', title: info.title, video: info.video, channelId: info.channelId ?? null, participantIds: info.participantIds })
      this.ringing.set(id, setTimeout(() => {
        if (!this.ringing.delete(id)) return
        this.send(id, { kind: 'leave' }) // stop their ringing
        this.onGone(id, 'timeout')
        this.onChange()
      }, 35_000))
    }
    this.onChange()
  }

  /** Tell everyone online that I'm in this call — members already in it will connect to me. */
  announce() {
    for (const id of useSyncStatus.getState().online) if (id !== this.me) this.send(id, { kind: 'join' })
  }

  sendReaction(emoji: string) {
    for (const c of this.conns.values()) this.send(c.userId, { kind: 'react', emoji })
  }

  /** Hang up: tell peers + cancel pending invites, close everything. */
  leave() {
    if (this.closed) return
    for (const id of new Set([...this.conns.keys(), ...this.ringing.keys()])) this.send(id, { kind: 'leave' })
    this.close()
  }

  get isClosed() {
    return this.closed
  }

  get localFlags(): PeerFlags {
    return { ...this.flags }
  }

  /** the screen-share track (for the local preview), if sharing */
  get screenTrack() {
    return this.screen
  }

  /* ───────────── local media ───────────── */

  async startMedia(video: boolean) {
    const { stream, error } = await getLocalMedia(video)
    if (this.closed) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    this.mic = stream.getAudioTracks()[0] ?? null
    this.camera = stream.getVideoTracks()[0] ?? null
    this.mediaError = error
    for (const t of stream.getTracks()) this.local.addTrack(t)
    this.localVersion++
    this.flags = { ...this.flags, muted: !this.mic || this.flags.muted, camera: !!this.camera }
    if (this.mic) this.mic.enabled = !this.flags.muted
    this.pushTracks()
    this.setFlags({})
    this.onChange()
  }

  /** returns an error message (Korean) if the mic can't be turned on */
  async setMuted(muted: boolean): Promise<string | null> {
    if (!muted && !this.mic) {
      try {
        this.mic = await getMicTrack()
        if (this.closed) { this.mic.stop(); return null }
        this.local.addTrack(this.mic)
        this.localVersion++
        this.pushTracks()
      } catch (err) {
        return mediaErrorMessage(err, 'mic')
      }
    }
    if (this.mic) this.mic.enabled = !muted
    this.setFlags({ muted })
    this.onChange()
    return null
  }

  async setCamera(on: boolean): Promise<string | null> {
    if (on && !this.camera) {
      try {
        const t = await getCameraTrack()
        if (this.closed) { t.stop(); return null }
        this.camera = t
        this.local.addTrack(t)
      } catch (err) {
        return mediaErrorMessage(err, 'camera')
      }
    } else if (!on && this.camera) {
      // stop the device (camera light off), not just mute it
      this.camera.stop()
      this.local.removeTrack(this.camera)
      this.camera = null
    }
    this.localVersion++
    this.pushTracks()
    this.setFlags({ camera: on && !!this.camera })
    this.onChange()
    return null
  }

  async setSharing(on: boolean): Promise<string | null> {
    if (on && !this.screen) {
      try {
        const t = await getScreenTrack()
        if (this.closed) { t.stop(); return null }
        this.screen = t
        // the browser's own "공유 중지" button
        t.onended = () => { if (this.screen === t) void this.setSharing(false) }
      } catch (err) {
        return mediaErrorMessage(err, 'screen')
      }
    } else if (!on && this.screen) {
      this.screen.onended = null
      this.screen.stop()
      this.screen = null
    }
    this.pushTracks()
    this.setFlags({ sharing: !!this.screen })
    this.onChange()
    return null
  }

  setHand(hand: boolean) {
    this.setFlags({ hand })
    this.onChange()
  }

  /** what peers receive: mic + (screen share, else camera) */
  private pushTracks() {
    this.setTracks(this.mic, this.screen ?? this.camera)
  }

  private stopLocal() {
    for (const t of [this.mic, this.camera, this.screen]) t?.stop()
    this.mic = this.camera = this.screen = null
  }

  close() {
    this.closed = true
    this.stopLocal()
    for (const t of this.ringing.values()) clearTimeout(t)
    this.ringing.clear()
    for (const c of this.conns.values()) {
      try { c.pc.close() } catch { /* ignore */ }
    }
    this.conns.clear()
  }

  /** A real user went offline (presence) — drop their tile. */
  dropOffline(online: string[]) {
    for (const id of [...this.conns.keys()]) if (!online.includes(id)) this.remove(id, 'left')
    for (const id of [...this.ringing.keys()]) if (!online.includes(id)) {
      clearTimeout(this.ringing.get(id))
      this.ringing.delete(id)
      this.onGone(id, 'timeout')
    }
    this.onChange()
  }

  /** Feed every incoming signal for this call here. */
  async handle(from: string, msg: Signal) {
    if (this.closed || from === this.me || msg.callId !== this.callId) return
    const kind = msg.kind
    try {
      if (kind === 'join') {
        this.clearRinging(from)
        this.remove(from) // a rejoin (refresh) gets a fresh connection
        this.create(from, true)
        this.onChange()
      } else if (kind === 'offer' || kind === 'answer') {
        this.clearRinging(from)
        let c = this.conns.get(from)
        if (!c) {
          if (kind === 'answer') return
          c = this.create(from, false)
          this.onChange()
        }
        await this.onDescription(c, msg.sdp as RTCSessionDescriptionInit)
      } else if (kind === 'ice') {
        const c = this.conns.get(from)
        const cand = msg.candidate as RTCIceCandidateInit | undefined
        if (!c || !cand) return
        if (!c.pc.remoteDescription) c.pendingIce.push(cand)
        else await c.pc.addIceCandidate(cand).catch((e) => { if (!c.ignoreOffer) throw e })
      } else if (kind === 'state') {
        const c = this.conns.get(from)
        if (!c) return
        c.flags = {
          muted: !!msg.muted,
          camera: !!msg.camera,
          sharing: !!msg.sharing,
          hand: !!msg.hand,
        }
        this.onChange()
      } else if (kind === 'react') {
        if (typeof msg.emoji === 'string' && this.conns.has(from)) this.onReact(from, msg.emoji)
      } else if (kind === 'decline') {
        if (this.clearRinging(from)) {
          this.onGone(from, 'declined')
          this.onChange()
        }
      } else if (kind === 'leave') {
        const was = this.conns.has(from) || this.clearRinging(from)
        this.remove(from)
        if (was) {
          this.onGone(from, 'left')
          this.onChange()
        }
      }
    } catch (err) {
      console.warn('[call] signal error', kind, err)
    }
  }

  /* ───────────── internals ───────────── */

  private send(to: string, payload: Signal) {
    sendSignal(to, { ...payload, callId: this.callId })
  }

  private clearRinging(id: string) {
    const t = this.ringing.get(id)
    if (!t) return false
    clearTimeout(t)
    this.ringing.delete(id)
    return true
  }

  private remove(id: string, reason?: 'left') {
    const c = this.conns.get(id)
    if (!c) return
    this.conns.delete(id)
    try { c.pc.close() } catch { /* ignore */ }
    if (reason) this.onGone(id, reason)
  }

  private create(userId: string, initiator: boolean): Conn {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const c: Conn = {
      userId,
      pc,
      stream: new MediaStream(),
      polite: this.me > userId,
      makingOffer: false,
      ignoreOffer: false,
      pendingIce: [],
      connected: false,
      version: 0,
      flags: { ...DEFAULT_FLAGS },
    }
    this.conns.set(userId, c)

    pc.ontrack = (e) => {
      if (!c.stream.getTracks().includes(e.track)) {
        // one track per kind: a renegotiated track replaces the old one
        for (const old of c.stream.getTracks()) if (old.kind === e.track.kind && old !== e.track) c.stream.removeTrack(old)
        c.stream.addTrack(e.track)
      }
      c.version++
      e.track.onunmute = () => {
        c.version++
        this.onChange()
      }
      this.onChange()
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(userId, { kind: 'ice', candidate: e.candidate.toJSON() })
    }
    pc.onnegotiationneeded = async () => {
      try {
        c.makingOffer = true
        await pc.setLocalDescription()
        if (pc.localDescription) this.send(userId, { kind: 'offer', sdp: pc.localDescription.toJSON() })
      } catch (err) {
        console.warn('[call] negotiation failed', err)
      } finally {
        c.makingOffer = false
      }
    }
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === 'connected' && !c.connected) {
        c.connected = true
        this.send(userId, { kind: 'state', ...this.flags })
        this.onChange()
      } else if (st === 'failed') {
        try { pc.restartIce() } catch { /* ignore */ }
      } else if (st === 'closed' && this.conns.get(userId) === c) {
        this.conns.delete(userId)
        this.onChange()
      }
    }

    // initiator side: one audio + one video transceiver; the answerer gets them from the offer
    if (initiator) {
      pc.addTransceiver('audio', { direction: 'sendrecv' })
      pc.addTransceiver('video', { direction: 'sendrecv' })
      this.attachLocal(c)
    }
    return c
  }

  private attachLocal(c: Conn) {
    for (const t of c.pc.getTransceivers()) {
      if (t.currentDirection === 'stopped') continue
      const kind = t.receiver.track?.kind
      const track = kind === 'audio' ? this.audio : kind === 'video' ? this.video : null
      if (t.sender.track !== track) void t.sender.replaceTrack(track).catch(() => {})
      if (t.direction === 'recvonly' || t.direction === 'inactive') {
        try { t.direction = 'sendrecv' } catch { /* ignore */ }
      }
    }
  }

  private async onDescription(c: Conn, desc: RTCSessionDescriptionInit) {
    const pc = c.pc
    const collision = desc.type === 'offer' && (c.makingOffer || pc.signalingState !== 'stable')
    c.ignoreOffer = !c.polite && collision
    if (c.ignoreOffer) return
    await pc.setRemoteDescription(desc)
    for (const cand of c.pendingIce.splice(0)) await pc.addIceCandidate(cand).catch(() => {})
    if (desc.type === 'offer') {
      this.attachLocal(c)
      await pc.setLocalDescription()
      if (pc.localDescription) this.send(c.userId, { kind: 'answer', sdp: pc.localDescription.toJSON() })
    }
  }
}

/* ───────────── registry ─────────────
 * One mesh per call *instance* (keyed by the call's `startedAt`, so re-joining the same huddle — e.g. an
 * audio ↔ video switch — gets a fresh mesh) and it survives StrictMode's double mount.
 */

const registry = new Map<string, { mesh: CallMesh; refs: number; timer?: ReturnType<typeof setTimeout> }>()

export function meshFor(instance: string, callId: string, me: string): CallMesh {
  let e = registry.get(instance)
  if (!e || e.mesh.isClosed) {
    e = { mesh: new CallMesh(callId, me), refs: 0 }
    registry.set(instance, e)
  }
  return e.mesh
}

export function retainMesh(instance: string) {
  const e = registry.get(instance)
  if (!e) return
  e.refs++
  clearTimeout(e.timer)
}

export function releaseMesh(instance: string) {
  const e = registry.get(instance)
  if (!e) return
  e.refs--
  clearTimeout(e.timer)
  if (e.refs <= 0) e.timer = setTimeout(() => { if (e.refs <= 0) disposeMesh(instance) }, 150)
}

/** Hang up for real: notify peers, stop camera/mic. */
export function disposeMesh(instance: string) {
  const e = registry.get(instance)
  if (!e) return
  registry.delete(instance)
  clearTimeout(e.timer)
  e.mesh.leave()
}

/** Route an incoming signal to the call it belongs to (if we're in it). */
export function routeSignal(from: string, msg: Record<string, unknown>) {
  const id = msg.callId
  if (typeof id !== 'string') return
  for (const e of registry.values()) if (e.mesh.callId === id && !e.mesh.isClosed) void e.mesh.handle(from, msg)
}
