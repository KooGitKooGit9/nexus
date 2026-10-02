import { useState } from 'react'
import { Pause, Play, Volume2, Maximize2, Archive, File as FileIconLucide } from 'lucide-react'
import { cn, formatBytes, hashIndex } from '@/lib/utils'
import type { FileItem } from '../types'
import { artFor, baseName, extOf, kindOf, KIND_META } from '../fileTypes'
import { DocGlyph } from './FileGlyph'

const seeded = (id: string, i: number, mod: number) => hashIndex(`${id}:${i}`, mod)

function Bars({ id, count, offset = 0 }: { id: string; count: number; offset?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-2 rounded-full bg-zinc-200" style={{ width: `${55 + seeded(id, i + offset, 45)}%` }} />
      ))}
    </div>
  )
}

function DocumentPreview({ item }: { item: FileItem }) {
  const kind = kindOf(item)
  const accent = KIND_META[kind].color
  return (
    <div className="flex h-full flex-col items-center gap-6 overflow-y-auto py-8">
      {[0, 1].map((page) => (
        <div key={page} className="w-[min(640px,90%)] shrink-0 rounded-sm bg-white p-12 text-zinc-800 shadow-2xl" style={{ aspectRatio: '1 / 1.3' }}>
          {page === 0 ? (
            <>
              <div className="mb-1 h-1 w-14 rounded-full" style={{ background: accent }} />
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">{baseName(item.name)}</h1>
              <p className="mt-1 text-xs text-zinc-500">오로라랩스 · 내부용 · 2026</p>
              <div className="mt-8"><Bars id={item.id} count={6} /></div>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-[10px] text-zinc-500">지표 {i + 1}</div>
                    <div className="mt-1 text-lg font-bold text-zinc-900">{(seeded(item.id, i, 90) + 10).toLocaleString()}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-8"><Bars id={item.id} count={5} offset={10} /></div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-zinc-900">2. 세부 내용</h2>
              <div className="mt-4"><Bars id={item.id} count={7} offset={20} /></div>
              <div className="mt-6 flex h-32 items-end gap-2 rounded-lg bg-zinc-50 p-4">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${25 + seeded(item.id, i + 40, 75)}%`, background: i % 3 === 0 ? accent : `${accent}66` }} />
                ))}
              </div>
              <div className="mt-6"><Bars id={item.id} count={6} offset={30} /></div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function SheetPreview({ item }: { item: FileItem }) {
  const cols = ['항목', '1월', '2월', '3월', '4월', '5월', '6월']
  const rows = ['매출', '신규 고객', '이탈률', '마케팅비', '인건비', '서버 비용', 'MAU', 'WAT', 'NPS', '전환율', 'ARPU', '영업이익']
  return (
    <div className="flex h-full items-center justify-center overflow-auto p-8">
      <div className="w-[min(860px,95%)] overflow-hidden rounded-lg bg-white text-[12px] text-zinc-700 shadow-2xl">
        <div className="flex items-center gap-2 bg-emerald-600 px-3 py-2 text-white">
          <span className="font-semibold">{baseName(item.name)}</span>
          <span className="ml-auto rounded bg-white/20 px-2 py-0.5 text-[10px]">Sheet1</span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-zinc-100 text-[10px] text-zinc-500">
              <th className="w-8 border border-zinc-200" />
              {cols.map((_, i) => <th key={i} className="border border-zinc-200 py-0.5 font-medium">{String.fromCharCode(65 + i)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-emerald-50 font-semibold text-emerald-800">
              <td className="border border-zinc-200 text-center text-[10px] text-zinc-400">1</td>
              {cols.map((c) => <td key={c} className="border border-zinc-200 px-2 py-1">{c}</td>)}
            </tr>
            {rows.map((r, ri) => (
              <tr key={r}>
                <td className="border border-zinc-200 text-center text-[10px] text-zinc-400">{ri + 2}</td>
                <td className="border border-zinc-200 px-2 py-1 font-medium">{r}</td>
                {cols.slice(1).map((_, ci) => (
                  <td key={ci} className="border border-zinc-200 px-2 py-1 text-right tabular-nums">{(seeded(item.id, ri * 10 + ci, 9000) + 100).toLocaleString()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SlidePreview({ item }: { item: FileItem }) {
  const [active, setActive] = useState(0)
  const titles = [baseName(item.name), '배경과 문제', '핵심 전략', '로드맵', 'Q&A']
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
      <div className="relative w-[min(860px,95%)] overflow-hidden rounded-xl shadow-2xl" style={{ aspectRatio: '16 / 9', background: artFor(item.id + active) }}>
        <div className="noise absolute inset-0" />
        <div className="absolute inset-0 flex flex-col justify-end p-[6%] text-white">
          <span className="mb-3 w-fit rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">{active + 1} / {titles.length}</span>
          <h2 className="font-display text-[clamp(20px,4vw,44px)] font-bold leading-tight drop-shadow">{titles[active]}</h2>
          <p className="mt-2 text-sm text-white/75">오로라랩스 · 2026</p>
        </div>
      </div>
      <div className="flex gap-2">
        {titles.map((t, i) => (
          <button key={i} onClick={() => setActive(i)} className={cn('h-14 w-24 overflow-hidden rounded-md ring-2 transition', active === i ? 'ring-accent' : 'ring-transparent opacity-60 hover:opacity-100')} style={{ background: artFor(item.id + i) }}>
            <span className="block truncate px-1.5 pt-8 text-left text-[9px] font-semibold text-white">{t}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MediaPreview({ item }: { item: FileItem }) {
  const kind = kindOf(item)
  const [playing, setPlaying] = useState(false)
  if (item.url && kind === 'video') return <div className="flex h-full items-center justify-center p-6"><video src={item.url} controls autoPlay className="max-h-full max-w-full rounded-xl shadow-2xl" /></div>
  const progress = playing ? 38 : 12
  if (kind === 'audio') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
        <div className="flex h-36 w-36 items-center justify-center rounded-3xl shadow-2xl" style={{ background: artFor(item.id) }}>
          <Volume2 className="h-12 w-12 text-white drop-shadow" />
        </div>
        <div className="flex h-24 w-[min(640px,90%)] items-center gap-[3px]">
          {Array.from({ length: 90 }, (_, i) => (
            <div key={i} className={cn('flex-1 rounded-full transition-colors', i / 90 * 100 < progress ? 'bg-accent' : 'bg-white/25', playing && 'animate-pulse')} style={{ height: `${15 + seeded(item.id, i, 85)}%` }} />
          ))}
        </div>
        {item.url ? (
          <audio src={item.url} controls className="w-[min(480px,90%)]" />
        ) : (
          <button onClick={() => setPlaying(!playing)} className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-gradient text-white shadow-glow">
            {playing ? <Pause className="h-6 w-6 fill-white" /> : <Play className="ml-1 h-6 w-6 fill-white" />}
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="group relative w-[min(960px,95%)] overflow-hidden rounded-xl shadow-2xl" style={{ aspectRatio: '16 / 9', background: artFor(item.id) }}>
        <div className="noise absolute inset-0" />
        <button onClick={() => setPlaying(!playing)} className="absolute inset-0 flex items-center justify-center">
          <span className={cn('flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/30 backdrop-blur-md transition hover:scale-110', playing && 'opacity-0 group-hover:opacity-100')}>
            {playing ? <Pause className="h-8 w-8 fill-white" /> : <Play className="ml-1 h-8 w-8 fill-white" />}
          </span>
        </button>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-10">
          <div className="h-1 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${progress}%` }} /></div>
          <div className="mt-2 flex items-center gap-3 text-xs text-white/85">
            {playing ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
            <span className="font-mono">{playing ? '04:12' : '01:21'} / 11:{String(seeded(item.id, 1, 60)).padStart(2, '0')}</span>
            <Volume2 className="ml-auto h-4 w-4" />
            <Maximize2 className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ZipPreview({ item }: { item: FileItem }) {
  const base = baseName(item.name)
  const entries = Array.from({ length: 9 }, (_, i) => {
    const exts = ['png', 'jpg', 'pdf', 'svg', 'json', 'md', 'mp4']
    const ext = exts[seeded(item.id, i, exts.length)]
    return { name: `${base.replace(/\s/g, '_')}_${String(i + 1).padStart(2, '0')}.${ext}`, size: (seeded(item.id, i + 20, 9000) + 40) * 1024 }
  })
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-[min(560px,95%)] overflow-hidden rounded-2xl glass-strong shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line/10 px-5 py-4">
          <Archive className="h-5 w-5 text-amber-500" />
          <span className="flex-1 truncate font-semibold">{item.name}</span>
          <span className="text-xs text-subtle">{entries.length}개 항목</span>
        </div>
        {entries.map((e) => {
          const k = kindOf({ kind: 'file', name: e.name })
          const M = KIND_META[k]
          return (
            <div key={e.name} className="flex items-center gap-3 border-b border-line/[0.05] px-5 py-2.5 text-[13px] last:border-0">
              <M.icon className="h-4 w-4" style={{ color: M.color }} />
              <span className="flex-1 truncate">{e.name}</span>
              <span className="text-xs tabular-nums text-subtle">{formatBytes(e.size)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DesignPreview({ item }: { item: FileItem }) {
  return (
    <div className="dot-bg relative flex h-full items-center justify-center gap-6 overflow-hidden bg-[#1e1e1e] p-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5" style={{ transform: `translateY(${(i - 1) * 18}px)` }}>
          <span className="text-[10px] text-zinc-400">{['Home', 'Docs', 'Drive'][i]} — iPhone 16</span>
          <div className="flex h-[360px] w-[180px] flex-col gap-2 overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0b14] p-3 shadow-2xl">
            <div className="h-20 rounded-xl" style={{ background: artFor(item.id + i) }} />
            {Array.from({ length: 5 }, (_, j) => (
              <div key={j} className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
                <div className="h-6 w-6 rounded-md" style={{ background: ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24'][(j + i) % 5] }} />
                <div className="flex-1 space-y-1">
                  <div className="h-1.5 rounded-full bg-white/30" style={{ width: `${50 + seeded(item.id, i * 9 + j, 45)}%` }} />
                  <div className="h-1.5 w-1/2 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="absolute left-4 top-4 rounded-lg bg-black/50 px-2.5 py-1 text-[11px] text-zinc-300">🎨 {item.name}</div>
    </div>
  )
}

const CODE_SAMPLES: Record<string, string> = {
  yml: `version: "3.9"\nservices:\n  gateway:\n    image: aurora/gateway:1.18.0\n    ports: ["8080:8080"]\n    depends_on: [messenger, docs]\n  messenger:\n    image: aurora/messenger:1.18.0\n    environment:\n      DB_URL: postgres://nexus@db:5432/nexus\n      KAFKA_BROKERS: kafka:9092\n  docs:\n    image: aurora/docs:1.18.0\n  db:\n    image: postgres:16\n    volumes: [pgdata:/var/lib/postgresql/data]\nvolumes:\n  pgdata: {}`,
  sql: `-- 2026-09-28: 문서 블록 테이블 추가\nCREATE TABLE doc_blocks (\n  id          UUID PRIMARY KEY,\n  doc_id      UUID NOT NULL REFERENCES docs(id) ON DELETE CASCADE,\n  type        TEXT NOT NULL,\n  content     JSONB NOT NULL DEFAULT '{}',\n  position    INT  NOT NULL,\n  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nCREATE INDEX idx_doc_blocks_doc ON doc_blocks (doc_id, position);`,
  json: `{\n  "color": {\n    "accent": { "value": "#8B5CF6" },\n    "accent-2": { "value": "#22D3EE" },\n    "accent-3": { "value": "#F472B6" }\n  },\n  "radius": { "sm": "8px", "md": "12px", "lg": "16px" },\n  "motion": {\n    "ease-out": "cubic-bezier(0.22, 1, 0.36, 1)",\n    "duration-fast": "150ms"\n  }\n}`,
  txt: `10/2 회의 메모\n\n- 베타 고객사 안내 메일 초안 → 현우님 리뷰\n- 에디터 단축키 노션과 통일\n- AI 요금 정책: 영업팀 의견 다음 주까지\n- 런칭 이벤트 장소 후보 3곳 정리 필요\n\nTODO\n[ ] 온보딩 시안 피드백\n[ ] 검색 성능 PR 리뷰`,
}

function CodePreview({ item }: { item: FileItem }) {
  const ext = extOf(item.name)
  const sample = CODE_SAMPLES[ext] ?? CODE_SAMPLES[ext === 'yaml' ? 'yml' : ext === 'md' || ext === 'log' ? 'txt' : 'json']
  // uploaded files show their real content (persisted excerpt), seeded mock files a sample
  const real = item.textPreview
  const truncated = !!real && !!item.size && item.size > real.length + 8
  const code = real !== undefined ? (real || ' ') + (truncated ? '\n…' : '') : sample
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-[min(760px,95%)] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-zinc-400">{item.name}</span>
        </div>
        <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-zinc-200">
          {code.split('\n').map((l, i) => (
            <div key={i} className="flex">
              <span className="mr-5 w-6 shrink-0 select-none text-right text-zinc-600">{i + 1}</span>
              <span className={cn(l.trim().startsWith('--') || l.trim().startsWith('#') ? 'text-zinc-500' : /^\s*[\w"-]+:/.test(l) ? 'text-sky-300' : '')}>{l || ' '}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}

export function MockPreview({ item }: { item: FileItem }) {
  const kind = kindOf(item)
  const [broken, setBroken] = useState(false)
  switch (kind) {
    case 'image': {
      const src = item.url ?? item.thumbnail
      return (
        <div className="flex h-full items-center justify-center p-8">
          {src && !broken ? (
            <img src={src} alt={item.name} onError={() => setBroken(true)} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
          ) : (
            <div className="relative w-[min(860px,95%)] overflow-hidden rounded-xl shadow-2xl" style={{ aspectRatio: '4 / 3', background: artFor(item.id) }}>
              <div className="noise absolute inset-0" />
            </div>
          )}
        </div>
      )
    }
    case 'pdf':
      if (item.url) return <div className="flex h-full items-center justify-center p-6"><iframe src={item.url} title={item.name} className="h-full w-[min(900px,100%)] rounded-xl bg-white shadow-2xl" /></div>
      return <DocumentPreview item={item} />
    case 'doc':
      return <DocumentPreview item={item} />
    case 'sheet':
      return <SheetPreview item={item} />
    case 'slide':
      return <SlidePreview item={item} />
    case 'video':
    case 'audio':
      return <MediaPreview item={item} />
    case 'zip':
      return <ZipPreview item={item} />
    case 'design':
      return <DesignPreview item={item} />
    case 'code':
    case 'text':
      return <CodePreview item={item} />
    default:
      return (
        <div className="flex h-full flex-col items-center justify-center gap-5">
          <DocGlyph item={item} size={1.8} />
          <div className="flex items-center gap-2 text-sm text-white/70"><FileIconLucide className="h-4 w-4" /> 미리보기를 지원하지 않는 형식이에요</div>
        </div>
      )
  }
}
