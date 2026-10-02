import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId, getUser } from '@/store/core'
import { notifyMembers } from '@/app/notifyMembers'
import type { ClockState, Kudos, KudosBadge, LeaveBalance, LeaveEntry, WorkMode } from './types'
import { SEED_BALANCE, SEED_CLOCK, SEED_KUDOS, SEED_LEAVES } from './seed'
import { dateKey } from './lib'

interface PeopleState {
  clock: ClockState
  /** yyyy-MM-dd → minutes worked (finalized days of the current user) */
  hoursLog: Record<string, number>
  leaves: LeaveEntry[]
  balance: LeaveBalance
  kudos: Kudos[]

  clockIn: (mode?: Exclude<WorkMode, 'leave'>) => void
  clockOut: () => void
  setWorkMode: (mode: Exclude<WorkMode, 'leave'>) => void
  giveKudos: (k: { toId: string; badge: KudosBadge; message: string }) => Kudos
  toggleReaction: (kudosId: string, emoji: string) => void
}

/** Make sure clock state belongs to today; roll over (and log yesterday) otherwise. */
function freshClock(s: PeopleState): Pick<PeopleState, 'clock' | 'hoursLog'> {
  const today = dateKey()
  if (s.clock.date === today) return { clock: s.clock, hoursLog: s.hoursLog }
  // A session left open on a past day (forgot to clock out) is closed at that day's midnight.
  const endOfThatDay = new Date(`${s.clock.date}T00:00:00`)
  endOfThatDay.setDate(endOfThatDay.getDate() + 1)
  const mins = workedMs(s.clock, Math.min(Date.now(), endOfThatDay.getTime())) / 60000
  return {
    clock: { date: today, sessions: [], mode: s.clock.mode },
    hoursLog: mins > 0 ? { ...s.hoursLog, [s.clock.date]: Math.round(mins) } : s.hoursLog,
  }
}

export function workedMs(clock: ClockState, now = Date.now()) {
  return clock.sessions.reduce((acc, ss) => acc + ((ss.out ? new Date(ss.out).getTime() : now) - new Date(ss.in).getTime()), 0)
}

export function isClockedIn(clock: ClockState) {
  const last = clock.sessions[clock.sessions.length - 1]
  return clock.date === dateKey() && !!last && !last.out
}

export const usePeople = create<PeopleState>()(
  persisted<PeopleState>('people', (set, get) => ({
    clock: SEED_CLOCK,
    hoursLog: {},
    leaves: SEED_LEAVES,
    balance: SEED_BALANCE,
    kudos: SEED_KUDOS,

    clockIn: (mode) => {
      const base = freshClock(get())
      if (isClockedIn(base.clock)) return
      set({
        ...base,
        clock: { ...base.clock, mode: mode ?? base.clock.mode, sessions: [...base.clock.sessions, { in: new Date().toISOString() }] },
      })
    },
    clockOut: () => {
      const base = freshClock(get())
      if (!isClockedIn(base.clock)) return
      const sessions = base.clock.sessions.map((ss, i, arr) => (i === arr.length - 1 ? { ...ss, out: new Date().toISOString() } : ss))
      set({ ...base, clock: { ...base.clock, sessions } })
    },
    setWorkMode: (mode) => {
      const base = freshClock(get())
      set({ ...base, clock: { ...base.clock, mode } })
    },

    giveKudos: ({ toId, badge, message }) => {
      const k: Kudos = { id: uid('kd'), fromId: getCurrentUserId(), toId, badge, message, createdAt: new Date().toISOString(), reactions: {} }
      set((s) => ({ kudos: [k, ...s.kudos] }))
      notifyMembers([toId], {
        type: 'system',
        title: `👏 ${getUser(k.fromId)?.name ?? '동료'}님이 칭찬을 보냈어요`,
        body: message.length > 80 ? message.slice(0, 80) + '…' : message,
        link: '/people?tab=kudos',
      })
      return k
    },
    toggleReaction: (kudosId, emoji) => {
      const me = getCurrentUserId()
      set((s) => ({
        kudos: s.kudos.map((k) => {
          if (k.id !== kudosId) return k
          const cur = k.reactions[emoji] ?? []
          const next = cur.includes(me) ? cur.filter((x) => x !== me) : [...cur, me]
          const reactions = { ...k.reactions, [emoji]: next }
          if (!next.length) delete reactions[emoji]
          return { ...k, reactions }
        }),
      }))
    },
  })),
)
syncAcrossTabs(usePeople)
