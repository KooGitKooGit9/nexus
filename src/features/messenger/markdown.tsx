import { Fragment, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Copy, Hash, Lock, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUser, useCore } from '@/store/core'
import { Avatar, Button, Popover, PRESENCE_LABEL } from '@/components/ui'
import { useMessenger } from './store'
import { joinMeta } from '@/features/people/format'

/* ───────────── Inline tokenizer ───────────── */

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let cachedNames = ''
let cachedRe: RegExp | null = null
function inlineRegex(): RegExp {
  const names = useCore
    .getState()
    .users.map((u) => u.name)
    .sort((a, b) => b.length - a.length)
  const key = names.join('|')
  if (cachedRe && key === cachedNames) return cachedRe
  cachedNames = key
  const mention = `@(?:${names.map(escapeRe).join('|')}|here|channel|everyone)`
  cachedRe = new RegExp(
    [
      '(\\\\[*_~`\\\\])', // 1 escape
      '(`[^`\\n]+`)', // 2 code
      '(\\*\\*[^*\\n]+?\\*\\*)', // 3 bold
      '(~[^~\\n]+?~)', // 4 strike
      '((?<![\\w\\\\])_[^_\\n]+?_(?!\\w))', // 5 italic
      '(\\[[^\\]\\n]+\\]\\([^)\\s]+\\))', // 6 md link
      '(https?:\\/\\/[^\\s<]+[^\\s<.,:;"\')\\]])', // 7 url
      `(${mention})`, // 8 mention
      '((?<![\\w/&])#[a-z0-9가-힣_-]+)', // 9 channel
    ].join('|'),
    'g',
  )
  return cachedRe
}

export interface MdOptions {
  highlight?: string
  /** collapse to a single line (previews) */
  plain?: boolean
}

