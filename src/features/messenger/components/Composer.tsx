import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle, AtSign, Bold, CalendarClock, ChevronDown, Code, Italic, Link2, List, ListOrdered, Loader2, Paperclip, Plus, Quote, SendHorizontal, Slash, Smile, SquareCode, Strikethrough, X,
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn, formatBytes, uid } from '@/lib/utils'
import { uploadFile } from '@/lib/upload'
import { getCurrentUserId, toast, useCore } from '@/store/core'
import { Avatar, Checkbox, Kbd, Popover, PresenceDot, Tooltip } from '@/components/ui'
import { useMessenger } from '../store'
import { channelLabel, useChatUI, isDirect } from '../lib'
import { respondTo } from '../simulator'
import { emitTyping, emitTypingStop } from '../realtime'
import { runSlashCommand, SLASH_COMMANDS } from '../actions'
import { searchEmoji } from '../emoji'
import { EmojiPicker } from './EmojiPicker'
import { FileTypeIcon } from './Attachments'
import type { Attachment } from '../types'

/** A file attached in the composer: uploading → done (server URL) | error. `preview` is a local blob URL for the chip only. */
interface PendingFile extends Attachment {
  status: 'uploading' | 'done' | 'error'
  progress: number
  preview?: string
}

/** What actually goes into the message (no local preview / upload state, never a blob: preview). */
function toAttachment({ status: _s, progress: _p, preview: _pv, ...att }: PendingFile): Attachment {
  return att
}

interface ComposerProps {
  channelId: string
  threadId?: string
  placeholder: string
  variant?: 'channel' | 'thread'
  fileDropRef?: MutableRefObject<((files: File[]) => void) | null>
}

type ACType = 'mention' | 'channel' | 'emoji' | 'slash'
interface ACState {
  type: ACType
  start: number
  end: number
  query: string
}
interface ACItem {
  id: string
  insert: string
  node: ReactNode
}

function detect(text: string, caret: number): ACState | null {
  if (text.startsWith('/')) {
    const sp = text.search(/\s/)
    if (sp === -1 || caret <= sp) return { type: 'slash', start: 0, end: sp === -1 ? text.length : sp, query: text.slice(1, sp === -1 ? text.length : sp) }
  }
  const before = text.slice(0, caret)
  let m = /(?:^|\s)@([^\s@]{0,20})$/.exec(before)
  if (m) return { type: 'mention', start: caret - m[1].length - 1, end: caret, query: m[1] }
  m = /(?:^|\s)#([^\s#]{0,30})$/.exec(before)
  if (m) return { type: 'channel', start: caret - m[1].length - 1, end: caret, query: m[1] }
  m = /(?:^|\s):([a-zA-Z가-힣]{2,20})$/.exec(before)
  if (m) return { type: 'emoji', start: caret - m[1].length - 1, end: caret, query: m[1] }
  return null
}

