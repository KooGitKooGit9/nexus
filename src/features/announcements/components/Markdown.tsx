import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Minimal, safe markdown → React renderer (no innerHTML).
 * Supports: # headings, lists (-, *, 1.), > quotes, ``` fences, | tables |, ---, paragraphs,
 * inline **bold**, *italic* / _italic_, `code`, ~~strike~~, [links](url), @mentions.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={cn('prose-nexus', className)}>{renderBlocks(source)}</div>
}

function renderBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    // fenced code
    if (line.trim().startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++])
      i++
      out.push(<pre key={k++}><code>{buf.join('\n')}</code></pre>)
      continue
    }
    // heading
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const content = inline(h[2])
      out.push(level === 1 ? <h1 key={k++}>{content}</h1> : level === 2 ? <h2 key={k++}>{content}</h2> : <h3 key={k++}>{content}</h3>)
      i++
      continue
    }
    // hr
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { out.push(<hr key={k++} />); i++; continue }
    // quote
    if (line.startsWith('>')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''))
      out.push(<blockquote key={k++}>{inline(buf.join(' '))}</blockquote>)
      continue
    }
    // table
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = row(line)
      i += 2
      const body: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) body.push(row(lines[i++]))
      out.push(
        <table key={k++}>
          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>,
      )
      continue
    }
    // lists
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''))
      out.push(<ul key={k++}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      out.push(<ol key={k++}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>)
      continue
    }
    // paragraph (merge consecutive plain lines)
    const buf: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|```|\s*[-*]\s|\s*\d+[.)]\s|\|)/.test(lines[i])) buf.push(lines[i++])
    out.push(<p key={k++}>{buf.map((b, j) => <Fragment key={j}>{j > 0 && <br />}{inline(b)}</Fragment>)}</p>)
  }
  return out
}

const INLINE_RE = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_|@[가-힣A-Za-z0-9]+)/g

function inline(text: string): ReactNode[] {
  const parts = text.split(INLINE_RE)
  return parts.map((p, i) => {
    if (!p) return null
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i} className="font-semibold text-fg">{inline(p.slice(2, -2))}</strong>
    if (p.startsWith('~~') && p.endsWith('~~')) return <del key={i}>{p.slice(2, -2)}</del>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      // allow http(s)/mailto and same-origin paths — but not protocol-relative "//host"
      const safe = /^(https?:|mailto:|\/(?!\/))/.test(link[2].trim()) ? link[2].trim() : '#'
      return <a key={i} href={safe} target={safe.startsWith('/') ? undefined : '_blank'} rel="noreferrer">{link[1]}</a>
    }
    if ((p.startsWith('*') && p.endsWith('*') && p.length > 2) || (p.startsWith('_') && p.endsWith('_') && p.length > 2)) return <em key={i}>{p.slice(1, -1)}</em>
    if (p.startsWith('@') && p.length > 1) return <span key={i} className="rounded px-1 bg-accent/15 text-accent font-medium">{p}</span>
    return <Fragment key={i}>{p}</Fragment>
  })
}

/** Plain-text excerpt from markdown (for previews). */
export function excerpt(md: string, max = 140): string {
  const t = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\|.*\|$/gm, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*([-*]|\d+[.)])\s+/gm, '· ')
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > max ? t.slice(0, max).trimEnd() + '…' : t
}
