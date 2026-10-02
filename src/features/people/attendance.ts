import type { User } from '@/store/types'
import { hashIndex } from '@/lib/utils'
import type { ClockState, LeaveEntry, WorkMode } from './types'
import { arrivalMinutes, dateKey, defaultWorkMode, hourIn, leaveCovers, LEAVE_LABEL } from './lib'

export type AttendanceStatus = 'working' | 'left' | 'notyet' | 'leave'

export interface AttendanceRow {
  user: User
  mode: WorkMode
  status: AttendanceStatus
  inLabel?: string
  outLabel?: string
  note?: string
  /** worked minutes so far today */
  workedMin: number
}

const hm = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const timeOf = (iso: string) => {
  const d = new Date(iso)
  return hm(d.getHours() * 60 + d.getMinutes())
}

export function teamAttendance(users: User[], leaves: LeaveEntry[], clock: ClockState, meId: string, now: Date): AttendanceRow[] {
  const key = dateKey(now)
  return users.map((u): AttendanceRow => {
    const leave = leaves.find((l) => l.userId === u.id && leaveCovers(l, now))
    if (leave && (leave.type === 'annual' || leave.type === 'sick' || leave.type === 'workshop')) {
      return { user: u, mode: 'leave', status: 'leave', note: `${LEAVE_LABEL[leave.type]}${leave.note ? ` · ${leave.note}` : ''}`, workedMin: 0 }
    }

    if (u.id === meId) {
      const today = clock.date === key ? clock : { ...clock, sessions: [] }
      const first = today.sessions[0]
      const last = today.sessions[today.sessions.length - 1]
      if (!first) return { user: u, mode: today.mode, status: 'notyet', workedMin: 0 }
      const worked = today.sessions.reduce((a, s) => a + ((s.out ? new Date(s.out).getTime() : now.getTime()) - new Date(s.in).getTime()), 0) / 60000
      return {
        user: u,
        mode: today.mode,
        status: last.out ? 'left' : 'working',
        inLabel: timeOf(first.in),
        outLabel: last.out ? timeOf(last.out) : undefined,
        workedMin: worked,
      }
    }

    const mode = defaultWorkMode(u)
    let arrival = arrivalMinutes(u.id, key)
    let note: string | undefined
    if (leave?.type === 'half_am') { arrival = 14 * 60 + (arrival % 20); note = '오전 반차' }
    const localNow = Math.round(hourIn(u.timezone, now) * 60)
    const span = 9 * 60 + hashIndex(u.id + key + 'out', 75)
    let leaveAt = arrival + span
    if (leave?.type === 'half_pm') { leaveAt = 13 * 60; note = '오후 반차' }
    if (u.timezone !== 'Asia/Seoul') note = `현지 시간 기준 (${u.location})`

    if (localNow < arrival) return { user: u, mode, status: 'notyet', note, workedMin: 0 }
    if (localNow >= leaveAt) return { user: u, mode, status: 'left', inLabel: hm(arrival), outLabel: hm(leaveAt), note, workedMin: leaveAt - arrival }
    return { user: u, mode, status: 'working', inLabel: hm(arrival), note, workedMin: localNow - arrival }
  })
}
