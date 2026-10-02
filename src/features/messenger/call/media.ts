/* Local media (mic / camera / screen) + audio level metering for calls. */
import { useEffect, useState } from 'react'

export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

/** Human (Korean) explanation of a getUserMedia / getDisplayMedia failure. */
export function mediaErrorMessage(err: unknown, what: 'mic' | 'camera' | 'both' | 'screen' = 'both'): string {
  const label = what === 'mic' ? '마이크' : what === 'camera' ? '카메라' : what === 'screen' ? '화면 공유' : '마이크/카메라'
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return `이 환경에서는 ${label}를 사용할 수 없어요. HTTPS 또는 localhost 주소로 접속해주세요.`
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return what === 'screen' ? '화면 공유가 취소되었거나 권한이 없어요.' : `${label} 권한이 거부되었어요. 주소창 왼쪽의 사이트 설정에서 ${label} 접근을 허용해주세요.`
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `사용할 수 있는 ${label} 장치를 찾지 못했어요.`
    case 'NotReadableError':
    case 'AbortError':
      return `다른 앱이 ${label}를 사용 중이라 연결하지 못했어요.`
    default:
      return `${label}를 시작하지 못했어요.`
  }
}

export interface LocalMedia {
  stream: MediaStream
  /** non-fatal problem (e.g. camera denied but mic works) */
  error: string | null
}

/** Acquire mic (+ camera). Falls back to audio-only, then to nothing — never throws. */
export async function getLocalMedia(video: boolean): Promise<LocalMedia> {
  const stream = new MediaStream()
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { stream, error: mediaErrorMessage(null, video ? 'both' : 'mic') }
  }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false })
    s.getTracks().forEach((t) => stream.addTrack(t))
    return { stream, error: null }
  } catch (err) {
    if (!video) return { stream, error: mediaErrorMessage(err, 'mic') }
    // camera failed — keep the call going with audio only
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      s.getTracks().forEach((t) => stream.addTrack(t))
      return { stream, error: mediaErrorMessage(err, 'camera') }
    } catch (err2) {
      return { stream, error: mediaErrorMessage(err2, 'both') }
    }
  }
}

export async function getCameraTrack(): Promise<MediaStreamTrack> {
  const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
  return s.getVideoTracks()[0]
}

export async function getMicTrack(): Promise<MediaStreamTrack> {
  const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  return s.getAudioTracks()[0]
}

export async function getScreenTrack(): Promise<MediaStreamTrack> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new DOMException('unsupported', 'NotFoundError')
  const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
  return s.getVideoTracks()[0]
}

/* ───────────── audio level ───────────── */

let ctx: AudioContext | null = null
function audioCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

/**
 * true while the stream's audio is above a speaking threshold. Polls, so tracks added to the stream later
 * (remote tracks arriving) are picked up.
 */
export function useSpeaking(stream: MediaStream | null | undefined, enabled = true) {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    if (!stream || !enabled) {
      setSpeaking(false)
      return
    }
    let source: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null
    let trackId = ''
    let buf: Uint8Array<ArrayBuffer> | null = null
    let hold = 0
    const t = setInterval(() => {
      const track = stream.getAudioTracks().find((x) => x.readyState === 'live')
      if (!track) {
        setSpeaking(false)
        return
      }
      if (track.id !== trackId) {
        const c = audioCtx()
        if (!c) return
        try {
          source?.disconnect()
          source = c.createMediaStreamSource(new MediaStream([track]))
          analyser = c.createAnalyser()
          analyser.fftSize = 512
          source.connect(analyser)
          buf = new Uint8Array(new ArrayBuffer(analyser.fftSize))
          trackId = track.id
        } catch {
          return
        }
      }
      if (!analyser || !buf) return
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / buf.length)
      const on = track.enabled && rms > 0.035
      if (on) hold = 4
      else hold = Math.max(0, hold - 1)
      setSpeaking(hold > 0)
    }, 120)
    return () => {
      clearInterval(t)
      try { source?.disconnect() } catch { /* ignore */ }
    }
  }, [stream, enabled])
  return speaking
}
