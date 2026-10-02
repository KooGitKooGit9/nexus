import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import { STORAGE_PREFIX } from '@/lib/persist'
import { getSessionUserId, getSessionScope } from '@/lib/session'
import { useSyncStatus } from '@/lib/sync'
import { uid } from '@/lib/utils'
import { getCurrentUserId, toast } from '@/store/core'
import { runAgent } from './agent'
import { executeAction, type AgentAction, type ActionResult } from './actions'
import { GeminiError, appendUserText, errorMessage, repairContents, rollbackTo, trimContents, type Content } from './gemini'
import { runGemini, type ToolStep } from './runner'
import { undoAction, type ActionCardData, type ConfirmPreview } from './tools'
import { clip } from './schema'

/** A proposed action of the local (fallback) agent, rendered as a confirm card. */
export interface ChatAction {
  data: AgentAction
  state: 'pending' | 'done' | 'cancelled'
  result?: ActionResult
  error?: string
}

/** "보내기 전 확인" card of the Gemini agent. */
export interface ConfirmState {
  stepId: string
  tool: string
  preview: ConfirmPreview
  state: 'pending' | 'confirmed' | 'cancelled'
  /** final (possibly edited) text */
  text?: string
}

export type ResultCard = ActionCardData & { id: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  /** assistant only */
  prompt?: string
  status?: 'thinking' | 'streaming' | 'done' | 'stopped' | 'error'
  /** which brain answered */
  engine?: 'gemini' | 'local'
  /* local agent */
  steps?: string[]
  stepIndex?: number
  variant?: number
  action?: ChatAction
  /* gemini agent */
  tools?: ToolStep[]
  cards?: ResultCard[]
  confirm?: ConfirmState
  error?: string
  /** machine-readable error kind (e.g. 'PLAN_LIMIT' → the panel offers an upgrade button) */
  errorCode?: string
}

export interface Conversation {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  /** Gemini `contents` history (model turns kept verbatim) */
  contents: Content[]
  /** context notes for the model, sent with the next user turn (e.g. "user undid X") */
  notes: string[]
}

export interface AIStatus {
  checked: boolean
  enabled: boolean
  model: string
  mock: boolean
}

interface AIChatState {
  conversations: Conversation[]
  /** userId → active conversation id */
  activeId: Record<string, string>
  busy: boolean
  confirmBeforeSend: boolean
  bannerDismissed: boolean
  /** the server answered NO_KEY during this session */
  noKey: boolean
  status: AIStatus

  send: (prompt: string) => void
  regenerate: (assistantId: string) => void
  stop: () => void
  /** start a fresh conversation (context reset) */
  newChat: () => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  clearHistory: () => void
  /* local agent confirm cards */
  confirmAction: (messageId: string, data?: AgentAction) => void
  cancelAction: (messageId: string) => void
  /* gemini */
  resolveConfirm: (messageId: string, ok: boolean, text?: string) => void
  undoCard: (messageId: string, cardId: string) => void
  setConfirmBeforeSend: (v: boolean) => void
  dismissBanner: () => void
  probeStatus: () => Promise<void>
}

const EMPTY: ChatMessage[] = []

/* ───────────── selectors ───────────── */

export function activeConversation(s: Pick<AIChatState, 'conversations' | 'activeId'>, userId = getCurrentUserId()): Conversation | undefined {
  const id = s.activeId[userId]
  return id ? s.conversations.find((c) => c.id === id && c.userId === userId) : undefined
}
export const selectMessages = (s: AIChatState) => activeConversation(s)?.messages ?? EMPTY

/** Gemini on? (server key present and not rejected as NO_KEY this session) */
export function geminiEnabled(s: Pick<AIChatState, 'noKey' | 'status'>, syncAi = useSyncStatus.getState().aiEnabled) {
  if (s.noKey) return false
  return s.status.checked ? s.status.enabled : syncAi
}

/** Messages that already changed the workspace can't be regenerated (it would run the writes again). */
export function canRegenerateMessage(conv: Conversation | undefined, m: ChatMessage): boolean {
  if (m.engine !== 'gemini') return true
  if (!conv) return false
  const lastAssistant = [...conv.messages].reverse().find((x) => x.role === 'assistant')
  return lastAssistant?.id === m.id && !(m.cards ?? []).some((c) => !c.undone)
}

/* ───────────── navigation bridge (set by the panel) ───────────── */

let navFn: ((path: string) => void) | null = null
export function setAINavigator(fn: ((path: string) => void) | null) {
  navFn = fn
}

