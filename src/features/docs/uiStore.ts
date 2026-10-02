import { create } from 'zustand'

/** Ephemeral (non-persisted) UI state shared across docs components. */
interface DocsUIState {
  templatesOpen: boolean
  templatesParentId: string | null
  openTemplates: (parentId?: string | null) => void
  closeTemplates: () => void
  deleteId: string | null
  setDeleteId: (id: string | null) => void
  moveId: string | null
  setMoveId: (id: string | null) => void
  treeOpen: boolean
  setTreeOpen: (v: boolean) => void
  /** Narrow layout: the page tree floats over the content instead of taking up a column. */
  compact: boolean
  setCompact: (v: boolean) => void
  /** Overlay tree visibility in compact mode. */
  overlayOpen: boolean
  setOverlayOpen: (v: boolean) => void
}

/** Whether the page tree is currently visible (column or overlay). */
export const selectTreeVisible = (s: DocsUIState) => (s.compact ? s.overlayOpen : s.treeOpen)

/** Show / hide the page tree in whatever mode the layout is in. */
export function setTreeVisible(v: boolean) {
  const s = useDocsUI.getState()
  if (s.compact) s.setOverlayOpen(v)
  else s.setTreeOpen(v)
}

/** In compact mode, hide the overlay tree (after picking a page / action from it). */
export function closeOverlayTree() {
  const s = useDocsUI.getState()
  if (s.compact && s.overlayOpen) s.setOverlayOpen(false)
}

export const useDocsUI = create<DocsUIState>()((set) => ({
  templatesOpen: false,
  templatesParentId: null,
  openTemplates: (parentId = null) => set({ templatesOpen: true, templatesParentId: parentId }),
  closeTemplates: () => set({ templatesOpen: false }),
  deleteId: null,
  setDeleteId: (deleteId) => set({ deleteId }),
  moveId: null,
  setMoveId: (moveId) => set({ moveId }),
  treeOpen: true,
  setTreeOpen: (treeOpen) => set({ treeOpen }),
  compact: false,
  setCompact: (compact) => set({ compact, overlayOpen: false }),
  overlayOpen: false,
  setOverlayOpen: (overlayOpen) => set({ overlayOpen }),
}))
