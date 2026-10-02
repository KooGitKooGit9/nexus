import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, SquarePen, ArrowUp, Square, Copy, Check, RefreshCw, Loader2, CircleCheck, ChevronDown, Lock, History, SlidersHorizontal, Trash2, KeyRound, CircleX, Ban, AlertTriangle, Cpu } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { useCurrentUser, useUI } from '@/store/core'
import { useSyncStatus } from '@/lib/sync'
import { Avatar, Kbd, Popover, Switch, Tooltip } from '@/components/ui'
import { Markdown } from './ai/Markdown'
import { useAIChat, activeConversation, selectMessages, geminiEnabled, canRegenerateMessage, setAINavigator, type ChatMessage, type Conversation } from './ai/store'
import { SUGGESTIONS } from './ai/agent'
import { GEMINI_SUGGESTIONS } from './ai/prompt'
import { prettyModel } from './ai/gemini'
import { ActionCard, ConfirmCard, ResultCard } from './ai/ActionCard'

/** Gemini on/off + model, reactive. */
function useAIMode() {
  const syncAi = useSyncStatus((s) => s.aiEnabled)
  const syncModel = useSyncStatus((s) => s.aiModel)
  const status = useAIChat((s) => s.status)
  const noKey = useAIChat((s) => s.noKey)
  const on = geminiEnabled({ status, noKey }, syncAi)
  const model = status.model || syncModel
  return { on, checked: status.checked, model, mock: status.mock || /^mock/i.test(model) }
}

