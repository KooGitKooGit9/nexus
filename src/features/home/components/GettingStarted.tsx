import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CalendarPlus, Check, FolderKanban, Rocket, Sparkles, UserPlus, X } from 'lucide-react'
import { Button, Progress, Tooltip } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useCore, useUI } from '@/store/core'
import { useWorkspace } from '@/lib/workspace'
import { useProjects } from '@/features/projects/store'
import { useCalendar } from '@/features/calendar/store'
import { useAIChat } from '@/app/shell/ai/store'
import { isHuman } from '@/features/people/format'
import { useHome } from '../store'

interface Step {
  id: string
  title: string
  description: string
  icon: ReactNode
  cta: string
  done: boolean
  run: () => void
}

/**
 * First-run checklist for real (non-demo) workspaces. Completion is derived from actual workspace data;
 * hidden once everything is done or the member dismisses it (per-member state in the home store).
 */
export function GettingStarted() {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const me = useCore((s) => s.currentUserId)
  const hasTeammates = useCore((s) => s.users.some((u) => u.id !== me && isHuman(u)))
  const hasProject = useProjects((s) => s.projects.length > 0)
  const hasEvent = useCalendar((s) => s.events.some((e) => e.type !== 'holiday'))
  const talkedToAI = useAIChat((s) => s.conversations.some((c) => c.userId === me && c.messages.some((m) => m.role === 'user')))
  const dismissed = useHome((s) => s.onboardingDismissed)
  const dismiss = useHome((s) => s.dismissOnboarding)

  const steps: Step[] = useMemo(
    () => [
      {
        id: 'invite',
        title: '동료 초대하기',
        description: '이메일이나 초대 링크로 팀원을 불러오세요.',
        icon: <UserPlus />,
        cta: '초대하기',
        done: hasTeammates,
        run: () => navigate('/settings/members'),
      },
      {
        id: 'project',
        title: '첫 프로젝트 만들기',
        description: '할 일을 프로젝트로 묶고 담당자와 마감일을 정해요.',
        icon: <FolderKanban />,
        cta: '만들기',
        done: hasProject,
        run: () => navigate('/projects?new=1'),
      },
      {
        id: 'event',
        title: '일정 추가하기',
        description: '회의나 마감일을 캘린더에 올려 팀과 공유해요.',
        icon: <CalendarPlus />,
        cta: '일정 추가',
        done: hasEvent,
        run: () => navigate('/calendar?new=1'),
      },
      {
        id: 'ai',
        title: 'Nexus AI에게 말 걸기',
        description: '"내일 오후 3시에 팀 회의 잡아줘"처럼 말로 시켜 보세요.',
        icon: <Sparkles />,
        cta: '말 걸기',
        done: talkedToAI,
        // just open the panel — sending a canned request would create things the user didn't ask for
        run: () => useUI.getState().setAiOpen(true),
      },
    ],
    [hasTeammates, hasProject, hasEvent, talkedToAI, navigate],
  )

  const doneCount = steps.filter((s) => s.done).length
  const visible = ws.kind !== 'demo' && !dismissed && doneCount < steps.length
  const next = steps.find((s) => !s.done)

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.section
          key="getting-started"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="glass relative overflow-hidden rounded-2xl"
          aria-label="시작하기"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-accent-2/20 blur-3xl" />

          <div className="relative flex flex-wrap items-start gap-4 px-5 pt-5 sm:px-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm">
              <Rocket className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[17px] font-bold tracking-tight text-fg">
                <span className="gradient-text">{ws.name}</span> 시작하기
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {doneCount === 0 ? '네 단계만 마치면 팀이 Nexus에서 함께 일할 준비가 끝나요.' : `${steps.length}단계 중 ${doneCount}단계 완료 — 거의 다 왔어요!`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {next && (
                <Button size="sm" variant="primary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={next.run} className="hidden sm:inline-flex">
                  다음: {next.title}
                </Button>
              )}
              <Tooltip content="시작하기 숨기기">
                <button onClick={dismiss} aria-label="시작하기 숨기기" className="rounded-lg p-1.5 text-subtle transition hover:bg-line/10 hover:text-fg">
                  <X className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="relative px-5 pt-4 sm:px-6">
            <Progress value={(doneCount / steps.length) * 100} size="sm" />
          </div>

          <ol className="relative grid gap-2 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={s.run}
                  className={cn(
                    'group flex h-full w-full items-start gap-3 rounded-xl border p-3 text-left transition focus-ring',
                    s.done ? 'border-success/20 bg-success/[0.05]' : 'border-line/10 bg-surface/40 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/[0.06]',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4',
                      s.done ? 'bg-success text-white' : 'bg-line/[0.07] text-muted group-hover:bg-accent/15 group-hover:text-accent',
                    )}
                  >
                    {s.done ? <Check /> : s.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[13px] font-semibold', s.done ? 'text-muted line-through decoration-success/50' : 'text-fg')}>
                      <span className="mr-1 text-subtle tabular-nums">{i + 1}.</span>
                      {s.title}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-subtle">{s.done ? '완료했어요' : s.description}</span>
                    {!s.done && <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11.5px] font-medium text-accent">{s.cta} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
