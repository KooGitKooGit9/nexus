import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MessageSquare, Megaphone, ListPlus, CalendarPlus, FilePlus2, Send, X, Check, ArrowRight, AlertTriangle, Video, MapPin, Undo2, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser } from '@/store/core'
import { Avatar, AvatarStack, Button } from '@/components/ui'
import { useProjects } from '@/features/projects/store'
import { useMessenger } from '@/features/messenger/store'
import { useDocs } from '@/features/docs/store'
import type { Priority } from '@/features/projects/types'
import type { ChatAction, ConfirmState, ResultCard as ResultCardData } from './store'
import { ACTION_VERB, type AgentAction } from './actions'

const META: Record<AgentAction['kind'], { icon: ReactNode; label: string }> = {
  dm: { icon: <MessageSquare />, label: 'DM 보내기' },
  post: { icon: <Megaphone />, label: '채널에 게시' },
  task: { icon: <ListPlus />, label: '태스크 만들기' },
  event: { icon: <CalendarPlus />, label: '일정 추가' },
  doc: { icon: <FilePlus2 />, label: '문서 만들기' },
}
const PRIORITY_LABEL: Record<Priority, string> = { urgent: '🔴 긴급', high: '🟠 높음', medium: '🟡 보통', low: '⚪ 낮음' }

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 py-1 text-[12.5px]">
      <span className="w-14 shrink-0 pt-px text-subtle">{label}</span>
      <div className="min-w-0 flex-1 text-fg/90">{children}</div>
    </div>
  )
}

const fieldCls = 'w-full rounded-xl border border-line/10 bg-surface-2/70 px-3 py-2 text-[13px] leading-relaxed text-fg outline-none transition focus:border-accent/50 focus:ring-4 focus:ring-accent/10 disabled:opacity-70'

