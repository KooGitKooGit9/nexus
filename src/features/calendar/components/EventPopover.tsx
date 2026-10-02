import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlignLeft, Copy, ExternalLink, MapPin, Pencil, Trash2, Users, Video, X, Clock3, Lock } from 'lucide-react'
import { Avatar, Badge, Button, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'
import { getUser, toast, useCore, useUI } from '@/store/core'
import { useCalendar } from '../store'
import { TYPE_META, alpha, roomById } from '../constants'
import { durationLabel, eventDuration, formatRange, isAllDayLike, relativeStart } from '../utils'
import { RSVP_META, RsvpDot } from './Rsvp'
import type { CalEvent, DisplayEvent, RsvpStatus } from '../types'

interface Props {
  eventId: string | null
  anchor: DOMRect | null
  events: DisplayEvent[]
  onClose: () => void
  onEdit: (ev: CalEvent) => void
  onDuplicated?: (ev: CalEvent) => void
}

const W = 384

export function EventPopover({ eventId, anchor, events, onClose, onEdit, onDuplicated }: Props) {
  const stored = useCalendar((s) => s.events.find((e) => e.id === eventId))
  const ev: CalEvent | undefined = stored ?? events.find((e) => e.id === eventId)
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const hasEv = !!ev
  useLayoutEffect(() => {
    if (!hasEv) return
    const place = () => {
      const h = panel.current?.offsetHeight ?? 420
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(W, vw - 24)
      if (!anchor) { setPos({ top: Math.max(12, (vh - h) / 2), left: Math.max(12, (vw - w) / 2) }); return }
      let left = anchor.right + 10
      if (left + w > vw - 12) left = anchor.left - w - 10
      if (left < 12) left = Math.min(Math.max(12, anchor.left + anchor.width / 2 - w / 2), vw - w - 12)
      let top = anchor.top
      if (top + h > vh - 12) top = vh - h - 12
      setPos({ top: Math.max(12, top), left: Math.max(12, left) })
    }
    place()
    // re-place when the content grows (delete confirm, RSVP) or the window resizes
    const ro = new ResizeObserver(place)
    if (panel.current) ro.observe(panel.current)
    window.addEventListener('resize', place)
    return () => { ro.disconnect(); window.removeEventListener('resize', place) }
  }, [hasEv, anchor, eventId])

  useEffect(() => {
    if (!eventId) return
    const onDown = (e: MouseEvent) => {
      if (panel.current?.contains(e.target as Node)) return
      if ((e.target as HTMLElement).closest?.('[role="dialog"]')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const t = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(t); document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [eventId, onClose])

  return createPortal(
    <AnimatePresence>
      {ev && (
        <motion.div
          ref={panel}
          key={ev.id}
          initial={{ opacity: 0, scale: 0.95, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 4 }}
          transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          className="fixed z-[75] overflow-hidden rounded-3xl glass-strong shadow-float"
          style={{ width: `min(${W}px, calc(100vw - 24px))`, top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxHeight: 'calc(100vh - 24px)' }}
        >
          <PopoverBody ev={ev} onClose={onClose} onEdit={onEdit} onDuplicated={onDuplicated} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function PopoverBody({ ev, onClose, onEdit, onDuplicated }: { ev: CalEvent; onClose: () => void; onEdit: (ev: CalEvent) => void; onDuplicated?: (ev: CalEvent) => void }) {
  const me = useCore((s) => s.currentUserId)
  const { setRsvp, deleteEvent, duplicateEvent } = useCalendar.getState()
  const [confirmDel, setConfirmDel] = useState(false)
  const meta = TYPE_META[ev.type]
  const c = ev.color ?? meta.color
  const readOnly = ev.type === 'holiday'
  // teammates' events shown via overlay can be viewed (and copied) but not edited/deleted
  const canEdit = !readOnly && (ev.organizerId === me || ev.attendeeIds.includes(me))
  const myRsvp = ev.rsvp?.[me]
  const isAttendee = ev.attendeeIds.includes(me)
  const counts = { yes: 0, maybe: 0, no: 0, none: 0 }
  ev.attendeeIds.forEach((u) => { counts[(ev.rsvp?.[u] ?? 'none') as keyof typeof counts]++ })
  const room = roomById(ev.room)
  const organizer = getUser(ev.organizerId)
  const live = new Date(ev.start) <= new Date() && new Date(ev.end) > new Date()
  const allDay = isAllDayLike(ev)

  // demo links (meet.nexus.app) are placeholders → in-app call; anything else is a real link the user pasted
  const internalMeet = /^https:\/\/meet\.nexus\.app\//.test(ev.videoLink ?? '')
  const join = () => {
    if (ev.videoLink && !internalMeet && /^https?:\/\//i.test(ev.videoLink)) window.open(ev.videoLink, '_blank', 'noopener,noreferrer')
    else useUI.getState().startCall({ title: ev.title, participantIds: ev.attendeeIds, video: true })
    onClose()
  }
  const rsvp = (s: RsvpStatus) => {
    setRsvp(ev.id, me, s)
    toast(`'${ev.title}' ${RSVP_META[s].label}으로 응답했어요`, { variant: s === 'no' ? 'warning' : 'success', emoji: s === 'yes' ? '✅' : s === 'maybe' ? '🤔' : '🙅', duration: 2400 })
  }
  const remove = () => {
    const snapshot = ev
    deleteEvent(ev.id)
    onClose()
    toast('일정을 삭제했어요', { description: snapshot.title, variant: 'default', emoji: '🗑️' })
  }
  const duplicate = () => {
    const copy = duplicateEvent(ev.id)
    if (copy) { toast('일정을 복제했어요', { description: copy.title, variant: 'success', emoji: '📋' }); onDuplicated?.(copy) }
  }

  return (
    <div className="flex max-h-[inherit] flex-col">
      {/* hero */}
      <div className="relative overflow-hidden px-5 pb-4 pt-4">
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(420px circle at 0% 0%, ${alpha(c, 0.28)}, transparent 60%)` }} />
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl" style={{ background: alpha(c, 0.35) }} />
        <div className="relative flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge className="border-transparent" icon={<span>{meta.emoji}</span>}>
              <span style={{ color: c }}>{meta.label}</span>
            </Badge>
            {live && <Badge tone="danger" dot>진행 중</Badge>}
            {!live && !allDay && new Date(ev.start) > new Date() && <span className="text-[11px] text-muted">{relativeStart(ev)}</span>}
          </div>
          <div className="-mr-2 -mt-1 flex items-center">
            {!readOnly && (
              <>
                {canEdit && <Tooltip side="bottom" content="편집"><button onClick={() => onEdit(ev)} className="rounded-lg p-1.5 text-muted transition hover:bg-line/10 hover:text-fg"><Pencil className="h-4 w-4" /></button></Tooltip>}
                <Tooltip side="bottom" content={canEdit ? '복제' : '내 캘린더로 복사'}><button onClick={duplicate} className="rounded-lg p-1.5 text-muted transition hover:bg-line/10 hover:text-fg"><Copy className="h-4 w-4" /></button></Tooltip>
                {canEdit && <Tooltip side="bottom" content="삭제"><button onClick={() => setConfirmDel(true)} className="rounded-lg p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button></Tooltip>}
              </>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-line/10 hover:text-fg"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <h3 className="relative mt-2 flex items-start gap-2.5 text-[19px] font-bold leading-snug tracking-tight text-fg">
          <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-[5px]" style={{ background: c, boxShadow: `0 0 12px ${alpha(c, 0.8)}` }} />
          {ev.title}
        </h3>
        <p className="relative mt-1.5 flex items-center gap-1.5 pl-6 text-[13px] text-muted">
          <Clock3 className="h-3.5 w-3.5" />
          {formatRange(ev)}
          {!allDay && <span className="text-subtle">· {durationLabel(eventDuration(ev))}</span>}
        </p>
      </div>

      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[12.5px]">
              <span className="flex-1 text-fg">이 일정을 삭제할까요?</span>
              <Button size="xs" variant="ghost" onClick={() => setConfirmDel(false)}>취소</Button>
              <Button size="xs" variant="danger" onClick={remove}>삭제</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3.5 overflow-y-auto px-5 pb-4">
        {(ev.location || room) && (
          <Row icon={<MapPin className="h-4 w-4" />}>
            <p className="text-[13px] text-fg">{ev.location}</p>
            {room && <p className="text-[11px] text-subtle">{room.emoji} {room.capacity}인 · {room.perks}</p>}
          </Row>
        )}
        {ev.videoLink && (
          <Row icon={<Video className="h-4 w-4" />}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-fg">{internalMeet ? 'Nexus Meet 화상 회의' : '화상 회의'}</p>
                <a href={/^https?:\/\//i.test(ev.videoLink) ? ev.videoLink : undefined} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!internalMeet) return; e.preventDefault(); navigator.clipboard?.writeText(ev.videoLink!); toast('회의 링크를 복사했어요', { emoji: '🔗', duration: 2000 }) }} className="flex items-center gap-1 truncate text-[11px] text-accent-2 hover:underline">
                  {ev.videoLink.replace('https://', '')}<ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Button size="sm" variant="primary" leftIcon={<Video className="h-3.5 w-3.5" />} onClick={join} className={cn(live && 'animate-pulse')}>참여하기</Button>
            </div>
          </Row>
        )}
        {ev.attendeeIds.length > 0 && !readOnly && (
          <Row icon={<Users className="h-4 w-4" />}>
            <p className="text-[13px] font-medium text-fg">참석자 {ev.attendeeIds.length}명</p>
            <p className="mb-2 text-[11px] text-subtle">참석 {counts.yes} · 미정 {counts.maybe} · 불참 {counts.no}{counts.none ? ` · 대기 ${counts.none}` : ''}</p>
            <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
              {[...ev.attendeeIds].sort((a, b) => (a === ev.organizerId ? -1 : b === ev.organizerId ? 1 : 0)).map((id) => {
                const u = getUser(id)
                const st = ev.rsvp?.[id]
                return (
                  <div key={id} className="flex items-center gap-2.5 rounded-lg px-1 py-0.5">
                    <div className="relative">
                      <Avatar userId={id} size="sm" />
                      <RsvpDot status={st} className="absolute -bottom-1 -right-1" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[12.5px] text-fg', st === 'no' && 'text-muted line-through')}>
                        {u?.name ?? '나간 멤버'}{id === me && <span className="ml-1 text-[10px] text-accent">(나)</span>}
                      </p>
                      <p className="truncate text-[10.5px] text-subtle">{id === ev.organizerId ? '주최자' : u?.title}</p>
                    </div>
                    <span className={cn('text-[10.5px]', st === 'yes' ? 'text-emerald-600 dark:text-emerald-400' : st === 'no' ? 'text-rose-600 dark:text-rose-400' : st === 'maybe' ? 'text-amber-700 dark:text-amber-400' : 'text-subtle')}>{RSVP_META[st ?? 'none'].label}</span>
                  </div>
                )
              })}
            </div>
          </Row>
        )}
        {ev.description && (
          <Row icon={<AlignLeft className="h-4 w-4" />}>
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-muted">{ev.description}</p>
          </Row>
        )}
        {readOnly && (
          <Row icon={<Lock className="h-4 w-4" />}>
            <p className="text-[12px] text-subtle">공휴일 캘린더 · 읽기 전용</p>
          </Row>
        )}
        {!readOnly && organizer && ev.organizerId !== me && !ev.attendeeIds.includes(me) && (
          <p className="rounded-lg bg-line/[0.05] px-3 py-2 text-[11.5px] text-muted">👀 {organizer.name}님의 캘린더에서 보고 있어요</p>
        )}
      </div>

      {isAttendee && !readOnly && (
        <div className="flex items-center gap-2 border-t border-line/10 px-5 py-3">
          <span className="text-[12px] font-medium text-muted">참석 여부</span>
          <div className="ml-auto flex gap-1 rounded-xl bg-line/[0.05] p-1">
            {(['yes', 'maybe', 'no'] as RsvpStatus[]).map((s) => {
              const m = RSVP_META[s]
              const Icon = m.icon
              const active = myRsvp === s
              return (
                <button
                  key={s}
                  onClick={() => rsvp(s)}
                  className={cn('relative flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition', active ? m.text : 'text-muted hover:text-fg')}
                >
                  {active && <motion.span layoutId={`rsvp-${ev.id}`} className={cn('absolute inset-0 rounded-lg border', m.cls)} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                  <Icon className="relative h-3.5 w-3.5" strokeWidth={2.6} />
                  <span className="relative">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-subtle">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
