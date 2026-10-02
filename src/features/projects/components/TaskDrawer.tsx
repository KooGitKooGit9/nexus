import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Sparkles, Link2, Trash2, Eye, Pencil, Plus, X, Send, MessageSquare, History, ListChecks, CircleDot, Flag, Users, Tag, CalendarDays, CalendarClock, Gauge, UserRound, FolderKanban, MoreHorizontal, Check,
} from 'lucide-react'
import { Avatar, Button, Checkbox, Drawer, Menu, Popover, Progress, UnderlineTabs, Kbd } from '@/components/ui'
import { getUser, toast, useCore, useUI } from '@/store/core'
import { cn, timeAgo, formatDate } from '@/lib/utils'
import type { Task } from '../types'
import { PRIORITY_META, STATUS_META, isOverdue } from '../constants'
import { useProjects } from '../store'
import { useTaskParams } from '../hooks'
import { AssigneePicker, ChipButton, DateInput, LabelChip, LabelPicker, PriorityIcon, PriorityPicker, StatusIcon, StatusPicker } from './atoms'
import { Markdown } from './Markdown'

export function TaskDrawer() {
  const { taskId, closeTask } = useTaskParams()
  const task = useProjects((s) => (taskId ? s.tasks.find((t) => t.id === taskId) : undefined))
  // keep last task around during exit animation
  const last = useRef<Task | undefined>(undefined)
  if (task) last.current = task
  const shown = task ?? last.current
  const project = useProjects((s) => s.projects.find((p) => p.id === shown?.projectId))
  const deleteTask = useProjects((s) => s.deleteTask)
  const [confirmDel, setConfirmDel] = useState(false)

  if (!shown) return <Drawer open={false} onClose={closeTask} />
  const key = `${project?.key ?? 'T'}-${shown.number}`

  const copyLink = () => {
    const url = `${location.origin}/projects/${shown.projectId}?task=${shown.id}`
    navigator.clipboard?.writeText(url).catch(() => {})
    toast('링크를 복사했습니다', { description: key, variant: 'success', emoji: '🔗' })
  }
  const askAI = () => {
    const subs = shown.subtasks.map((s) => `- [${s.done ? 'x' : ' '}] ${s.title}`).join('\n')
    const comments = shown.comments.map((c) => `- ${getUser(c.userId)?.name}: ${c.text}`).join('\n')
    useUI.getState().askAI(
      `다음 태스크를 3줄로 요약하고, 리스크와 다음 액션을 제안해줘.\n\n[${key}] ${shown.title}\n상태: ${STATUS_META[shown.status].label} · 우선순위: ${PRIORITY_META[shown.priority].label}` +
        `${shown.dueDate ? ` · 마감: ${formatDate(shown.dueDate, 'M월 d일')}` : ''}\n담당자: ${shown.assigneeIds.map((a) => getUser(a)?.name).join(', ') || '없음'}` +
        `${shown.description ? `\n\n설명:\n${shown.description}` : ''}${subs ? `\n\n하위 작업:\n${subs}` : ''}${comments ? `\n\n댓글:\n${comments}` : ''}`,
    )
  }
  const remove = () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500); return }
    closeTask()
    deleteTask(shown.id)
    setConfirmDel(false)
    toast('태스크를 삭제했습니다', { description: `${key} ${shown.title}`, variant: 'warning' })
  }

  return (
    <Drawer
      open={!!task}
      onClose={closeTask}
      width={680}
      title={
        <div className="flex min-w-0 items-center gap-2.5">
          {project && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: `${project.color}26`, boxShadow: `0 0 16px -4px ${project.color}` }}>{project.emoji}</span>
          )}
          <span className="hidden min-w-0 truncate text-[13px] text-muted sm:inline">{project?.name}</span>
          <span className="hidden text-subtle sm:inline">/</span>
          <span className="shrink-0 font-mono text-[13px] text-fg">{key}</span>
          <div className="ml-auto flex shrink-0 items-center gap-1 pr-1">
            <Button size="xs" variant="primary" className="hidden sm:inline-flex" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={askAI}>AI로 요약</Button>
            <Button size="icon-sm" variant="ghost" onClick={copyLink} title="링크 복사"><Link2 className="h-4 w-4" /></Button>
            <Menu
              trigger={<Button size="icon-sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>}
              items={[
                { label: '링크 복사', icon: <Link2 />, onClick: copyLink },
                { label: 'AI로 요약', icon: <Sparkles />, onClick: askAI },
                { divider: true, label: '' },
                { label: '태스크 삭제', icon: <Trash2 />, danger: true, onClick: () => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); toast('아래 삭제 버튼을 한 번 더 누르면 삭제됩니다', { variant: 'warning' }) } },
              ]}
            />
          </div>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[11.5px] text-subtle">
          <span className="min-w-0">{getUser(shown.reporterId)?.name}님이 {timeAgo(shown.createdAt)} 생성 · 업데이트 {timeAgo(shown.updatedAt)}</span>
          <button onClick={remove} className={cn('ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 transition', confirmDel ? 'bg-danger/15 text-danger' : 'hover:bg-danger/10 hover:text-danger')}>
            <Trash2 className="h-3.5 w-3.5" />{confirmDel ? '한 번 더 누르면 삭제됩니다' : '삭제'}
          </button>
        </div>
      }
    >
      {task && <DrawerBody key={task.id} task={task} />}
    </Drawer>
  )
}

