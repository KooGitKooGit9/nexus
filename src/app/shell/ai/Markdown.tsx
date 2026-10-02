import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; lines: string[] }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'quote'; lines: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'hr' }

const splitRow = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())

function parse(src: string): Block[] {
  const lines = src.split('\n')
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++])
      i++
      out.push({ t: 'code', lang, text: buf.join('\n') })
      continue
    }
    if (!line.trim()) { i++; continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) { out.push({ t: 'h', level: h[1].length, text: h[2] }); i++; continue }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push({ t: 'hr' }); i++; continue }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(splitRow(lines[i]))
        i++
      }
      out.push({ t: 'table', head: rows[0] ?? [], rows: rows.slice(1) })
      continue
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''))
      out.push({ t: 'ul', items })
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      out.push({ t: 'ol', items })
      continue
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''))
      out.push({ t: 'quote', lines: buf })
      continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*[-*•]\s+|\s*\d+[.)]\s+|>|\s*\|)/.test(lines[i])) buf.push(lines[i++])
    if (!buf.length) { buf.push(line); i++ }
    out.push({ t: 'p', lines: buf })
  }
  return out
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|_[^_\s][^_]*_|~~[^~]+~~)/g

function Inline({ text, onLink }: { text: string; onLink: (href: string) => void }): ReactNode {
  const parts = text.split(INLINE)
  return parts.map((p, i) => {
    if (!p) return null
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i} className="font-semibold text-fg">{<Inline text={p.slice(2, -2)} onLink={onLink} />}</strong>
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i} className="rounded-md bg-surface-3/80 px-1.5 py-0.5 font-mono text-[0.85em] text-accent-3">{p.slice(1, -1)}</code>
    if (p.startsWith('~~') && p.endsWith('~~')) return <del key={i} className="text-subtle">{p.slice(2, -2)}</del>
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p)
    if (link) {
      const [, label, href] = link
      if (href.startsWith('/')) {
        return (
          <button key={i} onClick={() => onLink(href)} className="inline font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:decoration-accent">
            <Inline text={label} onLink={onLink} />
          </button>
        )
      }
      return <a key={i} href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">{label}</a>
    }
    if (p.startsWith('_') && p.endsWith('_') && p.length > 2) return <em key={i} className="text-fg/80">{p.slice(1, -1)}</em>
    return <span key={i}>{p}</span>
  })
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group/code relative my-2 overflow-hidden rounded-xl border border-line/10 bg-surface-3/50">
      <div className="flex items-center justify-between border-b border-line/[0.08] px-3 py-1.5 text-[10.5px] text-subtle">
        <span className="font-mono">{lang || 'text'}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400) }}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-line/10 hover:text-fg"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-fg/90"><code>{text}</code></pre>
    </div>
  )
}

/** Compact markdown renderer for chat bubbles. Internal links (`/path`) call `onLink`. */
export function Markdown({ text, onLink, className }: { text: string; onLink: (href: string) => void; className?: string }) {
  const blocks = parse(text)
  return (
    <div className={cn('space-y-2 text-[13.5px] leading-[1.65] text-fg/90', className)}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h': {
            const cls = b.level <= 2 ? 'text-[15px] font-bold text-fg mt-1' : 'text-[13.5px] font-semibold text-fg mt-2'
            return <div key={i} className={cls}><Inline text={b.text} onLink={onLink} /></div>
          }
          case 'p':
            return <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Inline text={l} onLink={onLink} /></span>)}</p>
          case 'ul':
            return (
              <ul key={i} className="space-y-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" /><span className="min-w-0"><Inline text={it} onLink={onLink} /></span></li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="space-y-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-[3px] flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-accent/15 text-[10.5px] font-bold text-accent">{j + 1}</span>
                    <span className="min-w-0"><Inline text={it} onLink={onLink} /></span>
                  </li>
                ))}
              </ol>
            )
          case 'code':
            return <CodeBlock key={i} lang={b.lang} text={b.text} />
          case 'quote':
            return (
              <div key={i} className="rounded-xl border border-accent/20 bg-accent/[0.07] px-3 py-2 text-[12.5px] text-fg/85">
                {b.lines.map((l, j) => <div key={j}><Inline text={l} onLink={onLink} /></div>)}
              </div>
            )
          case 'table':
            return (
              <div key={i} className="-mx-0.5 my-1 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-line/10 bg-line/[0.02]">
                <table className="w-max min-w-full border-collapse text-[11.5px] leading-snug">
                  <thead>
                    <tr className="bg-line/[0.05]">
                      {b.head.map((h, j) => <th key={j} className="whitespace-nowrap px-2 py-1.5 text-left text-[11px] font-semibold text-muted"><Inline text={h} onLink={onLink} /></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-t border-line/[0.07] hover:bg-line/[0.03]">
                        {r.map((c, k) => (
                          <td key={k} className={cn('px-2 py-1.5 align-top', k === 0 ? 'min-w-[3.5rem] max-w-[11rem] break-keep' : 'min-w-[4.5rem] max-w-[13rem] break-keep [overflow-wrap:anywhere]')}>
                            <Inline text={c} onLink={onLink} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'hr':
            return <div key={i} className="h-px bg-line/10" />
        }
      })}
    </div>
  )
}
