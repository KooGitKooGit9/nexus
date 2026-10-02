import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  addDays, addMonths, endOfDay, endOfMonth, endOfWeek, isSameMonth, isSameYear, isWithinInterval, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns'
import { toast, useUI } from '@/store/core'
import { useCalendar, useCalendarPrefs } from './store'
import { useDisplayEvents } from './hooks'
import { useEventReminders } from './reminders'
import { holidayEvents, holidayOn } from './holidays'
import { fmt } from './utils'
import { LeftPanel } from './components/LeftPanel'
import { CalendarHeader } from './components/CalendarHeader'
import { EventPopover } from './components/EventPopover'
import { EventModal, defaultDraft, type EventDraft } from './components/EventModal'
import { WeekView } from './views/WeekView'
import { DayView } from './views/DayView'
import { MonthView } from './views/MonthView'
import { AgendaView } from './views/AgendaView'
import { TeamView } from './views/TeamView'
import type { CalendarView } from './types'

function step(view: CalendarView, d: Date, n: number) {
  switch (view) {
    case 'day':
    case 'team':
      return addDays(d, n)
    case 'week':
    case 'agenda':
      return addDays(d, 7 * n)
    case 'month':
      return addMonths(startOfMonth(d), n)
  }
}

function rangeOf(view: CalendarView, d: Date) {
  switch (view) {
    case 'day':
    case 'team':
      return { start: startOfDay(d), end: endOfDay(d) }
    case 'week':
      return { start: startOfWeek(d), end: endOfWeek(d) }
    case 'agenda':
      return { start: startOfDay(d), end: endOfDay(addDays(d, 29)) }
    case 'month':
      return { start: startOfMonth(d), end: endOfMonth(d) }
  }
}

function titleOf(view: CalendarView, d: Date): { title: string; subtitle?: string } {
  const hol = holidayOn(d)
  switch (view) {
    case 'day':
      return { title: fmt(d, 'yyyy년 M월 d일'), subtitle: `${fmt(d, 'EEEE')}${hol ? ` · 🎌 ${hol.name}` : ''}` }
    case 'team':
      return { title: fmt(d, 'M월 d일 (EEE)'), subtitle: '팀 가용성 타임라인' }
    case 'week': {
      const s = startOfWeek(d)
      const e = endOfWeek(d)
      const title = isSameMonth(s, e) ? fmt(s, 'yyyy년 M월') : isSameYear(s, e) ? `${fmt(s, 'yyyy년 M월')} – ${fmt(e, 'M월')}` : `${fmt(s, 'yyyy년 M월')} – ${fmt(e, 'yyyy년 M월')}`
      return { title, subtitle: `${fmt(s, 'M월 d일')} – ${fmt(e, 'M월 d일')}` }
    }
    case 'agenda': {
      const e = addDays(d, 29)
      return { title: `${fmt(d, 'yyyy년 M월 d일')} – ${isSameYear(d, e) ? fmt(e, 'M월 d일') : fmt(e, 'yyyy년 M월 d일')}`, subtitle: '30일간의 일정' }
    }
    case 'month':
      return { title: fmt(d, 'yyyy년 M월') }
  }
}