function Prop({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <>
      <div className="flex h-8 items-center gap-2 whitespace-nowrap text-[12.5px] text-subtle [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0">{icon}{label}</div>
      <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-1">{children}</div>
    </>
  )
}

function DrawerBody({ task }: { task: Task }) {
  const navigate = useNavigate()
  const update = useProjects((s) => s.updateTask)
  const projects = useProjects((s) => s.projects)
  const project = projects.find((p) => p.id === task.projectId)
  const [title, setTitle] = useState(task.title)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setTitle(task.title), [task.title])
  useEffect(() => {
    const el = titleRef.current
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }, [title])

  const overdue = isOverdue(task)

  return (
    <div className="px-4 py-5 sm:px-6">
      <textarea
        ref={titleRef}
        rows={1}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const next = title.trim()
          if (!next) { setTitle(task.title); return } // empty title → revert
          if (next !== task.title) update(task.id, { title: next })
          else if (next !== title) setTitle(next)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
        className="w-full resize-none overflow-hidden bg-transparent font-display text-[22px] font-bold leading-snug tracking-tight text-fg outline-none placeholder:text-subtle"
        placeholder="태스크 제목"
      />

      {/* Properties */}
      <div className="mt-4 grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-2xl sm:grid-cols-[120px_minmax(0,1fr)] border border-line/[0.07] bg-line/[0.02] p-3">
        <Prop icon={<CircleDot />} label="상태">
          <StatusPicker value={task.status} onChange={(status) => update(task.id, { status })} trigger={({ toggle }) => (
            <ChipButton onClick={toggle}><StatusIcon status={task.status} />{STATUS_META[task.status].label}</ChipButton>
          )} />
        </Prop>
        <Prop icon={<Flag />} label="우선순위">
          <PriorityPicker value={task.priority} onChange={(priority) => update(task.id, { priority })} trigger={({ toggle }) => (
            <ChipButton onClick={toggle}><PriorityIcon priority={task.priority} className="text-fg" />{PRIORITY_META[task.priority].label}</ChipButton>
          )} />
        </Prop>
        <Prop icon={<Users />} label="담당자">
          <AssigneePicker value={task.assigneeIds} candidateIds={project?.memberIds} onChange={(assigneeIds) => update(task.id, { assigneeIds })} trigger={({ toggle }) => (
            <ChipButton onClick={toggle} className="h-auto min-h-8 max-w-full flex-wrap py-1">
              {task.assigneeIds.length ? (
                task.assigneeIds.map((id) => (
                  <span key={id} className="flex items-center gap-1.5 pr-1"><Avatar userId={id} size="xs" />{getUser(id)?.name}</span>
                ))
              ) : <span className="text-subtle">담당자 지정</span>}
            </ChipButton>
          )} />
        </Prop>
        <Prop icon={<Tag />} label="라벨">
          {task.labels.map((l) => <LabelChip key={l} label={l} onRemove={() => update(task.id, { labels: task.labels.filter((x) => x !== l) })} />)}
          <LabelPicker value={task.labels} onChange={(labels) => update(task.id, { labels })} trigger={({ toggle }) => (
            <button onClick={toggle} className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] text-subtle transition hover:bg-line/[0.07] hover:text-fg"><Plus className="h-3 w-3" />추가</button>
          )} />
        </Prop>
        <Prop icon={<CalendarDays />} label="시작일">
          <DateInput value={task.startDate} onChange={(v) => update(task.id, { startDate: v })} />
        </Prop>
        <Prop icon={<CalendarClock />} label="마감일">
          <DateInput value={task.dueDate} onChange={(v) => update(task.id, { dueDate: v })} className={overdue ? 'text-danger [&_span]:text-danger' : ''} />
          {overdue && <span className="rounded-md bg-danger/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-danger">지연됨</span>}
        </Prop>
        <Prop icon={<Gauge />} label="추정치">
          <Popover trigger={({ toggle }) => (
            <ChipButton onClick={toggle}>{task.estimate !== undefined ? <span className="font-mono">{task.estimate} pt</span> : <span className="text-subtle">설정 안 함</span>}</ChipButton>
          )} className="w-auto min-w-0">
            {(close) => (
              <div className="flex gap-1 p-0.5">
                {[1, 2, 3, 5, 8, 13].map((n) => (
                  <button key={n} onClick={() => { update(task.id, { estimate: n }); close() }} className={cn('h-8 w-8 rounded-lg font-mono text-[13px] transition', task.estimate === n ? 'bg-accent-gradient text-white shadow-glow-sm' : 'hover:bg-line/[0.08]')}>{n}</button>
                ))}
              </div>
            )}
          </Popover>
        </Prop>
        <Prop icon={<UserRound />} label="보고자">
          <span className="flex items-center gap-1.5 px-1 text-[13px]"><Avatar userId={task.reporterId} size="xs" />{getUser(task.reporterId)?.name}</span>
        </Prop>
        <Prop icon={<FolderKanban />} label="프로젝트">
          <Menu
            placement="bottom-start"
            trigger={<ChipButton>{project?.emoji} {project?.name}</ChipButton>}
            items={projects.filter((p) => !p.archived || p.id === task.projectId).map((p) => ({
              label: `${p.emoji} ${p.name}`,
              icon: p.id === task.projectId ? <Check /> : undefined,
              onClick: () => {
                if (p.id === task.projectId) return
                update(task.id, { projectId: p.id })
                const moved = useProjects.getState().tasks.find((t) => t.id === task.id)
                toast('프로젝트를 이동했습니다', { description: `${p.emoji} ${p.name} · ${p.key}-${moved?.number ?? ''}`, variant: 'success' })
                // follow the task to its new project's page (keeps the drawer open via ?task=)
                navigate(`/projects/${p.id}?task=${task.id}`)
              },
            }))}
          />
        </Prop>
      </div>

      <Description task={task} />
      <Subtasks task={task} />
      <Discussion task={task} />
    </div>
  )
}

