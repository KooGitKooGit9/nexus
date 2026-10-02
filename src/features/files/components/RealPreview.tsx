import { useEffect, useState } from 'react'
import { Download, File as FileIconLucide, Loader2 } from 'lucide-react'
import { downloadUrl } from '@/lib/upload'
import type { FileItem } from '../types'
import { extOf, kindOf } from '../fileTypes'
import { DocGlyph } from './FileGlyph'

const TEXT_LIMIT = 200_000
const TEXT_EXT = new Set(['txt', 'md', 'log', 'csv', 'json', 'yml', 'yaml', 'js', 'ts', 'tsx', 'jsx', 'sql', 'py', 'go', 'kt', 'sh', 'html', 'css', 'xml', 'env', 'ini', 'toml'])

/** Can the browser render this uploaded file natively? */
function previewMode(item: FileItem): 'image' | 'video' | 'audio' | 'pdf' | 'text' | null {
  const kind = kindOf(item)
  const mime = item.mime ?? ''
  if (kind === 'image' || mime.startsWith('image/')) return 'image'
  if (kind === 'video' || mime.startsWith('video/')) return 'video'
  if (kind === 'audio' || mime.startsWith('audio/')) return 'audio'
  if (kind === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (kind === 'code' || kind === 'text' || mime.startsWith('text/') || mime === 'application/json' || TEXT_EXT.has(extOf(item.name))) return 'text'
  return null
}

function TextPreview({ item }: { item: FileItem }) {
  const [state, setState] = useState<{ text?: string; error?: boolean; truncated?: boolean }>({})
  useEffect(() => {
    let alive = true
    setState({})
    const ctrl = new AbortController()
    fetch(item.url!, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.text()
      })
      .then((t) => {
        if (!alive) return
        const norm = t.replace(/\r\n?/g, '\n')
        setState({ text: norm.slice(0, TEXT_LIMIT), truncated: norm.length > TEXT_LIMIT })
      })
      .catch(() => { if (alive) setState({ text: item.textPreview, error: item.textPreview === undefined }) })
    return () => { alive = false; ctrl.abort() }
  }, [item.url, item.textPreview])

  if (state.error) return <Unsupported item={item} message="파일 내용을 불러오지 못했어요" />
  if (state.text === undefined)
    return <div className="flex h-full items-center justify-center text-white/70"><Loader2 className="h-6 w-6 animate-spin" /></div>
  const lines = (state.text || ' ').split('\n')
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-h-full w-[min(900px,98%)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 min-w-0 flex-1 truncate font-mono text-xs text-zinc-400">{item.name}</span>
          <span className="text-[11px] text-zinc-500">{lines.length.toLocaleString()}줄</span>
        </div>
        <pre className="min-h-0 overflow-auto p-5 font-mono text-[12.5px] leading-6 text-zinc-200">
          {lines.map((l, i) => (
            <div key={i} className="flex">
              <span className="mr-5 w-8 shrink-0 select-none text-right text-zinc-600">{i + 1}</span>
              <span className="whitespace-pre">{l || ' '}</span>
            </div>
          ))}
          {state.truncated && <div className="mt-2 text-zinc-500">… 파일이 커서 앞부분만 표시했어요. 전체 내용은 다운로드하세요.</div>}
        </pre>
      </div>
    </div>
  )
}

function Unsupported({ item, message = '브라우저에서 미리볼 수 없는 형식이에요' }: { item: FileItem; message?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-white">
      <DocGlyph item={item} size={1.8} />
      <div className="flex items-center gap-2 text-sm text-white/70"><FileIconLucide className="h-4 w-4" /> {message}</div>
      <a
        href={downloadUrl(item.url!)}
        download={item.name}
        className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
      >
        <Download className="h-4 w-4" /> 다운로드
      </a>
    </div>
  )
}

/** Preview of an uploaded file using its real bytes (server URL, or an object URL offline). */
export function RealPreview({ item }: { item: FileItem }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [item.url])
  const mode = previewMode(item)
  if (!item.url) return null
  if (broken) return <Unsupported item={item} message="파일을 불러오지 못했어요" />
  switch (mode) {
    case 'image':
      return (
        <div className="flex h-full items-center justify-center p-8">
          <img src={item.url} alt={item.name} onError={() => setBroken(true)} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
        </div>
      )
    case 'video':
      return (
        <div className="flex h-full items-center justify-center p-6">
          <video src={item.url} controls autoPlay playsInline onError={() => setBroken(true)} className="max-h-full max-w-full rounded-xl bg-black shadow-2xl" />
        </div>
      )
    case 'audio':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
          <DocGlyph item={item} size={1.6} />
          <audio src={item.url} controls autoPlay onError={() => setBroken(true)} className="w-[min(520px,90%)]" />
        </div>
      )
    case 'pdf':
      return (
        <div className="flex h-full items-center justify-center p-6">
          <object data={item.url} type="application/pdf" className="h-full w-[min(960px,100%)] rounded-xl bg-white shadow-2xl">
            <iframe src={item.url} title={item.name} className="h-full w-full rounded-xl bg-white" />
          </object>
        </div>
      )
    case 'text':
      return <TextPreview item={item} />
    default:
      return <Unsupported item={item} />
  }
}
