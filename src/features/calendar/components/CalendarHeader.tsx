import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Columns3, GanttChart, Keyboard, LayoutGrid, ListTodo, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { Button, Kbd, Popover, Tabs, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { CalendarView } from '../types'

interface Props {
  view: CalendarView
  onView: (v: CalendarView) => void
  title: string
  subtitle?: string
  dir: number
  isCurrent: boolean
  onToday: () => void
  onPrev: () => void
  onNext: () => void
  onNew: () => void
  panelOpen: boolean
  onTogglePanel: () => void
  showNew: boolean
}

const VIEW_ITEMS: { value: CalendarView; label: string; icon: React.ReactNode }[] = [
  { value: 'day', label: '일', icon: <CalendarDays /> },
  { value: 'week', label: '주', icon: <Columns3 /> },
  { value: 'month', label: '월', icon: <LayoutGrid /> },
  { value: 'agenda', label: '일정', icon: <ListTodo /> },
  { value: 'team', label: '팀', icon: <GanttChart /> },
]

const SHORTCUTS: [string, string][] = [
  ['T', '오늘로 이동'],
  ['D', '일 보기'],
  ['W', '주 보기'],
  ['M', '월 보기'],
  ['A', '일정 목록'],
  ['←  →', '이전 / 다음'],
  ['N', '새 일정'],
]

export function CalendarHeader({ view, onView, title, subtitle, dir, isCurrent, onToday, onPrev, onNext, onNew, panelOpen, onTogglePanel, showNew }: Props) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line/10 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-1.5">
        <Tooltip content={panelOpen ? '사이드 패널 닫기' : '사이드 패널 열기'} side="bottom">
          <button
            onClick={onTogglePanel}
            aria-label={panelOpen ? '사이드 패널 닫기' : '사이드 패널 열기'}
            aria-pressed={panelOpen}
            className={cn('rounded-lg p-1.5 text-muted transition hover:bg-line/10 hover:text-fg', panelOpen && 'text-fg')}
          >
            {panelOpen ? <PanelLeftClose className="h-[18px] w-[18px]" /> : <PanelLeftOpen className="h-[18px] w-[18px]" />}
          </button>
        </Tooltip>
        <Button size="sm" variant={isCurrent ? 'secondary' : 'outline'} onClick={onToday} className="relative">
          오늘
          {!isCurrent && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent shadow-glow-sm" />}
        </Button>
        <div className="flex items-center rounded-xl border border-line/10 bg-line/[0.03]">
          <Tooltip content="이전 (←)" side="bottom">
            <button onClick={onPrev} className="rounded-l-xl p-1.5 text-muted transition hover:bg-line/10 hover:text-fg"><ChevronLeft className="h-4 w-4" /></button>
          </Tooltip>
          <span className="h-4 w-px bg-line/10" />
          <Tooltip content="다음 (→)" side="bottom">
            <button onClick={onNext} className="rounded-r-xl p-1.5 text-muted transition hover:bg-line/10 hover:text-fg"><ChevronRight className="h-4 w-4" /></button>
          </Tooltip>
        </div>
      </div>

      <div className="relative min-w-[180px] flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={`${title}|${subtitle ?? ''}`}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 28, filter: 'blur(4px)' }),
              center: { opacity: 1, x: 0, filter: 'blur(0px)' },
              exit: (d: number) => ({ opacity: 0, x: d * -28, filter: 'blur(4px)' }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-w-0 items-baseline gap-2.5"
          >
            <h1 className="shrink-0 whitespace-nowrap font-display text-[22px] font-bold tracking-tight text-fg">{title}</h1>
            {subtitle && <span className="min-w-0 truncate text-[13px] text-muted">{subtitle}</span>}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex max-w-full items-center gap-2">
        <Tabs items={VIEW_ITEMS} value={view} onChange={onView} size="sm" className="min-w-0" />
        <Popover
          placement="bottom-end"
          className="w-56 p-3"
          trigger={({ toggle }) => (
            <Tooltip content="단축키" side="bottom">
              <button onClick={toggle} className="rounded-lg p-2 text-muted transition hover:bg-line/10 hover:text-fg"><Keyboard className="h-4 w-4" /></button>
            </Tooltip>
          )}
        >
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold"><CalendarRange className="h-3.5 w-3.5 text-accent" />캘린더 단축키</p>
          <div className="space-y-1.5">
            {SHORTCUTS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between text-[12px] text-muted">
                {label}
                <Kbd>{k}</Kbd>
              </div>
            ))}
          </div>
        </Popover>
        <Button size="sm" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={onNew} className={cn(!showNew && 'hidden')}>새 일정</Button>
      </div>
    </header>
  )
}
