import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Loader2, Terminal, X, XCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import type { LogLine } from './useTestRun'

const toneClass: Record<LogLine['tone'], string> = {
  info: 'text-fg/85',
  success: 'text-success',
  warn: 'text-warning',
  error: 'text-danger',
  muted: 'text-subtle',
  accent: 'text-accent',
}

function ts(ms: number) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

export function RunConsole({ open, logs, running, progress, done, onClose, onRerun, mode = 'dry' }: {
  open: boolean
  logs: LogLine[]
  running: boolean
  progress: number
  done: null | { ok: boolean; ms: number; steps: number }
  onClose: () => void
  onRerun: () => void
  mode?: 'dry' | 'live'
}) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [logs.length])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="absolute inset-x-3 bottom-3 z-20 overflow-hidden rounded-2xl border border-line/10 bg-surface/90 shadow-float backdrop-blur-2xl"
        >
          <div className="relative h-0.5 bg-line/10">
            <motion.div className={cn('absolute inset-y-0 left-0', done ? (done.ok ? 'bg-success' : 'bg-danger') : 'bg-accent-gradient')} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
          </div>
          <div className="flex items-center gap-2 border-b border-line/10 px-4 py-2">
            <Terminal className="h-4 w-4 text-accent" />
            <span className="text-[13px] font-semibold text-fg">실행 로그</span>
            <span className={cn('rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold', mode === 'live' ? 'bg-warning/15 text-warning' : 'bg-accent/10 text-accent')}>
              {mode === 'live' ? '실제 실행' : '테스트 · 부작용 없음'}
            </span>
            {running ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-info/15 px-1.5 py-0.5 text-[11px] font-medium text-info"><Loader2 className="h-3 w-3 animate-spin" />실행 중 {progress}%</span>
            ) : done?.ok ? (
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-medium text-success">
                <CheckCircle2 className="h-3 w-3" />성공 · {(done.ms / 1000).toFixed(2)}초
              </motion.span>
            ) : done ? (
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 rounded-md bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                <XCircle className="h-3 w-3" />실패
              </motion.span>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              {!running && <Button variant="ghost" size="xs" leftIcon={<RotateCcw className="h-3 w-3" />} onClick={onRerun}>테스트 다시 실행</Button>}
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="로그 닫기"><X className="h-4 w-4" /></Button>
            </div>
          </div>
          <div ref={scroller} className="h-44 overflow-y-auto bg-black/[0.06] px-4 py-2.5 font-mono text-[12px] leading-[1.75] dark:bg-black/20">
            {logs.map((l) => (
              <div key={l.id} className="wf-log-line flex gap-3">
                <span className="shrink-0 text-subtle/80">{ts(l.at)}</span>
                <span className={cn('min-w-0 whitespace-pre-wrap break-words', toneClass[l.tone])}>{l.text}</span>
              </div>
            ))}
            {running && <div className="flex gap-1 py-1 pl-[104px]">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-accent animate-typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
