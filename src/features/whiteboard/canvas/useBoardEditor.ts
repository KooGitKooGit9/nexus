import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { uid } from '@/lib/utils'
import type { Board, Tool, Viewport, WbElement } from '../types'
import { useWhiteboard } from '../store'
import { STICKY_COLORS } from './geometry'

const HISTORY_LIMIT = 120

export interface EditorStyle {
  stickyColor: string
  stroke: string
  strokeWidth: number
}

/** All editable state for one board + history (undo/redo) + debounced persistence. */
export function useBoardEditor(board: Board) {
  const [elements, setEls] = useState<WbElement[]>(board.elements)
  const elsRef = useRef(elements)
  const undoStack = useRef<WbElement[][]>([])
  const redoStack = useRef<WbElement[][]>([])
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [selected, setSelectedState] = useState<string[]>([])
  const selRef = useRef(selected)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [style, setStyle] = useState<EditorStyle>({ stickyColor: STICKY_COLORS[0].fill, stroke: 'ink', strokeWidth: 3 })
  const [view, setViewState] = useState<Viewport>(() => useWhiteboard.getState().viewports?.[board.id] ?? board.viewport ?? { x: 0, y: 0, zoom: 1 })
  const viewRef = useRef(view)
  const clipboard = useRef<WbElement[]>([])
  const [savedAt, setSavedAt] = useState<number>(Date.now())
  /** true once the user changed content since the last save (bumps the board's updatedAt). */
  const dirty = useRef(false)
  /** true while there are unsaved element changes of any kind. */
  const pending = useRef(false)

  const setSelected = useCallback((ids: string[]) => {
    selRef.current = ids
    setSelectedState(ids)
  }, [])

  const setView = useCallback((v: Viewport | ((p: Viewport) => Viewport)) => {
    const next = typeof v === 'function' ? v(viewRef.current) : v
    viewRef.current = next
    setViewState(next)
  }, [])

  /** Replace elements; `record` pushes the previous state to the undo stack. */
  const commit = useCallback((next: WbElement[], record = true) => {
    if (record) {
      undoStack.current.push(elsRef.current)
      if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift()
      redoStack.current = []
      dirty.current = true
      bump()
    }
    elsRef.current = next
    setEls(next)
  }, [])

  /** Push a snapshot before a continuous (unrecorded) change like dragging. */
  const checkpoint = useCallback(() => {
    undoStack.current.push(elsRef.current)
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift()
    redoStack.current = []
    dirty.current = true
    bump()
  }, [])

  /** Drop undo entries identical to the current state (e.g. a text box created then left empty). */
  const dropRedundantUndo = useCallback(() => {
    const same = (a: WbElement[], b: WbElement[]) => a.length === b.length && a.every((x, i) => x === b[i])
    let changed = false
    while (undoStack.current.length && same(undoStack.current[undoStack.current.length - 1], elsRef.current)) {
      undoStack.current.pop()
      changed = true
    }
    if (changed) bump()
  }, [])

  /** Elements added by someone else (simulated teammates): not part of *my* undo history, so they are
   *  appended to every snapshot — undo/redo never removes a teammate's sticky. */
  const remoteAdd = useCallback((els: WbElement[]) => {
    undoStack.current = undoStack.current.map((snap) => [...snap, ...els])
    redoStack.current = redoStack.current.map((snap) => [...snap, ...els])
    const next = [...elsRef.current, ...els]
    elsRef.current = next
    setEls(next)
  }, [])

  const update = useCallback(
    (ids: string[] | Set<string>, fn: (el: WbElement) => Partial<WbElement>, record = true) => {
      const set = ids instanceof Set ? ids : new Set(ids)
      if (!set.size) return
      commit(elsRef.current.map((el) => (set.has(el.id) ? { ...el, ...fn(el) } : el)), record)
    },
    [commit],
  )

  const add = useCallback(
    (els: WbElement[], select = true, record = true) => {
      commit([...elsRef.current, ...els], record)
      if (select) setSelected(els.map((e) => e.id))
    },
    [commit, setSelected],
  )

  const remove = useCallback(
    (ids: string[]) => {
      if (!ids.length) return
      const set = new Set(ids)
      commit(elsRef.current.filter((e) => !set.has(e.id)))
      setSelected(selRef.current.filter((id) => !set.has(id)))
      setEditingId(null)
    },
    [commit, setSelected],
  )

  const cloneWithOffset = (els: WbElement[], d: number) =>
    els.map((e) => ({ ...e, id: uid('el'), x: e.x + d, y: e.y + d, bornAt: Date.now(), points: e.points?.map((p) => [...p] as [number, number]) }))

  const duplicate = useCallback(
    (ids: string[]) => {
      const set = new Set(ids)
      const src = elsRef.current.filter((e) => set.has(e.id))
      if (!src.length) return
      add(cloneWithOffset(src, 24))
    },
    [add],
  )

  const copy = useCallback(() => {
    const set = new Set(selRef.current)
    if (!set.size) return // ⌘C with nothing selected must not wipe the clipboard
    clipboard.current = elsRef.current.filter((e) => set.has(e.id))
  }, [])

  const paste = useCallback(() => {
    if (!clipboard.current.length) return
    const out = cloneWithOffset(clipboard.current, 36)
    clipboard.current = out
    add(out)
  }, [add])

  const reorder = useCallback(
    (dir: 'front' | 'back' | 'forward' | 'backward') => {
      const set = new Set(selRef.current)
      if (!set.size) return
      const els = [...elsRef.current]
      const sel = els.filter((e) => set.has(e.id))
      const rest = els.filter((e) => !set.has(e.id))
      let next: WbElement[]
      if (dir === 'front') next = [...rest, ...sel]
      else if (dir === 'back') next = [...sel, ...rest]
      else {
        next = els
        const idxs = els.map((e, i) => (set.has(e.id) ? i : -1)).filter((i) => i >= 0)
        if (dir === 'forward') {
          for (let k = idxs.length - 1; k >= 0; k--) {
            const i = idxs[k]
            if (i < next.length - 1 && !set.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]]
          }
        } else {
          for (const i of idxs) {
            if (i > 0 && !set.has(next[i - 1].id)) [next[i], next[i - 1]] = [next[i - 1], next[i]]
          }
        }
      }
      commit(next)
    },
    [commit],
  )

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(elsRef.current)
    elsRef.current = prev
    dirty.current = true
    setEls(prev)
    const ids = new Set(prev.map((e) => e.id))
    setSelected(selRef.current.filter((id) => ids.has(id)))
    setEditingId(null)
    bump()
  }, [setSelected])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(elsRef.current)
    elsRef.current = next
    dirty.current = true
    setEls(next)
    const ids = new Set(next.map((e) => e.id))
    setSelected(selRef.current.filter((id) => ids.has(id)))
    setEditingId(null)
    bump()
  }, [setSelected])

  // ── debounced persistence ──
  const boardId = board.id
  const first = useRef(true)
  /** Elements as last saved to / received from the shared store — the common ancestor for merges. */
  const baseRef = useRef<WbElement[]>(board.elements)
  /** set when `elements` changed because of a remote merge (no need to save it back) */
  const fromRemote = useRef(false)
  const flush = useCallback(() => {
    if (!pending.current) return
    pending.current = false
    baseRef.current = elsRef.current
    useWhiteboard.getState().setElements(boardId, elsRef.current, dirty.current)
    dirty.current = false
  }, [boardId])

  // ── live collaboration: merge edits from other members (by element id) without clobbering local work ──
  useEffect(() => {
    return useWhiteboard.subscribe((st) => {
      const remote = st.boards.find((b) => b.id === boardId)?.elements
      if (!remote || remote === baseRef.current || remote === elsRef.current) return
      const base = new Map(baseRef.current.map((e) => [e.id, e]))
      const local = elsRef.current
      const localById = new Map(local.map((e) => [e.id, e]))
      const remoteById = new Map(remote.map((e) => [e.id, e]))
      const changedLocally = (id: string) => localById.get(id) !== base.get(id)
      const same = (a?: WbElement, b?: WbElement) => a === b || (!!a && !!b && JSON.stringify(a) === JSON.stringify(b))
      // ids whose remote state differs from the common ancestor
      const remoteChanged = new Set<string>()
      for (const e of remote) if (!same(e, base.get(e.id))) remoteChanged.add(e.id)
      for (const id of base.keys()) if (!remoteById.has(id)) remoteChanged.add(id)
      baseRef.current = remote
      if (!remoteChanged.size) return
      const pick = (id: string): WbElement | undefined => {
        if (changedLocally(id)) return localById.get(id) // my in-progress edit wins
        return remoteById.get(id)
      }
      const next: WbElement[] = []
      const seen = new Set<string>()
      for (const e of remote) {
        const v = pick(e.id)
        if (v) next.push(v)
        seen.add(e.id)
      }
      // elements only I have (new, or deleted remotely while I was editing them)
      for (const e of local) if (!seen.has(e.id) && (changedLocally(e.id) || !base.has(e.id))) next.push(e)
      // patch undo/redo snapshots so history never resurrects or drops a teammate's change
      const patchSnap = (snap: WbElement[]) => {
        const ids = new Set(snap.map((e) => e.id))
        const out: WbElement[] = []
        for (const e of snap) {
          if (!remoteChanged.has(e.id)) out.push(e)
          else if (remoteById.has(e.id)) out.push(remoteById.get(e.id)!)
        }
        for (const id of remoteChanged) if (!ids.has(id) && !base.has(id) && remoteById.has(id)) out.push(remoteById.get(id)!)
        return out
      }
      undoStack.current = undoStack.current.map(patchSnap)
      redoStack.current = redoStack.current.map(patchSnap)
      fromRemote.current = true
      elsRef.current = next
      setEls(next)
      const alive = new Set(next.map((e) => e.id))
      if (selRef.current.some((id) => !alive.has(id))) setSelected(selRef.current.filter((id) => alive.has(id)))
    })
  }, [boardId, setSelected])

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (fromRemote.current) {
      fromRemote.current = false
      if (!pending.current) return // nothing of mine to save — the merge result is what the store already has
    }
    pending.current = true
    const t = setTimeout(() => {
      flush()
      setSavedAt(Date.now())
    }, 450)
    return () => clearTimeout(t)
  }, [elements, flush])

  useEffect(() => {
    const t = setTimeout(() => useWhiteboard.getState().setViewport(boardId, view), 600)
    return () => clearTimeout(t)
  }, [view, boardId])

  // flush on unmount and when the page is being unloaded (reload / tab close within the debounce window)
  useEffect(() => {
    const onHide = () => {
      flush()
      useWhiteboard.getState().setViewport(boardId, viewRef.current)
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      onHide()
    }
  }, [boardId, flush])

  const selectedEls = useMemo(() => {
    const set = new Set(selected)
    return elements.filter((e) => set.has(e.id))
  }, [elements, selected])

  return {
    elements, elsRef, commit, checkpoint, dropRedundantUndo, remoteAdd, update, add, remove, duplicate, copy, paste, reorder, undo, redo,
    canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0,
    selected, selRef, setSelected, selectedEls,
    editingId, setEditingId,
    tool, setTool,
    style, setStyle,
    view, viewRef, setView,
    savedAt,
  }
}

export type BoardEditor = ReturnType<typeof useBoardEditor>
