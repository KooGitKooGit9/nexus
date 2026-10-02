import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, LogOut, Timer } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Card, Tabs } from '@/components/ui'
import { toast } from '@/store/core'
import { cn } from '@/lib/utils'
import { isClockedIn, usePeople, workedMs } from '../store'
import { dateKey, formatDuration, useNow, WORK_MODE_META } from '../lib'
import type { WorkMode } from '../types'

const TARGET_MS = 8 * 3600_000

export function ClockCard() {
  const clock = usePeople((s) => s.clock)
  const clockIn = usePeople((s) => s.clockIn)
  const clockOut = usePeople((s) => s.clockOut)
  const setWorkMode = usePeople((s) => s.setWorkMode)
  const now = useNow(1000)
  const today = clock.date === dateKey(now) ? clock : { ...clock, sessions: [] }
  const working = isClockedIn(today)
  const ms = workedMs(today, now.getTime())
  const pct = Math.min(1, ms / TARGET_MS)
  const first = today.sessions[0]
  const eta = first ? new Date(new Date(first.in).getTime() + 9 * 3600_000) : null

  const onToggle = () => {
    if (working) {
      clockOut()
      toast('퇴근 처리되었습니다', { emoji: '🌙', variant: 'success', description: `오늘 ${formatDuration(ms, false)} 근무했어요. 수고하셨어요!` })
    } else {
      clockIn()
      toast(today.sessions.length ? '업무를 다시 시작합니다' : '출근 완료!', { emoji: '☀️', variant: 'success', description: `${format(new Date(), 'a h:mm', { locale: ko })} · ${WORK_MODE_META[today.mode].label} 근무` })
    }
  }

  const R = 92
  const C = 2 * Math.PI * R

  return (
    <Card spotlight className="flex flex-col items-center gap-5 p-6 lg:flex-row lg:items-center lg:gap-8">
      {/* ring + button */}
      <div className="relative flex h-[220px] w-[220px] shrink-0 items-center justify-center">
        <svg width={220} height={220} className="absolute inset-0 -rotate-90">
          <defs>
            <linearGradient id="clock-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent))" />
              <stop offset="100%" stopColor="rgb(var(--accent-2))" />
            </linearGradient>
          </defs>
          <circle cx={110} cy={110} r={R} strokeWidth={8} className="fill-none stroke-line/10" />
          <motion.circle
            cx={110} cy={110} r={R} strokeWidth={8} fill="none" stroke="url(#clock-ring)" strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C - pct * C }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ filter: 'drop-shadow(0 0 8px rgb(var(--accent) / 0.6))' }}
          />
        </svg>
        {working && (
          <>
            <span className="absolute h-[150px] w-[150px] rounded-full bg-accent/30 animate-pulse-ring" />
            <span className="absolute h-[150px] w-[150px] rounded-full bg-accent-2/20 animate-pulse-ring [animation-delay:0.8s]" />
          </>
        )}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggle}
          className={cn(
            'relative flex h-[150px] w-[150px] flex-col items-center justify-center gap-1.5 rounded-full text-white font-semibold transition-shadow',
            working
              ? 'bg-gradient-to-br from-rose-500 via-fuchsia-500 to-violet-600 shadow-[0_0_60px_-6px_rgba(236,72,153,.75)]'
              : 'bg-accent-gradient-3 shadow-[0_0_60px_-6px_rgb(var(--accent)/.8)]',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={working ? 'out' : 'in'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-1.5"
            >
              {working ? <LogOut className="h-7 w-7" /> : <LogIn className="h-7 w-7" />}
              <span className="text-lg">{working ? '퇴근하기' : today.sessions.length ? '다시 출근' : '출근하기'}</span>
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* timer + details */}
      <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Timer className="h-3.5 w-3.5" />
            오늘의 근무 시간
            <span className={cn('ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', working ? 'bg-emerald-400/15 text-emerald-400' : 'bg-line/10 text-subtle')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', working ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500')} />
              {working ? '근무 중' : today.sessions.length ? '퇴근' : '미출근'}
            </span>
          </div>
          <div className="mt-1 font-display text-5xl font-bold tabular-nums tracking-tight text-fg lg:text-6xl">
            <span className={cn(working && 'gradient-text')}>{formatDuration(ms)}</span>
          </div>
          <div className="mt-1 text-xs text-subtle">
            {format(now, 'yyyy년 M월 d일 EEEE', { locale: ko })} · 목표 8시간 중 {Math.round(pct * 100)}%
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="출근" value={first ? format(new Date(first.in), 'HH:mm') : '--:--'} />
          <Stat label="예상 퇴근" value={eta ? format(eta, 'HH:mm') : '--:--'} />
          <Stat label="세션" value={`${today.sessions.length}회`} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">근무 형태</span>
          <Tabs<Exclude<WorkMode, 'leave'>>
            size="sm"
            value={today.mode}
            onChange={setWorkMode}
            items={(['office', 'remote', 'field'] as const).map((m) => ({ value: m, label: `${WORK_MODE_META[m].emoji} ${WORK_MODE_META[m].label}` }))}
          />
        </div>
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/10 bg-line/[0.03] px-3 py-2">
      <div className="text-[10px] text-subtle">{label}</div>
      <div className="font-display text-lg font-semibold tabular-nums text-fg">{value}</div>
    </div>
  )
}
