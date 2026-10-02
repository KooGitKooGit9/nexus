import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId, getUser } from '@/store/core'
import { getSessionUserId } from '@/lib/session'
import { notifyMembers } from '@/app/notifyMembers'
import { formatRange } from './utils'
import { buildSeedEvents } from './seed'
import { holidayEvents } from './holidays'
import type { CalEvent, CalendarView, EventType, RsvpStatus } from './types'

export { getEventsForDay, findFreeSlots, userConflict, roomConflict, formatRange, relativeStart } from './utils'
export type { FreeSlotOptions, Slot } from './utils'

export type NewEventInput = Omit<CalEvent, 'id' | 'organizerId' | 'attendeeIds' | 'type'> &
  Partial<Pick<CalEvent, 'organizerId' | 'attendeeIds' | 'type'>>

interface CalendarState {
  events: CalEvent[]
  createEvent: (input: NewEventInput) => CalEvent
  updateEvent: (id: string, patch: Partial<CalEvent>) => void
  deleteEvent: (id: string) => void
  duplicateEvent: (id: string) => CalEvent | undefined
  setRsvp: (id: string, userId: string, status: RsvpStatus) => void
  /** Move an event; if `end` is omitted the duration is preserved. */
  moveEvent: (id: string, start: Date | string, end?: Date | string) => void
  resetCalendar: () => void
}

const iso = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString())

const RSVP_LABEL: Record<RsvpStatus, string> = { yes: '참석', no: '불참', maybe: '미정' }

/** Invite / update / cancel notifications for the other attendees (delivered to their browsers). */
function tellAttendees(kind: 'invite' | 'update' | 'cancel', ev: CalEvent, to: string[] = ev.attendeeIds) {
  if (ev.type === 'holiday') return
  const who = getUser(getCurrentUserId())?.name ?? '누군가'
  let when = ''
  try { when = formatRange(ev) } catch { /* ignore */ }
  const where = [when, ev.location].filter(Boolean).join(' · ')
  notifyMembers(to, {
    type: 'event',
    title:
      kind === 'invite' ? `${who}님이 일정에 초대했습니다: ${ev.title}` : kind === 'update' ? `일정이 변경되었습니다: ${ev.title}` : `일정이 취소되었습니다: ${ev.title}`,
    body: where || undefined,
    link: kind === 'cancel' ? '/calendar' : `/calendar?event=${ev.id}`,
  })
}

const MATERIAL: (keyof CalEvent)[] = ['title', 'start', 'end', 'location', 'room', 'allDay', 'videoLink']

