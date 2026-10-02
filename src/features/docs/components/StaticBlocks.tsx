import { cn } from '@/lib/utils'
import { numberAt, parseMarkdown, type Block } from '../markdown'
import { calloutTone } from '../constants'
import { Inline } from './Inline'

/** Lightweight read-only renderer for block markdown (template previews etc.). */
export function StaticBlocks({ markdown, className, limit }: { markdown: string; className?: string; limit?: number }) {
  const all = parseMarkdown(markdown)
  const blocks = limit ? all.slice(0, limit) : all
  return (
    <div className={cn('space-y-1 text-[13px] leading-6 text-fg/85', className)}>
      {blocks.map((b, i) => <StaticBlock key={b.id} b={b} n={b.type === 'numbered' ? numberAt(all, i) : 0} />)}
    </div>
  )
}

function StaticBlock({ b, n }: { b: Block; n: number }) {
  const pl = { paddingLeft: (b.indent ?? 0) * 18 }
  switch (b.type) {
    case 'h1': return <h1 className="pt-3 text-xl font-bold text-fg"><Inline text={b.text} /></h1>
    case 'h2': return <h2 className="pt-2.5 text-[17px] font-semibold text-fg"><Inline text={b.text} /></h2>
    case 'h3': return <h3 className="pt-1.5 text-[15px] font-semibold text-fg"><Inline text={b.text} /></h3>
    case 'bullet': return <div className="flex gap-2" style={pl}><span className="text-accent">•</span><span><Inline text={b.text} /></span></div>
    case 'numbered': return <div className="flex gap-2" style={pl}><span className="text-accent tabular-nums">{n}.</span><span><Inline text={b.text} /></span></div>
    case 'todo':
      return (
        <div className="flex items-start gap-2" style={pl}>
          <span className={cn('mt-[5px] h-3.5 w-3.5 shrink-0 rounded border', b.checked ? 'border-transparent bg-accent-gradient' : 'border-line/25')} />
          <span className={cn(b.checked && 'text-subtle line-through')}><Inline text={b.text} /></span>
        </div>
      )
    case 'quote': return <div className="whitespace-pre-wrap border-l-2 border-accent/60 pl-3 text-muted"><Inline text={b.text} /></div>
    case 'callout':
      return (
        <div className={cn('flex gap-2 whitespace-pre-wrap rounded-xl border px-3 py-2', calloutTone(b.emoji))}>
          <span>{b.emoji}</span>
          <span><Inline text={b.text} /></span>
        </div>
      )
    case 'code': return <pre className="overflow-x-auto rounded-lg bg-surface-3/60 px-3 py-2 font-mono text-[11px]">{b.text}</pre>
    case 'divider': return <div className="my-2 h-px bg-line/15" />
    case 'image': return b.url ? <img src={b.url} alt={b.text} className="max-h-40 w-full rounded-lg object-cover" /> : null
    case 'table':
      return (
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {(b.rows ?? []).map((r, ri) => (
              <tr key={ri} className={cn(ri === 0 && 'bg-surface-2 font-semibold')}>
                {r.map((c, ci) => <td key={ci} className="border border-line/10 px-2 py-1"><Inline text={c} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )
    default: return <p className="whitespace-pre-wrap"><Inline text={b.text} /></p>
  }
}