function SectionTitle({ icon, children, right }: { icon: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-center gap-2 text-[13px] font-semibold text-fg [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-subtle">
      {icon}{children}
      <div className="ml-auto">{right}</div>
    </div>
  )
}

function Description({ task }: { task: Task }) {
  const update = useProjects((s) => s.updateTask)
  const [mode, setMode] = useState<'preview' | 'edit'>(task.description ? 'preview' : 'edit')
  const [text, setText] = useState(task.description ?? '')
  useEffect(() => setText(task.description ?? ''), [task.description])
  const save = () => { if (text !== (task.description ?? '')) update(task.id, { description: text }) }

  return (
    <>
      <SectionTitle
        icon={<Pencil />}
        right={
          <div className="flex rounded-lg border border-line/10 bg-line/[0.03] p-0.5">
            {(['edit', 'preview'] as const).map((m) => (
              <button key={m} onClick={() => { if (m === 'preview') save(); setMode(m) }} className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] transition', mode === m ? 'bg-surface text-fg shadow-card' : 'text-subtle hover:text-fg')}>
                {m === 'edit' ? <><Pencil className="h-3 w-3" />편집</> : <><Eye className="h-3 w-3" />미리보기</>}
              </button>
            ))}
          </div>
        }
      >
        설명
      </SectionTitle>
      {mode === 'edit' ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { save(); setMode('preview') } }}
            placeholder="마크다운으로 설명을 작성하세요… (## 제목, - 목록, **굵게**, `코드`)"
            className="input-base min-h-[160px] resize-y font-mono text-[13px] leading-relaxed"
          />
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-subtle"><Kbd>⌘</Kbd><Kbd>Enter</Kbd> 저장 후 미리보기 · 마크다운 지원</div>
        </div>
      ) : text.trim() ? (
        <div onDoubleClick={() => setMode('edit')} className="cursor-text rounded-xl px-1 transition hover:bg-line/[0.02]">
          <Markdown source={text} className="text-[14px] leading-6" />
        </div>
      ) : (
        <button onClick={() => setMode('edit')} className="w-full rounded-xl border border-dashed border-line/15 py-6 text-[13px] text-subtle transition hover:border-accent/40 hover:text-fg">설명 추가하기…</button>
      )}
    </>
  )
}

