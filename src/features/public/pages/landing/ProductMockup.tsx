import { motion } from 'framer-motion'
import {
  AtSign, Bell, CalendarDays, CheckCircle2, FileText, FolderOpen, Hash, Headphones, Home, KanbanSquare, MessagesSquare, Mic, Paperclip,
  Search, Send, Smile, Sparkles, Stamp, Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Face, TypingDots } from './ui'

/**
 * "Live-looking" product shot built from real UI pieces (static JSX, fictional demo data — no screenshot).
 * Responsive: chat only on phones, + channel list from md, + right rail from xl.
 */
export function ProductMockup({ reduce }: { reduce: boolean }) {
  const appear = (i: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.9 + i * 0.45, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } }

  return (
    <div className="relative" aria-label="Nexus 메신저 화면 예시" role="img">
      {/* glow */}
      <div aria-hidden className="absolute -inset-x-6 -inset-y-4 -z-10 rounded-[40px] bg-accent-gradient-3 opacity-25 blur-3xl" />

      <div aria-hidden className="overflow-hidden rounded-[22px] border border-line/[0.12] bg-surface/80 shadow-float backdrop-blur-xl">
        {/* window chrome */}
        <div className="flex h-10 items-center gap-3 border-b border-line/[0.08] bg-surface-2/60 px-3.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex h-6 w-full max-w-xs items-center gap-2 rounded-lg border border-line/10 bg-bg/50 px-2.5 text-[11px] text-subtle">
            <Search className="h-3 w-3" />
            <span className="truncate">검색하거나 명령하기</span>
            <span className="ml-auto rounded border border-line/15 px-1 font-mono text-[9px]">⌘K</span>
          </div>
          <Bell className="hidden h-3.5 w-3.5 text-muted sm:block" />
        </div>

        <div className="flex h-[400px] sm:h-[460px]">
          {/* rail */}
          <div className="hidden w-[52px] shrink-0 flex-col items-center gap-1.5 border-r border-line/[0.08] bg-surface-2/40 py-3 sm:flex">
            {[Home, MessagesSquare, KanbanSquare, FileText, CalendarDays, FolderOpen, Workflow, Stamp].map((Icon, i) => (
              <span key={i} className={cn('flex h-8 w-8 items-center justify-center rounded-lg', i === 1 ? 'bg-accent-gradient text-white shadow-glow-sm' : 'text-subtle')}>
                <Icon className="h-4 w-4" />
              </span>
            ))}
            <span className="mt-auto flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent"><Sparkles className="h-4 w-4" /></span>
          </div>

          {/* channels */}
          <div className="hidden w-48 shrink-0 flex-col border-r border-line/[0.08] p-2.5 md:flex">
            <div className="px-2 pb-2 text-[12px] font-semibold">우리 팀</div>
            <div className="px-2 pb-1 pt-1 text-[10px] font-semibold tracking-wide text-subtle">채널</div>
            {[
              { n: '공지', u: 0 },
              { n: '제품팀', u: 0, on: true },
              { n: '디자인', u: 2 },
              { n: '마케팅', u: 0 },
              { n: '잡담', u: 5 },
            ].map((c) => (
              <div key={c.n} className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px]', c.on ? 'bg-accent/15 font-semibold text-fg' : 'text-muted')}>
                <Hash className="h-3 w-3 opacity-70" />
                {c.n}
                {c.u > 0 && <span className="ml-auto rounded-full bg-accent-gradient px-1.5 text-[9px] font-bold text-white">{c.u}</span>}
              </div>
            ))}
            <div className="px-2 pb-1 pt-3 text-[10px] font-semibold tracking-wide text-subtle">다이렉트 메시지</div>
            {['이도윤', '박서연', '최민준'].map((n, i) => (
              <div key={n} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-muted">
                <span className="relative">
                  <Face name={n} size={18} />
                  <span className={cn('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-surface', i === 2 ? 'bg-amber-400' : 'bg-emerald-400')} />
                </span>
                {n}
              </div>
            ))}
            {/* huddle */}
            <div className="mt-auto rounded-xl border border-success/25 bg-success/[0.08] p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-success animate-pulse-ring motion-reduce:animate-none" />
                  <span className="relative h-2 w-2 rounded-full bg-success" />
                </span>
                허들 진행 중
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex -space-x-1.5">
                  {['김하늘', '이도윤', '박서연'].map((n) => <Face key={n} name={n} size={20} ring />)}
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white"><Headphones className="h-3 w-3" /></span>
              </div>
            </div>
          </div>

          {/* chat */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line/[0.08] px-4">
              <Hash className="h-4 w-4 text-muted" />
              <span className="text-[13px] font-semibold">제품팀</span>
              <span className="hidden truncate text-[11px] text-subtle sm:inline">· 3분기 출시 준비</span>
              <span className="ml-auto flex items-center gap-1.5 rounded-full border border-line/10 bg-line/[0.04] px-2 py-0.5 text-[10.5px] text-muted">
                <Headphones className="h-3 w-3 text-success" /> 허들 3명
              </span>
            </div>

            <div className="flex-1 space-y-3.5 overflow-hidden px-4 py-4">
              <motion.div {...appear(0)} className="flex gap-2.5">
                <Face name="이도윤" size={30} />
                <div className="min-w-0">
                  <div className="text-[12px]"><b>이도윤</b> <span className="text-[10.5px] text-subtle">오전 10:12</span></div>
                  <p className="text-[12.5px] leading-snug text-fg/90">3분기 출시 일정 정리했어요. 리뷰 부탁드려요 🙏</p>
                  <div className="mt-1.5 inline-flex items-center gap-2 rounded-xl border border-line/10 bg-line/[0.04] px-2.5 py-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-2/20 text-accent-2"><FileText className="h-3.5 w-3.5" /></span>
                    <span className="text-[11.5px] font-medium">3분기 출시 계획</span>
                    <span className="text-[10px] text-subtle">문서</span>
                  </div>
                </div>
              </motion.div>

              <motion.div {...appear(1)} className="flex gap-2.5">
                <Face name="박서연" size={30} />
                <div className="min-w-0">
                  <div className="text-[12px]"><b>박서연</b> <span className="text-[10.5px] text-subtle">오전 10:14</span></div>
                  <p className="text-[12.5px] leading-snug text-fg/90">
                    좋아요! <span className="rounded bg-accent/15 px-1 font-medium text-accent">@Nexus AI</span> 이거 태스크로 나눠서 금요일 마감으로 잡아줘
                  </p>
                  <div className="mt-1.5 flex gap-1">
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10.5px]">👍 3</span>
                    <span className="rounded-full border border-line/10 px-1.5 py-0.5 text-[10.5px]">🎉 2</span>
                  </div>
                </div>
              </motion.div>

              <motion.div {...appear(2)} className="flex gap-2.5">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-gradient text-white shadow-glow-sm"><Sparkles className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px]"><b>Nexus AI</b> <span className="rounded bg-accent/15 px-1 text-[9.5px] font-semibold text-accent">AI</span></div>
                  <div className="mt-1 max-w-sm rounded-xl border border-accent/25 bg-accent/[0.06] p-2.5">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> 태스크 3개를 만들었어요</div>
                    {['QA 시나리오 작성', '릴리스 노트 초안', '스토어 이미지 교체'].map((t) => (
                      <div key={t} className="mt-1.5 flex items-center gap-2 text-[11.5px] text-fg/85">
                        <span className="h-3 w-3 rounded-[4px] border border-line/25" />
                        <span className="truncate">{t}</span>
                        <span className="ml-auto shrink-0 rounded bg-warning/15 px-1 text-[9.5px] text-warning">금 마감</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div {...appear(3)} className="flex items-center gap-2 pl-10 text-[11px] text-subtle">
                <TypingDots className="text-accent" /> 최민준님이 입력 중…
              </motion.div>
            </div>

            {/* composer */}
            <div className="shrink-0 p-3 pt-0">
              <div className="flex items-center gap-2 rounded-xl border border-line/10 bg-surface-2/70 px-3 py-2">
                <span className="truncate text-[12px] text-subtle">#제품팀에 메시지 보내기</span>
                <span className="ml-auto flex items-center gap-2 text-subtle">
                  <AtSign className="hidden h-3.5 w-3.5 sm:block" /><Paperclip className="hidden h-3.5 w-3.5 sm:block" /><Smile className="h-3.5 w-3.5" /><Mic className="h-3.5 w-3.5" />
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-gradient text-white"><Send className="h-3 w-3" /></span>
                </span>
              </div>
            </div>
          </div>

          {/* right rail */}
          <div className="hidden w-56 shrink-0 flex-col gap-3 border-l border-line/[0.08] p-3 xl:flex">
            <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold"><CalendarDays className="h-3.5 w-3.5 text-accent" /> 오늘 일정</div>
              {[
                { t: '10:00', n: '데일리 스탠드업', c: 'bg-accent' },
                { t: '14:00', n: '디자인 리뷰', c: 'bg-accent-2' },
                { t: '16:30', n: '고객 인터뷰', c: 'bg-accent-3' },
              ].map((e) => (
                <div key={e.n} className="mt-2 flex items-center gap-2 text-[11px]">
                  <span className={cn('h-6 w-1 rounded-full', e.c)} />
                  <span className="font-mono text-[10px] text-subtle">{e.t}</span>
                  <span className="truncate">{e.n}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold"><Stamp className="h-3.5 w-3.5 text-warning" /> 결재 대기</div>
              <div className="mt-2 text-[11.5px] font-medium">출장비 정산 · 부산</div>
              <div className="mt-2 flex items-center gap-1">
                {['박서연', '이도윤', '김하늘'].map((n, i) => (
                  <span key={n} className="flex items-center gap-1">
                    <span className="relative">
                      <Face name={n} size={20} />
                      {i < 2 && <CheckCircle2 className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-surface text-success" />}
                    </span>
                    {i < 2 && <span className="h-px w-3 bg-line/20" />}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="flex items-center gap-1.5"><KanbanSquare className="h-3.5 w-3.5 text-accent-2" /> 3분기 출시</span>
                <span className="text-subtle">68%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/10">
                <motion.div className="h-full rounded-full bg-accent-gradient" initial={reduce ? false : { width: 0 }} animate={{ width: '68%' }} transition={{ delay: 1.2, duration: 1.2, ease: [0.22, 1, 0.36, 1] }} style={reduce ? { width: '68%' } : undefined} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9.5px] text-subtle">
                <span className="rounded bg-line/[0.05] py-1">할 일 4</span>
                <span className="rounded bg-accent/10 py-1 text-accent">진행 6</span>
                <span className="rounded bg-success/10 py-1 text-success">완료 13</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* floating toasts */}
      <motion.div
        aria-hidden
        initial={reduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.6, duration: 0.5 }}
        className="glass-strong absolute -left-6 top-24 hidden items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-float lg:flex"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-success/15 text-success"><Stamp className="h-4 w-4" /></span>
        <span className="text-[12px]"><b className="block">결재가 승인됐어요</b><span className="text-muted">휴가 신청 · 10/14–10/15</span></span>
      </motion.div>
      <motion.div
        aria-hidden
        initial={reduce ? false : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 3.1, duration: 0.5 }}
        className={cn('glass-strong absolute -right-5 bottom-16 hidden items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-float lg:flex', !reduce && 'animate-float motion-reduce:animate-none')}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-gradient text-white"><CalendarDays className="h-4 w-4" /></span>
        <span className="text-[12px]"><b className="block">일정이 추가됐어요</b><span className="text-muted">내일 15:00 · 디자인 리뷰</span></span>
      </motion.div>
    </div>
  )
}
