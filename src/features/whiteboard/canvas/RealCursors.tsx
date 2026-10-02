import { useEffect, useRef, useState } from 'react'
import { emitSyncEvent, isServerMode, onSyncEvent, useSyncStatus } from '@/lib/sync'
import { getCurrentUserId, getUser } from '@/store/core'
import { hashIndex } from '@/lib/utils'
import type { BoardEditor } from './useBoardEditor'
import { COLLAB_COLORS } from './Collaborators'

/** A real member's cursor on this board (world coordinates). */
export interface RemoteCursor {
  userId: string
  x: number
  y: number
  at: number
  color: string
}

const EVENT = 'wb-cursor'
const STALE_MS = 12_000
const SEND_EVERY_MS = 66 // ~15/s
const HEARTBEAT_MS = 4_000

export const cursorColor = (userId: string) => COLLAB_COLORS[hashIndex(userId, COLLAB_COLORS.length)]

/** Other members currently looking at `boardId` (via ephemeral `wb-cursor` events). */
export function useRemoteCursors(boardId: string): RemoteCursor[] {
  const [map, setMap] = useState<Record<string, RemoteCursor>>({})
  const online = useSyncStatus((s) => s.online)

  useEffect(() => {
    setMap({})
    const off = onSyncEvent(EVENT, (msg) => {
      const from = String(msg.from ?? '')
      if (!from || from === getCurrentUserId() || msg.boardId !== boardId) return
      if (msg.leave) {
        setMap((m) => {
          if (!m[from]) return m
          const { [from]: _gone, ...rest } = m
          return rest
        })
        return
      }
      const x = Number(msg.x)
      const y = Number(msg.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      setMap((m) => ({ ...m, [from]: { userId: from, x, y, at: Date.now(), color: cursorColor(from) } }))
    })
    const sweep = setInterval(() => {
      const now = Date.now()
      setMap((m) => {
        const stale = Object.values(m).filter((c) => now - c.at > STALE_MS)
        if (!stale.length) return m
        const next = { ...m }
        stale.forEach((c) => delete next[c.userId])
        return next
      })
    }, 2_000)
    return () => { off(); clearInterval(sweep) }
  }, [boardId])

  // people who disconnected entirely
  return Object.values(map).filter((c) => online.includes(c.userId))
}

/**
 * Broadcasts my cursor (throttled) while I'm on the board and renders the other members' cursors.
 * Rendered inside the canvas' world layer, so positions are plain world coordinates.
 */
export function RealCursors({ ed, boardId, cursors, visible }: { ed: BoardEditor; boardId: string; cursors: RemoteCursor[]; visible: boolean }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const edRef = useRef(ed)
  edRef.current = ed

  useEffect(() => {
    if (!isServerMode()) return
    const root = anchor.current?.closest<HTMLElement>('.wb-canvas')
    if (!root) return
    let last = 0
    let pos: { x: number; y: number } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const send = () => {
      timer = null
      last = Date.now()
      if (pos) emitSyncEvent(EVENT, { boardId, x: Math.round(pos.x), y: Math.round(pos.y) })
    }
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
      const v = edRef.current.viewRef.current
      pos = { x: (e.clientX - r.left - v.x) / v.zoom, y: (e.clientY - r.top - v.y) / v.zoom }
      const wait = SEND_EVERY_MS - (Date.now() - last)
      if (wait <= 0) send()
      else if (!timer) timer = setTimeout(send, wait)
    }
    // announce presence right away (canvas centre) and keep it alive while idle
    const r0 = root.getBoundingClientRect()
    const v0 = edRef.current.viewRef.current
    pos = { x: (r0.width / 2 - v0.x) / v0.zoom, y: (r0.height / 2 - v0.y) / v0.zoom }
    send()
    const beat = setInterval(() => { if (!document.hidden && Date.now() - last > HEARTBEAT_MS - 200) send() }, HEARTBEAT_MS)
    window.addEventListener('pointermove', onMove)
    const leave = () => emitSyncEvent(EVENT, { boardId, leave: true })
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pagehide', leave)
      clearInterval(beat)
      if (timer) clearTimeout(timer)
      leave()
    }
  }, [boardId])

  const zoom = ed.view.zoom
  return (
    <>
      <span ref={anchor} className="hidden" />
      {visible &&
        cursors.map((c) => (
          <div
            key={c.userId}
            className="pointer-events-none absolute left-0 top-0 z-10"
            style={{ transform: `translate3d(${c.x}px, ${c.y}px, 0) scale(${1 / zoom})`, transformOrigin: '0 0', transition: 'transform 90ms linear' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.35))' }}>
              <path d="M4 2.5 L10.8 21 L13.4 13.4 L21 10.8 Z" fill={c.color} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <span
              className="absolute left-4 top-5 whitespace-nowrap rounded-full rounded-tl-sm px-2 py-0.5 text-[11px] font-semibold text-white shadow-lg"
              style={{ background: c.color, textShadow: '0 1px 1px rgba(0,0,0,.35)' }}
            >
              {getUser(c.userId)?.name ?? '동료'}
            </span>
          </div>
        ))}
    </>
  )
}
