import { useEffect, useMemo, useState } from 'react'
import { useCore } from '@/store/core'
import { useCalendar, useCalendarPrefs } from './store'
import { TYPE_META, userColor } from './constants'
import { holidayEvents } from './holidays'
import { involves } from './utils'
import type { DisplayEvent } from './types'

/** Current time, re-rendering every `ms`. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

/** Events to render: mine (filtered by type toggles) + teammate overlays + holidays for nearby years. */
export function useDisplayEvents(anchor: Date): DisplayEvent[] {
  const events = useCalendar((s) => s.events)
  const me = useCore((s) => s.currentUserId)
  const hidden = useCalendarPrefs((s) => s.hiddenTypes)
  const overlay = useCalendarPrefs((s) => s.overlayUserIds)
  const year = anchor.getFullYear()
  return useMemo(() => {
    const out: DisplayEvent[] = []
    const ids = new Set<string>()
    for (const ev of events) {
      if (hidden.includes(ev.type)) continue
      if (ev.type === 'holiday' || involves(ev, me)) {
        out.push({ ...ev, tint: ev.color ?? TYPE_META[ev.type].color, readOnly: ev.type === 'holiday' })
        ids.add(ev.id)
      } else {
        const who = overlay.find((u) => involves(ev, u))
        if (who) {
          out.push({ ...ev, tint: userColor(who), overlayUserId: who, readOnly: true })
          ids.add(ev.id)
        }
      }
    }
    if (!hidden.includes('holiday')) {
      for (const h of holidayEvents([year - 1, year, year + 1])) {
        if (!ids.has(h.id)) out.push({ ...h, tint: TYPE_META.holiday.color, readOnly: true })
      }
    }
    return out
  }, [events, me, hidden, overlay, year])
}
