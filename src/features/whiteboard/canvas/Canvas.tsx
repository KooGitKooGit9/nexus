import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { uid, clamp } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import type { WbElement } from '../types'
import type { BoardEditor } from './useBoardEditor'
import { ElementView } from './ElementView'
import { SelectionOverlay, type Handle } from './SelectionOverlay'
import { boundsOf, contains, intersects, isLinear, normalizePath, normRect, rectOf, simplify, type Pt, type Rect } from './geometry'

export interface CanvasApi {
  zoomBy: (f: number) => void
  zoomTo: (z: number) => void
  fit: (animate?: boolean) => void
  center: () => { x: number; y: number }
  focusRect: (r: Rect) => void
}

type DragState =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'move'; sx: number; sy: number; orig: Map<string, { x: number; y: number }>; started: boolean }
  | { kind: 'resize'; handle: Handle; orig: WbElement; sx: number; sy: number; started: boolean }
  | { kind: 'marquee'; sx: number; sy: number; base: string[] }
  | { kind: 'create'; id: string; sx: number; sy: number; type: WbElement['type'] }
  | { kind: 'pen'; id: string; ox: number; oy: number; pts: Pt[] }
  | { kind: 'erase'; checkpointed: boolean }

const EDITABLE = new Set<WbElement['type']>(['sticky', 'rect', 'ellipse', 'text', 'frame'])
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4

const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="rgba(244,114,182,.25)" stroke="#f472b6" stroke-width="2"/></svg>',
)}") 12 12, crosshair`

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** Tool shortcuts by physical key (e.code) so they also work while a Korean IME is active (e.key would be 'ㅍ' etc.). */
const TOOL_KEYS: Record<string, BoardEditor['tool']> = {
  KeyV: 'select', KeyH: 'hand', KeyN: 'sticky', KeyS: 'sticky', KeyR: 'rect', KeyO: 'ellipse', KeyA: 'arrow', KeyL: 'line', KeyT: 'text', KeyP: 'pen', KeyE: 'eraser',
}

const snapAngle = (dx: number, dy: number, step = Math.PI / 12) => {
  const len = Math.hypot(dx, dy)
  const a = Math.round(Math.atan2(dy, dx) / step) * step
  return [Math.cos(a) * len, Math.sin(a) * len]
}

