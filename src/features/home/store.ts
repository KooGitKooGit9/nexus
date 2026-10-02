import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { toast, useCore } from '@/store/core'
import type { Presence } from '@/store/types'
import { bigConfetti } from '@/features/goals/lib'

export type FocusMode = 'focus' | 'break'

export const FOCUS_DURATION: Record<FocusMode, number> = { focus: 25 * 60_000, break: 5 * 60_000 }

interface HomeState {
  note: string
  noteUpdatedAt: string | null
  setNote: (v: string) => void

  /* Pomodoro — persisted so the timer survives navigation & reloads */
  focusMode: FocusMode
  focusRunning: boolean
  /** epoch ms when the running session ends */
  focusEndsAt: number | null
  /** remaining ms while paused */
  focusRemaining: number
  /** completed focus sessions, keyed by yyyy-mm-dd */
  focusSessions: Record<string, number>
  /** presence before a focus session switched it to 방해 금지 (restored afterwards) */
  focusPrevPresence: Presence | null
  startFocus: () => void
  pauseFocus: () => void
  resetFocus: (mode?: FocusMode) => void
  completeFocus: () => FocusMode
}

const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const myPresence = (): Presence => {
  const c = useCore.getState()
  return c.users.find((u) => u.id === c.currentUserId)?.presence ?? 'online'
}

export const useHome = create<HomeState>()(
  persisted<HomeState>('home', (set, get) => ({
    note: '📝 오늘 꼭 할 것\n- 온보딩 개선안 리뷰\n- 런칭 회고 아젠다 정리\n- 지우님 PR 피드백',
    noteUpdatedAt: null,
    setNote: (note) => set({ note, noteUpdatedAt: new Date().toISOString() }),

    focusMode: 'focus',
    focusRunning: false,
    focusEndsAt: null,
    focusRemaining: FOCUS_DURATION.focus,
    focusSessions: {},
    focusPrevPresence: null,
    startFocus: () => {
      const { focusRemaining, focusMode, focusRunning } = get()
      if (focusRunning) return
      set({ focusRunning: true, focusEndsAt: Date.now() + focusRemaining })
      if (focusMode === 'focus') {
        const prev = myPresence()
        if (prev !== 'dnd') {
          set({ focusPrevPresence: prev })
          useCore.getState().setPresence('dnd')
        } else set({ focusPrevPresence: null })
      }
    },
    pauseFocus: () => {
      const { focusEndsAt, focusRunning } = get()
      if (!focusRunning) return
      set({ focusRunning: false, focusEndsAt: null, focusRemaining: Math.max(0, (focusEndsAt ?? Date.now()) - Date.now()) })
      restorePresence()
    },
    resetFocus: (mode) => {
      const m = mode ?? get().focusMode
      const wasRunning = get().focusRunning
      set({ focusMode: m, focusRunning: false, focusEndsAt: null, focusRemaining: FOCUS_DURATION[m] })
      if (wasRunning) restorePresence()
    },
    completeFocus: () => {
      restorePresence()
      const { focusMode, focusSessions } = get()
      const next: FocusMode = focusMode === 'focus' ? 'break' : 'focus'
      const k = todayKey()
      set({
        focusMode: next,
        focusRunning: false,
        focusEndsAt: null,
        focusRemaining: FOCUS_DURATION[next],
        focusSessions: focusMode === 'focus' ? { ...focusSessions, [k]: (focusSessions[k] ?? 0) + 1 } : focusSessions,
      })
      return next
    },
  })),
)
syncAcrossTabs(useHome)

/** Puts the user's presence back to what it was before the focus session (only if we set 방해 금지). */
function restorePresence() {
  const { focusPrevPresence } = useHome.getState()
  if (!focusPrevPresence) return
  if (myPresence() === 'dnd') useCore.getState().setPresence(focusPrevPresence)
  useHome.setState({ focusPrevPresence: null })
}

export function focusSessionsToday(s: Record<string, number>) {
  return s[todayKey()] ?? 0
}

/**
 * Global watcher — finishes a running session even when the Home page isn't mounted
 * (the module stays loaded after the first visit). Only the visible tab acts, to avoid double counting.
 */
if (typeof window !== 'undefined') {
  const w = window as unknown as { __nexusFocusWatcher?: number }
  if (w.__nexusFocusWatcher) window.clearInterval(w.__nexusFocusWatcher)
  w.__nexusFocusWatcher = window.setInterval(() => {
    const { focusRunning, focusEndsAt, completeFocus } = useHome.getState()
    if (!focusRunning || !focusEndsAt || Date.now() < focusEndsAt || document.visibilityState !== 'visible') return
    const next = completeFocus()
    if (next === 'break') {
      bigConfetti()
      toast('집중 세션 완료! 🎉', { description: '5분간 휴식하세요 ☕', variant: 'success', emoji: '🍅' })
    } else {
      toast('휴식 끝! 다시 집중해볼까요?', { variant: 'info', emoji: '⏰' })
    }
  }, 500)
}
