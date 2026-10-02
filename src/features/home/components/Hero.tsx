import { motion } from 'framer-motion'
import { CalendarDays, CheckCircle2, FileSignature, Sparkles, ArrowRight, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/components/ui'
import { useCore, useCurrentUser, useUI } from '@/store/core'
import { formatTime } from '@/lib/utils'
import { friendlyName, greetingFor, mockWeather, useDailyBrief, useNow } from '../lib'
import { Starfield } from './Starfield'
import { useWorkspace } from '@/lib/workspace'

export function Hero() {
  const me = useCurrentUser()
  const now = useNow(1000)
  const g = greetingFor(now)
  // the weather chip is a demo prop (no weather service) — real workspaces don't show invented data
  const demo = useWorkspace().kind === 'demo'
  const w = mockWeather(now)
  const brief = useDailyBrief()
  const reduce = useCore((s) => s.reduceMotion)

  const hh = format(now, 'h')
  const mm = format(now, 'mm')
  const ss = format(now, 'ss')
  const ampm = format(now, 'a', { locale: ko })

  const briefParts: React.ReactNode[] = [
    `오늘 회의 ${brief.meetings}개`,
    `마감 임박 태스크 ${brief.urgent}개`,
    ...(brief.overdue > 0 ? [<span key="od" className="text-danger">지연 태스크 {brief.overdue}개</span>] : []),
    `결재 대기 ${brief.approvals}건`,
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative isolate overflow-hidden rounded-[28px] border border-line/10 bg-surface/60 shadow-card"
    >
      {/* aurora mesh */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className={`absolute -left-[10%] -top-[40%] h-[140%] w-[60%] rounded-full bg-accent/40 blur-[90px] ${reduce ? '' : 'animate-aurora-1'}`} />
        <div className={`absolute right-[-10%] top-[-30%] h-[120%] w-[55%] rounded-full bg-accent-2/30 blur-[100px] ${reduce ? '' : 'animate-aurora-2'}`} />
        <div className={`absolute bottom-[-50%] left-[30%] h-[110%] w-[45%] rounded-full bg-accent-3/25 blur-[100px] ${reduce ? '' : 'animate-aurora-1 [animation-delay:-7s]'}`} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface/40" />
        <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <Starfield className="absolute inset-0" />
      </div>
      <div className="noise absolute inset-0 -z-10" />

      <div className="relative grid gap-8 p-6 sm:p-7 md:p-9 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line/10 bg-surface/50 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(now, 'yyyy년 M월 d일 EEEE', { locale: ko })}
            </span>
            {demo && <span className="inline-flex items-center gap-1.5 rounded-full border border-line/10 bg-surface/50 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
              <span className="text-sm leading-none">{w.emoji}</span>
              {w.city} <span className="font-semibold text-fg">{w.temp}°</span> {w.label}
              <span className="text-subtle">· 최고 {w.high}° 최저 {w.low}°</span>
            </span>}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="mt-5 font-display text-[28px] font-bold leading-tight tracking-tight text-fg break-keep sm:text-3xl md:text-[42px]"
          >
            {g.text}{me?.name ? <>, <span className="gradient-text">{friendlyName(me.name)}</span></> : null}{' '}
            <motion.span className="inline-block origin-bottom" animate={{ rotate: [0, 14, -8, 14, 0] }} transition={{ delay: 0.8, duration: 1.4 }}>
              {g.emoji}
            </motion.span>
          </motion.h1>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }} className="mt-4 flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-gradient text-white shadow-glow-sm">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-[15px] leading-relaxed text-fg/85">
              <span className="font-medium text-muted">오늘의 브리핑 · </span>
              {briefParts.map((p, i) => (
                <span key={i}>{i > 0 && ', '}{p}</span>
              ))}
              {brief.next && (
                <span className="text-muted">
                  {' '}— 다음 일정 <span className="font-medium text-fg">{formatTime(brief.next.start)} · {brief.next.title}</span>
                </span>
              )}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="mt-6 flex flex-wrap items-center gap-2.5">
            <Button variant="primary" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => useUI.getState().askAI('오늘 하루 브리핑해줘')}>
              AI 브리핑 자세히
            </Button>
            <Link to="/calendar">
              <Button variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>오늘 일정 보기</Button>
            </Link>
          </motion.div>
        </div>

        {/* Clock */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative flex min-w-0 flex-col items-start xl:items-end"
        >
          <div className="flex items-baseline gap-1 font-display tabular-nums tracking-tighter text-fg">
            <span className="mr-2 text-lg font-medium text-muted">{ampm}</span>
            <span className="text-6xl font-bold leading-none sm:text-7xl md:text-[88px]">{hh}</span>
            <motion.span
              className="text-6xl font-light leading-none text-muted sm:text-7xl md:text-[88px]"
              animate={reduce ? { opacity: 1 } : { opacity: [1, 0.25, 1] }}
              transition={reduce ? { duration: 0 } : { duration: 1, repeat: Infinity }}
            >
              :
            </motion.span>
            <span className="text-6xl font-bold leading-none gradient-text sm:text-7xl md:text-[88px]">{mm}</span>
            <span className="ml-1 w-8 text-xl font-medium text-subtle">{ss}</span>
          </div>
          <div className="mt-5 grid w-full max-w-md grid-cols-3 gap-2 xl:w-auto">
            <BriefPill icon={<Clock3 />} label="회의" value={brief.meetings} to="/calendar" tone="from-violet-500 to-fuchsia-500" />
            <BriefPill icon={<CheckCircle2 />} label={brief.overdue ? '임박 · 지연' : '마감 임박'} value={brief.urgent + brief.overdue} to="/projects" tone="from-amber-400 to-orange-500" />
            <BriefPill icon={<FileSignature />} label="결재 대기" value={brief.approvals} to="/approvals" tone="from-cyan-400 to-blue-500" />
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}

function BriefPill({ icon, label, value, to, tone }: { icon: React.ReactNode; label: string; value: number; to: string; tone: string }) {
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-line/10 bg-surface/50 px-3 py-2.5 backdrop-blur transition hover:-translate-y-0.5 hover:border-accent/40">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-lg [&>svg]:h-4 [&>svg]:w-4`}>{icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="font-display text-lg font-bold tabular-nums text-fg">{value}</div>
        <div className="truncate text-[11px] text-muted">{label}</div>
      </div>
    </Link>
  )
}
