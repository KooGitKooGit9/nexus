import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import type { Board, TemplateId, Viewport, WbElement } from './types'
import { SEED_BOARDS } from './seed'
import { buildTemplate } from './templates'

interface WhiteboardState {
  boards: Board[]
  /** Per-user camera per board (not shared — every member pans/zooms independently). */
  viewports: Record<string, Viewport>
  createBoard: (input: { name: string; emoji?: string; template?: TemplateId }) => string
  updateBoard: (id: string, patch: Partial<Omit<Board, 'id'>>) => void
  /** `touch=false` saves without bumping updatedAt (e.g. auto-measured text heights, simulated teammates). */
  setElements: (id: string, elements: WbElement[], touch?: boolean) => void
  setViewport: (id: string, viewport: Viewport) => void
  duplicateBoard: (id: string) => string | undefined
  deleteBoard: (id: string) => void
  toggleStar: (id: string) => void
}

const cloneElements = (els: WbElement[]) => els.map((e) => ({ ...e, id: uid('el'), points: e.points?.map((p) => [...p] as [number, number]) }))

export const useWhiteboard = create<WhiteboardState>()(
  persisted<WhiteboardState>('whiteboard', (set, get) => ({
    boards: SEED_BOARDS,
    viewports: {},

    createBoard: ({ name, emoji, template = 'blank' }) => {
      const id = uid('wb')
      const me = getCurrentUserId()
      const now = new Date().toISOString()
      const board: Board = {
        id, name: name.trim() || '제목 없는 보드', emoji: emoji ?? '🎨', ownerId: me, memberIds: [me],
        createdAt: now, updatedAt: now, template, elements: buildTemplate(template, ''),
      }
      set((s) => ({ boards: [board, ...s.boards] }))
      return id
    },
    updateBoard: (id, patch) =>
      set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b)) })),
    setElements: (id, elements, touch = true) =>
      set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, elements, ...(touch ? { updatedAt: new Date().toISOString() } : {}) } : b)) })),
    setViewport: (id, viewport) => set((s) => ({ viewports: { ...s.viewports, [id]: viewport } })),
    duplicateBoard: (id) => {
      const src = get().boards.find((b) => b.id === id)
      if (!src) return undefined
      const nid = uid('wb')
      const now = new Date().toISOString()
      const copy: Board = { ...src, id: nid, name: `${src.name} (사본)`, ownerId: getCurrentUserId(), createdAt: now, updatedAt: now, starred: false, elements: cloneElements(src.elements) }
      set((s) => ({ boards: [copy, ...s.boards] }))
      return nid
    },
    deleteBoard: (id) => set((s) => ({ boards: s.boards.filter((b) => b.id !== id) })),
    toggleStar: (id) => set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, starred: !b.starred } : b)) })),
  })),
)
syncAcrossTabs(useWhiteboard)