/** Confirm card for an action proposed by Nexus AI ([보내기] / [취소]). */
export function ActionCard({ action, onConfirm, onCancel, onLink }: { action: ChatAction; onConfirm: (data: AgentAction) => void; onCancel: () => void; onLink: (href: string) => void }) {
  const [draft, setDraft] = useState<AgentAction>(action.data)
  const pending = action.state === 'pending'
  const data = pending ? draft : action.data
  const meta = META[data.kind]
  const projects = useProjects((s) => s.projects)
  const channels = useMessenger((s) => s.channels)
  const docs = useDocs((s) => s.docs)

  const text = data.kind === 'dm' || data.kind === 'post' ? data.text : data.title
  const setText = (v: string) =>
    setDraft((d) => (d.kind === 'dm' || d.kind === 'post' ? { ...d, text: v } : { ...d, title: v }))
  const empty = !text.trim()

  let body: ReactNode = null
  switch (data.kind) {
    case 'dm':
      body = (
        <Row label="받는 사람">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {data.userIds.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-line/[0.06] py-0.5 pl-0.5 pr-2">
                <Avatar userId={id} size="xs" showPresence />
                <span className="font-medium">{getUser(id)?.name ?? id}</span>
              </span>
            ))}
          </span>
        </Row>
      )
      break
    case 'post': {
      const ch = channels.find((c) => c.id === data.channelId)
      body = <Row label="채널"><span className="font-medium">{ch?.emoji} #{ch?.name ?? '알 수 없음'}</span><span className="ml-1.5 text-subtle">· 멤버 {ch?.memberIds.length ?? 0}명</span></Row>
      break
    }
    case 'task': {
      const p = projects.find((x) => x.id === data.projectId)
      body = (
        <>
          <Row label="프로젝트"><span className="font-medium">{p?.emoji} {p?.name}</span> <span className="font-mono text-[11px] text-subtle">{p?.key}</span></Row>
          <Row label="담당"><span className="inline-flex items-center gap-1.5"><AvatarStack userIds={data.assigneeIds} size="xs" />{data.assigneeIds.map((id) => getUser(id)?.name).filter(Boolean).join(', ')}</span></Row>
          <Row label="마감">{data.dueDate ? format(new Date(data.dueDate), 'M월 d일 (EEE)', { locale: ko }) : <span className="text-subtle">없음</span>}</Row>
          {pending ? (
            <Row label="우선순위">
              <span className="flex flex-wrap gap-1">
                {(['urgent', 'high', 'medium', 'low'] as Priority[]).map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => setDraft((d) => (d.kind === 'task' ? { ...d, priority: pr } : d))}
                    className={cn('rounded-lg border px-1.5 py-0.5 text-[11px] transition', data.priority === pr ? 'border-accent/50 bg-accent/10 text-fg' : 'border-line/10 text-muted hover:border-line/25')}
                  >
                    {PRIORITY_LABEL[pr]}
                  </button>
                ))}
              </span>
            </Row>
          ) : (
            <Row label="우선순위">{PRIORITY_LABEL[data.priority]}</Row>
          )}
        </>
      )
      break
    }
    case 'event':
      body = (
        <>
          <Row label="일시"><span className="font-medium">{format(new Date(data.start), 'M월 d일 (EEE) HH:mm', { locale: ko })} – {format(new Date(data.end), 'HH:mm')}</span></Row>
          <Row label="참석자"><span className="inline-flex min-w-0 items-center gap-1.5"><AvatarStack userIds={data.attendeeIds} size="xs" max={5} /><span className="truncate">{data.attendeeIds.map((id) => getUser(id)?.name).filter(Boolean).join(', ')}</span></span></Row>
          {(data.location || data.videoLink) && (
            <Row label="장소">
              <span className="inline-flex items-center gap-1">{data.videoLink ? <Video className="h-3.5 w-3.5 text-accent" /> : <MapPin className="h-3.5 w-3.5 text-accent" />}{data.location ?? '화상회의'}</span>
            </Row>
          )}
        </>
      )
      break
    case 'doc': {
      const parent = docs.find((d) => d.id === data.parentId)
      body = (
        <>
          <Row label="위치">{parent ? `${parent.emoji} ${parent.title}` : '최상위'}</Row>
          {data.content && (
            <Row label="미리보기">
              <span className="line-clamp-3 whitespace-pre-line font-mono text-[11px] text-muted">{data.content.replace(/> \[![^\]]*\]\s*/g, '').replace(/\*\*/g, '').slice(0, 160)}</span>
            </Row>
          )}
        </>
      )
      break
    }
  }

  const multiline = data.kind === 'dm' || data.kind === 'post'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('mt-2.5 overflow-hidden rounded-2xl border bg-line/[0.03]', pending ? 'border-accent/30 shadow-glow-sm' : 'border-line/10')}
    >
      <div className={cn('flex items-center gap-2 border-b px-3 py-2', pending ? 'border-accent/15 bg-accent/[0.07]' : 'border-line/[0.07]')}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-gradient text-white [&>svg]:h-3.5 [&>svg]:w-3.5">{meta.icon}</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{meta.label}</span>
        {action.state === 'done' && <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"><Check className="h-3 w-3" />완료</span>}
        {action.state === 'cancelled' && <span className="rounded-full bg-line/[0.08] px-2 py-0.5 text-[11px] text-subtle">취소됨</span>}
      </div>

      <div className="px-3 py-2.5">
        {body}
        <div className="mt-1.5">
          {pending ? (
            multiline ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={Math.min(6, Math.max(2, Math.ceil(text.length / 34)))}
                aria-label="보낼 내용"
                className={cn(fieldCls, 'resize-none')}
              />
            ) : (
              <input value={text} onChange={(e) => setText(e.target.value)} aria-label="제목" className={cn(fieldCls, 'font-medium')} />
            )
          ) : (
            <div className={cn('whitespace-pre-wrap break-words rounded-xl bg-line/[0.04] px-3 py-2 text-[13px]', action.state === 'cancelled' && 'text-subtle line-through decoration-line/30')}>{text}</div>
          )}
        </div>
        {action.error && pending && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-danger"><AlertTriangle className="h-3.5 w-3.5" />{action.error}</div>
        )}
      </div>

      {pending ? (
        <div className="flex items-center justify-end gap-2 border-t border-line/[0.07] px-3 py-2">
          <Button size="sm" variant="ghost" leftIcon={<X className="h-3.5 w-3.5" />} onClick={onCancel}>취소</Button>
          <Button size="sm" variant="primary" disabled={empty} leftIcon={multiline ? <Send className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} onClick={() => onConfirm(draft)}>
            {ACTION_VERB[data.kind]}
          </Button>
        </div>
      ) : action.state === 'done' && action.result ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/[0.07] px-3 py-2 text-[12px]">
          <span className="min-w-0 truncate text-muted">{action.result.summary}</span>
          <button onClick={() => onLink(action.result!.href)} className="inline-flex shrink-0 items-center gap-1 font-medium text-accent transition hover:gap-1.5">
            {action.result.label}<ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </motion.div>
  )
}

/* ───────────── Gemini agent cards ───────────── */

