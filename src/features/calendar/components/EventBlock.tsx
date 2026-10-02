import type { PointerEvent as RPointerEvent } from 'react'
import { MapPin, Video } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import { alpha } from '../constants'
import { shortTime } from '../utils'
import type { DisplayEvent } from '../types'

interface Props {
  ev: DisplayEvent
  top: number
  height: number
  left: number // fraction
  width: number // fraction
  isStart?: boolean
  isEnd?: boolean
  dragging?: boolean
  faded?: boolean
  past?: boolean
  /** shown time range override (while dragging) */
  onPointerDown?: (e: RPointerEvent, mode: 'move' | 'resize') => void
}

/** Glassy, color-tinted event block for the time grid. */
export function EventBlock({ ev, top, height, left, width, isStart = true, isEnd = true, dragging, faded, past, onPointerDown }: Props) {
  const c = ev.tint
  const me = getCurrentUserId()
  const myRsvp = ev.rsvp?.[me]
  const pending = !ev.overlayUserId && ev.organizerId !== me && !myRsvp && ev.attendeeIds.includes(me)
  const declined = myRsvp === 'no'
  const tiny = height < 30
  const s = new Date(ev.start)
  const e = new Date(ev.end)

  const bg = ev.overlayUserId
    ? `repeating-linear-gradient(135deg, ${alpha(c, 0.16)} 0 7px, ${alpha(c, 0.07)} 7px 14px)`
    : `linear-gradient(160deg, ${alpha(c, dragging ? 0.38 : 0.26)}, ${alpha(c, dragging ? 0.24 : 0.12)})`

  return (
    <div
      data-event={ev.id}
      onPointerDown={(e) => onPointerDown?.(e, 'move')}
      className={cn(
        'group/ev pointer-events-auto absolute overflow-hidden rounded-[10px] border backdrop-blur-md transition-[box-shadow,filter,opacity] duration-150',
        ev.readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        'hover:z-20 hover:brightness-110',
        dragging && 'z-30 ring-2 ring-white/30',
        faded && 'opacity-35',
        past && !dragging && 'opacity-70',
        declined && 'opacity-50',
        !isStart && 'rounded-t-sm',
        !isEnd && 'rounded-b-sm',
      )}
      style={{
        top,
        height: Math.max(height, 18),
        left: `calc(${left * 100}% + 2px)`,
        width: `calc(${width * 100}% - 5px)`,
        background: bg,
        borderColor: alpha(c, pending ? 0.7 : 0.38),
        borderStyle: pending || ev.overlayUserId ? 'dashed' : 'solid',
        boxShadow: dragging ? `0 18px 40px -12px ${alpha(c, 0.7)}` : `0 6px 18px -12px ${alpha(c, 0.8)}`,
      }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: c, boxShadow: `0 0 10px ${alpha(c, 0.8)}` }} />
      <div className={cn('flex h-full flex-col pl-2.5 pr-1.5', tiny ? 'justify-center py-0' : 'py-1')}>
        {tiny ? (
          <p className="truncate text-[11px] leading-none text-fg">
            <span className={cn('font-semibold', declined && 'line-through')}>{ev.title}</span>
            <span className="ml-1 text-muted">{shortTime(s)}</span>
          </p>
        ) : (
          <>
            <p className={cn('truncate text-[12px] font-semibold leading-tight text-fg', height >= 56 && 'whitespace-normal line-clamp-2', declined && 'line-through')}>
              {ev.title}
            </p>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-muted">
              {shortTime(s)} – {shortTime(e)}
              {ev.videoLink && height < 70 && <Video className="ml-1 inline h-3 w-3 -mt-0.5" style={{ color: c }} />}
            </p>
            {height >= 70 && (ev.location || ev.videoLink) && (
              <p className="mt-1 flex items-center gap-1 truncate text-[10.5px] text-muted">
                {ev.location ? <MapPin className="h-3 w-3 shrink-0" style={{ color: c }} /> : <Video className="h-3 w-3 shrink-0" style={{ color: c }} />}
                <span className="truncate">{ev.location ?? '화상 회의'}</span>
              </p>
            )}
            {height >= 96 && ev.attendeeIds.length > 1 && (
              <div className="mt-auto flex items-center -space-x-1.5 pb-0.5">
                {ev.attendeeIds.slice(0, 4).map((id) => (
                  <Avatar key={id} userId={id} size="xs" ring />
                ))}
                {ev.attendeeIds.length > 4 && <span className="pl-2.5 text-[10px] text-muted">+{ev.attendeeIds.length - 4}</span>}
              </div>
            )}
            {ev.overlayUserId && height >= 44 && (
              <div className="absolute right-1 top-1"><Avatar userId={ev.overlayUserId} size="xs" /></div>
            )}
          </>
        )}
      </div>
      {!ev.readOnly && isEnd && (
        <div
          onPointerDown={(e) => { e.stopPropagation(); onPointerDown?.(e, 'resize') }}
          className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-end justify-center opacity-0 group-hover/ev:opacity-100"
        >
          <span className="mb-0.5 h-1 w-6 rounded-full" style={{ background: alpha(c, 0.9) }} />
        </div>
      )}
    </div>
  )
}

/** Compact pill used in the month grid / all-day row. */
export function EventPill({ ev, filled, onClick, className, continuesBefore, continuesAfter, draggable, onDragStart }: {
  ev: DisplayEvent
  filled?: boolean
  onClick?: (rect: DOMRect) => void
  className?: string
  continuesBefore?: boolean
  continuesAfter?: boolean
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}) {
  const c = ev.tint
  const me = getCurrentUserId()
  const declined = ev.rsvp?.[me] === 'no'
  return (
    <button
      type="button"
      data-event={ev.id}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => { e.stopPropagation(); onClick?.((e.currentTarget as HTMLElement).getBoundingClientRect()) }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'group/pill flex h-[20px] w-full min-w-0 items-center gap-1.5 px-1.5 text-left text-[11px] leading-none transition hover:brightness-110',
        filled ? 'rounded-md border font-medium text-fg' : 'rounded-md hover:bg-line/[0.07] text-fg/90',
        continuesBefore && 'rounded-l-none',
        continuesAfter && 'rounded-r-none',
        declined && 'opacity-50 line-through',
        className,
      )}
      style={filled ? { background: ev.overlayUserId ? `repeating-linear-gradient(135deg, ${alpha(c, 0.22)} 0 6px, ${alpha(c, 0.1)} 6px 12px)` : `linear-gradient(90deg, ${alpha(c, 0.32)}, ${alpha(c, 0.16)})`, borderColor: alpha(c, 0.4) } : undefined}
    >
      {!filled && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${alpha(c, 0.9)}` }} />}
      {filled && !continuesBefore && <span className="h-3 w-[3px] shrink-0 rounded-full" style={{ background: c }} />}
      {!filled && !ev.allDay && <span className="shrink-0 text-muted tabular-nums">{shortTime(ev.start)}</span>}
      <span className="truncate">{ev.title}</span>
    </button>
  )
}
