import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import type { Doc } from './types'
import { SEED_DOCS, SEED_EXPANDED, SEED_RECENT } from './seed'

interface DocsState {
  docs: Doc[]
  /** Most recently visited doc ids (newest first). */
  recentIds: string[]
  /** Tree expand/collapse state. */
  expanded: Record<string, boolean>

  createDoc: (input?: Partial<Omit<Doc, 'id' | 'createdAt' | 'updatedAt'>>) => Doc
  updateDoc: (id: string, patch: Partial<Doc>, opts?: { touch?: boolean }) => void
  /** Deletes the doc and all of its descendants. */
  deleteDoc: (id: string) => void
  moveDoc: (id: string, parentId: string | null) => void
  toggleStar: (id: string) => void
  duplicateDoc: (id: string) => Doc | undefined
  visitDoc: (id: string) => void
  setExpanded: (id: string, open: boolean) => void
}

/** All descendant ids of a doc (not including itself). */
export function descendantIds(docs: Doc[], id: string): string[] {
  const out: string[] = []
  const walk = (pid: string) => {
    docs.forEach((d) => {
      if (d.parentId === pid) {
        out.push(d.id)
        walk(d.id)
      }
    })
  }
  walk(id)
  return out
}

/** Ancestors from root → direct parent. */
export function ancestorsOf(docs: Doc[], id: string): Doc[] {
  const chain: Doc[] = []
  let cur = docs.find((d) => d.id === id)
  const seen = new Set<string>()
  while (cur?.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId)
    const parent = docs.find((d) => d.id === cur!.parentId)
    if (!parent) break
    chain.unshift(parent)
    cur = parent
  }
  return chain
}

const seedState = () => ({ docs: SEED_DOCS, recentIds: SEED_RECENT, expanded: SEED_EXPANDED })

export const useDocs = create<DocsState>()(
  persisted<DocsState>(
    'docs',
    (set, get) => ({
      ...seedState(),

      createDoc: (input = {}) => {
        const me = getCurrentUserId()
        const now = new Date().toISOString()
        const doc: Doc = {
          id: uid('doc'),
          parentId: null,
          title: '',
          emoji: '📄',
          content: '',
          authorId: me,
          lastEditedBy: me,
          ...input,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({
          docs: [...s.docs, doc],
          expanded: doc.parentId ? { ...s.expanded, [doc.parentId]: true } : s.expanded,
        }))
        return doc
      },

      updateDoc: (id, patch, opts) => {
        const touch = opts?.touch ?? true
        set((s) => ({
          docs: s.docs.map((d) =>
            d.id === id
              ? { ...d, ...patch, ...(touch ? { updatedAt: new Date().toISOString(), lastEditedBy: getCurrentUserId() } : {}) }
              : d,
          ),
        }))
      },

      deleteDoc: (id) => {
        const ids = new Set([id, ...descendantIds(get().docs, id)])
        set((s) => ({
          docs: s.docs.filter((d) => !ids.has(d.id)),
          recentIds: s.recentIds.filter((r) => !ids.has(r)),
        }))
      },

      moveDoc: (id, parentId) => {
        if (parentId === id || (parentId && descendantIds(get().docs, id).includes(parentId))) return
        set((s) => ({
          docs: s.docs.map((d) => (d.id === id ? { ...d, parentId } : d)),
          expanded: parentId ? { ...s.expanded, [parentId]: true } : s.expanded,
        }))
      },

      toggleStar: (id) => set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, starred: !d.starred } : d)) })),

      duplicateDoc: (id) => {
        const src = get().docs.find((d) => d.id === id)
        if (!src) return undefined
        const now = new Date().toISOString()
        const me = getCurrentUserId()
        const copy: Doc = { ...src, id: uid('doc'), title: `${src.title || '제목 없음'} (사본)`, starred: false, authorId: me, lastEditedBy: me, createdAt: now, updatedAt: now }
        set((s) => {
          const idx = s.docs.findIndex((d) => d.id === id)
          const docs = [...s.docs]
          docs.splice(idx + 1, 0, copy)
          return { docs }
        })
        return copy
      },

      visitDoc: (id) => set((s) => ({ recentIds: [id, ...s.recentIds.filter((r) => r !== id)].slice(0, 12) })),

      setExpanded: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: open } })),
    }),
    {
      version: 2,
      // v1 was the empty skeleton → reseed
      migrate: () => seedState() as unknown as DocsState,
    },
  ),
)
syncAcrossTabs(useDocs)
