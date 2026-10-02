import { useMemo } from 'react'
import { cn } from '@/lib/utils'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/@([가-힣A-Za-z]{2,10})/g, '<span class="text-accent font-medium">@$1</span>')
}

/** Tiny, safe markdown → HTML (escapes first). Supports headings, lists, task lists, code, quotes. */
export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r/g, '').split('\n')
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  let inCode = false
  let code: string[] = []
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = []; inCode = false }
      else { closeList(); inCode = true }
      continue
    }
    if (inCode) { code.push(line); continue }
    let m: RegExpMatchArray | null
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { closeList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue }
    if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)$/i))) {
      if (list !== 'ul') { closeList(); out.push('<ul style="list-style:none;padding-left:0.25rem">'); list = 'ul' }
      const done = m[1].toLowerCase() === 'x'
      out.push(`<li><span style="display:inline-flex;width:14px;height:14px;border-radius:4px;margin-right:8px;vertical-align:-2px;border:1.5px solid ${done ? 'rgb(var(--accent))' : 'rgb(var(--line) / .3)'};background:${done ? 'rgb(var(--accent))' : 'transparent'}"></span>${done ? `<del>${inline(m[2])}</del>` : inline(m[2])}</li>`)
      continue
    }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul' } out.push(`<li>${inline(m[1])}</li>`); continue }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol' } out.push(`<li>${inline(m[1])}</li>`); continue }
    if ((m = line.match(/^>\s?(.*)$/))) { closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue }
    if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr/>'); continue }
    if (!line.trim()) { closeList(); continue }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  if (inCode) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
  closeList()
  return out.join('')
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  return <div className={cn('prose-nexus', className)} dangerouslySetInnerHTML={{ __html: html }} />
}