/* ───────────── storage (debounced, quota-safe) ───────────── */

type Persisted = Pick<AIChatState, 'conversations' | 'activeId' | 'confirmBeforeSend' | 'bannerDismissed'>

/** Heavy part of persisting (trim + sort) — runs at flush time, not on every typewriter tick. */
function compactForStorage(s: Persisted): Persisted {
  return {
    conversations: [...(s.conversations ?? [])]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_CONVERSATIONS)
      .map((c) => ({ ...c, messages: c.messages.slice(-60), contents: trimContents(c.contents, { maxItems: 40, maxChars: 40_000 }) })),
    activeId: s.activeId,
    confirmBeforeSend: s.confirmBeforeSend,
    bannerDismissed: s.bannerDismissed,
  }
}

const pendingWrites = new Map<string, StorageValue<AIChatState>>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
const flush = () => {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  for (const [k, v] of pendingWrites) {
    try {
      localStorage.setItem(k, JSON.stringify({ ...v, state: compactForStorage(v.state as unknown as Persisted) }))
    } catch { /* quota / private mode — keep the in-memory state */ }
  }
  pendingWrites.clear()
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)
}
// AI chats are private to the member *and* the workspace (never leak across workspaces on one browser)
const scoped = (k: string) => { const scope = getSessionScope(); return scope ? `${k}@${scope}` : k }
const storage: PersistStorage<AIChatState> = {
  getItem: (key) => {
    const k = scoped(key)
    const p = pendingWrites.get(k)
    if (p) return p
    try {
      const raw = localStorage.getItem(k)
      return raw ? (JSON.parse(raw) as StorageValue<AIChatState>) : null
    } catch {
      return null
    }
  },
  setItem: (key, v) => {
    pendingWrites.set(scoped(key), v)
    if (!flushTimer) flushTimer = setTimeout(flush, 700)
  },
  removeItem: (key) => {
    const k = scoped(key)
    pendingWrites.delete(k)
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  },
}

/* ───────────── run bookkeeping (not persisted) ───────────── */

let timers: ReturnType<typeof setTimeout>[] = []
let interval: ReturnType<typeof setInterval> | null = null
const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
  if (interval) clearInterval(interval)
  interval = null
}
let controller: AbortController | null = null
let runSeq = 0
let pendingConfirm: { messageId: string; resolve: (r: { ok: boolean; text?: string }) => void } | null = null

const STEP_MS = 520
const MAX_CONVERSATIONS = 24

const upsertStep = (list: ToolStep[] | undefined, st: ToolStep) => {
  const cur = list ?? []
  return cur.some((x) => x.id === st.id) ? cur.map((x) => (x.id === st.id ? st : x)) : [...cur, st]
}

function newConversation(userId: string): Conversation {
  const now = new Date().toISOString()
  return { id: uid('conv'), userId, title: '새 대화', createdAt: now, updatedAt: now, messages: [], contents: [], notes: [] }
}

