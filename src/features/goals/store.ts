import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId, getUser } from '@/store/core'
import { notifyMembers } from '@/app/notifyMembers'
import type { Announcement, KeyResult, Objective } from './types'
import { SEED_OBJECTIVES, buildSeedAnnouncements } from './seed'
import { objectiveProgress } from './lib'

// Owned by the Home/Goals agent. Keep `objectives` & `announcements` field names stable.
interface GoalsState {
  objectives: Objective[]
  announcements: Announcement[]

  /* objectives */
  addObjective: (o: Omit<Objective, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateObjective: (id: string, patch: Partial<Objective>) => void
  deleteObjective: (id: string) => void
  setObjectiveStatus: (id: string, status: Objective['status']) => void
  /** Records a check-in on a key result. Auto-marks the objective done when every KR hits 100%. */
  checkInKeyResult: (objectiveId: string, krId: string, value: number, note?: string) => void
  addKeyResult: (objectiveId: string, kr: Omit<KeyResult, 'id'>) => void
  removeKeyResult: (objectiveId: string, krId: string) => void

  /* announcements */
  addAnnouncement: (a: Omit<Announcement, 'id' | 'createdAt' | 'reactions' | 'readBy'> & Partial<Pick<Announcement, 'reactions' | 'readBy'>>) => string
  updateAnnouncement: (id: string, patch: Partial<Announcement>) => void
  deleteAnnouncement: (id: string) => void
  togglePin: (id: string) => void
  markRead: (id: string, userId?: string) => void
  markAllRead: () => void
  toggleReaction: (id: string, emoji: string, userId?: string) => void
}

const now = () => new Date().toISOString()

export const useGoals = create<GoalsState>()(
  persisted<GoalsState>(
    'goals',
    (set, get) => ({
      objectives: SEED_OBJECTIVES,
      announcements: buildSeedAnnouncements(),

      addObjective: (o) => {
        const id = uid('obj')
        set((s) => ({ objectives: [...s.objectives, { ...o, id, createdAt: now(), updatedAt: now() }] }))
        return id
      },
      updateObjective: (id, patch) =>
        set((s) => ({ objectives: s.objectives.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: now() } : o)) })),
      deleteObjective: (id) =>
        set((s) => ({
          objectives: s.objectives.filter((o) => o.id !== id).map((o) => (o.parentId === id ? { ...o, parentId: undefined } : o)),
        })),
      setObjectiveStatus: (id, status) => get().updateObjective(id, { status }),
      checkInKeyResult: (objectiveId, krId, value, note) => {
        const o = get().objectives.find((x) => x.id === objectiveId)
        const kr = o?.keyResults.find((k) => k.id === krId)
        if (o && kr) {
          notifyMembers([kr.ownerId, o.ownerId], {
            type: 'system',
            title: `${getUser(getCurrentUserId())?.name ?? '누군가'}님이 핵심 결과를 체크인했어요`,
            body: `${kr.title} · ${kr.current}${kr.unit} → ${value}${kr.unit}${note ? ` — ${note}` : ''}`,
            link: `/goals?id=${o.id}`,
          })
        }
        set((s) => ({
          objectives: s.objectives.map((o) => {
            if (o.id !== objectiveId) return o
            const keyResults = o.keyResults.map((k) =>
              k.id === krId
                ? { ...k, current: value, history: [...(k.history ?? []), { id: uid('ci'), at: now(), value, userId: getCurrentUserId(), note }] }
                : k,
            )
            const next = { ...o, keyResults, updatedAt: now() }
            const p = objectiveProgress(next)
            if (p >= 100) next.status = 'done'
            else if (o.status === 'done') next.status = 'on_track'
            return next
          }),
        }))
      },
      addKeyResult: (objectiveId, kr) =>
        set((s) => ({
          objectives: s.objectives.map((o) => (o.id === objectiveId ? { ...o, keyResults: [...o.keyResults, { ...kr, id: uid('kr') }], updatedAt: now() } : o)),
        })),
      removeKeyResult: (objectiveId, krId) =>
        set((s) => ({
          objectives: s.objectives.map((o) => (o.id === objectiveId ? { ...o, keyResults: o.keyResults.filter((k) => k.id !== krId), updatedAt: now() } : o)),
        })),

      addAnnouncement: (a) => {
        const id = uid('ann')
        const me = getCurrentUserId()
        set((s) => ({ announcements: [{ reactions: {}, readBy: [me], ...a, id, createdAt: now() }, ...s.announcements] }))
        return id
      },
      updateAnnouncement: (id, patch) => set((s) => ({ announcements: s.announcements.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      deleteAnnouncement: (id) => set((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) })),
      togglePin: (id) => set((s) => ({ announcements: s.announcements.map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a)) })),
      markRead: (id, userId) => {
        const u = userId ?? getCurrentUserId()
        set((s) => ({ announcements: s.announcements.map((a) => (a.id === id && !a.readBy.includes(u) ? { ...a, readBy: [...a.readBy, u] } : a)) }))
      },
      markAllRead: () => {
        const u = getCurrentUserId()
        set((s) => ({ announcements: s.announcements.map((a) => (a.readBy.includes(u) ? a : { ...a, readBy: [...a.readBy, u] })) }))
      },
      toggleReaction: (id, emoji, userId) => {
        const u = userId ?? getCurrentUserId()
        set((s) => ({
          announcements: s.announcements.map((a) => {
            if (a.id !== id) return a
            const list = a.reactions[emoji] ?? []
            const nextList = list.includes(u) ? list.filter((x) => x !== u) : [...list, u]
            const reactions = { ...a.reactions }
            if (nextList.length) reactions[emoji] = nextList
            else delete reactions[emoji]
            return { ...a, reactions }
          }),
        }))
      },
    }),
    {
      version: 3,
      // Re-seed when upgrading from the empty skeleton.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<GoalsState>
        if (version < 2 || !p.objectives?.length) {
          return { ...p, objectives: SEED_OBJECTIVES, announcements: p.announcements?.length ? p.announcements : buildSeedAnnouncements() } as GoalsState
        }
        if (version < 3) {
          // v3: seeded check-ins of whole-number KRs were stored with decimals (e.g. "12.5회")
          p.objectives = p.objectives.map((o) => ({
            ...o,
            keyResults: o.keyResults.map((k) =>
              [k.start ?? 0, k.current, k.target].every(Number.isInteger)
                ? { ...k, history: k.history?.map((h) => (h.id.startsWith(`${k.id}_h`) ? { ...h, value: Math.round(h.value) } : h)) }
                : k,
            ),
          }))
        }
        return p as GoalsState
      },
    },
  ),
)
syncAcrossTabs(useGoals)

/** Unread announcements for the current user. */
export function useUnreadAnnouncements() {
  return useGoals((s) => s.announcements.filter((a) => !a.readBy.includes(getCurrentUserId())).length)
}