export function Composer({ channelId, threadId, placeholder, variant = 'channel', fileDropRef }: ComposerProps) {
  const draftKey = threadId ? `thread:${threadId}` : channelId
  const initial = useMessenger.getState().drafts[draftKey] ?? ''
  const [text, setText] = useState(initial)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [also, setAlso] = useState(false)
  const [ac, setAc] = useState<ACState | null>(null)
  const [acIndex, setAcIndex] = useState(0)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [schedOpen, setSchedOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const latest = useRef(text)
  useEffect(() => {
    latest.current = text
  }, [text])

  const users = useCore((s) => s.users)
  const channels = useMessenger((s) => s.channels)
  const channel = channels.find((c) => c.id === channelId)

  /* drafts: debounced save + flush on unmount */
  useEffect(() => {
    const t = setTimeout(() => useMessenger.getState().setDraft(draftKey, text), 350)
    return () => clearTimeout(t)
  }, [text, draftKey])
  useEffect(() => () => useMessenger.getState().setDraft(draftKey, latest.current), [draftKey])

  /* autogrow */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.4)) + 'px'
  }, [text])

  useEffect(() => {
    if (variant === 'channel') ref.current?.focus()
  }, [variant, channelId])

  /* attachments: upload right away (progress in the chip), message stores the server URL */
  const patchFile = (id: string, patch: Partial<PendingFile>) => setFiles((cur) => cur.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const previews = useRef(new Set<string>())
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), [])
  const removeFile = (id: string) =>
    setFiles((cur) => {
      const f = cur.find((x) => x.id === id)
      if (f?.preview) {
        URL.revokeObjectURL(f.preview)
        previews.current.delete(f.preview)
      }
      return cur.filter((x) => x.id !== id)
    })

  const startUpload = (f: File, id: string) => {
    patchFile(id, { status: 'uploading', progress: 0 })
    uploadFile(f, (pct) => patchFile(id, { progress: pct }))
      .then((res) => patchFile(id, { status: 'done', progress: 100, url: res.url, mime: res.mime || f.type || 'application/octet-stream', size: res.size ?? f.size }))
      .catch((err: unknown) => {
        patchFile(id, { status: 'error' })
        toast('파일 업로드에 실패했어요', { variant: 'error', emoji: '⚠️', description: `${f.name} · ${err instanceof Error ? err.message : '다시 시도해주세요'}` })
      })
  }
  const sources = useRef(new Map<string, File>())

  const addFiles = (list: File[]) => {
    if (!list.length) return
    const room = Math.max(0, 10 - files.length)
    if (list.length > room) toast('파일은 한 번에 10개까지 보낼 수 있어요', { variant: 'warning', emoji: '📎' })
    const picked = list.slice(0, room)
    const pending: PendingFile[] = picked.map((f) => {
      const mime = f.type || 'application/octet-stream'
      const preview = mime.startsWith('image/') ? URL.createObjectURL(f) : undefined
      if (preview) previews.current.add(preview)
      return { id: uid('att'), name: f.name || `clipboard-${Date.now()}.png`, size: f.size, mime, status: 'uploading', progress: 0, preview }
    })
    setFiles((cur) => [...cur, ...pending])
    pending.forEach((p, i) => {
      sources.current.set(p.id, picked[i])
      startUpload(picked[i], p.id)
      // remember the image's aspect ratio so the message can reserve the right space while it loads
      if (p.preview) {
        const img = new Image()
        img.onload = () => img.naturalHeight && patchFile(p.id, { aspect: Math.round((img.naturalWidth / img.naturalHeight) * 100) / 100 })
        img.src = p.preview
      }
    })
    ref.current?.focus()
  }
  const retryFile = (id: string) => {
    const f = sources.current.get(id)
    if (f) startUpload(f, id)
  }
  const uploading = files.some((f) => f.status === 'uploading')
  const readyFiles = files.filter((f) => f.status === 'done')
  useEffect(() => {
    if (!fileDropRef) return
    fileDropRef.current = addFiles
    return () => {
      fileDropRef.current = null
    }
  })

  /* autocomplete */
  const updateAc = (value: string, caret: number) => {
    const next = detect(value, caret)
    setAc(next)
    setAcIndex(0)
  }

  const items: ACItem[] = useMemo(() => {
    if (!ac) return []
    const q = ac.query.toLowerCase()
    if (ac.type === 'slash') {
      return SLASH_COMMANDS.filter((c) => c.name.startsWith(q)).map((c) => ({
        id: c.name,
        insert: `/${c.name} `,
        node: (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-line/[0.06] text-base">{c.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[13px] font-semibold">/{c.name}</span>
              <span className="block truncate text-[11.5px] text-subtle">{c.description}</span>
            </span>
            <span className="hidden truncate font-mono text-[11px] text-subtle sm:block">{c.usage}</span>
          </>
        ),
      }))
    }
    if (ac.type === 'mention') {
      const members = channel?.memberIds ?? []
      const list = users
        .filter((u) => !q || u.name.toLowerCase().includes(q) || u.nameEn.toLowerCase().includes(q) || u.title.toLowerCase().includes(q))
        .sort((a, b) => Number(members.includes(b.id)) - Number(members.includes(a.id)))
        .slice(0, 7)
        .map((u) => ({
          id: u.id,
          insert: `@${u.name} `,
          node: (
            <>
              <div className="relative">
                <Avatar user={u} size="sm" />
                <PresenceDot presence={u.presence} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
              </div>
              <span className="min-w-0 flex-1">
                <span className="text-[13.5px] font-medium">{u.name}</span>
                <span className="ml-2 text-[11.5px] text-subtle">{u.title}</span>
              </span>
              {!members.includes(u.id) && channel && !isDirect(channel) && <span className="text-[10.5px] text-subtle">채널 멤버 아님</span>}
            </>
          ),
        }))
      const broad = channel && !isDirect(channel)
        ? [
            { k: 'here', d: '현재 활동 중인 멤버에게 알림' },
            { k: 'channel', d: '채널의 모든 멤버에게 알림' },
          ]
            .filter((b) => !q || b.k.startsWith(q))
            .map((b) => ({
              id: b.k,
              insert: `@${b.k} `,
              node: (
                <>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning/15 text-warning"><AtSign className="h-3.5 w-3.5" /></span>
                  <span className="text-[13.5px] font-medium">@{b.k}</span>
                  <span className="text-[11.5px] text-subtle">{b.d}</span>
                </>
              ),
            }))
        : []
      return [...list, ...broad]
    }
    if (ac.type === 'channel') {
      const me = getCurrentUserId()
      return channels
        .filter((c) => (c.kind === 'public' || (c.kind === 'private' && c.memberIds.includes(me))) && c.name.toLowerCase().includes(q))
        .slice(0, 7)
        .map((c) => ({
          id: c.id,
          insert: `#${c.name} `,
          node: (
            <>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-line/[0.06] text-sm">{c.emoji ?? '#'}</span>
              <span className="text-[13.5px] font-medium">{c.name}</span>
              <span className="truncate text-[11.5px] text-subtle">{c.topic}</span>
            </>
          ),
        }))
    }
    return searchEmoji(ac.query, 8).map((e) => ({
      id: e.e,
      insert: `${e.e} `,
      node: (
        <>
          <span className="text-xl leading-none">{e.e}</span>
          <span className="text-[13px] text-muted">:{e.k.split(' ')[0]}:</span>
        </>
      ),
    }))
  }, [ac, users, channels, channel])

  const choose = (item: ACItem) => {
    if (!ac) return
    const next = text.slice(0, ac.start) + item.insert + text.slice(ac.end).replace(/^\s/, '')
    const caret = ac.start + item.insert.length
    setText(next)
    setAc(null)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  /* formatting */
  const wrap = (before: string, after = before, placeholderText = '텍스트') => {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const sel = text.slice(s, e) || placeholderText
    setText(text.slice(0, s) + before + sel + after + text.slice(e))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + before.length, s + before.length + sel.length)
    })
  }
  const prefixLines = (mk: (i: number) => string) => {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const lineStart = text.lastIndexOf('\n', s - 1) + 1
    const block = text.slice(lineStart, e) || ''
    const out = block.split('\n').map((l, i) => mk(i) + l).join('\n')
    setText(text.slice(0, lineStart) + out + text.slice(e))
    requestAnimationFrame(() => {
      el.focus()
      const end = lineStart + out.length
      el.setSelectionRange(end, end)
    })
  }
  const insertAtCaret = (str: string) => {
    const el = ref.current
    const s = el?.selectionStart ?? text.length
    const e = el?.selectionEnd ?? text.length
    const next = text.slice(0, s) + str + text.slice(e)
    setText(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(s + str.length, s + str.length)
      updateAc(next, s + str.length)
    })
  }

  const reset = () => {
    setText('')
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
    previews.current.clear()
    sources.current.clear()
    setFiles([])
    setAc(null)
    useMessenger.getState().setDraft(draftKey, '')
    emitTypingStop(channelId, threadId)
  }

  /** false (+ toast) while files are still uploading */
  const filesReady = () => {
    if (uploading) {
      toast('파일 업로드가 끝나면 보낼 수 있어요', { emoji: '⏳', variant: 'info' })
      return false
    }
    if (files.some((f) => f.status === 'error') && !readyFiles.length && !text.trim()) {
      toast('업로드에 실패한 파일은 보낼 수 없어요', { variant: 'warning', emoji: '⚠️', description: '다시 시도하거나 제거해주세요' })
      return false
    }
    return true
  }

  const send = () => {
    const t = text.trim()
    if (!t && !files.length) return
    if (t.startsWith('/') && !files.length) {
      if (runSlashCommand(t, channelId, threadId)) reset()
      return
    }
    if (!filesReady()) return
    if (!t && !readyFiles.length) return
    const msg = useMessenger.getState().sendMessage({ channelId, text: t, threadId, attachments: readyFiles.map(toAttachment), alsoInChannel: threadId ? also : undefined })
    respondTo(msg)
    reset()
  }

  const schedule = (at: Date) => {
    const t = text.trim()
    if (!t && !readyFiles.length) {
      toast(uploading ? '파일 업로드가 끝나면 예약할 수 있어요' : '예약할 메시지를 먼저 입력해주세요', { variant: 'warning', emoji: uploading ? '⏳' : '✍️' })
      return
    }
    if (!filesReady()) return
    useMessenger.getState().scheduleMessage({ channelId, text: t, threadId, attachments: readyFiles.map(toAttachment) }, at.toISOString())
    toast('메시지가 예약되었습니다', { emoji: '🗓️', variant: 'success', description: format(at, 'M월 d일 (EEE) a h:mm', { locale: ko }) + '에 전송' })
    reset()
    setSchedOpen(false)
  }

  const editLast = () => {
    const me = getCurrentUserId()
    const msgs = useMessenger.getState().messages
    const last = [...msgs].reverse().find((m) => m.channelId === channelId && m.userId === me && !m.deleted && (threadId ? m.threadId === threadId : !m.threadId) && (!m.kind || m.kind === 'text'))
    if (last) useChatUI.getState().setEditing(last.id)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (ac && items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex((i) => (i + 1) % items.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex((i) => (i - 1 + items.length) % items.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(items[acIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setAc(null); return }
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      const k = e.key.toLowerCase()
      if (k === 'b') { e.preventDefault(); wrap('**'); return }
      if (k === 'i') { e.preventDefault(); wrap('_'); return }
      if (k === 'e') { e.preventDefault(); wrap('`', '`', 'code'); return }
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'x') { e.preventDefault(); wrap('~'); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
      return
    }
    if (e.key === 'ArrowUp' && !text) {
      e.preventDefault()
      editLast()
    }
  }

  const canSend = (text.trim().length > 0 || readyFiles.length > 0) && !uploading
  const isThread = variant === 'thread'

  const fmtBtns: { icon: ReactNode; label: string; kbd?: string; run: () => void }[] = [
    { icon: <Bold />, label: '굵게', kbd: '⌘B', run: () => wrap('**') },
    { icon: <Italic />, label: '기울임', kbd: '⌘I', run: () => wrap('_') },
    { icon: <Strikethrough />, label: '취소선', kbd: '⌘⇧X', run: () => wrap('~') },
    { icon: <Code />, label: '코드', kbd: '⌘E', run: () => wrap('`', '`', 'code') },
    { icon: <Link2 />, label: '링크', run: () => wrap('[', '](https://)', '링크 텍스트') },
    { icon: <List />, label: '글머리 기호', run: () => prefixLines(() => '- ') },
    { icon: <ListOrdered />, label: '번호 목록', run: () => prefixLines((i) => `${i + 1}. `) },
    { icon: <Quote />, label: '인용', run: () => prefixLines(() => '> ') },
    { icon: <SquareCode />, label: '코드 블록', run: () => wrap('```\n', '\n```', 'code') },
  ]

  return (
    <div className={cn(isThread ? 'px-4 pb-4' : 'px-5 pb-4')}>
      <ScheduledStrip channelId={channelId} threadId={threadId} />
      <div
        className={cn(
          'relative rounded-2xl border bg-surface/70 backdrop-blur-xl transition-all duration-200',
          focused ? 'border-accent/45 shadow-[0_0_0_4px_rgb(var(--accent)/0.08),0_12px_40px_-16px_rgb(var(--accent)/0.45)]' : 'border-line/10 shadow-card',
        )}
      >
        {/* autocomplete */}
        <AnimatePresence>
          {ac && items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.14 }}
              className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-2xl glass-strong shadow-float"
            >
              <div className="flex items-center justify-between border-b border-line/[0.07] px-3 py-1.5 text-[11px] font-semibold text-subtle">
                <span>{{ slash: '명령어', mention: '사람', channel: '채널', emoji: '이모지' }[ac.type]}</span>
                <span className="flex items-center gap-1 font-normal"><Kbd>↑</Kbd><Kbd>↓</Kbd> 이동 <Kbd>Enter</Kbd> 선택 <Kbd>Esc</Kbd> 닫기</span>
              </div>
              <div className="max-h-72 overflow-y-auto p-1">
                {items.map((it, i) => (
                  <button
                    key={it.id}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      choose(it)
                    }}
                    onMouseEnter={() => setAcIndex(i)}
                    className={cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors', i === acIndex ? 'bg-accent/15' : 'hover:bg-line/[0.05]')}
                  >
                    {it.node}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* format toolbar */}
        {!isThread && (
          <div className="flex items-center gap-0.5 border-b border-line/[0.06] px-2 py-1">
            {fmtBtns.map((b, i) => (
              <span key={b.label} className="contents">
                {(i === 4 || i === 5 || i === 7) && <span className="mx-1 h-4 w-px bg-line/10" />}
                <Tooltip content={<span className="flex items-center gap-1.5">{b.label}{b.kbd && <span className="text-white/50">{b.kbd}</span>}</span>}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={b.run} className="flex h-7 w-7 items-center justify-center rounded-lg text-subtle transition hover:bg-line/[0.07] hover:text-fg [&>svg]:h-[15px] [&>svg]:w-[15px]">
                    {b.icon}
                  </button>
                </Tooltip>
              </span>
            ))}
          </div>
        )}

        {/* pending files */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap gap-2 px-3 pt-3">
                {files.map((f) => (
                  <motion.div key={f.id} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="group/f relative">
                    {f.mime.startsWith('image/') && (f.preview || f.url) ? (
                      <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-line/10 shadow-card">
                        <img src={f.preview || f.url} alt={f.name} className={cn('h-full w-full object-cover transition', f.status !== 'done' && 'scale-105 blur-[1px] brightness-75')} />
                        {f.status !== 'done' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            {f.status === 'uploading' ? <UploadRing pct={f.progress} /> : (
                              <button onClick={() => retryFile(f.id)} title="다시 시도" className="flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white shadow"><AlertCircle className="h-4 w-4" /></button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={cn('relative flex h-16 w-56 items-center gap-2.5 overflow-hidden rounded-xl border bg-surface-2/70 px-2.5', f.status === 'error' ? 'border-danger/40' : 'border-line/10')}>
                        <FileTypeIcon att={f} />
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-medium">{f.name}</div>
                          <div className={cn('flex items-center gap-1 text-[11px]', f.status === 'error' ? 'text-danger' : 'text-subtle')}>
                            {f.status === 'uploading' ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> 업로드 중 {f.progress}%</>
                            ) : f.status === 'error' ? (
                              <>업로드 실패 · <button onClick={() => retryFile(f.id)} className="font-semibold underline-offset-2 hover:underline">다시 시도</button></>
                            ) : (
                              formatBytes(f.size)
                            )}
                          </div>
                        </div>
                        {f.status === 'uploading' && (
                          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-line/10">
                            <motion.span className="block h-full bg-accent-gradient" initial={false} animate={{ width: `${f.progress}%` }} transition={{ ease: 'easeOut', duration: 0.2 }} />
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => removeFile(f.id)}
                      aria-label="첨부 제거"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white opacity-0 shadow ring-2 ring-surface transition group-hover/f:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setTimeout(() => setAc(null), 120)
          }}
          onChange={(e) => {
            const v = e.target.value
            setText(v)
            updateAc(v, e.target.selectionStart)
            if (v.trim() && !v.startsWith('/')) emitTyping(channelId, threadId)
            else if (!v.trim()) emitTypingStop(channelId, threadId)
          }}
          onClick={(e) => updateAc(text, e.currentTarget.selectionStart)}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) updateAc(text, e.currentTarget.selectionStart)
          }}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files)
            if (pasted.length) {
              e.preventDefault()
              addFiles(pasted)
            }
          }}
          className={cn('block w-full resize-none bg-transparent px-4 text-[14.5px] leading-[1.55] text-fg outline-none placeholder:text-subtle', isThread ? 'pt-3 pb-1' : 'pt-3 pb-1.5')}
        />

        {/* bottom row */}
        <div className="flex items-center gap-0.5 px-2 pb-2">
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          <Tooltip content="파일 첨부">
            <button onClick={() => fileInput.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-full bg-line/[0.06] text-muted transition hover:bg-accent/15 hover:text-accent">
              <Plus className="h-4 w-4" />
            </button>
          </Tooltip>
          <Popover
            placement="top-start"
            className="p-1"
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            trigger={({ toggle }) => (
              <Tooltip content="이모지">
                <button onClick={toggle} className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-line/[0.07] hover:text-fg', emojiOpen && 'text-accent')}>
                  <Smile className="h-[17px] w-[17px]" />
                </button>
              </Tooltip>
            )}
          >
            <EmojiPicker
              onPick={(e) => {
                setEmojiOpen(false)
                insertAtCaret(e)
              }}
            />
          </Popover>
          <Tooltip content="멘션">
            <button onClick={() => insertAtCaret(text && !/\s$/.test(text) ? ' @' : '@')} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-line/[0.07] hover:text-fg">
              <AtSign className="h-[17px] w-[17px]" />
            </button>
          </Tooltip>
          {!isThread && (
            <>
              <Tooltip content="첨부">
                <button onClick={() => fileInput.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-line/[0.07] hover:text-fg">
                  <Paperclip className="h-[17px] w-[17px]" />
                </button>
              </Tooltip>
              <Tooltip content="명령어">
                <button
                  onClick={() => {
                    setText('/')
                    requestAnimationFrame(() => {
                      ref.current?.focus()
                      ref.current?.setSelectionRange(1, 1)
                      updateAc('/', 1)
                    })
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-line/[0.07] hover:text-fg"
                >
                  <Slash className="h-[15px] w-[15px]" />
                </button>
              </Tooltip>
            </>
          )}

          {isThread && (
            <div className="ml-2 flex min-w-0 cursor-pointer select-none items-center gap-1.5 text-[12px] text-muted">
              <Checkbox checked={also} onChange={setAlso} className="h-4 w-4" />
              <span className="truncate" onClick={() => setAlso(!also)}>{channel ? `${channelLabel(channel)}에도 전송` : '채널에도 전송'}</span>
            </div>
          )}

          <div className="ml-auto flex items-center">
            <AnimatePresence>
              {focused && !isThread && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mr-3 hidden text-[11px] text-subtle lg:block">
                  <b className="font-semibold text-muted">Enter</b> 전송 · <b className="font-semibold text-muted">Shift+Enter</b> 줄바꿈
                </motion.span>
              )}
            </AnimatePresence>
            <div className={cn('flex h-8 items-center overflow-hidden rounded-xl transition-all', canSend ? 'bg-accent-gradient text-white shadow-glow-sm' : 'bg-line/[0.06] text-subtle')}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={send} disabled={!canSend} title={uploading ? '업로드 중…' : '전송'} className="flex h-8 w-9 items-center justify-center disabled:cursor-not-allowed">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              </motion.button>
              <span className={cn('h-4 w-px', canSend ? 'bg-white/30' : 'bg-line/10')} />
              <Popover
                placement="top-end"
                open={schedOpen}
                onOpenChange={setSchedOpen}
                trigger={({ toggle }) => (
                  <button onClick={toggle} className="flex h-8 w-6 items-center justify-center" title="예약 전송">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
              >
                <ScheduleMenu onPick={schedule} />
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadRing({ pct }: { pct: number }) {
  const r = 11
  const c = 2 * Math.PI * r
  return (
    <span className="relative flex h-8 w-8 items-center justify-center">
      <svg viewBox="0 0 28 28" className="absolute inset-0 h-8 w-8 -rotate-90">
        <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
        <circle cx="14" cy="14" r={r} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} className="transition-[stroke-dashoffset] duration-200" />
      </svg>
      <span className="text-[9px] font-bold text-white">{pct}</span>
    </span>
  )
}

/* ───────────── Schedule-send ───────────── */

function ScheduleMenu({ onPick }: { onPick: (d: Date) => void }) {
  const [custom, setCustom] = useState(() => {
    const d = new Date(Date.now() + 3600_000)
    d.setMinutes(0, 0, 0)
    return format(d, "yyyy-MM-dd'T'HH:mm")
  })
  const now = new Date()
  const at = (days: number, h: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(h, 0, 0, 0)
    return d
  }
  const nextMonday = () => {
    const d = new Date()
    const diff = ((8 - d.getDay()) % 7) || 7
    d.setDate(d.getDate() + diff)
    d.setHours(9, 0, 0, 0)
    return d
  }
  const opts = [
    { label: '1분 후 (데모)', d: new Date(now.getTime() + 60_000) },
    { label: '30분 후', d: new Date(now.getTime() + 30 * 60_000) },
    { label: '1시간 후', d: new Date(now.getTime() + 60 * 60_000) },
    ...(now.getHours() < 18 ? [{ label: '오늘 오후 6:00', d: at(0, 18) }] : []),
    { label: '내일 오전 9:00', d: at(1, 9) },
    { label: '다음 주 월요일 오전 9:00', d: nextMonday() },
  ]
  return (
    <div className="w-64">
      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1 text-[12px] font-semibold text-muted">
        <CalendarClock className="h-4 w-4 text-accent" /> 예약 전송
      </div>
      {opts.map((o) => (
        <button key={o.label} onClick={() => onPick(o.d)} className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] transition hover:bg-line/[0.07]">
          {o.label}
          <span className="text-[11px] text-subtle">{format(o.d, 'M/d a h:mm', { locale: ko })}</span>
        </button>
      ))}
      <div className="my-1 h-px bg-line/10" />
      <div className="flex items-center gap-1.5 p-1.5">
        <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="input-base h-8 flex-1 px-2 py-1 text-[12px]" />
        <button
          onClick={() => {
            const d = new Date(custom)
            if (isNaN(d.getTime()) || d < new Date()) {
              toast('미래 시간을 선택해주세요', { variant: 'warning', emoji: '⏱' })
              return
            }
            onPick(d)
          }}
          className="h-8 rounded-lg bg-accent-gradient px-2.5 text-[12px] font-semibold text-white"
        >
          예약
        </button>
      </div>
    </div>
  )
}

function ScheduledStrip({ channelId, threadId }: { channelId: string; threadId?: string }) {
  const all = useMessenger((s) => s.scheduled)
  const list = all.filter((m) => m.channelId === channelId && (m.threadId ?? undefined) === threadId)
  const { cancelScheduled, sendScheduledNow } = useMessenger.getState()
  if (!list.length) return null
  return (
    <div className="mb-2 space-y-1.5">
      <AnimatePresence initial={false}>
        {list.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2.5 rounded-xl border border-dashed border-accent/35 bg-accent/[0.05] px-3 py-1.5"
          >
            <CalendarClock className="h-4 w-4 shrink-0 text-accent" />
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10.5px] font-bold text-accent">예약됨</span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg/80">{m.text || `파일 ${m.attachments?.length ?? 0}개`}</span>
            <span className="shrink-0 text-[11.5px] text-muted">{format(new Date(m.scheduledFor!), 'M월 d일 a h:mm', { locale: ko })}</span>
            <button
              onClick={() => {
                const sent = sendScheduledNow(m.id)
                if (sent) respondTo(sent)
              }}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-accent hover:bg-accent/10">지금 전송</button>
            <button onClick={() => cancelScheduled(m.id)} className="shrink-0 rounded-md p-0.5 text-subtle hover:bg-line/10 hover:text-fg"><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

