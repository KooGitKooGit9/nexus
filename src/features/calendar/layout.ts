import { addDays, differenceInCalendarDays, differenceInMinutes, startOfDay } from 'date-fns'
import { isAllDayLike } from './utils'
import type { CalEvent } from './types'

/** A timed event clipped to one visible day column. */
export interface Segment<T> {
  ev: T
  day: number
  startMin: number
  endMin: number
  isStart: boolean
  isEnd: boolean
}

export interface Placed<T> extends Segment<T> {
  left: number // fraction of column
  width: number // fraction of column
}

const MIN_VISUAL = 20 // minutes — tiny events still need room for a label

export function timedSegments<T extends CalEvent>(events: T[], days: Date[]): Segment<T>[] {
  const out: Segment<T>[] = []
  for (const ev of events) {
    if (isAllDayLike(ev)) continue
    const s = new Date(ev.start)
    const e = new Date(ev.end)
    days.forEach((day, i) => {
      const ds = startOfDay(day)
      const de = addDays(ds, 1)
      if (!(s < de && (e > ds || (s >= ds && s.getTime() === e.getTime())))) return
      out.push({
        ev,
        day: i,
        startMin: Math.max(0, differenceInMinutes(s, ds)),
        endMin: Math.min(1440, differenceInMinutes(e, ds)),
        isStart: s >= ds,
        isEnd: e <= de,
      })
    })
  }
  return out
}

/**
 * Column-packing for overlapping events (Google Calendar style):
 * transitively-overlapping events form a cluster; each event takes the first free column,
 * then expands right across columns that stay free for its duration.
 */
export function packColumns<T>(segs: Segment<T>[]): Placed<T>[] {
  const byDay = new Map<number, Segment<T>[]>()
  segs.forEach((s) => byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]))
  const out: Placed<T>[] = []
  const visEnd = (s: Segment<T>) => Math.max(s.endMin, s.startMin + MIN_VISUAL)
  const collide = (a: Segment<T>, b: Segment<T>) => a.startMin < visEnd(b) && b.startMin < visEnd(a)

  for (const daySegs of byDay.values()) {
    const sorted = [...daySegs].sort((a, b) => a.startMin - b.startMin || b.endMin - b.startMin - (a.endMin - a.startMin))
    let cluster: Segment<T>[] = []
    let clusterEnd = -1
    const flush = () => {
      const cols: Segment<T>[][] = []
      const colOf = new Map<Segment<T>, number>()
      for (const s of cluster) {
        let i = cols.findIndex((col) => visEnd(col[col.length - 1]) <= s.startMin)
        if (i < 0) { i = cols.length; cols.push([]) }
        cols[i].push(s)
        colOf.set(s, i)
      }
      const n = cols.length
      for (const s of cluster) {
        const i = colOf.get(s)!
        let span = 1
        while (i + span < n && !cols[i + span].some((o) => collide(o, s))) span++
        out.push({ ...s, left: i / n, width: span / n })
      }
    }
    for (const s of sorted) {
      if (cluster.length && s.startMin >= clusterEnd) { flush(); cluster = []; clusterEnd = -1 }
      cluster.push(s)
      clusterEnd = Math.max(clusterEnd, visEnd(s))
    }
    if (cluster.length) flush()
  }
  return out
}

export interface Lane<T> {
  ev: T
  startIdx: number
  endIdx: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

/** Lanes for all-day / multi-day bars over a contiguous run of days. */
export function allDayLanes<T extends CalEvent>(events: T[], days: Date[], filter: (ev: T) => boolean = isAllDayLike): Lane<T>[] {
  if (!days.length) return []
  const first = startOfDay(days[0])
  const n = days.length
  const items = events
    .filter(filter)
    .map((ev) => {
      const s = new Date(ev.start)
      const e = new Date(new Date(ev.end).getTime() - 1)
      const si = differenceInCalendarDays(s, first)
      const ei = differenceInCalendarDays(e < s ? s : e, first)
      return { ev, si, ei }
    })
    .filter((x) => x.ei >= 0 && x.si < n)
    .sort((a, b) => a.si - b.si || b.ei - b.si - (a.ei - a.si))
  const laneEnds: number[] = []
  return items.map(({ ev, si, ei }) => {
    const startIdx = Math.max(0, si)
    const endIdx = Math.min(n - 1, ei)
    let lane = laneEnds.findIndex((end) => end < startIdx)
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(endIdx) } else laneEnds[lane] = endIdx
    return { ev, startIdx, endIdx, lane, continuesBefore: si < 0, continuesAfter: ei > n - 1 }
  })
}
