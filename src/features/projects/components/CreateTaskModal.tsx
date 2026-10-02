import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CornerDownLeft, Users, Tag, Gauge } from 'lucide-react'
import { Avatar, Button, Modal, Switch, Kbd, Menu, Popover } from '@/components/ui'
import { getUser, toast } from '@/store/core'
import { cn } from '@/lib/utils'
import type { Priority, TaskStatus } from '../types'
import { PRIORITY_META, STATUS_META } from '../constants'
import { useProjects } from '../store'
import { AssigneePicker, ChipButton, DateInput, LabelChip, LabelPicker, PriorityIcon, PriorityPicker, StatusIcon, StatusPicker } from './atoms'

export function CreateTaskModal({ open, onClose, defaultProjectId, defaultStatus = 'todo' }: { open: boolean; onClose: () => void; defaultProjectId?: string; defaultStatus?: TaskStatus }) {
  const projects = useProjects((s) => s.projects)
  const createTask = useProjects((s) => s.createTask)
  const navigate = useNavigate()
  const [projectId, setProjectId] = useState<string | undefined>(defaultProjectId ?? projects[0]?.id)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<Priority>('medium')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [dueDate, setDueDate] = useState<string | undefined>()
  const [estimate, setEstimate] = useState<number | undefined>()
  const [more, setMore] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    // ignore an unknown project id (e.g. a bad /projects/:id URL) — fall back to the first active project
    const def = defaultProjectId && projects.some((p) => p.id === defaultProjectId) ? defaultProjectId : undefined
    setProjectId(def ?? projects.find((p) => !p.archived)?.id)
    setStatus(defaultStatus)
    setTimeout(() => titleRef.current?.focus(), 60)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const project = projects.find((p) => p.id === projectId)
  const reset = () => { setTitle(''); setDescription(''); setAssigneeIds([]); setLabels([]); setDueDate(undefined); setEstimate(undefined); setPriority('medium') }

  const submit = () => {
    if (!title.trim() || !project) return
    const t = createTask({ projectId: project.id, title, description: description || undefined, status, priority, assigneeIds, labels, dueDate, estimate })
    toast('태스크를 만들었습니다', { description: `${project.key}-${t.number} ${t.title}`, variant: 'success', emoji: '✨' })
    reset()
    if (more) { titleRef.current?.focus(); return }
    // The modal is driven by `?new=1`: replacing the URL (without `new`) closes it and opens the new task's
    // drawer in one history entry, so Back doesn't re-open the create dialog.
    navigate(`/projects/${project.id}?task=${t.id}`, { replace: true })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <Menu
            placement="bottom-start"
            trigger={
              <ChipButton>
                {project ? <><span>{project.emoji}</span><span className="font-mono text-[11px] text-subtle">{project.key}</span>{project.name}</> : '프로젝트 선택'}
              </ChipButton>
            }
            items={projects.filter((p) => !p.archived).map((p) => ({ label: `${p.emoji} ${p.name}`, onClick: () => setProjectId(p.id) }))}
          />
          <span className="text-subtle">›</span>
          <span className="text-muted">새 태스크</span>
        </div>
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            <Switch size="sm" checked={more} onChange={setMore} /> 계속 만들기
          </label>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button variant="primary" disabled={!title.trim() || !project} onClick={submit} leftIcon={<Plus className="h-4 w-4" />}>
              태스크 만들기 <span className="ml-1 flex items-center gap-0.5 opacity-70"><Kbd className="border-white/20 bg-white/10 text-white">⌘</Kbd><CornerDownLeft className="h-3 w-3" /></span>
            </Button>
          </div>
        </div>
      }
    >
      <div onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit() } }}>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); submit() } }}
          placeholder="태스크 제목"
          className="w-full bg-transparent font-display text-xl font-semibold text-fg outline-none placeholder:text-subtle"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 추가… (마크다운 지원)"
          rows={4}
          className="mt-3 w-full resize-none bg-transparent text-[14px] leading-relaxed text-fg/90 outline-none placeholder:text-subtle"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/[0.07] pt-4">
          <StatusPicker value={status} onChange={setStatus} trigger={({ toggle }) => (
            <ChipButton onClick={toggle}><StatusIcon status={status} />{STATUS_META[status].label}</ChipButton>
          )} />
          <PriorityPicker value={priority} onChange={setPriority} trigger={({ toggle }) => (
            <ChipButton onClick={toggle}><PriorityIcon priority={priority} className="text-fg" />{PRIORITY_META[priority].label}</ChipButton>
          )} />
          <AssigneePicker value={assigneeIds} onChange={setAssigneeIds} candidateIds={project?.memberIds} trigger={({ toggle }) => (
            <ChipButton onClick={toggle} active={assigneeIds.length > 0}>
              {assigneeIds.length ? (
                <>
                  <span className="flex -space-x-1.5">{assigneeIds.slice(0, 3).map((id) => <Avatar key={id} userId={id} size="xs" ring />)}</span>
                  {assigneeIds.length === 1 ? getUser(assigneeIds[0])?.name : `${assigneeIds.length}명`}
                </>
              ) : <><Users className="h-3.5 w-3.5 text-subtle" />담당자</>}
            </ChipButton>
          )} />
          <LabelPicker value={labels} onChange={setLabels} trigger={({ toggle }) => (
            <ChipButton onClick={toggle} active={labels.length > 0}><Tag className="h-3.5 w-3.5 text-subtle" />라벨{labels.length ? ` ${labels.length}` : ''}</ChipButton>
          )} />
          <div className={cn('rounded-lg border', dueDate ? 'border-accent/40 bg-accent/10' : 'border-line/10 bg-line/[0.03]')}>
            <DateInput value={dueDate} onChange={setDueDate} placeholder="마감일" className="h-[30px]" />
          </div>
          <Popover trigger={({ toggle }) => (
            <ChipButton onClick={toggle} active={estimate !== undefined}><Gauge className="h-3.5 w-3.5 text-subtle" />{estimate !== undefined ? `${estimate}pt` : '추정치'}</ChipButton>
          )} className="w-auto min-w-0">
            {(close) => (
              <div className="flex gap-1 p-0.5">
                {[1, 2, 3, 5, 8, 13].map((n) => (
                  <button key={n} onClick={() => { setEstimate(n); close() }} className={cn('h-8 w-8 rounded-lg font-mono text-[13px] transition', estimate === n ? 'bg-accent-gradient text-white' : 'hover:bg-line/[0.08]')}>{n}</button>
                ))}
              </div>
            )}
          </Popover>
        </div>
        {labels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">{labels.map((l) => <LabelChip key={l} label={l} onRemove={() => setLabels(labels.filter((x) => x !== l))} />)}</div>
        )}
      </div>
    </Modal>
  )
}
