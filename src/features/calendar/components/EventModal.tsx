import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMinutes, differenceInCalendarDays, endOfDay, format, startOfDay } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, AlignLeft, CalendarClock, Check, Copy, DoorOpen, MapPin, Palette, RefreshCw, Sparkles, Users, Video, Wand2 } from 'lucide-react'
import { Button, Field, Input, Kbd, Modal, Select, Switch, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'
import { toast, useCore } from '@/store/core'
import { isDemoWorkspace } from '@/lib/workspace'
import { useCalendar } from '../store'
import { COLOR_SWATCHES, CREATABLE_TYPES, ROOMS, TYPE_META, alpha } from '../constants'
import { durationLabel, findFreeSlots, fmt, formatRange, generateMeetLink, roomConflict, TIME_OPTIONS, userConflict, type Slot } from '../utils'
import { AttendeePicker } from './AttendeePicker'
import type { CalEvent, EventType } from '../types'

export type EventDraft = Partial<CalEvent> & { id?: string }

interface Props {
  draft: EventDraft | null
  onClose: () => void
  onSaved?: (ev: CalEvent) => void
}

export function EventModal({ draft, onClose, onSaved }: Props) {
  const editing = useCalendar((s) => (draft?.id ? s.events.find((e) => e.id === draft.id) : undefined))
  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      size="xl"
      hideClose
      className="max-w-[880px] overflow-hidden"
    >
      {draft && <EventForm key={draft.id ?? `${draft.start}-${draft.end}`} draft={draft} editing={editing} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  )
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
/** local date + "HH:mm" ("24:00" = midnight at the end of that day) */
const combine = (date: string, time: string) => (time === '24:00' ? addDays(new Date(`${date}T00:00:00`), 1) : new Date(`${date}T${time}:00`))
const MIDNIGHT = { value: '24:00', label: '오전 12:00 (다음 날)' }
const roundUp = (d: Date, step = 30) => new Date(Math.ceil(d.getTime() / (step * 60_000)) * step * 60_000)

function EventForm({ draft, editing, onClose, onSaved }: { draft: EventDraft; editing?: CalEvent; onClose: () => void; onSaved?: (ev: CalEvent) => void }) {
  const me = useCore((s) => s.currentUserId)
  const events = useCalendar((s) => s.events)
  const { createEvent, updateEvent } = useCalendar.getState()
  const src = editing ?? draft

  const initStart = src.start ? new Date(src.start) : roundUp(new Date())
  const initEnd = src.end ? new Date(src.end) : addMinutes(initStart, 60)

  const [title, setTitle] = useState(src.title ?? '')
  const [type, setType] = useState<EventType>(src.type && src.type !== 'holiday' ? src.type : 'meeting')
  const [allDay, setAllDay] = useState(!!src.allDay)
  // a timed event ending exactly at the next midnight is shown as "24:00" on the same day
  const endsAtMidnight = !src.allDay && differenceInCalendarDays(initEnd, initStart) === 1 && initEnd.getHours() === 0 && initEnd.getMinutes() === 0
  const [date, setDate] = useState(format(initStart, 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endsAtMidnight ? initStart : initEnd, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(src.allDay ? '09:00' : fromMin(Math.floor((initStart.getHours() * 60 + initStart.getMinutes()) / 15) * 15))
  const [endTime, setEndTime] = useState(() => {
    if (src.allDay) return '10:00'
    if (endsAtMidnight) return '24:00'
    return fromMin(Math.min(1425, Math.ceil((initEnd.getHours() * 60 + initEnd.getMinutes()) / 15) * 15))
  })
  /** timed event spanning several days (e.g. overnight) */
  const multiDay = !allDay && endDate > date
  const organizerId = editing?.organizerId ?? me
  const [attendeeIds, setAttendeeIds] = useState<string[]>(() => Array.from(new Set([organizerId, ...(src.attendeeIds ?? [])])))
  const [room, setRoom] = useState<string | undefined>(src.room)
  // the meeting rooms + auto-generated meeting links are demo props; real teams type their own place / paste their own link
  const [demo] = useState(isDemoWorkspace)
  const [location, setLocation] = useState(src.location ?? '')
  const [videoLink, setVideoLink] = useState<string | undefined>(src.videoLink)
  const [description, setDescription] = useState(src.description ?? '')
  const [color, setColor] = useState<string | undefined>(src.color)
  const [slotDur, setSlotDur] = useState<30 | 60>(30)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [scanning, setScanning] = useState(false)

  const range = useMemo(() => {
    if (allDay) {
      const s = startOfDay(new Date(`${date}T00:00:00`))
      const e = endOfDay(new Date(`${endDate < date ? date : endDate}T00:00:00`))
      return { start: s, end: e }
    }
    return { start: combine(date, startTime), end: combine(endDate > date ? endDate : date, endTime) }
  }, [allDay, date, endDate, startTime, endTime])

  const durMin = Math.round((range.end.getTime() - range.start.getTime()) / 60_000)
  const myConflict = !allDay ? userConflict(events, me, range.start, range.end, editing?.id) : undefined
  const roomBusy = !allDay && room ? roomConflict(events, room, range.start, range.end, editing?.id) : undefined
  const tint = color ?? TYPE_META[type].color

  const changeStart = (t: string) => {
    setStartTime(t)
    if (multiDay) return
    const d = toMin(endTime) - toMin(startTime)
    setEndTime(fromMin(Math.min(1440, toMin(t) + Math.max(15, d))))
  }
  const changeDate = (v: string) => {
    if (!v) return
    // keep the event's span in days when the start date moves
    const span = Math.max(0, differenceInCalendarDays(new Date(`${endDate}T00:00:00`), new Date(`${date}T00:00:00`)))
    setDate(v)
    setEndDate(format(addDays(new Date(`${v}T00:00:00`), span), 'yyyy-MM-dd'))
  }
  const toggleAllDay = (v: boolean) => {
    setAllDay(v)
    if (!v && endDate > date) { setEndDate(date); if (toMin(endTime) <= toMin(startTime)) setEndTime(fromMin(Math.min(1440, toMin(startTime) + 60))) }
  }
  const endOptions = multiDay
    ? [...TIME_OPTIONS]
    : [...TIME_OPTIONS.filter((o) => toMin(o.value) > toMin(startTime)), MIDNIGHT]

  const scan = () => {
    setScanning(true)
    window.setTimeout(() => {
      const from = new Date(Math.max(Date.now(), startOfDay(new Date(`${date}T00:00:00`)).getTime()))
      setSlots(findFreeSlots(events, { attendeeIds, durationMin: slotDur, from, days: 14, limit: 3, excludeEventId: editing?.id }))
      setScanning(false)
    }, 420)
  }
  useEffect(() => { setSlots(null) }, [attendeeIds.length, slotDur])

  const applySlot = (s: Slot) => {
    setAllDay(false)
    setDate(format(s.start, 'yyyy-MM-dd'))
    setEndDate(format(s.start, 'yyyy-MM-dd'))
    setStartTime(format(s.start, 'HH:mm'))
    setEndTime(format(s.end, 'HH:mm'))
  }

  const pickRoom = (id: string | undefined) => {
    setRoom(id)
    const r = ROOMS.find((x) => x.id === id)
    setLocation(r ? `회의실 ${r.name} (${r.floor})` : '')
  }

  const save = () => {
    if (!allDay && durMin <= 0) { toast('종료 시간이 시작 시간보다 늦어야 해요', { variant: 'warning' }); return }
    if (Number.isNaN(range.start.getTime()) || Number.isNaN(range.end.getTime())) { toast('날짜를 확인해 주세요', { variant: 'warning' }); return }
    const payload = {
      title: title.trim() || '(제목 없음)',
      type,
      allDay: allDay || undefined,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      attendeeIds,
      room,
      location: location.trim() || undefined,
      videoLink,
      description: description.trim() || undefined,
      color,
    }
    let saved: CalEvent
    if (editing) {
      updateEvent(editing.id, payload)
      saved = { ...editing, ...payload }
      toast('일정을 수정했어요', { description: `${saved.title} · ${formatRange(saved)}`, variant: 'success', emoji: '✏️' })
    } else {
      saved = createEvent(payload)
      toast('새 일정이 생성되었어요', { description: `${saved.title} · ${formatRange(saved)}`, variant: 'success', emoji: '🗓️' })
    }
    onSaved?.(saved)
    onClose()
  }
  // ⌘/Ctrl + Enter saves from anywhere in the dialog (even when focus fell back to <body>)
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); saveRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="-mx-6 -mb-5">
      {/* header */}
      <div className="relative overflow-hidden px-6 pb-4 pt-5">
        <div className="pointer-events-none absolute inset-0 transition-colors" style={{ background: `radial-gradient(600px circle at 0% 0%, ${alpha(tint, 0.2)}, transparent 55%)` }} />
        <div className="relative flex items-center gap-2 text-[12px] font-medium text-muted">
          <CalendarClock className="h-4 w-4" style={{ color: tint }} />
          {editing ? '일정 편집' : '새 일정'}
          <span className="ml-auto hidden items-center gap-1 text-subtle sm:flex"><Kbd>⌘</Kbd><Kbd>↵</Kbd> 저장 · <Kbd>esc</Kbd> 닫기</span>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="일정 제목을 입력하세요"
          className="relative mt-2 w-full bg-transparent font-display text-[26px] font-bold tracking-tight text-fg outline-none placeholder:text-subtle/70"
        />
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {CREATABLE_TYPES.map((t) => {
            const m = TYPE_META[t]
            const on = t === type
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn('relative flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition', on ? 'text-fg' : 'border-line/10 text-muted hover:border-line/20 hover:text-fg')}
                style={on ? { borderColor: alpha(m.color, 0.6), background: alpha(m.color, 0.16), boxShadow: `0 0 16px -4px ${alpha(m.color, 0.7)}` } : undefined}
              >
                <span>{m.emoji}</span>
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 border-t border-line/10 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* left column */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-line/10 bg-line/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><CalendarClock className="h-4 w-4 text-muted" />날짜와 시간</span>
              <label className="flex items-center gap-2 text-[12px] text-muted">종일 <Switch size="sm" checked={allDay} onChange={toggleAllDay} /></label>
            </div>
            <div className={cn('grid gap-2', allDay || multiDay ? 'grid-cols-2' : 'grid-cols-[1.2fr_1fr_1fr]')}>
              <Field label={allDay || multiDay ? '시작일' : '날짜'}>
                <Input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
              </Field>
              {allDay ? (
                <Field label="종료일">
                  <Input type="date" value={endDate} min={date} onChange={(e) => e.target.value && setEndDate(e.target.value < date ? date : e.target.value)} />
                </Field>
              ) : (
                <>
                  <Field label="시작">
                    <Select value={startTime} onChange={(e) => changeStart(e.target.value)}>
                      {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </Field>
                  {multiDay && (
                    <Field label="종료일">
                      <Input type="date" value={endDate} min={date} onChange={(e) => e.target.value && setEndDate(e.target.value < date ? date : e.target.value)} />
                    </Field>
                  )}
                  <Field label="종료">
                    <Select value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                      {endOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}{multiDay ? '' : ` (${durationLabel(toMin(o.value) - toMin(startTime))})`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}
            </div>
            <p className="mt-2.5 text-[12px] text-muted">
              {formatRange({ start: range.start.toISOString(), end: range.end.toISOString(), allDay })}
              {!allDay && durMin > 0 && <span className="text-subtle"> · {durationLabel(durMin)}</span>}
            </p>
            <AnimatePresence>
              {myConflict && (
                <motion.p key="me" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex items-center gap-1.5 overflow-hidden text-[12px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />'{myConflict.title}' 일정과 겹쳐요
                </motion.p>
              )}
              {roomBusy && (
                <motion.p key="room" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-1 flex items-center gap-1.5 overflow-hidden text-[12px] text-rose-600 dark:text-rose-400">
                  <DoorOpen className="h-3.5 w-3.5 shrink-0" />선택한 회의실이 이 시간에 '{roomBusy.title}'(으)로 예약되어 있어요
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted"><Users className="h-3.5 w-3.5" />참석자 {attendeeIds.length}명</span>
            <AttendeePicker value={attendeeIds} onChange={setAttendeeIds} organizerId={organizerId} events={events} range={allDay ? null : range} excludeId={editing?.id} />
          </div>

          {/* smart free-time finder */}
          <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-accent/[0.05] p-4">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/25 blur-2xl" />
            <div className="relative flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><Wand2 className="h-4 w-4 text-accent" />빈 시간 찾기</span>
              <span className="text-[11px] text-muted">참석자 {attendeeIds.length}명의 일정을 스캔해요</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="flex rounded-lg bg-line/[0.06] p-0.5">
                  {([30, 60] as const).map((d) => (
                    <button key={d} type="button" onClick={() => setSlotDur(d)} className={cn('rounded-md px-2 py-0.5 text-[11.5px] font-semibold transition', slotDur === d ? 'bg-surface text-fg shadow-card' : 'text-muted')}>
                      {d}분
                    </button>
                  ))}
                </div>
                <Button type="button" size="xs" variant="primary" onClick={scan} loading={scanning} leftIcon={slots ? <RefreshCw className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}>
                  {slots ? '다시 찾기' : '찾기'}
                </Button>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {slots && (
                <motion.div key={slots.map((s) => s.start.getTime()).join()} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative mt-3 flex flex-wrap gap-2">
                  {slots.length ? (
                    slots.map((s, i) => {
                      const active = !allDay && s.start.getTime() === range.start.getTime() && s.end.getTime() === range.end.getTime()
                      return (
                        <motion.button
                          key={s.start.getTime()}
                          type="button"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.08, type: 'spring', stiffness: 420, damping: 26 }}
                          onClick={() => applySlot(s)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px] font-semibold transition',
                            active ? 'border-transparent bg-accent-gradient text-white shadow-glow-sm' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-400/20',
                          )}
                        >
                          {active ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {fmt(s.start, 'M/d (EEE)')} {fmt(s.start, 'a h:mm')}
                        </motion.button>
                      )
                    })
                  ) : (
                    <p className="text-[12px] text-muted">2주 내 근무 시간 중 모두가 비어 있는 시간이 없어요 😢</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Field label={<span className="flex items-center gap-1.5"><AlignLeft className="h-3.5 w-3.5" />설명</span>}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="아젠다, 준비물, 참고 링크를 적어주세요" className="min-h-[84px]" />
          </Field>
        </div>

        {/* right column */}
        <div className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><DoorOpen className="h-3.5 w-3.5" />{demo ? '회의실' : '장소'}</p>
            {demo && <div className="grid grid-cols-2 gap-2">
              {ROOMS.map((r) => {
                const conflict = !allDay ? roomConflict(events, r.id, range.start, range.end, editing?.id) : undefined
                const on = room === r.id
                const tooSmall = attendeeIds.length > r.capacity
                return (
                  <button
                    key={r.id}
                    type="button"
                    title={conflict ? `사용 중: ${conflict.title}` : r.perks}
                    onClick={() => pickRoom(on ? undefined : r.id)}
                    className={cn(
                      'relative rounded-xl border p-2.5 text-left transition',
                      on ? 'border-accent/60 bg-accent/10 shadow-glow-sm' : 'border-line/10 hover:border-line/25 hover:bg-line/[0.04]',
                      conflict && !on && 'opacity-60',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{r.emoji}</span>
                      <span className="text-[13px] font-semibold">{r.name}</span>
                      {on && <Check className="ml-auto h-3.5 w-3.5 text-accent" />}
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-subtle">{r.floor} · {r.capacity}인</p>
                    <p className={cn('mt-1 flex items-center gap-1 text-[10.5px] font-semibold', conflict ? 'text-rose-600 dark:text-rose-400' : tooSmall ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', conflict ? 'bg-rose-400' : tooSmall ? 'bg-amber-400' : 'bg-emerald-400')} />
                      {conflict ? '사용 중' : tooSmall ? '정원 초과' : '예약 가능'}
                    </p>
                  </button>
                )
              })}
            </div>}
            <div className={demo ? 'mt-2' : ''}>
              <Input icon={<MapPin />} value={location} onChange={(e) => { setLocation(e.target.value); setRoom(undefined) }} placeholder={demo ? '또는 장소 직접 입력' : '예: 3층 회의실, 강남역 카페'} />
            </div>
          </div>

          {!demo ? (
            <div className="rounded-2xl border border-line/10 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Video className="h-3.5 w-3.5" />화상 회의 링크</p>
              <Input
                value={videoLink ?? ''}
                onChange={(e) => setVideoLink(e.target.value.trim() ? e.target.value.trim() : undefined)}
                placeholder="Zoom, Google Meet 등 링크 붙여넣기"
              />
              <p className="mt-1.5 text-[11px] text-subtle">메신저의 허들로 바로 통화할 수도 있어요.</p>
            </div>
          ) : (
          <div className="rounded-2xl border border-line/10 p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-2/15 text-accent-2"><Video className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">Nexus Meet 화상 회의</p>
                <p className="truncate text-[11px] text-muted">{videoLink ? videoLink.replace('https://', '') : '링크가 자동으로 생성돼요'}</p>
              </div>
              <Switch size="sm" checked={!!videoLink} onChange={(v) => setVideoLink(v ? generateMeetLink() : undefined)} />
            </div>
            {videoLink && (
              <button type="button" onClick={() => { navigator.clipboard?.writeText(videoLink); toast('링크를 복사했어요', { emoji: '🔗', duration: 1800 }) }} className="mt-2 flex items-center gap-1 text-[11px] font-medium text-accent-2 hover:underline">
                <Copy className="h-3 w-3" />링크 복사
              </button>
            )}
          </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Palette className="h-3.5 w-3.5" />색상</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setColor(undefined)}
                className={cn('flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium transition', !color ? 'border-accent/60 text-fg' : 'border-line/10 text-muted')}
              >
                유형 기본
              </button>
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn('h-7 w-7 rounded-full transition hover:scale-110', color === c && 'ring-2 ring-fg/70 ring-offset-2 ring-offset-surface')}
                  style={{ background: c, boxShadow: `0 0 12px -2px ${alpha(c, 0.7)}` }}
                />
              ))}
            </div>
          </div>

          {/* live preview */}
          <div className="rounded-2xl border border-line/10 p-3">
            <p className="mb-2 text-[11px] font-medium text-subtle">미리보기</p>
            <div className="relative overflow-hidden rounded-[10px] border py-1.5 pl-3 pr-2" style={{ background: `linear-gradient(160deg, ${alpha(tint, 0.26)}, ${alpha(tint, 0.12)})`, borderColor: alpha(tint, 0.4) }}>
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: tint }} />
              <p className="truncate text-[12.5px] font-semibold text-fg">{title || '(제목 없음)'}</p>
              <p className="truncate text-[11px] text-muted">{allDay ? '종일' : `${fmt(range.start, 'a h:mm')} – ${fmt(range.end, 'a h:mm')}`}{location ? ` · ${location}` : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line/10 px-6 py-4">
        {!editing && attendeeIds.length > 1 && <span className="mr-auto text-[11.5px] text-subtle">저장하면 참석자 {attendeeIds.length - 1}명에게 초대가 전송돼요 ✉️</span>}
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="primary" onClick={save} leftIcon={<Check className="h-4 w-4" />}>{editing ? '변경사항 저장' : '일정 만들기'}</Button>
      </div>
    </div>
  )
}

/** Default draft for "new event" — next half hour, 1 hour long. */
export function defaultDraft(base?: Date): EventDraft {
  const now = new Date()
  let start = roundUp(now)
  if (base && startOfDay(base).getTime() !== startOfDay(now).getTime()) start = addMinutes(startOfDay(base), 10 * 60)
  return { start: start.toISOString(), end: addMinutes(start, 60).toISOString(), attendeeIds: [] }
}