export default function CalendarPage() {
  useEventReminders()
  const view = useCalendarPrefs((s) => s.view)
  const setView = useCalendarPrefs((s) => s.setView)
  const [date, setDate] = useState(() => startOfDay(new Date()))
  const [dir, setDir] = useState(0)
  const [selected, setSelected] = useState<{ id: string; anchor: DOMRect | null } | null>(null)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [params, setParams] = useSearchParams()
  const events = useDisplayEvents(date)
  const panelCollapsed = useCalendarPrefs((s) => s.panelCollapsed)
  const setPanelCollapsed = useCalendarPrefs((s) => s.setPanelCollapsed)
  const [drawer, setDrawer] = useState(false)
  const drawerRef = useRef(false)
  drawerRef.current = drawer
  const rootRef = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(true)
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => setWide(el.clientWidth >= 1080)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { if (wide) setDrawer(false) }, [wide])

  /* ── query params: ?new=1, ?event=<id> ── */
  useEffect(() => {
    const isNew = params.get('new')
    const eventId = params.get('event')
    if (!isNew && !eventId) return
    if (isNew) setDraft(defaultDraft())
    if (eventId) {
      const holYear = /^hol_(\d{4})-/.exec(eventId)?.[1]
      const ev = useCalendar.getState().events.find((e) => e.id === eventId) ?? (holYear ? holidayEvents([Number(holYear)]).find((e) => e.id === eventId) : undefined)
      if (ev) {
        const d = startOfDay(new Date(ev.start))
        setDate(d)
        if (useCalendarPrefs.getState().view === 'agenda') setView('week')
        setSelected({ id: ev.id, anchor: null })
      } else {
        toast('일정을 찾을 수 없어요', { description: '삭제되었거나 접근할 수 없는 일정이에요.', variant: 'warning' })
      }
    }
    const next = new URLSearchParams(params)
    next.delete('new')
    next.delete('event')
    setParams(next, { replace: true })
  }, [params, setParams, setView])

  const go = useCallback((n: number) => {
    setDir(n)
    setSelected(null)
    setDate((d) => step(useCalendarPrefs.getState().view, d, n))
  }, [])
  const goToday = useCallback(() => {
    const t = startOfDay(new Date())
    setDir(t > date ? 1 : -1)
    setSelected(null)
    setDate(t)
  }, [date])
  const jump = useCallback((d: Date) => {
    setDir(d > date ? 1 : -1)
    setDate(startOfDay(d))
  }, [date])
  const changeView = useCallback((v: CalendarView) => { setSelected(null); setView(v) }, [setView])
  const openNew = useCallback(() => { setSelected(null); setDraft(defaultDraft(date)) }, [date])

  /* ── keyboard shortcuts ── */
  const gAt = useRef(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || (e.repeat && e.code !== 'ArrowLeft' && e.code !== 'ArrowRight')) return
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
      if (e.key === 'Escape' && drawerRef.current && !typing) { setDrawer(false); return }
      if (typing) return
      if (e.metaKey || e.ctrlKey || e.altKey || draft) return
      if (document.querySelector('[role="dialog"]')) return
      const ui = useUI.getState()
      if (ui.call || ui.commandOpen || ui.aiOpen || ui.shortcutsOpen) return
      // Use the physical key so shortcuts also work with the Korean IME active (e.key === 'ㅅ' for T, …)
      const code = e.code
      if (code === 'KeyG' || e.key === 'g') { gAt.current = Date.now(); return }
      if (Date.now() - gAt.current < 1000) { gAt.current = 0; return } // global "g + key" navigation owns this key
      if (e.shiftKey && code !== 'ArrowLeft' && code !== 'ArrowRight') return
      switch (code) {
        case 'KeyT': goToday(); break
        case 'KeyD': changeView('day'); break
        case 'KeyW': changeView('week'); break
        case 'KeyM': changeView('month'); break
        case 'KeyA': changeView('agenda'); break
        case 'KeyN': e.preventDefault(); openNew(); break
        case 'ArrowLeft': e.preventDefault(); go(-1); break
        case 'ArrowRight': e.preventDefault(); go(1); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, goToday, changeView, openNew, go])

  const range = rangeOf(view, date)
  const { title, subtitle } = titleOf(view, date)
  const isCurrent = isWithinInterval(new Date(), range)

  const onEventClick = useCallback((id: string, rect: DOMRect) => setSelected({ id, anchor: rect }), [])
  const onCreate = useCallback((start: Date, end: Date, allDay?: boolean) => {
    setSelected(null)
    setDraft({ start: start.toISOString(), end: end.toISOString(), allDay, attendeeIds: [] })
  }, [])
  const closePopover = useCallback(() => setSelected(null), [])
  const closeModal = useCallback(() => setDraft(null), [])

  const ghost = useMemo(
    () => (draft && !draft.id && !draft.allDay && draft.start && draft.end ? { start: new Date(draft.start), end: new Date(draft.end) } : null),
    [draft],
  )

  const common = { events, onEventClick, onCreate, locked: !!selected }

  const leftPanel = (
    <LeftPanel
      date={date}
      onDate={(d) => { jump(d); if (!wide) setDrawer(false) }}
      events={events}
      range={range}
      onNew={() => { setDrawer(false); openNew() }}
      onEventClick={(id, r) => { if (!wide) setDrawer(false); onEventClick(id, r) }}
    />
  )
  const panelInline = wide && !panelCollapsed

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0">
      <AnimatePresence initial={false}>
        {panelInline && (
          <motion.div
            key="panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 284, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="h-full shrink-0 overflow-hidden border-r border-line/10"
          >
            {leftPanel}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!wide && drawer && (
          <>
            <motion.div
              key="scrim"
              className="absolute inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.div
              key="drawer"
              className="absolute inset-y-0 left-0 z-50 border-r border-line/10 bg-bg/95 shadow-float backdrop-blur-xl"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            >
              {leftPanel}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <main className="flex min-w-0 flex-1 flex-col">
        <CalendarHeader
          panelOpen={wide ? !panelCollapsed : drawer}
          onTogglePanel={() => (wide ? setPanelCollapsed(!panelCollapsed) : setDrawer((v) => !v))}
          showNew={!panelInline}
          view={view}
          onView={changeView}
          title={title}
          subtitle={subtitle}
          dir={dir}
          isCurrent={isCurrent}
          onToday={goToday}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          onNew={openNew}
        />
        <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 8, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {view === 'week' && <WeekView date={date} ghost={ghost} onSelectDay={(d) => { jump(d); changeView('day') }} {...common} />}
              {view === 'day' && <DayView date={date} ghost={ghost} onSelectDay={() => changeView('week')} {...common} />}
              {view === 'month' && <MonthView date={date} onSelectDay={(d) => { jump(d); changeView('day') }} {...common} />}
              {view === 'agenda' && <AgendaView date={date} events={events} onEventClick={onEventClick} />}
              {view === 'team' && (
                <TeamView
                  date={date}
                  onEventClick={onEventClick}
                  onCreate={(start, end, attendeeIds) => { setSelected(null); setDraft({ start: start.toISOString(), end: end.toISOString(), attendeeIds }) }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <EventPopover
        eventId={selected?.id ?? null}
        anchor={selected?.anchor ?? null}
        events={events}
        onClose={closePopover}
        onEdit={(ev) => { setSelected(null); setDraft({ id: ev.id }) }}
        onDuplicated={(copy) => setSelected((s) => ({ id: copy.id, anchor: s?.anchor ?? null }))}
      />
      <EventModal draft={draft} onClose={closeModal} />
    </div>
  )
}