function highlightText(text: string, q: string | undefined, keyBase: string): ReactNode {
  if (!q || !q.trim()) return text
  const re = new RegExp(`(${escapeRe(q.trim())})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <mark key={keyBase + i} className="rounded bg-warning/30 px-0.5 text-fg">
        {p}
      </mark>
    ) : (
      <Fragment key={keyBase + i}>{p}</Fragment>
    ),
  )
}

export function renderInline(text: string, opts: MdOptions = {}, keyBase = 'i'): ReactNode[] {
  // fresh instance per call: renderInline recurses (bold/italic content), so a shared global regex would clobber lastIndex
  const re = new RegExp(inlineRegex().source, 'g')
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let n = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={`${keyBase}t${n++}`}>{highlightText(text.slice(last, m.index), opts.highlight, `${keyBase}h${n}`)}</Fragment>)
    const tok = m[0]
    const k = `${keyBase}-${n++}`
    if (m[1]) out.push(tok.slice(1))
    else if (m[2]) out.push(<code key={k} className="rounded-md border border-line/10 bg-surface-3/70 px-1.5 py-[1px] font-mono text-[0.84em] text-accent-3">{tok.slice(1, -1)}</code>)
    else if (m[3]) out.push(<strong key={k} className="font-semibold text-fg">{renderInline(tok.slice(2, -2), opts, k)}</strong>)
    else if (m[4]) out.push(<s key={k} className="text-muted">{renderInline(tok.slice(1, -1), opts, k)}</s>)
    else if (m[5]) out.push(<em key={k} className="italic">{renderInline(tok.slice(1, -1), opts, k)}</em>)
    else if (m[6]) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!
      out.push(<a key={k} href={mm[2]} target="_blank" rel="noreferrer" className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">{mm[1]}</a>)
    } else if (m[7]) out.push(<a key={k} href={tok} target="_blank" rel="noreferrer" className="break-all text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">{tok}</a>)
    else if (m[8]) out.push(opts.plain ? <span key={k} className="font-medium text-accent">{tok}</span> : <Mention key={k} name={tok.slice(1)} />)
    else if (m[9]) out.push(opts.plain ? <span key={k} className="font-medium text-accent">{tok}</span> : <ChannelRef key={k} name={tok.slice(1)} />)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(<Fragment key={`${keyBase}end`}>{highlightText(text.slice(last), opts.highlight, `${keyBase}he`)}</Fragment>)
  return out
}

/* ───────────── Mentions & channel references ───────────── */

function Mention({ name }: { name: string }) {
  const me = useCore((s) => s.users.find((u) => u.id === s.currentUserId))
  const user = useCore((s) => s.users.find((u) => u.name === name))
  const isBroadcast = ['here', 'channel', 'everyone'].includes(name)
  const self = me?.name === name
  const cls = cn(
    'rounded-md px-1 py-[1px] font-medium transition-colors cursor-pointer',
    self || isBroadcast ? 'bg-warning/20 text-amber-600 dark:text-amber-300 hover:bg-warning/30' : 'bg-accent/15 text-accent hover:bg-accent/25',
  )
  if (!user) return <span className={cls}>@{name}</span>
  return (
    <Popover placement="top-start" className="w-72 p-0" trigger={({ toggle }) => <span className={cls} onClick={toggle}>@{name}</span>}>
      {(close) => <ProfileCard userId={user.id} onDone={close} />}
    </Popover>
  )
}

export function ProfileCard({ userId, onDone }: { userId: string; onDone?: () => void }) {
  const u = getUser(userId)
  const navigate = useNavigate()
  const openDM = useMessenger((s) => s.openDM)
  const meId = useCore((s) => s.currentUserId)
  if (!u) return null
  return (
    <div className="overflow-hidden rounded-2xl">
      <div className="relative h-16 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x opacity-80" />
      <div className="-mt-8 px-4 pb-4">
        <Avatar user={u} size="lg" showPresence className="ring-4 ring-surface rounded-full" />
        <div className="mt-2 flex items-center gap-1.5 text-[15px] font-semibold">
          {u.name}
          {u.statusEmoji && <span>{u.statusEmoji}</span>}
        </div>
        <div className="text-xs text-muted">{joinMeta(u.title, u.department)}</div>
        {u.statusText && <div className="mt-2 rounded-lg bg-line/[0.05] px-2.5 py-1.5 text-xs text-muted">{u.statusEmoji} {u.statusText}</div>}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-subtle">
          <span>{PRESENCE_LABEL[u.presence]}</span>
          <span>·</span>
          <span>{u.location}</span>
        </div>
        {u.id !== meId && u.id !== 'u_bot' && (
          <Button
            size="sm"
            variant="primary"
            className="mt-3 w-full"
            leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
            onClick={() => {
              const ch = openDM([u.id])
              onDone?.()
              navigate(`/messages/${ch.id}`)
            }}
          >
            메시지 보내기
          </Button>
        )}
      </div>
    </div>
  )
}

function ChannelRef({ name }: { name: string }) {
  const ch = useMessenger((s) => s.channels.find((c) => c.name === name && (c.kind === 'public' || c.kind === 'private')))
  if (!ch) return <>#{name}</>
  return (
    <Link to={`/messages/${ch.id}`} className="inline-flex items-center gap-0.5 rounded-md bg-accent-2/10 px-1 py-[1px] font-medium text-accent-2 hover:bg-accent-2/20">
      {ch.kind === 'private' ? <Lock className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
      {ch.name}
    </Link>
  )
}

/* ───────────── Code blocks with tiny syntax highlighter ───────────── */

const KW = /\b(const|let|var|function|return|if|else|for|while|import|from|export|default|class|new|async|await|suspend|fun|val|try|catch|throw|interface|type|extends|implements|public|private|def|in|of|null|undefined|true|false|this|repeat|struct|func|go|package|select|where|insert|update|delete|create|table)\b/
const TOKEN_RE = /(\/\/[^\n]*|#[^\n]*|--[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/g

function highlightCode(code: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index))
    const t = m[0]
    if (m[1]) out.push(<span key={i++} className="italic text-subtle">{t}</span>)
    else if (m[2]) out.push(<span key={i++} className="text-emerald-500 dark:text-emerald-300">{t}</span>)
    else if (m[3]) out.push(<span key={i++} className="text-amber-600 dark:text-amber-300">{t}</span>)
    else if (KW.test(t)) out.push(<span key={i++} className="text-violet-600 dark:text-violet-300">{t}</span>)
    else if (/^[A-Z]/.test(t)) out.push(<span key={i++} className="text-sky-600 dark:text-sky-300">{t}</span>)
    else if (code[m.index + t.length] === '(') out.push(<span key={i++} className="text-pink-600 dark:text-pink-300">{t}</span>)
    else out.push(t)
    last = m.index + t.length
  }
  if (last < code.length) out.push(code.slice(last))
  return out
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group/code relative my-1.5 overflow-hidden rounded-xl border border-line/10 bg-surface-3/50">
      <div className="flex items-center justify-between border-b border-line/[0.07] bg-line/[0.03] px-3 py-1">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-subtle">{lang || 'code'}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 1400)
          }}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-subtle opacity-0 transition hover:bg-line/10 hover:text-fg group-hover/code:opacity-100"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-2.5 font-mono text-[12.5px] leading-[1.65] text-fg/90">
        <code>{highlightCode(code)}</code>
      </pre>
    </div>
  )
}

/* ───────────── Block renderer ───────────── */

export function Markdown({ text, highlight, className }: { text: string; highlight?: string; className?: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0
  const opts = { highlight }
  while (i < lines.length) {
    const line = lines[i]
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) body.push(lines[i++])
      i++
      blocks.push(<CodeBlock key={k++} code={body.join('\n')} lang={lang} />)
      continue
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(
        <blockquote key={k++} className="my-1 border-l-[3px] border-accent/50 pl-3 text-fg/80">
          {body.map((b, j) => (
            <div key={j}>{renderInline(b, opts, `q${k}-${j}`)}</div>
          ))}
        </blockquote>,
      )
      continue
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''))
      blocks.push(
        <ul key={k++} className="my-1 space-y-0.5 pl-1">
          {items.map((it, j) => (
            <li key={j} className="flex gap-2">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
              <span className="min-w-0">{renderInline(it, opts, `l${k}-${j}`)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocks.push(
        <ol key={k++} className="my-1 space-y-0.5 pl-1">
          {items.map((it, j) => (
            <li key={j} className="flex gap-2">
              <span className="w-4 shrink-0 text-right font-mono text-[12px] leading-[1.6rem] text-accent">{j + 1}.</span>
              <span className="min-w-0">{renderInline(it, opts, `o${k}-${j}`)}</span>
            </li>
          ))}
        </ol>,
      )
      continue
    }
    if (!line.trim()) {
      i++
      if (blocks.length) blocks.push(<div key={k++} className="h-1.5" />)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(>|\s*[-*•]\s+|\s*\d+[.)]\s+|\s*```)/.test(lines[i])) para.push(lines[i++])
    blocks.push(
      <p key={k++} className="whitespace-pre-wrap break-words">
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(p, opts, `p${k}-${j}`)}
          </Fragment>
        ))}
      </p>,
    )
  }
  return <div className={cn('text-[14.5px] leading-[1.6] text-fg/90', className)}>{blocks}</div>
}

/** Single-line plain-ish preview (search results, thread summaries, pins). */
export function InlinePreview({ text, highlight, className }: { text: string; highlight?: string; className?: string }) {
  const flat = text.replace(/```[\s\S]*?```/g, '[코드]').replace(/\n+/g, ' ').replace(/^>\s?/, '')
  return <span className={cn('break-words', className)}>{renderInline(flat, { highlight, plain: true }, 'pv')}</span>
}
