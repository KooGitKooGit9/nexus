export type EventType = 'meeting' | 'focus' | 'personal' | 'deadline' | 'holiday' | 'ooo'

export type RsvpStatus = 'yes' | 'no' | 'maybe'

export interface CalEvent {
  id: string
  title: string
  start: string // ISO
  end: string // ISO (all-day events end at 23:59:59.999 of their last day)
  allDay?: boolean
  type: EventType
  attendeeIds: string[]
  organizerId: string
  location?: string // room name or address
  videoLink?: string
  description?: string
  color?: string // hex override
  /** RSVP per user */
  rsvp?: Record<string, RsvpStatus>
  /** Meeting room id (see ROOMS in constants.ts) */
  room?: string
  /** Series key for recurring seed events (e.g. "standup") */
  seriesId?: string
}

export type CalendarView = 'day' | 'week' | 'month' | 'agenda' | 'team'

/** View-model used by the calendar views: a CalEvent plus resolved display info. */
export interface DisplayEvent extends CalEvent {
  /** resolved tint color (hex) */
  tint: string
  /** set when shown because a teammate overlay is on */
  overlayUserId?: string
  /** cannot be dragged / edited (holidays, teammate overlays) */
  readOnly?: boolean
}