export function AIPanel() {
  const open = useUI((s) => s.aiOpen)
  const aiPrompt = useUI((s) => s.aiPrompt)
  const setOpen = useUI((s) => s.setAiOpen)

  // Auto-send prompts coming from askAI() (palette, feature buttons)
  useEffect(() => {
    if (!open || !aiPrompt) return
    const p = useUI.getState().consumeAiPrompt()
    if (!p) return
    const chat = useAIChat.getState()
    if (chat.busy) chat.stop()
    chat.send(p)
  }, [open, aiPrompt])

  // (Re)check whether the server has a Gemini key whenever the panel opens.
  useEffect(() => {
    if (open) void useAIChat.getState().probeStatus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useUI.getState().commandOpen) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.aside
          key="ai"
          role="dialog"
          aria-label="Nexus AI"
          className="fixed bottom-4 right-4 top-[76px] z-[85] flex w-[420px] max-w-[calc(100vw-32px)] flex-col"
          initial={{ opacity: 0, x: 40, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          <div className="pointer-events-none absolute -inset-px rounded-[28px] bg-accent-gradient-3 opacity-30 blur-xl" />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] glass-strong shadow-float">
            <Panel onClose={() => setOpen(false)} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const headerBtn = 'rounded-xl p-2 text-white/85 transition hover:bg-white/15 hover:text-white'

function Panel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const messages = useAIChat(selectMessages)
  const conv = useAIChat((s) => activeConversation(s))
  const busy = useAIChat((s) => s.busy)
  const bannerDismissed = useAIChat((s) => s.bannerDismissed)
  const { send, stop, newChat, regenerate } = useAIChat.getState()
  const mode = useAIMode()
  const [input, setInput] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)

  // tools like `navigate` move the app while the panel stays open
  useEffect(() => {
    setAINavigator((p) => navigate(p))
    return () => setAINavigator(null)
  }, [navigate])

  const last = messages[messages.length - 1]
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages.length, last?.content, last?.stepIndex, last?.tools?.length, last?.cards?.length, last?.confirm?.state, last?.status])

  useEffect(() => { ta.current?.focus() }, [conv?.id])

  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(140, el.scrollHeight) + 'px'
  }, [input])

  const submit = (text = input) => {
    if (!text.trim() || busy) return
    stick.current = true
    send(text)
    setInput('')
  }

  const suggestions = mode.on ? GEMINI_SUGGESTIONS : SUGGESTIONS
  const showBanner = mode.checked && !mode.on && !bannerDismissed

  return (
    <>
      {/* gradient header */}
      <div className="relative shrink-0 overflow-hidden px-4 pb-3.5 pt-4 text-white">
        <div className="absolute inset-0 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.35),transparent_55%)]" />
        <div className="relative flex items-center gap-2">
          <div className="relative mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
            <Sparkles className="h-5 w-5" />
            <span className={cn('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white/40', mode.on ? 'bg-emerald-300' : 'bg-amber-300')} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="font-display text-[15px] font-bold tracking-tight">Nexus AI</span>
              {mode.on ? (
                <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-white/25">
                  <Cpu className="h-3 w-3 shrink-0" />
                  <span className="truncate">{prettyModel(mode.model)}{mode.mock ? ' · mock' : ''}</span>
                </span>
              ) : mode.checked ? (
                <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10.5px] font-medium text-white/85 ring-1 ring-white/20">기본 모드</span>
              ) : null}
            </div>
            <div className="truncate text-[11.5px] text-white/80">{mode.on ? '대화하고, 찾고, 실제로 실행하는 업무 비서' : '워크스페이스 데이터를 읽고 답하는 어시스턴트'}</div>
          </div>
          <HistoryMenu />
          <Tooltip content="새 대화" side="bottom">
            <button onClick={() => { newChat(); setInput('') }} className={headerBtn} aria-label="새 대화">
              <SquarePen className="h-4 w-4" />
            </button>
          </Tooltip>
          <SettingsMenu geminiOn={mode.on} />
          <Tooltip content="닫기 (Esc)" side="bottom">
            <button onClick={onClose} className={headerBtn} aria-label="닫기">
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showBanner && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="shrink-0 overflow-hidden">
            <div className="flex items-start gap-2 border-b border-warning/20 bg-warning/[0.08] px-4 py-2 text-[11.5px] leading-snug text-fg/80">
              <KeyRound className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">Gemini API 키를 설정하면 진짜 AI로 동작합니다 · <code className="rounded bg-line/10 px-1 font-mono text-[10.5px]">server/.env</code></span>
              <button onClick={() => useAIChat.getState().dismissBanner()} className="-m-1 rounded-md p-1 text-subtle transition hover:bg-line/10 hover:text-fg" aria-label="배너 닫기">
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* conversation */}
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <Welcome onPick={(t) => submit(t)} suggestions={suggestions} geminiOn={mode.on} />
        ) : (
          <div className="space-y-5">
            {messages.map((m) =>
              m.role === 'user' ? (
                <UserBubble key={m.id} m={m} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  m={m}
                  onLink={(href) => navigate(href)}
                  onRegenerate={() => regenerate(m.id)}
                  canRegenerate={!busy && canRegenerateMessage(conv, m)}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-line/[0.08] p-3">
        {messages.length > 0 && !busy && (
          <div className="scrollbar-none -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
            {suggestions.map((s) => (
              <button key={s.text} onClick={() => submit(s.text)} className="shrink-0 rounded-full border border-line/10 bg-line/[0.04] px-2.5 py-1 text-[11.5px] text-muted transition hover:border-accent/40 hover:bg-accent/10 hover:text-fg">
                {s.emoji} {s.text}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-line/10 bg-surface-2/70 p-2 pl-3.5 transition focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10">
          <textarea
            ref={ta}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={mode.on ? '무엇이든 말씀하세요… (예: 서준님께 점심 같이 하자고 DM)' : '무엇이든 물어보세요… (예: 오늘 브리핑)'}
            className="max-h-[140px] min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-[13.5px] leading-6 text-fg outline-none placeholder:text-subtle"
          />
          {busy ? (
            <Tooltip content="중지">
              <button onClick={stop} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-line/10 text-fg transition hover:bg-line/20" aria-label="중지">
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={() => submit()}
              disabled={!input.trim()}
              aria-label="전송"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10.5px] text-subtle">
          {mode.on ? (
            <span className="flex min-w-0 items-center gap-1 truncate"><Sparkles className="h-3 w-3 shrink-0" />Gemini로 처리 · API 키는 서버에만 보관</span>
          ) : (
            <span className="flex min-w-0 items-center gap-1 truncate"><Lock className="h-3 w-3 shrink-0" />로컬에서 처리 · 외부 전송 없음</span>
          )}
          <span className="flex shrink-0 items-center gap-1"><Kbd>↵</Kbd>전송 <Kbd>⇧↵</Kbd>줄바꿈</span>
        </div>
      </div>
    </>
  )
}

/* ───────────── header menus ───────────── */

function HistoryMenu() {
  const conversations = useAIChat((s) => s.conversations)
  const activeId = useAIChat((s) => activeConversation(s)?.id)
  const me = useCurrentUser()
  const mine = conversations.filter((c) => c.userId === me?.id && c.messages.length > 0).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <Popover
      placement="bottom-end"
      className="w-[300px] p-1.5"
      trigger={({ toggle, open }) => (
        <Tooltip content="대화 기록" side="bottom">
          <button onClick={toggle} className={cn(headerBtn, open && 'bg-white/15 text-white')} aria-label="대화 기록">
            <History className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    >
      {(close) => (
        <div className="flex max-h-[360px] flex-col">
          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
            <span>대화 기록</span>
            {mine.length > 0 && (
              <button onClick={() => { useAIChat.getState().clearHistory(); close() }} className="rounded-md px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-subtle transition hover:bg-danger/10 hover:text-danger">
                모두 삭제
              </button>
            )}
          </div>
          <div className="min-h-0 overflow-y-auto">
            {mine.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12.5px] text-subtle">아직 대화가 없어요</div>
            ) : (
              mine.map((c) => <HistoryRow key={c.id} c={c} active={c.id === activeId} onPick={() => { useAIChat.getState().selectConversation(c.id); close() }} />)
            )}
          </div>
        </div>
      )}
    </Popover>
  )
}

function HistoryRow({ c, active, onPick }: { c: Conversation; active: boolean; onPick: () => void }) {
  return (
    <div className={cn('group flex items-center gap-1 rounded-xl pr-1 transition', active ? 'bg-accent/10' : 'hover:bg-line/[0.06]')}>
      <button onClick={onPick} className="min-w-0 flex-1 px-2.5 py-2 text-left">
        <div className={cn('truncate text-[12.5px] font-medium', active ? 'text-fg' : 'text-fg/85')}>{c.title}</div>
        <div className="mt-0.5 text-[11px] text-subtle">{timeAgo(c.updatedAt)} · 메시지 {c.messages.filter((m) => m.role === 'user').length}개</div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); useAIChat.getState().deleteConversation(c.id) }}
        className="rounded-lg p-1.5 text-subtle opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus:opacity-100"
        aria-label="대화 삭제"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function SettingsMenu({ geminiOn }: { geminiOn: boolean }) {
  const confirmBeforeSend = useAIChat((s) => s.confirmBeforeSend)
  return (
    <Popover
      placement="bottom-end"
      className="w-[280px] p-1.5"
      trigger={({ toggle, open }) => (
        <Tooltip content="AI 설정" side="bottom">
          <button onClick={toggle} className={cn(headerBtn, open && 'bg-white/15 text-white')} aria-label="AI 설정">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    >
      <div className="flex items-start gap-3 rounded-xl px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-fg">보내기 전 확인</div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-subtle">DM · 채널 게시 · 공지 · 결재 결정 전에 내용을 보여주고 확인을 받아요.</div>
        </div>
        <div className="pt-0.5"><Switch size="sm" checked={confirmBeforeSend} onChange={(v) => useAIChat.getState().setConfirmBeforeSend(v)} /></div>
      </div>
      <div className="my-1 h-px bg-line/10" />
      <div className="px-2.5 py-1.5 text-[11px] leading-snug text-subtle">
        {geminiOn ? '요청한 작업은 바로 실행되고, 결과 카드에서 실행 취소할 수 있어요.' : '지금은 기본(규칙 기반) 모드예요. server/.env에 GEMINI_API_KEY를 넣으면 Gemini로 동작해요.'}
      </div>
    </Popover>
  )
}

/* ───────────── messages ───────────── */

function Welcome({ onPick, suggestions, geminiOn }: { onPick: (t: string) => void; suggestions: { emoji: string; text: string }[]; geminiOn: boolean }) {
  const me = useCurrentUser()
  const h = new Date().getHours()
  const hello = h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요'
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <div className="relative mb-5 h-20 w-20">
        <div className="absolute inset-0 rounded-full bg-accent-gradient-3 opacity-60 blur-2xl animate-pulse" />
        <motion.div
          className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x text-white shadow-glow"
          animate={{ rotate: [0, 4, -4, 0], y: [0, -4, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles className="h-9 w-9" />
        </motion.div>
      </div>
      <div className="font-display text-xl font-bold tracking-tight">
        {hello}, <span className="gradient-text">{(me?.name && /^[가-힣]{3}$/.test(me.name) ? me.name.slice(1) : me?.name) ?? ''}님</span>
      </div>
      <p className="mt-1.5 max-w-[310px] text-[13px] text-muted">
        {geminiOn
          ? '편하게 말씀하세요. 일정·태스크·대화를 찾아보고, DM·공지·일정·결재까지 직접 처리해 드릴게요.'
          : '일정, 태스크, 대화, 결재, OKR을 분석해 바로 쓸 수 있는 답을 드릴게요.'}
      </p>
      <div className="mt-6 grid w-full grid-cols-2 gap-2">
        {suggestions.map((s, i) => (
          <motion.button
            key={s.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            onClick={() => onPick(s.text)}
            className="group flex items-center gap-2 rounded-2xl border border-line/10 bg-line/[0.03] px-3 py-2.5 text-left text-[12.5px] font-medium text-fg/85 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/[0.08] hover:shadow-glow-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-line/[0.06] text-[14px] transition group-hover:scale-110">{s.emoji}</span>
            <span className="leading-snug">{s.text}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function UserBubble({ m }: { m: ChatMessage }) {
  const me = useCurrentUser()
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-end gap-2">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent-gradient px-3.5 py-2 text-[13.5px] leading-relaxed text-white shadow-glow-sm">{m.content}</div>
      <Avatar user={me} size="xs" />
    </motion.div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent animate-typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}
    </div>
  )
}

const STEP_ICON = {
  running: <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />,
  done: <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" />,
  error: <CircleX className="h-3.5 w-3.5 shrink-0 text-danger" />,
  cancelled: <Ban className="h-3.5 w-3.5 shrink-0 text-subtle" />,
}

/** Real tool steps of a Gemini answer. */
function ToolSteps({ m }: { m: ChatMessage }) {
  const [open, setOpen] = useState(false)
  const tools = m.tools ?? []
  const live = m.status === 'thinking'
  if (live) {
    return (
      <div className="space-y-1.5 rounded-2xl border border-line/[0.08] bg-line/[0.03] px-3 py-2.5">
        {tools.map((s) => (
          <motion.div key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-[12.5px]">
            {STEP_ICON[s.status]}
            <span className={cn('min-w-0 truncate', s.status === 'running' ? 'gradient-text font-medium' : s.status === 'error' ? 'text-danger/90' : 'text-muted')}>{s.label}</span>
          </motion.div>
        ))}
        {!tools.some((t) => t.status === 'running') && (m.confirm?.state !== 'pending') && (
          <div className="flex items-center gap-2 text-[12px] text-subtle">
            <TypingDots />
            {tools.length > 0 && <span>정리하는 중</span>}
          </div>
        )}
      </div>
    )
  }
  if (!tools.length) return null
  const errors = tools.filter((t) => t.status === 'error').length
  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="mb-1.5 flex items-center gap-1 text-[11px] text-subtle transition hover:text-muted">
        <CircleCheck className="h-3 w-3 text-success" />
        도구 {tools.length}개 사용{errors ? ` · 오류 ${errors}` : ''}
        <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-2 overflow-hidden border-l-2 border-line/10 pl-3 text-[11.5px] text-subtle">
            {tools.map((s) => (
              <li key={s.id} className="flex items-start gap-1.5 py-0.5">
                <span className="mt-px [&>svg]:h-3 [&>svg]:w-3">{STEP_ICON[s.status]}</span>
                <span className="min-w-0">{s.label}{s.error && <span className="text-danger/80"> — {s.error}</span>}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </>
  )
}

/** Simulated steps of the local (fallback) agent. */
function LocalSteps({ m }: { m: ChatMessage }) {
  const [open, setOpen] = useState(false)
  const steps = m.steps ?? []
  if (m.status === 'thinking') {
    return (
      <div className="space-y-1.5 rounded-2xl border border-line/[0.08] bg-line/[0.03] px-3 py-2.5">
        {steps.map((s, i) => {
          const idx = m.stepIndex ?? 0
          if (i > idx) return null
          const active = i === idx
          return (
            <motion.div key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-[12.5px]">
              {active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : <CircleCheck className="h-3.5 w-3.5 text-success" />}
              <span className={cn(active ? 'gradient-text font-medium' : 'text-muted')}>{s}</span>
            </motion.div>
          )
        })}
        {steps.length === 0 && <TypingDots />}
      </div>
    )
  }
  if (!steps.length) return null
  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="mb-1.5 flex items-center gap-1 text-[11px] text-subtle transition hover:text-muted">
        <CircleCheck className="h-3 w-3 text-success" />
        {steps.length}단계 분석 완료
        <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-2 overflow-hidden border-l-2 border-line/10 pl-3 text-[11.5px] text-subtle">
            {steps.map((s) => <li key={s} className="py-0.5">{s.replace(/…$/, '')}</li>)}
          </motion.ul>
        )}
      </AnimatePresence>
    </>
  )
}

function AssistantMessage({ m, onLink, onRegenerate, canRegenerate }: { m: ChatMessage; onLink: (h: string) => void; onRegenerate: () => void; canRegenerate: boolean }) {
  const [copied, setCopied] = useState(false)
  const thinking = m.status === 'thinking'
  const streaming = m.status === 'streaming'
  const done = m.status === 'done' || m.status === 'stopped' || m.status === 'error'
  const gemini = m.engine === 'gemini'
  const chat = useAIChat.getState()

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-accent-gradient-3 text-white shadow-glow-sm">
        <Sparkles className={cn('h-3.5 w-3.5', (thinking || streaming) && 'animate-pulse')} />
      </div>
      <div className="min-w-0 flex-1">
        {gemini ? <ToolSteps m={m} /> : <LocalSteps m={m} />}

        {gemini && m.confirm && m.confirm.state !== 'confirmed' && (
          <ConfirmCard
            key={m.confirm.stepId}
            confirm={m.confirm}
            onConfirm={(text) => chat.resolveConfirm(m.id, true, text)}
            onCancel={() => chat.resolveConfirm(m.id, false)}
          />
        )}

        {gemini && (m.cards ?? []).map((c) => (
          <ResultCard key={c.id} card={c} onUndo={() => chat.undoCard(m.id, c.id)} onLink={onLink} />
        ))}

        {!thinking && m.content && (
          <div className={cn('relative min-w-0', gemini && (m.cards?.length || m.confirm) && 'mt-2.5')}>
            <Markdown text={m.content} onLink={onLink} />
            {streaming && <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 animate-pulse rounded-sm bg-accent align-middle" />}
          </div>
        )}

        {m.status === 'error' && (
          <div className="mt-2 flex items-start gap-2 rounded-2xl border border-danger/25 bg-danger/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-fg/85">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <Markdown text={m.error ?? '오류가 발생했어요.'} onLink={onLink} className="text-[12.5px]" />
              {canRegenerate && (
                <button onClick={onRegenerate} className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-line/[0.08] px-2 py-1 text-[11.5px] font-medium text-fg transition hover:bg-line/15">
                  <RefreshCw className="h-3 w-3" />다시 시도
                </button>
              )}
            </div>
          </div>
        )}

        {!gemini && m.status === 'done' && m.action && (
          <ActionCard
            key={`${m.id}-${m.variant ?? 0}`}
            action={m.action}
            onConfirm={(data) => chat.confirmAction(m.id, data)}
            onCancel={() => chat.cancelAction(m.id)}
            onLink={onLink}
          />
        )}

        {done && m.status !== 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex items-center gap-0.5">
            <Tooltip content={copied ? '복사됨!' : '복사'}>
              <button
                onClick={() => { navigator.clipboard?.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="rounded-lg p-1.5 text-subtle transition hover:bg-line/10 hover:text-fg"
                aria-label="복사"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </Tooltip>
            <Tooltip content={canRegenerate ? '다시 생성' : gemini && (m.cards ?? []).some((c) => !c.undone) ? '실행된 작업이 있어 다시 생성할 수 없어요' : '마지막 답변만 다시 생성할 수 있어요'}>
              <button disabled={!canRegenerate} onClick={onRegenerate} className="rounded-lg p-1.5 text-subtle transition hover:bg-line/10 hover:text-fg disabled:opacity-40" aria-label="다시 생성">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            {m.status === 'stopped' && <span className="ml-1 text-[11px] text-subtle">중단됨</span>}
            {gemini && m.status === 'done' && <span className="ml-auto text-[10.5px] text-subtle/80">Gemini</span>}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
