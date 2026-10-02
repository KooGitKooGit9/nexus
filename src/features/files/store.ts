import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import type { FileItem, SortKey } from './types'
import { SEED_FILES } from './seed'

interface FilesState {
  files: FileItem[]
  view: 'grid' | 'list'
  sortKey: SortKey
  sortDir: 'asc' | 'desc'

  addFile: (input: Pick<FileItem, 'name' | 'parentId'> & Partial<FileItem>) => FileItem
  createFolder: (name: string, parentId: string | null, color?: string) => FileItem
  renameItem: (id: string, name: string) => void
  moveItems: (ids: string[], parentId: string | null) => void
  /** Stars all if any is unstarred, otherwise unstars all. */
  toggleStar: (ids: string[]) => void
  trashItems: (ids: string[]) => void
  restoreItems: (ids: string[]) => void
  deleteForever: (ids: string[]) => void
  emptyTrash: () => void
  shareItem: (id: string, userIds: string[]) => void
  markOpened: (id: string) => void
  setView: (v: 'grid' | 'list') => void
  setSort: (key: SortKey, dir?: 'asc' | 'desc') => void
}

/** All descendant ids (recursive). */
export function descendantsOf(files: FileItem[], id: string): string[] {
  const out: string[] = []
  const walk = (pid: string) =>
    files.forEach((f) => {
      if (f.parentId === pid) {
        out.push(f.id)
        if (f.kind === 'folder') walk(f.id)
      }
    })
  walk(id)
  return out
}

/** Folder chain root → item's parent. */
export function pathOf(files: FileItem[], id: string | null): FileItem[] {
  const chain: FileItem[] = []
  let cur = id ? files.find((f) => f.id === id) : undefined
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.unshift(cur)
    cur = cur.parentId ? files.find((f) => f.id === cur!.parentId) : undefined
  }
  return chain
}

const now = () => new Date().toISOString()
const seedState = () => ({ files: SEED_FILES, view: 'grid' as const, sortKey: 'updatedAt' as SortKey, sortDir: 'desc' as const })

export const useFiles = create<FilesState>()(
  persisted<FilesState>(
    'files',
    (set, get) => ({
      ...seedState(),

      addFile: (input) => {
        const t = now()
        const item: FileItem = { id: uid('fl'), kind: 'file', ownerId: getCurrentUserId(), createdAt: t, updatedAt: t, ...input }
        set((s) => ({ files: [...s.files, item] }))
        return item
      },

      createFolder: (name, parentId, color) => {
        const t = now()
        const item: FileItem = { id: uid('fd'), kind: 'folder', name: name.trim() || '새 폴더', parentId, color, ownerId: getCurrentUserId(), createdAt: t, updatedAt: t }
        set((s) => ({ files: [...s.files, item] }))
        return item
      },

      renameItem: (id, name) =>
        set((s) => ({ files: s.files.map((f) => (f.id === id && name.trim() ? { ...f, name: name.trim(), updatedAt: now() } : f)) })),

      moveItems: (ids, parentId) => {
        const files = get().files
        // never move a folder into itself / its descendants
        const blocked = new Set(ids.flatMap((id) => [id, ...descendantsOf(files, id)]))
        if (parentId && blocked.has(parentId)) return
        set((s) => ({ files: s.files.map((f) => (ids.includes(f.id) ? { ...f, parentId, updatedAt: now() } : f)) }))
      },

      toggleStar: (ids) =>
        set((s) => {
          const me = getCurrentUserId()
          const targets = s.files.filter((f) => ids.includes(f.id))
          const value = targets.some((f) => !isFileStarred(f, me))
          return {
            files: s.files.map((f) => {
              if (!ids.includes(f.id)) return f
              const base = (f.starredBy ?? (f.starred ? [me] : [])).filter((x) => x !== me)
              return { ...f, starredBy: value ? [...base, me] : base, starred: undefined }
            }),
          }
        }),

      trashItems: (ids) => set((s) => ({ files: s.files.map((f) => (ids.includes(f.id) ? { ...f, trashed: true, trashedAt: now() } : f)) })),

      restoreItems: (ids) =>
        set((s) => ({
          files: s.files.map((f) => {
            if (!ids.includes(f.id)) return f
            // the item stays in place only if every ancestor exists and is live (or restored in this same batch)
            let parentOk = true
            let pid = f.parentId
            for (let guard = 0; pid && guard < 50; guard++) {
              const p = s.files.find((x) => x.id === pid)
              if (!p || (p.trashed && !ids.includes(p.id))) { parentOk = false; break }
              pid = p.parentId
            }
            return { ...f, trashed: false, trashedAt: undefined, parentId: parentOk ? f.parentId : null }
          }),
        })),

      deleteForever: (ids) => {
        const files = get().files
        const all = new Set(ids.flatMap((id) => [id, ...descendantsOf(files, id)]))
        files.forEach((f) => { if (all.has(f.id) && f.url?.startsWith('blob:')) URL.revokeObjectURL(f.url) })
        set({ files: files.filter((f) => !all.has(f.id)) })
      },

      emptyTrash: () => get().deleteForever(get().files.filter((f) => f.trashed).map((f) => f.id)),

      shareItem: (id, userIds) => set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, sharedWith: userIds } : f)) })),

      markOpened: (id) => set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, lastOpenedAt: now() } : f)) })),

      setView: (view) => set({ view }),
      setSort: (key, dir) =>
        set((s) => ({ sortKey: key, sortDir: dir ?? (s.sortKey === key ? (s.sortDir === 'asc' ? 'desc' : 'asc') : key === 'name' || key === 'owner' ? 'asc' : 'desc') })),
    }),
    {
      version: 2,
      // v1 was the empty skeleton → reseed
      migrate: () => seedState() as unknown as FilesState,
      // Offline fallback only: uploads without the server are page-lived object URLs — don't persist them
      // (server uploads are stable `/api/files/<id>` URLs and are kept).
      partialize: (s) => ({ ...s, files: s.files.map((f) => (f.url?.startsWith('blob:') ? { ...f, url: undefined } : f)) }),
    },
  ),
)
syncAcrossTabs(useFiles)

/** Stars are personal: did `me` star this item? (demo seed files carry a legacy `starred` flag) */
export function isFileStarred(f: Pick<FileItem, 'starred' | 'starredBy'>, me: string = getCurrentUserId()): boolean {
  return f.starredBy ? f.starredBy.includes(me) : !!f.starred
}