function Subtasks({ task }: { task: Task }) {
  const add = useProjects((s) => s.addSubtask)
  const toggle = useProjects((s) => s.toggleSubtask)
  const remove = useProjects((s) => s.deleteSubtask)
  const rename = useProjects((s) => s.updateSubtask)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const done = task.subtasks.filter((s) => s.done).length
  const pct = task.subtasks.length ? Math.round((done / task.subtasks.length) * 100) : 0
  return (
    <>
      <SectionTitle icon={<ListChecks />} right={task.subtasks.length > 0 && <span className="text-[11.5px] font-medium text-subtle tabular-nums">{done}/{task.subtasks.length} · {pct}%</span>}>
        하위 작업
      </SectionTitle>
      {task.subtasks.length > 0 && <Progress value={pct} size="sm" tone={pct === 100 ? 'success' : 'accent'} className="mb-2" />}
      <div className="flex flex-col">
        <AnimatePresence initial={false}>
          {task.subtasks.map((s) => (
            <motion.div key={s.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-line/[0.04]">
              <Checkbox checked={s.done} onChange={() => toggle(task.id, s.id)} />
              {editing === s.id ? (
                <input
                  autoFocus
                  defaultValue={s.title}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.title) rename(task.id, s.id, v); setEditing(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) }
                  }}
                  className="min-w-0 flex-1 rounded-md bg-line/[0.05] px-1.5 py-0.5 text-[13.5px] text-fg outline-none ring-1 ring-accent/40"
                />
              ) : (
                <span onDoubleClick={() => setEditing(s.id)} title="더블클릭하여 편집" className={cn('min-w-0 flex-1 break-words text-[13.5px] transition', s.done ? 'text-subtle line-through' : 'text-fg')}>{s.title}</span>
              )}
              <button onClick={() => setEditing(s.id)} title="편집" className="rounded p-0.5 text-subtle opacity-0 transition hover:text-fg group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(task.id, s.id)} title="삭제" className="rounded p-0.5 text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
        <form
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) { add(task.id, text.trim()); setText('') } }}
          className="mt-1 flex items-center gap-2.5 rounded-lg px-1.5 py-1"
        >
          <Plus className="h-[18px] w-[18px] text-subtle" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="하위 작업 추가 후 Enter" className="flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-subtle" />
        </form>
      </div>
    </>
  )
}

type Feed = 'comments' | 'activity'

function Discussion({ task }: { task: Task }) {
  const addComment = useProjects((s) => s.addComment)
  const me = useCore((s) => s.currentUserId)
  const [tab, setTab] = useState<Feed>('comments')
  const [text, setText] = useState('')
  const activity = useMemo(() => [...(task.activity ?? [])].reverse(), [task.activity])
  const send = () => { if (!text.trim()) return; addComment(task.id, text.trim()); setText('') }

  return (
    <div className="mt-7">
      <UnderlineTabs<Feed>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'comments', label: '댓글', icon: <MessageSquare />, count: task.comments.length },
          { value: 'activity', label: '활동', icon: <History />, count: activity.length },
        ]}
      />
      {tab === 'comments' ? (
        <div className="mt-4 space-y-4">
          {task.comments.length === 0 && <p className="py-4 text-center text-[13px] text-subtle">아직 댓글이 없어요. 첫 의견을 남겨보세요 💬</p>}
          <AnimatePresence initial={false}>
            {task.comments.map((c) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <Avatar userId={c.userId} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-fg">{getUser(c.userId)?.name}</span>
                    <span className="text-[11px] text-subtle">{timeAgo(c.createdAt)}</span>
                  </div>
                  <div className={cn('mt-1 inline-block max-w-full rounded-2xl rounded-tl-md px-3 py-2 text-[13.5px] leading-relaxed', c.userId === me ? 'bg-accent/10 text-fg' : 'bg-line/[0.05] text-fg/90')}>
                    <Markdown source={c.text} className="text-[13.5px] leading-relaxed [&_p]:my-0" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex gap-3 pt-1">
            <Avatar userId={me} size="sm" />
            <div className="flex-1 rounded-2xl border border-line/10 bg-surface-2/60 p-2 transition focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }}
                rows={2}
                placeholder="댓글을 입력하세요… (@멘션, 마크다운 지원)"
                className="w-full resize-none bg-transparent px-1 text-[13.5px] text-fg outline-none placeholder:text-subtle"
              />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 px-1 text-[11px] text-subtle"><Kbd>⌘</Kbd><Kbd>Enter</Kbd> 전송</span>
                <Button size="xs" variant="primary" disabled={!text.trim()} onClick={send} rightIcon={<Send className="h-3 w-3" />}>댓글</Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mt-4 pl-4">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-accent/40 via-line/10 to-transparent" />
          {activity.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="relative flex items-center gap-2.5 py-2">
              <span className={cn('absolute -left-[13px] h-2.5 w-2.5 rounded-full ring-4 ring-surface', i === 0 ? 'bg-accent shadow-glow-sm' : 'bg-line/25')} />
              <Avatar userId={a.userId} size="xs" />
              <span className="text-[13px] text-fg/90"><span className="font-semibold text-fg">{getUser(a.userId)?.name}</span>님이 {a.text}</span>
              <span className="ml-auto shrink-0 text-[11px] text-subtle">{timeAgo(a.createdAt)}</span>
            </motion.div>
          ))}
          {!activity.length && <p className="py-4 text-[13px] text-subtle">활동 기록이 없습니다</p>}
        </div>
      )}
    </div>
  )
}