export const useAIChat = create<AIChatState>()(persist((set, get) => {
  /* patch helpers */
  const patchConv = (convId: string, p: Partial<Conversation> | ((c: Conversation) => Partial<Conversation>)) =>
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === convId ? { ...c, ...(typeof p === 'function' ? p(c) : p), updatedAt: new Date().toISOString() } : c)),
    }))
  const patchMsg = (convId: string, id: string, p: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id !== convId ? c : { ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, ...(typeof p === 'function' ? p(m) : p) } : m)) },
      ),
    }))
  const findMsg = (messageId: string) => {
    for (const c of get().conversations) {
      const m = c.messages.find((x) => x.id === messageId)
      if (m) return { conv: c, msg: m }
    }
    return null
  }

  /** Typewriter: ~1.6s regardless of length; snaps to word boundaries. */
  const typewrite = (convId: string, id: string, full: string, onDone?: () => void) => {
    clearTimers()
    patchMsg(convId, id, { status: 'streaming', content: '' })
    const per = Math.max(2, Math.ceil(full.length / 100))
    let pos = 0
    interval = setInterval(() => {
      let next = Math.min(full.length, pos + per + Math.floor(Math.random() * per))
      const space = full.indexOf(' ', next)
      if (space !== -1 && space - next < 4) next = space + 1
      pos = next
      patchMsg(convId, id, { content: full.slice(0, pos) })
      if (pos >= full.length) {
        clearTimers()
        patchMsg(convId, id, { status: 'done' })
        set({ busy: false })
        onDone?.()
      }
    }, 16)
  }

  /** Local rule-based agent (fallback when Gemini is off): thinking steps → typewriter. */
  const runLocal = (convId: string, id: string, prompt: string, variant: number) => {
    clearTimers()
    set({ busy: true })
    const answer = runAgent(prompt, variant)
    patchMsg(convId, id, {
      engine: 'local', steps: answer.steps, stepIndex: 0, status: 'thinking', content: '', variant, error: undefined,
      action: answer.action ? { data: answer.action, state: 'pending' } : undefined,
    })
    answer.steps.forEach((_, i) => {
      if (i > 0) timers.push(setTimeout(() => patchMsg(convId, id, { stepIndex: i }), i * STEP_MS))
    })
    timers.push(setTimeout(() => {
      patchMsg(convId, id, { stepIndex: answer.steps.length })
      typewrite(convId, id, answer.text)
    }, answer.steps.length * STEP_MS))
  }

  /** Real Gemini agent. */
  const runRemote = async (convId: string, id: string, prompt: string) => {
    clearTimers()
    const my = ++runSeq
    controller?.abort()
    const ctrl = new AbortController()
    controller = ctrl
    set({ busy: true })
    patchMsg(convId, id, { engine: 'gemini', status: 'thinking', content: '', tools: [], cards: [], confirm: undefined, error: undefined, errorCode: undefined, steps: undefined, action: undefined })

    const conv = get().conversations.find((c) => c.id === convId)
    if (!conv) return set({ busy: false })
    const base = repairContents(conv.contents)
    const notes = conv.notes
    patchConv(convId, { contents: appendUserText(base, prompt, notes), notes: [] })
    let progressed = false
    const live = () => my === runSeq && !ctrl.signal.aborted

    try {
      const out = await runGemini(get().conversations.find((c) => c.id === convId)!.contents, {
        signal: ctrl.signal,
        confirmBeforeSend: get().confirmBeforeSend,
        hooks: {
          onStep: (st) => { if (live()) patchMsg(convId, id, (m) => ({ tools: upsertStep(m.tools, st) })) },
          onCard: (card) => { if (my === runSeq) patchMsg(convId, id, (m) => ({ cards: [...(m.cards ?? []), { ...card, id: uid('card') }] })) },
          onContents: (contents) => {
            if (my !== runSeq) return
            progressed = true
            patchConv(convId, { contents: trimContents(contents) })
          },
          confirm: (req) =>
            new Promise((resolve) => {
              if (!live()) return resolve({ ok: false })
              pendingConfirm = { messageId: id, resolve }
              patchMsg(convId, id, { confirm: { stepId: req.stepId, tool: req.tool, preview: req.preview, state: 'pending', text: req.preview.text } })
            }),
          navigate: (path) => navFn?.(path),
        },
      })
      if (!live()) return
      const cards = get().conversations.find((c) => c.id === convId)?.messages.find((m) => m.id === id)?.cards ?? []
      const text = out.text || (cards.length ? '완료했어요. ✅' : '음… 이번에는 드릴 말씀을 찾지 못했어요. 다시 한번 말씀해 주시겠어요?')
      typewrite(convId, id, text)
    } catch (err) {
      if (my !== runSeq) return
      if (!progressed) patchConv(convId, (c) => ({ contents: base, notes: [...notes, ...c.notes] }))
      if (err instanceof GeminiError && err.code === 'ABORTED') return
      if (err instanceof GeminiError && err.code === 'NO_KEY') {
        // Fall back to the local agent for this answer (and the rest of the session).
        set((s) => ({ noKey: true, status: { ...s.status, checked: true, enabled: false } }))
        runLocal(convId, id, prompt, 0)
        return
      }
      // plan quota reached is an expected state (shown with an upgrade button), not a bug
      if (!(err instanceof GeminiError && err.code === 'PLAN_LIMIT')) console.warn('[Nexus AI]', err)
      patchMsg(convId, id, (m) => ({
        status: 'error',
        error: errorMessage(err),
        errorCode: err instanceof GeminiError ? err.code : undefined,
        tools: (m.tools ?? []).map((t) => (t.status === 'running' ? { ...t, status: 'cancelled' as const } : t)),
      }))
      set({ busy: false })
    } finally {
      if (pendingConfirm?.messageId === id) pendingConfirm = null
    }
  }

  const start = (convId: string, id: string, prompt: string) => {
    if (geminiEnabled(get())) void runRemote(convId, id, prompt)
    else runLocal(convId, id, prompt, 0)
  }

  return {
    conversations: [],
    activeId: {},
    busy: false,
    confirmBeforeSend: false,
    bannerDismissed: false,
    noKey: false,
    status: { checked: false, enabled: false, model: '', mock: false },

    send: (prompt) => {
      const text = prompt.trim()
      if (!text || get().busy) return
      const userId = getCurrentUserId()
      let conv = activeConversation(get(), userId)
      if (!conv) {
        conv = newConversation(userId)
        const c = conv
        set((s) => ({ conversations: [c, ...s.conversations].slice(0, MAX_CONVERSATIONS * 3), activeId: { ...s.activeId, [userId]: c.id } }))
      }
      const now = new Date().toISOString()
      const aid = uid('ai')
      const convId = conv.id
      const added: ChatMessage[] = [
        { id: uid('u'), role: 'user', content: text, createdAt: now },
        { id: aid, role: 'assistant', content: '', prompt: text, status: 'thinking', createdAt: now },
      ]
      patchConv(convId, (c) => ({
        title: c.messages.length ? c.title : clip(text, 32),
        messages: [...c.messages, ...added].slice(-80),
      }))
      start(convId, aid, text)
    },

    regenerate: (assistantId) => {
      const hit = findMsg(assistantId)
      if (!hit || !hit.msg.prompt || get().busy) return
      const { conv, msg } = hit
      const prompt = msg.prompt
      if (!prompt || !canRegenerateMessage(conv, msg)) return
      if (msg.engine === 'gemini') {
        patchConv(conv.id, { contents: rollbackTo(conv.contents, prompt) })
        if (geminiEnabled(get())) void runRemote(conv.id, msg.id, prompt)
        else runLocal(conv.id, msg.id, prompt, 0)
      } else if (geminiEnabled(get())) {
        void runRemote(conv.id, msg.id, prompt)
      } else {
        runLocal(conv.id, msg.id, prompt, (msg.variant ?? 0) + 1)
      }
    },

    stop: () => {
      clearTimers()
      controller?.abort()
      controller = null
      if (pendingConfirm) {
        pendingConfirm.resolve({ ok: false })
        pendingConfirm = null
      }
      set((s) => ({
        busy: false,
        conversations: s.conversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.status === 'thinking' || m.status === 'streaming'
              ? {
                  ...m,
                  status: 'stopped' as const,
                  content: m.content || '_응답이 중단되었어요._',
                  tools: m.tools?.map((t) => (t.status === 'running' ? { ...t, status: 'cancelled' as const } : t)),
                  confirm: m.confirm?.state === 'pending' ? { ...m.confirm, state: 'cancelled' as const } : m.confirm,
                }
              : m,
          ),
        })),
      }))
    },

    newChat: () => {
      if (get().busy) get().stop()
      const userId = getCurrentUserId()
      const cur = activeConversation(get(), userId)
      if (cur && !cur.messages.length) return
      set((s) => ({ activeId: { ...s.activeId, [userId]: '' } }))
    },

    selectConversation: (id) => {
      if (get().busy) get().stop()
      const userId = getCurrentUserId()
      set((s) => ({ activeId: { ...s.activeId, [userId]: id } }))
    },

    deleteConversation: (id) => {
      const userId = getCurrentUserId()
      if (activeConversation(get(), userId)?.id === id && get().busy) get().stop()
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
        activeId: s.activeId[userId] === id ? { ...s.activeId, [userId]: '' } : s.activeId,
      }))
    },

    clearHistory: () => {
      if (get().busy) get().stop()
      const userId = getCurrentUserId()
      set((s) => ({ conversations: s.conversations.filter((c) => c.userId !== userId), activeId: { ...s.activeId, [userId]: '' } }))
    },

    confirmAction: (messageId, data) => {
      const hit = findMsg(messageId)
      const m = hit?.msg
      if (!hit || !m?.action || m.action.state !== 'pending') return
      const next = data ?? m.action.data
      try {
        const result = executeAction(next)
        patchMsg(hit.conv.id, messageId, { action: { data: next, state: 'done', result } })
      } catch (err) {
        patchMsg(hit.conv.id, messageId, { action: { data: next, state: 'pending', error: err instanceof Error ? err.message : '실행하지 못했어요' } })
      }
    },
    cancelAction: (messageId) => {
      const hit = findMsg(messageId)
      const m = hit?.msg
      if (!hit || !m?.action || m.action.state !== 'pending') return
      patchMsg(hit.conv.id, messageId, { action: { ...m.action, state: 'cancelled', error: undefined } })
    },

    resolveConfirm: (messageId, ok, text) => {
      const hit = findMsg(messageId)
      if (!hit?.msg.confirm || hit.msg.confirm.state !== 'pending') return
      patchMsg(hit.conv.id, messageId, { confirm: { ...hit.msg.confirm, state: ok ? 'confirmed' : 'cancelled', text: text ?? hit.msg.confirm.text } })
      if (pendingConfirm?.messageId === messageId) {
        const p = pendingConfirm
        pendingConfirm = null
        p.resolve({ ok, text })
      }
    },

    undoCard: (messageId, cardId) => {
      const hit = findMsg(messageId)
      const card = hit?.msg.cards?.find((c) => c.id === cardId)
      if (!hit || !card?.undo || card.undone) return
      try {
        const summary = undoAction(card.undo)
        patchMsg(hit.conv.id, messageId, (m) => ({ cards: m.cards?.map((c) => (c.id === cardId ? { ...c, undone: true } : c)) }))
        patchConv(hit.conv.id, (c) => ({ notes: [...c.notes, `[시스템 메모] 사용자가 방금 "${card.title}" 작업을 실행 취소했습니다 (${summary}).`] }))
        toast(summary, { variant: 'success', emoji: '↩️' })
      } catch (err) {
        toast('실행 취소하지 못했어요', { variant: 'error', description: err instanceof Error ? err.message : undefined })
      }
    },

    setConfirmBeforeSend: (confirmBeforeSend) => set({ confirmBeforeSend }),
    dismissBanner: () => set({ bannerDismissed: true }),

    probeStatus: async () => {
      try {
        const r = await fetch('/api/ai/status')
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as { enabled?: boolean; model?: string; mock?: boolean }
        set((s) => ({ status: { checked: true, enabled: !!j.enabled, model: j.model ?? '', mock: !!j.mock }, noKey: j.enabled ? false : s.noKey }))
      } catch {
        set({ status: { checked: true, enabled: false, model: '', mock: false } })
      }
    },
  }
}, {
  name: STORAGE_PREFIX + 'ai-chat',
  version: 2,
  storage,
  // cheap (references only) — trimming happens in the debounced storage flush
  partialize: (s) => ({ conversations: s.conversations, activeId: s.activeId, confirmBeforeSend: s.confirmBeforeSend, bannerDismissed: s.bannerDismissed }) as unknown as AIChatState,
  migrate: (persisted, version) => {
    // v1: a single flat message list (local agent only)
    if (version < 2) {
      const old = (persisted as { messages?: ChatMessage[] } | undefined)?.messages ?? []
      const userId = getSessionUserId() ?? 'u_me'
      const conv = { ...newConversation(userId), title: clip(old.find((m) => m.role === 'user')?.content ?? '이전 대화', 32), messages: old.map((m) => ({ ...m, engine: 'local' as const })) }
      return { conversations: old.length ? [conv] : [], activeId: old.length ? { [userId]: conv.id } : {}, confirmBeforeSend: false, bannerDismissed: false } as unknown as AIChatState
    }
    return persisted as AIChatState
  },
  merge: (persisted, current) => {
    const p = (persisted ?? {}) as Partial<AIChatState>
    const conversations = (p.conversations ?? []).map((c) => ({
      ...c,
      notes: c.notes ?? [],
      contents: repairContents(c.contents ?? []),
      messages: c.messages.map((m): ChatMessage => {
        const confirm = m.confirm?.state === 'pending' ? { ...m.confirm, state: 'cancelled' as const } : m.confirm
        if (m.role !== 'assistant' || (m.status !== 'thinking' && m.status !== 'streaming')) return confirm === m.confirm ? m : { ...m, confirm }
        // Interrupted mid-answer (reload)
        if (m.engine === 'gemini' || !m.prompt) {
          return { ...m, confirm, status: 'stopped', content: m.content || '_응답이 중단되었어요._', tools: m.tools?.map((t) => (t.status === 'running' ? { ...t, status: 'cancelled' as const } : t)) }
        }
        try {
          const answer = runAgent(m.prompt, m.variant ?? 0)
          return { ...m, status: 'done', content: answer.text, steps: answer.steps, stepIndex: answer.steps.length, action: m.action ?? (answer.action ? { data: answer.action, state: 'pending' } : undefined) }
        } catch {
          return { ...m, status: 'stopped', content: m.content || '_응답이 중단되었어요._' }
        }
      }),
    }))
    return {
      ...current,
      conversations,
      activeId: p.activeId ?? {},
      confirmBeforeSend: !!p.confirmBeforeSend,
      bannerDismissed: !!p.bannerDismissed,
      busy: false,
    }
  },
}))
