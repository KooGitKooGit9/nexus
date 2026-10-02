import { motion } from 'framer-motion'
import {
  ArrowRight, Bell, CalendarDays, FileText, FolderOpen, KanbanSquare, Megaphone, MessagesSquare, PenTool, Search, Sparkles, Stamp, Target, Video, Workflow,
  type LucideIcon,
} from 'lucide-react'
import { BRAND } from '@/config/brand'
import { cn } from '@/lib/utils'
import { LogoMark } from '../../components/Logo'
import { Reveal, Section } from './ui'

/** Kinds of tools teams typically juggle — generic categories only (no competitor names). */
const TOOLS: { label: string; icon: LucideIcon; color: string }[] = [
  { label: '메신저', icon: MessagesSquare, color: 'text-accent' },
  { label: '화상회의', icon: Video, color: 'text-accent-2' },
  { label: '프로젝트 관리', icon: KanbanSquare, color: 'text-info' },
  { label: '문서 · 위키', icon: FileText, color: 'text-accent-3' },
  { label: '캘린더', icon: CalendarDays, color: 'text-success' },
  { label: '파일 드라이브', icon: FolderOpen, color: 'text-warning' },
  { label: '화이트보드', icon: PenTool, color: 'text-accent' },
  { label: '업무 자동화', icon: Workflow, color: 'text-accent-2' },
  { label: '전자결재', icon: Stamp, color: 'text-danger' },
  { label: 'OKR · 목표', icon: Target, color: 'text-success' },
  { label: '사내 공지', icon: Megaphone, color: 'text-warning' },
  { label: 'AI 비서', icon: Sparkles, color: 'text-accent-3' },
]

export function Consolidation({ reduce }: { reduce: boolean }) {
  const n = TOOLS.length
  return (
    <Section
      eyebrow={<><Sparkles />도구 정리</>}
      title={<>도구 <span className="gradient-text">{n}개</span>를 <span className="gradient-text">1개</span>로</>}
      lead="로그인 열두 번, 알림함 열두 군데, 같은 내용을 여기저기 다시 붙여넣던 일. 이제 하나의 워크스페이스에서 대화하고, 계획하고, 결정하세요."
    >
      <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
        {/* before */}
        <Reveal>
          <div className="rounded-3xl border border-dashed border-line/15 bg-surface/30 p-5">
            <div className="mb-4 flex items-center justify-between text-[12.5px] font-semibold text-subtle">
              <span>지금까지</span>
              <span className="rounded-full bg-line/[0.06] px-2 py-0.5">탭 {n}개</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TOOLS.map((t, i) => (
                <motion.div
                  key={t.label}
                  initial={reduce ? false : { opacity: 0, scale: 0.9, rotate: (i % 2 ? 1 : -1) * 3 }}
                  whileInView={{ opacity: 1, scale: 1, rotate: (i % 3) - 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-line/10 bg-surface/70 px-2.5 py-2 text-[12.5px] text-muted shadow-card"
                >
                  <t.icon className={cn('h-4 w-4 shrink-0', t.color)} />
                  <span className="truncate">{t.label}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11.5px] text-subtle">
              <span className="rounded-lg bg-line/[0.04] py-1.5">로그인 {n}번</span>
              <span className="rounded-lg bg-line/[0.04] py-1.5">알림함 {n}곳</span>
              <span className="rounded-lg bg-line/[0.04] py-1.5">검색창 {n}개</span>
            </div>
          </div>
        </Reveal>

        <div className="flex justify-center" aria-hidden>
          <span className="flex h-12 w-12 rotate-90 items-center justify-center rounded-full border border-line/10 bg-surface/70 text-accent shadow-glow-sm lg:rotate-0">
            <ArrowRight className="h-5 w-5" />
          </span>
        </div>

        {/* after */}
        <Reveal delay={0.15}>
          <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-surface/60 p-6 shadow-glow backdrop-blur">
            <div aria-hidden className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
            <div className="relative mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center">
              {/* orbit */}
              <div aria-hidden className="absolute inset-0 rounded-full border border-dashed border-line/15" />
              <div aria-hidden className="absolute inset-[18%] rounded-full border border-line/10" />
              <div
                aria-hidden
                className="absolute inset-0"
                style={reduce ? undefined : { animation: 'spin 60s linear infinite' }}
              >
                {TOOLS.map((t, i) => {
                  const a = (i / n) * 2 * Math.PI
                  return (
                    <span
                      key={t.label}
                      className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-line/10 bg-surface shadow-card"
                      style={{ left: `${50 + 46 * Math.cos(a)}%`, top: `${50 + 46 * Math.sin(a)}%` }}
                    >
                      <span className="flex" style={reduce ? undefined : { animation: 'spin 60s linear infinite reverse' }}>
                        <t.icon className={cn('h-4 w-4', t.color)} />
                      </span>
                    </span>
                  )
                })}
              </div>
              <div className="relative flex flex-col items-center">
                <LogoMark size={72} />
                <div className="mt-3 font-display text-xl font-bold">{BRAND.name}</div>
              </div>
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-2 text-center text-[11.5px] font-medium">
              <span className="rounded-lg bg-accent/10 py-1.5 text-accent">로그인 1번</span>
              <span className="flex items-center justify-center gap-1 rounded-lg bg-accent/10 py-1.5 text-accent"><Bell className="h-3 w-3" />알림함 1곳</span>
              <span className="flex items-center justify-center gap-1 rounded-lg bg-accent/10 py-1.5 text-accent"><Search className="h-3 w-3" />⌘K 통합 검색</span>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
