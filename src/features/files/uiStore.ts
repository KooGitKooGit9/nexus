import { create } from 'zustand'
import type { FileKind } from './fileTypes'

export interface UploadJob {
  id: string
  name: string
  size: number
  progress: number
  kind: FileKind
  done: boolean
  /** upload failed (message shown in the panel) */
  error?: string
}

interface DriveUIState {
  selected: string[]
  anchor: string | null
  setSelected: (ids: string[], anchor?: string | null) => void
  clearSelection: () => void

  previewId: string | null
  setPreviewId: (id: string | null) => void
  renamingId: string | null
  setRenamingId: (id: string | null) => void
  moveIds: string[] | null
  setMoveIds: (ids: string[] | null) => void
  shareId: string | null
  setShareId: (id: string | null) => void
  deleteIds: string[] | null
  setDeleteIds: (ids: string[] | null) => void
  newFolderOpen: boolean
  setNewFolderOpen: (v: boolean) => void

  contextMenu: { x: number; y: number; id: string } | null
  openContextMenu: (x: number, y: number, id: string) => void
  closeContextMenu: () => void

  uploads: UploadJob[]
  upsertUpload: (job: UploadJob) => void
  /** Updates a job only if it is still listed (a cleared panel cancels in-flight uploads). Returns false if gone. */
  updateUpload: (job: UploadJob) => boolean
  removeUpload: (id: string) => void
  clearUploads: () => void

  query: string
  setQuery: (q: string) => void
  typeFilter: FileKind | 'all'
  setTypeFilter: (t: FileKind | 'all') => void

  /** Narrow layout: the drive nav floats over the content instead of taking up a column. */
  compact: boolean
  setCompact: (v: boolean) => void
  navOpen: boolean
  setNavOpen: (v: boolean) => void
}

export const useDriveUI = create<DriveUIState>()((set, get) => ({
  selected: [],
  anchor: null,
  setSelected: (selected, anchor) => set((s) => ({ selected, anchor: anchor === undefined ? s.anchor : anchor })),
  clearSelection: () => set({ selected: [], anchor: null }),

  previewId: null,
  setPreviewId: (previewId) => set({ previewId }),
  renamingId: null,
  setRenamingId: (renamingId) => set({ renamingId }),
  moveIds: null,
  setMoveIds: (moveIds) => set({ moveIds }),
  shareId: null,
  setShareId: (shareId) => set({ shareId }),
  deleteIds: null,
  setDeleteIds: (deleteIds) => set({ deleteIds }),
  newFolderOpen: false,
  setNewFolderOpen: (newFolderOpen) => set({ newFolderOpen }),

  contextMenu: null,
  openContextMenu: (x, y, id) => set({ contextMenu: { x, y, id } }),
  closeContextMenu: () => set({ contextMenu: null }),

  uploads: [],
  upsertUpload: (job) => set((s) => ({ uploads: s.uploads.some((u) => u.id === job.id) ? s.uploads.map((u) => (u.id === job.id ? job : u)) : [...s.uploads, job] })),
  updateUpload: (job) => {
    if (!get().uploads.some((u) => u.id === job.id)) return false
    set((s) => ({ uploads: s.uploads.map((u) => (u.id === job.id ? job : u)) }))
    return true
  },
  removeUpload: (id) => set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) })),
  clearUploads: () => set({ uploads: [] }),

  query: '',
  setQuery: (query) => set({ query }),
  typeFilter: 'all',
  setTypeFilter: (typeFilter) => set({ typeFilter }),

  compact: false,
  setCompact: (compact) => set({ compact, navOpen: false }),
  navOpen: false,
  setNavOpen: (navOpen) => set({ navOpen }),
}))