export function Canvas({ ed, apiRef, worldChildren, onImageTool }: { ed: BoardEditor; apiRef: Ref<CanvasApi>; worldChildren?: ReactNode; onImageTool: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [space, setSpace] = useState(false)
  const [grabbing, setGrabbing] = useState(false)
  const { view, tool, elements, editingId } = ed
  const edRef = useRef(ed)
  edRef.current = ed

  const toWorld = useCallback((cx: number, cy: number): Pt => {
    const r = rootRef.current!.getBoundingClientRect()
    const v = ed.viewRef.current
    return [(cx - r.left - v.x) / v.zoom, (cy - r.top - v.y) / v.zoom]
  }, [ed.viewRef])

  /* ───────────── viewport API ───────────── */
  const zoomAt = useCallback((z: number, sx: number, sy: number) => {
    ed.setView((v) => {
      const zoom = clamp(z, MIN_ZOOM, MAX_ZOOM)
      return { zoom, x: sx - ((sx - v.x) / v.zoom) * zoom, y: sy - ((sy - v.y) / v.zoom) * zoom }
    })
  }, [ed.setView])

  const focusRect = useCallback((b: Rect) => {
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const zoom = clamp(Math.min((r.width - 160) / Math.max(b.w, 1), (r.height - 220) / Math.max(b.h, 1)), 0.15, 1.4)
    ed.setView({ zoom, x: r.width / 2 - (b.x + b.w / 2) * zoom, y: r.height / 2 - (b.y + b.h / 2) * zoom + 10 })
  }, [ed.setView])

  const fit = useCallback(() => {
    const b = boundsOf(ed.elsRef.current)
    const el = rootRef.current
    if (!el) return
    if (!b) {
      const r = el.getBoundingClientRect()
      ed.setView({ zoom: 1, x: r.width / 2, y: r.height / 2 })
      return
    }
    focusRect(b)
  }, [ed.elsRef, ed.setView, focusRect])

  useImperativeHandle(apiRef, () => ({
    zoomBy: (f) => {
      const r = rootRef.current!.getBoundingClientRect()
      zoomAt(ed.viewRef.current.zoom * f, r.width / 2, r.height / 2)
    },
    zoomTo: (z) => {
      const r = rootRef.current!.getBoundingClientRect()
      zoomAt(z, r.width / 2, r.height / 2)
    },
    fit,
    focusRect,
    center: () => {
      const r = rootRef.current!.getBoundingClientRect()
      const v = ed.viewRef.current
      return { x: (r.width / 2 - v.x) / v.zoom, y: (r.height / 2 - v.y) / v.zoom }
    },
  }), [zoomAt, fit, focusRect, ed.viewRef])

  // initial fit if the board has no stored viewport
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    const v = ed.viewRef.current
    if (v.x === 0 && v.y === 0 && v.zoom === 1) fit()
  }, [fit, ed.viewRef])

  // wheel: ctrl/cmd → zoom, else pan
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (isTyping(e.target) && !(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        const v = ed.viewRef.current
        const factor = Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 30 ? 0.012 : 0.0025))
        zoomAt(v.zoom * factor, e.clientX - r.left, e.clientY - r.top)
      } else {
        ed.setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ed.viewRef, ed.setView, zoomAt])

  /* ───────────── element creation helpers ───────────── */
  const addSticky = useCallback((x: number, y: number) => {
    const ed = edRef.current
    const s: WbElement = {
      id: uid('el'), type: 'sticky', x: x - 100, y: y - 100, w: 200, h: 200, fill: ed.style.stickyColor, text: '',
      authorId: getCurrentUserId(), rotation: Math.round((Math.random() * 3 - 1.5) * 10) / 10, bornAt: Date.now(),
    }
    ed.add([s])
    ed.setEditingId(s.id)
    ed.setTool('select')
  }, [])

  const commitText = useCallback((id: string, text: string) => {
    const ed = edRef.current
    ed.setEditingId(null)
    const el = ed.elsRef.current.find((e) => e.id === id)
    if (!el) return
    if (el.type === 'text' && !text.trim()) {
      ed.commit(ed.elsRef.current.filter((e) => e.id !== id), false)
      ed.dropRedundantUndo()
      ed.setSelected([])
      return
    }
    if ((el.text ?? '') !== text) ed.update([id], () => ({ text }))
  }, [])

  const onMeasure = useCallback((id: string, h: number) => {
    edRef.current.update([id], () => ({ h }), false)
  }, [])

  /* ───────────── pointer handling ───────────── */
  const moveImpl = useRef<(e: PointerEvent) => void>(() => {})
  const upImpl = useRef<() => void>(() => {})
  const onPointerMove = useCallback((e: PointerEvent) => moveImpl.current(e), [])
  const onPointerUp = useCallback(() => upImpl.current(), [])

  moveImpl.current = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const [wx, wy] = toWorld(e.clientX, e.clientY)
    switch (d.kind) {
      case 'pan':
        ed.setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }))
        break
      case 'move': {
        let dx = wx - d.sx
        let dy = wy - d.sy
        if (!d.started) {
          if (Math.hypot(dx, dy) * ed.viewRef.current.zoom < 3) return
          d.started = true
          ed.checkpoint()
        }
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
        ed.commit(ed.elsRef.current.map((el) => {
          const o = d.orig.get(el.id)
          return o ? { ...el, x: Math.round(o.x + dx), y: Math.round(o.y + dy) } : el
        }), false)
        break
      }
      case 'resize': {
        const o = d.orig
        if (!d.started) { d.started = true; ed.checkpoint() }
        if (d.handle === 'p1' || d.handle === 'p2') {
          const ax = d.handle === 'p1' ? o.x + o.w : o.x
          const ay = d.handle === 'p1' ? o.y + o.h : o.y
          let [dx, dy] = [wx - ax, wy - ay]
          if (e.shiftKey) [dx, dy] = snapAngle(dx, dy)
          const patch = d.handle === 'p1' ? { x: ax + dx, y: ay + dy, w: -dx, h: -dy } : { w: dx, h: dy }
          ed.update([o.id], () => patch, false)
          break
        }
        const h = d.handle
        let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h
        const dx = wx - d.sx, dy = wy - d.sy
        if (h.includes('w')) x1 += dx
        if (h.includes('e')) x2 += dx
        if (h.includes('n')) y1 += dy
        if (h.includes('s')) y2 += dy
        const MIN = 24
        if (x2 - x1 < MIN) { if (h.includes('w')) x1 = x2 - MIN; else x2 = x1 + MIN }
        if (y2 - y1 < MIN) { if (h.includes('n')) y1 = y2 - MIN; else y2 = y1 + MIN }
        const lockAspect = (e.shiftKey || o.type === 'image') && h.length === 2
        if (lockAspect) {
          const ratio = o.w / o.h
          const nw = x2 - x1
          const nh = y2 - y1
          if (nw / nh > ratio) {
            const adj = nh * ratio
            if (h.includes('w')) x1 = x2 - adj; else x2 = x1 + adj
          } else {
            const adj = nw / ratio
            if (h.includes('n')) y1 = y2 - adj; else y2 = y1 + adj
          }
        }
        const patch: Partial<WbElement> = { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) }
        if (o.type === 'text') { delete patch.y; delete patch.h }
        if (o.type === 'path' && o.points) {
          const sx = (x2 - x1) / o.w
          const sy = (y2 - y1) / o.h
          patch.points = o.points.map(([px, py]) => [px * sx, py * sy] as Pt)
        }
        ed.update([o.id], () => patch, false)
        break
      }
      case 'marquee': {
        const r = normRect(d.sx, d.sy, wx, wy)
        setMarquee(r)
        const hits = ed.elsRef.current
          .filter((el) => (el.type === 'frame' ? contains(r, rectOf(el)) : intersects(r, rectOf(el))))
          .map((el) => el.id)
        ed.setSelected(Array.from(new Set([...d.base, ...hits])))
        break
      }
      case 'create': {
        let dx = wx - d.sx
        let dy = wy - d.sy
        if (d.type === 'line' || d.type === 'arrow') {
          if (e.shiftKey) [dx, dy] = snapAngle(dx, dy)
          ed.update([d.id], () => ({ w: dx, h: dy }), false)
        } else {
          if (e.shiftKey) { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m }
          const r = normRect(d.sx, d.sy, d.sx + dx, d.sy + dy)
          ed.update([d.id], () => r, false)
        }
        break
      }
      case 'pen': {
        const last = d.pts[d.pts.length - 1]
        const p: Pt = [wx - d.ox, wy - d.oy]
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) * ed.viewRef.current.zoom < 2) return
        d.pts.push(p)
        ed.update([d.id], () => ({ points: [...d.pts] }), false)
        break
      }
      case 'erase': {
        const hit = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-el-id]')
        const id = hit?.dataset.elId
        if (id) {
          if (!d.checkpointed) { d.checkpointed = true; ed.checkpoint() }
          ed.commit(ed.elsRef.current.filter((x) => x.id !== id), false)
        }
        break
      }
    }
  }

  upImpl.current = () => {
    const d = drag.current
    drag.current = null
    setGrabbing(false)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    if (!d) return
    if (d.kind === 'marquee') setMarquee(null)
    if (d.kind === 'create') {
      const el = ed.elsRef.current.find((x) => x.id === d.id)
      if (el) {
        const tiny = isLinear(el) ? Math.hypot(el.w, el.h) < 6 : el.w < 6 && el.h < 6
        if (tiny) {
          const def: Record<string, Partial<WbElement>> = {
            rect: { x: el.x - 90, y: el.y - 60, w: 180, h: 120 },
            ellipse: { x: el.x - 80, y: el.y - 80, w: 160, h: 160 },
            line: { w: 200, h: 0 },
            arrow: { w: 200, h: 0 },
          }
          ed.update([el.id], () => def[el.type] ?? {}, false)
        }
        ed.setSelected([el.id])
      }
      ed.setTool('select')
    }
    if (d.kind === 'pen') {
      const el = ed.elsRef.current.find((x) => x.id === d.id)
      if (el) {
        const pts = d.pts.length === 1 ? [d.pts[0], [d.pts[0][0] + 0.5, d.pts[0][1] + 0.5] as Pt] : simplify(d.pts, 0.9 / ed.viewRef.current.zoom)
        const norm = normalizePath({ ...el, points: pts })
        ed.update([el.id], () => norm, false)
      }
    }
  }

  const startDrag = (d: DragState) => {
    drag.current = d
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }
  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }, [onPointerMove, onPointerUp])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return
    const target = e.target as HTMLElement
    if (isTyping(target)) return
    // Only suppress the native mousedown where needed: sticky/text create an editor that must keep focus,
    // middle-click would start autoscroll. Elsewhere we let it through so open popovers/menus
    // (which close on document mousedown) still close when the canvas is clicked.
    if (e.button === 1 || ((tool === 'sticky' || tool === 'text') && !space)) e.preventDefault()
    // blur any active text editor
    if (document.activeElement instanceof HTMLElement && isTyping(document.activeElement)) document.activeElement.blur()

    const v = ed.viewRef.current
    if (e.button === 1 || tool === 'hand' || space) {
      setGrabbing(true)
      startDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y })
      return
    }
    const [wx, wy] = toWorld(e.clientX, e.clientY)
    const handle = target.closest<HTMLElement>('[data-handle]')?.dataset.handle as Handle | undefined
    const elId = target.closest<HTMLElement>('[data-el-id]')?.dataset.elId

    if (handle && ed.selRef.current.length === 1) {
      const orig = ed.elsRef.current.find((x) => x.id === ed.selRef.current[0])
      if (orig) startDrag({ kind: 'resize', handle, orig, sx: wx, sy: wy, started: false })
      return
    }

    switch (tool) {
      case 'select': {
        if (elId) {
          let sel = ed.selRef.current
          if (e.shiftKey) {
            sel = sel.includes(elId) ? sel.filter((x) => x !== elId) : [...sel, elId]
            ed.setSelected(sel)
            if (!sel.includes(elId)) return
          } else if (!sel.includes(elId)) {
            sel = [elId]
            ed.setSelected(sel)
          }
          if (ed.editingId && ed.editingId !== elId) ed.setEditingId(null)
          // moving a frame drags its contents along
          const moveIds = new Set(sel)
          const els = ed.elsRef.current
          els.filter((x) => sel.includes(x.id) && x.type === 'frame').forEach((f) => {
            const fr = rectOf(f)
            els.forEach((x) => { if (x.id !== f.id && contains(fr, rectOf(x))) moveIds.add(x.id) })
          })
          const orig = new Map(els.filter((x) => moveIds.has(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]))
          startDrag({ kind: 'move', sx: wx, sy: wy, orig, started: false })
        } else {
          ed.setEditingId(null)
          const base = e.shiftKey ? ed.selRef.current : []
          if (!e.shiftKey) ed.setSelected([])
          startDrag({ kind: 'marquee', sx: wx, sy: wy, base })
        }
        return
      }
      case 'sticky':
        addSticky(wx, wy)
        return
      case 'text': {
        const t: WbElement = { id: uid('el'), type: 'text', x: wx, y: wy - 14, w: 300, h: 30, text: '', fontSize: 22, stroke: ed.style.stroke, bornAt: Date.now() }
        ed.add([t])
        ed.setEditingId(t.id)
        ed.setTool('select')
        return
      }
      case 'rect':
      case 'ellipse':
      case 'line':
      case 'arrow': {
        const isShape = tool === 'rect' || tool === 'ellipse'
        const el: WbElement = {
          id: uid('el'), type: tool, x: wx, y: wy, w: 0, h: 0, stroke: ed.style.stroke, strokeWidth: isShape ? 2 : Math.max(2, ed.style.strokeWidth),
          fill: isShape ? (ed.style.stroke === 'ink' ? '#8b5cf6' : ed.style.stroke) : undefined, text: isShape ? '' : undefined, bornAt: Date.now(),
        }
        ed.checkpoint() // so undo removes exactly this shape
        ed.add([el], false, false)
        startDrag({ kind: 'create', id: el.id, sx: wx, sy: wy, type: tool })
        return
      }
      case 'pen': {
        const el: WbElement = { id: uid('el'), type: 'path', x: wx, y: wy, w: 1, h: 1, points: [[0, 0]], stroke: ed.style.stroke, strokeWidth: ed.style.strokeWidth }
        ed.checkpoint()
        ed.add([el], false, false)
        ed.setSelected([])
        startDrag({ kind: 'pen', id: el.id, ox: wx, oy: wy, pts: [[0, 0]] })
        return
      }
      case 'eraser': {
        const d: DragState = { kind: 'erase', checkpointed: false }
        if (elId) {
          d.checkpointed = true
          ed.remove([elId])
        }
        startDrag(d)
        return
      }
      case 'image':
        onImageTool()
        return
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'select' || space) return
    const target = e.target as HTMLElement
    if (isTyping(target)) return
    const elId = target.closest<HTMLElement>('[data-el-id]')?.dataset.elId
    if (elId) {
      const el = ed.elsRef.current.find((x) => x.id === elId)
      if (el && EDITABLE.has(el.type)) {
        ed.setSelected([elId])
        ed.setEditingId(elId)
      }
      return
    }
    const [wx, wy] = toWorld(e.clientX, e.clientY)
    addSticky(wx, wy)
  }

  /* ───────────── keyboard ───────────── */
  useEffect(() => {
    /** Only handle keys aimed at the editor: not while typing / composing, not inside modals or portalled popovers. */
    const ours = (e: KeyboardEvent) => {
      if (e.isComposing || isTyping(e.target)) return false
      if (document.querySelector('[role="dialog"]')) return false
      const t = e.target as Node | null
      const scope = rootRef.current?.parentElement
      return !t || t === document.body || t === document.documentElement || !!scope?.contains(t)
    }
    const onKey = (e: KeyboardEvent) => {
      if (!ours(e)) return
      const ed = edRef.current
      const mod = e.metaKey || e.ctrlKey
      const code = e.code
      const sel = ed.selRef.current
      const center = () => { const r = rootRef.current!.getBoundingClientRect(); return [r.width / 2, r.height / 2] as const }
      if (code === 'Space') { e.preventDefault(); if (!e.repeat) setSpace(true); return }
      if (mod) {
        if (code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) ed.redo(); else ed.undo(); return }
        if (code === 'KeyY') { e.preventDefault(); ed.redo(); return }
        if (code === 'KeyD') { e.preventDefault(); ed.duplicate(sel); return }
        if (code === 'KeyC') { if (sel.length) { e.preventDefault(); ed.copy() } return }
        if (code === 'KeyX') { if (sel.length) { e.preventDefault(); ed.copy(); ed.remove(sel) } return }
        if (code === 'KeyV') { e.preventDefault(); ed.paste(); return }
        if (code === 'KeyA') { e.preventDefault(); ed.setSelected(ed.elsRef.current.map((x) => x.id)); return }
        if (code === 'BracketRight') { e.preventDefault(); ed.reorder(e.shiftKey ? 'front' : 'forward'); return }
        if (code === 'BracketLeft') { e.preventDefault(); ed.reorder(e.shiftKey ? 'back' : 'backward'); return }
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') { if (sel.length) { e.preventDefault(); ed.remove(sel) } return }
      if (e.key === 'Escape') {
        if (ed.tool !== 'select') ed.setTool('select')
        else ed.setSelected([])
        return
      }
      if (e.key === 'Enter' && sel.length === 1) {
        const el = ed.elsRef.current.find((x) => x.id === sel[0])
        if (el && EDITABLE.has(el.type)) { e.preventDefault(); ed.setEditingId(el.id) }
        return
      }
      if (e.key.startsWith('Arrow') && sel.length) {
        e.preventDefault()
        const s = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0
        const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0
        ed.update(sel, (el) => ({ x: el.x + dx, y: el.y + dy }))
        return
      }
      if (e.shiftKey && code === 'Digit1') { e.preventDefault(); fit(); return }
      if (e.shiftKey && code === 'Digit0') { e.preventDefault(); const [cx, cy] = center(); zoomAt(1, cx, cy); return }
      if (code === 'Equal' || code === 'NumpadAdd') { e.preventDefault(); const [cx, cy] = center(); zoomAt(ed.viewRef.current.zoom * 1.2, cx, cy); return }
      if (code === 'Minus' || code === 'NumpadSubtract') { e.preventDefault(); const [cx, cy] = center(); zoomAt(ed.viewRef.current.zoom / 1.2, cx, cy); return }
      if (e.altKey || e.shiftKey) return
      if (TOOL_KEYS[code]) { ed.setTool(TOOL_KEYS[code]); return }
      if (code === 'KeyI') onImageTool()
    }
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false) }
    const onBlur = () => setSpace(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [fit, zoomAt, onImageTool])

  /* ───────────── render ───────────── */
  const cursor = grabbing
    ? 'grabbing'
    : space || tool === 'hand'
      ? 'grab'
      : tool === 'eraser'
        ? ERASER_CURSOR
        : tool === 'text'
          ? 'text'
          : tool === 'select'
            ? 'default'
            : 'crosshair'

  let grid = 24 * view.zoom
  while (grid < 12) grid *= 4

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      className={`wb-canvas absolute inset-0 touch-none select-none overflow-hidden ${tool === 'select' && !space ? 'wb-select' : ''}`}
      style={{
        cursor,
        backgroundColor: 'rgb(var(--bg))',
        backgroundImage: 'radial-gradient(circle, rgb(var(--line) / 0.16) 1.1px, transparent 1.4px)',
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`, willChange: 'transform' }}
      >
        {elements.map((el) => (
          <ElementView key={el.id} el={el} editing={editingId === el.id} onCommitText={commitText} onMeasure={onMeasure} />
        ))}
        <SelectionOverlay selected={ed.selectedEls} zoom={view.zoom} editing={!!editingId} />
        {marquee && (
          <div
            className="pointer-events-none absolute rounded-sm"
            style={{
              left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h,
              border: `${1 / view.zoom}px solid rgb(var(--accent))`, background: 'rgb(var(--accent) / 0.08)',
            }}
          />
        )}
        {worldChildren}
      </div>
    </div>
  )
}
