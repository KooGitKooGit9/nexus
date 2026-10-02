import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import type { TaskFilters, ViewMode } from './types'

export const DEFAULT_FILTERS: TaskFilters = { search: '', assigneeIds: [], priorities: [], labels: [], mineOnly: false, groupBy: 'status' }

interface PrefsState {
  views: Record<string, ViewMode>
  filters: TaskFilters
  setView: (projectId: string, view: ViewMode) => void
  setFilters: (patch: Partial<TaskFilters>) => void
  resetFilters: () => void
}

/** UI preferences for the projects feature (view per project + filter bar state). */
export const useProjectPrefs = create<PrefsState>()(
  persisted<PrefsState>('projects-prefs', (set) => ({
    views: {},
    filters: DEFAULT_FILTERS,
    setView: (projectId, view) => set((s) => ({ views: { ...s.views, [projectId]: view } })),
    setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
    resetFilters: () => set((s) => ({ filters: { ...DEFAULT_FILTERS, groupBy: s.filters.groupBy } })),
  })),
)
syncAcrossTabs(useProjectPrefs)

export function activeFilterCount(f: TaskFilters) {
  return (f.search ? 1 : 0) + f.assigneeIds.length + f.priorities.length + f.labels.length + (f.mineOnly ? 1 : 0)
}