/** "보내기 전 확인" — shown before an outbound tool (DM / post / announcement / approval decision) runs. */
export function ConfirmCard({ confirm, onConfirm, onCancel }: { confirm: ConfirmState; onConfirm: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(confirm.text ?? confirm.preview.text)
  const pending = confirm.state === 'pending'
  const p = confirm.preview
  const isComment = confirm.tool === 'decide_approval'
  const verb = confirm.tool === 'send_dm' || confirm.tool === 'post_message' ? '보내기' : confirm.tool === 'create_announcement' ? '등록하기' : p.title.includes('반려') ? '반려하기' : '승인하기'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('mt-2.5 overflow-hidden rounded-2xl border bg-line/[0.03]', pending ? 'border-accent/30 shadow-glow-sm' : 'border-line/10')}
    >
      <div className={cn('flex items-center gap-2 border-b px-3 py-2', pending ? 'border-accent/15 bg-accent/[0.07]' : 'border-line/[0.07]')}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-gradient text-[12px] text-white">{p.emoji}</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{p.title}</span>
        {pending && <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium text-accent"><ShieldCheck className="h-3 w-3" />확인 필요</span>}
        {confirm.state === 'confirmed' && <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"><Check className="h-3 w-3" />확인함</span>}
        {confirm.state === 'cancelled' && <span className="rounded-full bg-line/[0.08] px-2 py-0.5 text-[11px] text-subtle">취소됨</span>}
      </div>
      <div className="px-3 py-2.5">
        <Row label={confirm.tool === 'send_dm' ? '받는 사람' : confirm.tool === 'post_message' ? '채널' : '대상'}>
          {p.userIds?.length ? (
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              {p.userIds.map((id) => (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-line/[0.06] py-0.5 pl-0.5 pr-2">
                  <Avatar userId={id} size="xs" showPresence />
                  <span className="font-medium">{getUser(id)?.name ?? id}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="font-medium">{p.target}</span>
          )}
        </Row>
        <div className="mt-1.5">
          {pending ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={Math.min(8, Math.max(2, Math.ceil(text.length / 34) + (text.match(/\n/g)?.length ?? 0)))}
              placeholder={isComment ? '의견 (선택)' : ''}
              aria-label="보낼 내용"
              className={cn(fieldCls, 'resize-none')}
            />
          ) : (
            (confirm.text ?? '').trim() && (
              <div className={cn('max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-line/[0.04] px-3 py-2 text-[13px]', confirm.state === 'cancelled' && 'text-subtle line-through decoration-line/30')}>{confirm.text}</div>
            )
          )}
        </div>
      </div>
      {pending && (
        <div className="flex items-center justify-end gap-2 border-t border-line/[0.07] px-3 py-2">
          <Button size="sm" variant="ghost" leftIcon={<X className="h-3.5 w-3.5" />} onClick={onCancel}>취소</Button>
          <Button size="sm" variant="primary" disabled={!isComment && !text.trim()} leftIcon={<Send className="h-3.5 w-3.5" />} onClick={() => onConfirm(text)}>
            {verb}
          </Button>
        </div>
      )}
    </motion.div>
  )
}

/** Compact "what I did" card for each write the Gemini agent executed (link + 실행 취소). */
export function ResultCard({ card, onUndo, onLink }: { card: ResultCardData; onUndo: () => void; onLink: (href: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn('mt-2 overflow-hidden rounded-2xl border bg-line/[0.03] transition', card.undone ? 'border-line/10 opacity-60' : 'border-success/25')}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[14px]', card.undone ? 'bg-line/10' : 'bg-success/15')}>{card.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className={cn('flex items-center gap-1.5 text-[12.5px] font-semibold', card.undone && 'line-through decoration-line/40')}>
            <span className="min-w-0 truncate">{card.title}</span>
            {!card.undone ? <Check className="h-3.5 w-3.5 shrink-0 text-success" /> : <span className="shrink-0 rounded-full bg-line/[0.08] px-1.5 py-px text-[10.5px] font-medium text-subtle no-underline">실행 취소됨</span>}
          </div>
          {card.detail && <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{card.detail}</div>}
          {card.quote && <div className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words rounded-lg border-l-2 border-accent/40 bg-line/[0.04] px-2.5 py-1.5 text-[12px] text-fg/85">{card.quote}</div>}
          {card.warning && !card.undone && (
            <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-warning"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /><span className="min-w-0">{card.warning}</span></div>
          )}
        </div>
      </div>
      {(card.href || card.undo) && !card.undone && (
        <div className="flex items-center justify-between gap-2 border-t border-line/[0.07] px-3 py-1.5 text-[12px]">
          {card.undo ? (
            <button onClick={onUndo} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-subtle transition hover:bg-line/10 hover:text-fg">
              <Undo2 className="h-3.5 w-3.5" />실행 취소
            </button>
          ) : <span />}
          {card.href && (
            <button onClick={() => onLink(card.href!)} className="inline-flex shrink-0 items-center gap-1 font-medium text-accent transition hover:gap-1.5">
              {card.linkLabel ?? '열기'}<ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