export const useCalendar = create<CalendarState>()(
  persisted<CalendarState>(
    'calendar',
    (set, get) => ({
      events: buildSeedEvents(),

      createEvent: (input) => {
        const me = getCurrentUserId()
        const organizerId = input.organizerId ?? me
        const attendeeIds = Array.from(new Set([organizerId, ...(input.attendeeIds ?? [])]))
        const ev: CalEvent = {
          ...input,
          id: uid('ev'),
          type: input.type ?? 'meeting',
          organizerId,
          attendeeIds,
          rsvp: { ...input.rsvp, [organizerId]: 'yes' },
        }
        set((s) => ({ events: [...s.events, ev] }))
        tellAttendees('invite', ev)
        return ev
      },
      updateEvent: (id, patch) => {
        const before = get().events.find((e) => e.id === id)
        set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
        const after = get().events.find((e) => e.id === id)
        if (!before || !after) return
        const added = after.attendeeIds.filter((a) => !before.attendeeIds.includes(a))
        const removed = before.attendeeIds.filter((a) => !after.attendeeIds.includes(a))
        const stay = after.attendeeIds.filter((a) => before.attendeeIds.includes(a))
        if (added.length) tellAttendees('invite', after, added)
        if (removed.length) tellAttendees('cancel', before, removed)
        if (MATERIAL.some((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))) tellAttendees('update', after, stay)
      },
      deleteEvent: (id) => {
        const ev = get().events.find((e) => e.id === id)
        set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
        if (ev && new Date(ev.end).getTime() > Date.now()) tellAttendees('cancel', ev)
      },
      duplicateEvent: (id) => {
        const src = get().events.find((e) => e.id === id)
        if (!src) return undefined
        const copy: CalEvent = { ...src, id: uid('ev'), title: `${src.title} (사본)`, seriesId: undefined, organizerId: getCurrentUserId(), rsvp: { [getCurrentUserId()]: 'yes' } }
        if (!copy.attendeeIds.includes(copy.organizerId)) copy.attendeeIds = [copy.organizerId, ...copy.attendeeIds]
        set((s) => ({ events: [...s.events, copy] }))
        tellAttendees('invite', copy)
        return copy
      },
      setRsvp: (id, userId, status) => {
        const ev = get().events.find((e) => e.id === id)
        set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, rsvp: { ...e.rsvp, [userId]: status } } : e)) }))
        if (ev && ev.rsvp?.[userId] !== status && userId === getCurrentUserId())
          notifyMembers([ev.organizerId], {
            type: 'event',
            title: `${getUser(userId)?.name ?? ''}님이 "${ev.title}"에 ${RSVP_LABEL[status]}으로 응답했습니다`,
            link: `/calendar?event=${ev.id}`,
          })
      },
      moveEvent: (id, start, end) => {
        set((s) => ({
          events: s.events.map((e) => {
            if (e.id !== id) return e
            const dur = new Date(e.end).getTime() - new Date(e.start).getTime()
            const ns = new Date(start)
            const ne = end ? new Date(end) : new Date(ns.getTime() + dur)
            return { ...e, start: iso(ns), end: iso(ne) }
          }),
        }))
        const ev = get().events.find((e) => e.id === id)
        if (ev) tellAttendees('update', ev)
      },
      resetCalendar: () => set({ events: buildSeedEvents() }),
    }),
    {
      version: 2,
      // v1 was the empty skeleton — reseed.
      migrate: (persisted, version) => {
        const p = persisted as Partial<CalendarState> | undefined
        if (version < 2 || !p?.events?.length) return { events: buildSeedEvents() } as unknown as CalendarState
        return p as CalendarState
      },
      // Public holidays are computed (rules change, e.g. 노동절·제헌절 from 2026) — always refresh the stored copies.
      merge: (persisted, current) => {
        const p = persisted as Partial<CalendarState> | undefined
        if (!p?.events) return current
        const y = new Date().getFullYear()
        const events = [...p.events.filter((e) => e.type !== 'holiday' || !e.id.startsWith('hol_')), ...holidayEvents([y, y + 1])]
        return { ...current, ...p, events }
      },
    },
  ),
)
syncAcrossTabs(useCalendar)

/* ───────────── View preferences (persisted separately) ───────────── */

interface CalendarPrefs {
  view: CalendarView
  hiddenTypes: EventType[]
  overlayUserIds: string[]
  /** users included in the team view's "모두 가능" row */
  teamFocusIds: string[]
  /** wide layouts: left panel collapsed by the user */
  panelCollapsed: boolean
  setPanelCollapsed: (v: boolean) => void
  setView: (v: CalendarView) => void
  toggleType: (t: EventType) => void
  toggleOverlay: (userId: string) => void
  toggleTeamFocus: (userId: string) => void
}

export const useCalendarPrefs = create<CalendarPrefs>()(
  persisted<CalendarPrefs>('calendar-prefs', (set) => ({
    view: 'week',
    hiddenTypes: [],
    overlayUserIds: ['u_design'],
    teamFocusIds: Array.from(new Set([getSessionUserId() ?? 'u_me', 'u_design', 'u_fe', 'u_pm'])),
    panelCollapsed: false,
    setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
    setView: (view) => set({ view }),
    toggleType: (t) => set((s) => ({ hiddenTypes: s.hiddenTypes.includes(t) ? s.hiddenTypes.filter((x) => x !== t) : [...s.hiddenTypes, t] })),
    toggleOverlay: (id) => set((s) => ({ overlayUserIds: s.overlayUserIds.includes(id) ? s.overlayUserIds.filter((x) => x !== id) : [...s.overlayUserIds, id] })),
    toggleTeamFocus: (id) => set((s) => ({ teamFocusIds: s.teamFocusIds.includes(id) ? s.teamFocusIds.filter((x) => x !== id) : [...s.teamFocusIds, id] })),
  })),
)
