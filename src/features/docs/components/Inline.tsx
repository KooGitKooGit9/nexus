import { Fragment, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\)|(?<![\w*])\*[^*\s][^*]*\*(?!\*)|(?<!\w)_[^_\s][^_]*_(?!\w))/g
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/

/** Lightweight inline markdown: **bold**, *italic* / _italic_, ~~strike~~, `code`, [link](url). */
export function hasInlineMarkdown(text: string) {
  TOKEN.lastIndex = 0
  return TOKEN.test(text)
}

/** Only allow safe link targets (no `javascript:` etc.). Relative app paths are kept as-is. */
function safeHref(url: string) {
  const u = url.trim()
  if (/^(https?:|mailto:|tel:)/i.test(u) || u.startsWith('/') || u.startsWith('#')) return u
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return `https://${u}`
  return undefined
}

/**
 * Renders inline markdown. With `mapped`, every rendered run carries `data-src` = the offset in `text`
 * of its first visible character, so a click position can be mapped back to a caret position in the source.
 */
export function Inline({ text, mapped = false }: { text: string; mapped?: boolean }) {
  const navigate = useNavigate()
  const parts = text.split(TOKEN)
  let pos = 0
  return (
    <>
      {parts.map((p, i) => {
        const start = pos
        pos += p.length
        if (!p) return null
        const src = (open: number) => (mapped ? { 'data-src': start + open } : {})
        let node: ReactNode = null
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) node = <strong key={i} {...src(2)} className="font-semibold text-fg">{p.slice(2, -2)}</strong>
        else if (p.startsWith('~~') && p.endsWith('~~') && p.length > 4) node = <s key={i} {...src(2)} className="text-muted">{p.slice(2, -2)}</s>
        else if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
          node = <code key={i} {...src(1)} className="rounded bg-surface-3/70 px-1 py-px font-mono text-[0.85em] leading-none text-accent-3">{p.slice(1, -1)}</code>
        else if (LINK.test(p)) {
          const [, label, url] = LINK.exec(p)!
          const href = safeHref(url)
          node = href ? (
            <a
              key={i}
              {...src(1)}
              href={href}
              target={href.startsWith('/') || href.startsWith('#') ? undefined : '_blank'}
              rel="noreferrer"
              title={url}
              onClick={(e) => {
                if (!href.startsWith('/') || e.metaKey || e.ctrlKey || e.shiftKey) return
                e.preventDefault()
                navigate(href)
              }}
              className="text-accent underline decoration-accent/40 underline-offset-2 transition hover:decoration-accent"
            >
              {label}
            </a>
          ) : (
            <span key={i} {...src(1)} className="text-accent">{label}</span>
          )
        } else if (((p.startsWith('*') && p.endsWith('*')) || (p.startsWith('_') && p.endsWith('_'))) && p.length > 2) node = <em key={i} {...src(1)}>{p.slice(1, -1)}</em>
        else node = mapped ? <span key={i} {...src(0)}>{p}</span> : <Fragment key={i}>{p}</Fragment>
        return node
      })}
    </>
  )
}
