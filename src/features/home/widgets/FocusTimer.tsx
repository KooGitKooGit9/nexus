import { motion } from 'framer-motion'
import { Coffee, Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { Button, Tabs } from '@/components/ui'
import { toast } from '@/store/core'
import { Ring } from '@/features/goals/components/Ring'
import { FOCUS_DURATION, focusSessionsToday, useHome, type FocusMode } from '../store'
import { useNow } from '../lib'
import { Widget } from '../components/Widget'

export function FocusTimer({ className, delay }: { className?: string; delay?: number }) {
  const mode = useHome((s) => s.focusMode)
  const running = useHome((s) => s.focusRunning)
  const focusEndsAt = useHome((s) => s.focusEndsAt)
  const focusRemaining = useHome((s) => s.focusRemaining)
  const focusSessions = useHome((s) => s.focusSessions)
  const start = useHome((s) => s.startFocus)
  const pause = useHome((s) => s.pauseFocus)
  const reset = useHome((s) => s.resetFocus)
  const now = useNow(running ? 250 : 60_000)
  const remaining = running && focusEndsAt ? Math.max(0, focusEndsAt - now.getTime()) : focusRemaining
  const total = FOCUS_DURATION[mode]
  const pct = ((total - remaining) / total) * 100
  const secs = Math.ceil(remaining / 1000)
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  const sessions = focusSessionsToday(focusSessions)

  const onStart = () => {
    const wasFresh = remaining >= total
    start()
    if (mode === 'focus') {
      toast(wasFresh ? '포커스 모드 시작' : '포커스 모드 재개', { description: '상태가 방해 금지로 변경되었어요 🔕', emoji: '🎧' })
    }
  }
  const onPause = () => pause()
  const onReset = (m?: FocusMode) => reset(m)

  const isFocus = mode === 'focus'

  return (
    <Widget
      className={className}
      delay={delay}
      title="포커스 타이머"
      subtitle={`오늘 ${sessions}세션 완료 · ${sessions * 25}분 집중`}
      icon={<Timer />}
      gradient={isFocus ? 'from-rose-500 to-orange-500' : 'from-emerald-400 to-teal-600'}
      action={
        <Tabs<FocusMode>
          className="shrink-0 whitespace-nowrap"
          size="sm"
          value={mode}
          onChange={(m) => m !== mode && onReset(m)}
          items={[{ value: 'focus', label: '집중' }, { value: 'break', label: '휴식' }]}
        />
      }
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          {running && (
            <motion.div
              className="absolute inset-2 rounded-full blur-2xl"
              style={{ background: isFocus ? 'rgb(244 63 94 / .35)' : 'rgb(52 211 153 / .35)' }}
              animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
          )}
          <Ring value={pct} size={150} stroke={10} from={isFocus ? '#fb7185' : '#34d399'} to={isFocus ? '#f59e0b' : '#22d3ee'}>
            <div className="text-center">
              <div className="font-display text-[34px] font-bold leading-none tabular-nums tracking-tight text-fg">{mm}:{ss}</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted">
                {isFocus ? '🍅 집중 시간' : <><Coffee className="h-3 w-3" /> 휴식 시간</>}
              </div>
            </div>
          </Ring>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {running ? (
            <Button size="sm" variant="secondary" leftIcon={<Pause className="h-4 w-4" />} onClick={onPause}>일시정지</Button>
          ) : (
            <Button size="sm" variant="primary" leftIcon={<Play className="h-4 w-4" />} onClick={onStart}>
              {remaining < total ? '계속' : '시작'}
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" onClick={() => onReset()} title="초기화" aria-label="타이머 초기화" disabled={!running && remaining >= total}><RotateCcw className="h-4 w-4" /></Button>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={i < sessions % 4 || (sessions > 0 && sessions % 4 === 0) ? 'text-sm' : 'text-sm opacity-20 grayscale'}>🍅</span>
          ))}
        </div>
      </div>
    </Widget>
  )
}
