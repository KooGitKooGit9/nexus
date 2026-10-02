import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Clock, Home, LayoutTemplate, PanelLeftClose, Plus, Search, Star, X, BookOpen } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { Kbd, Tooltip } from '@/components/ui'
import { useDocs } from '../store'
import { closeOverlayTree, setTreeVisible, useDocsUI } from '../uiStore'
import { docMatches, useChildrenMap, useCreateDoc } from '../hooks'
import { TreeItem } from './TreeItem'

function Section({ title, icon, children, action, defaultOpen = true }: { title: string; icon: ReactNode; children: ReactNode; action?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-3">
      <div className="group/sec flex h-7 items-center gap-1 px-2">
        <button onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle hover:text-muted">
          <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>
          {title}
          <ChevronRight className={cn('h-3 w-3 opacity-0 transition group-hover/sec:opacity-100', open && 'rotate-90')} />
        </button>
        {action && <span className="opacity-0 transition group-hover/sec:opacity-100">{action}</span>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden px-1.5">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PageTree({ activeId }: { activeId?: string }) {
  const navigate = useNavigate()
  const docs = useDocs((s) => s.docs)
  const recentIds = useDocs((s) => s.recentIds)
  const childrenMap = useChildrenMap(docs)
  const createDoc = useCreateDoc()
  const openTemplates = useDocsUI((s) => s.openTemplates)
  const compact = useDocsUI((s) => s.compact)
  const [q, setQ] = useState('')

  const starred = useMemo(() => docs.filter((d) => d.starred), [docs])
  const recent = useMemo(() => recentIds.map((id) => docs.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d).slice(0, 5), [recentIds, docs])
  const results = useMemo(() => (q.trim() ? docs.filter((d) => docMatches(d, q.trim())).slice(0, 30) : []), [docs, q])
  const roots = childrenMap.get(null) ?? []

  return (
    <motion.aside
      initial={{ x: compact ? -280 : -20, opacity: compact ? 1 : 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: compact ? -280 : -20, opacity: compact ? 1 : 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex h-full w-[268px] shrink-0 flex-col border-r border-line/[0.07]',
        compact ? 'absolute inset-y-0 left-0 z-50 bg-surface/95 shadow-float backdrop-blur-2xl' : 'bg-surface/40 backdrop-blur-xl',
      )}
    >
      {/* workspace header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-accent-gradient opacity-60 blur-md" />
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm">
            <BookOpen className="h-4 w-4" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">오로라랩스 위키</div>
          <div className="text-[11px] text-subtle">페이지 {docs.length}개</div>
        </div>
        <Tooltip content={compact ? '닫기' : '사이드바 접기'} side="bottom">
          <button onClick={() => setTreeVisible(false)} className="rounded-lg p-1.5 text-subtle hover:bg-line/10 hover:text-fg">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>

      {/* search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQ('')}
            placeholder="페이지 검색"
            className="h-8 w-full rounded-lg border border-line/10 bg-line/[0.04] pl-8 pr-7 text-[13px] outline-none transition placeholder:text-subtle focus:border-accent/50 focus:bg-line/[0.06] focus:ring-4 focus:ring-accent/10"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-fg">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* quick links */}
      <div className="space-y-0.5 px-1.5 pb-2">
        <button onClick={() => { navigate('/docs'); closeOverlayTree() }} className={cn('flex h-[30px] w-full items-center gap-2 rounded-lg px-2.5 text-[13px] transition', !activeId ? 'bg-line/[0.06] text-fg' : 'text-muted hover:bg-line/[0.05] hover:text-fg')}>
          <Home className="h-4 w-4" /> 홈
        </button>
        <button onClick={() => { openTemplates(null); closeOverlayTree() }} className="flex h-[30px] w-full items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted transition hover:bg-line/[0.05] hover:text-fg">
          <LayoutTemplate className="h-4 w-4" /> 템플릿 갤러리
        </button>
      </div>

      <div className="mx-3 mb-2 h-px bg-line/[0.07]" />

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {q.trim() ? (
          <div className="px-1.5">
            <div className="px-2 pb-1.5 text-[11px] font-semibold text-subtle">검색 결과 {results.length}개</div>
            {results.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-subtle">“{q}”와 일치하는 페이지가 없어요</div>}
            {results.map((d) => {
              const parent = d.parentId ? docs.find((p) => p.id === d.parentId) : undefined
              return (
                <button
                  key={d.id}
                  onClick={() => { navigate(`/docs/${d.id}`); closeOverlayTree() }}
                  className={cn('flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-line/[0.05]', activeId === d.id && 'bg-accent/10')}
                >
                  <span className="text-[15px] leading-5">{d.emoji || '📄'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-fg/90">{d.title || '제목 없음'}</span>
                    <span className="block truncate text-[11px] text-subtle">{parent ? `${parent.emoji} ${parent.title}` : '워크스페이스'} · {timeAgo(d.updatedAt)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <>
            {starred.length > 0 && (
              <Section title="즐겨찾기" icon={<Star />}>
                {starred.map((d) => <TreeItem key={d.id} doc={d} depth={0} activeId={activeId} childrenMap={childrenMap} flat />)}
              </Section>
            )}
            {recent.length > 0 && (
              <Section title="최근" icon={<Clock />} defaultOpen={false}>
                {recent.map((d) => <TreeItem key={d.id} doc={d} depth={0} activeId={activeId} childrenMap={childrenMap} flat />)}
              </Section>
            )}
            <Section
              title="워크스페이스"
              icon={<BookOpen />}
              action={
                <Tooltip content="새 페이지" side="right">
                  <button onClick={() => createDoc()} className="rounded p-0.5 text-subtle hover:bg-line/10 hover:text-fg"><Plus className="h-3.5 w-3.5" /></button>
                </Tooltip>
              }
            >
              {roots.map((d) => <TreeItem key={d.id} doc={d} depth={0} activeId={activeId} childrenMap={childrenMap} />)}
            </Section>
          </>
        )}
      </div>

      <div className="border-t border-line/[0.07] p-2.5">
        <button
          onClick={() => { openTemplates(null); closeOverlayTree() }}
          className="group flex h-9 w-full items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-muted transition hover:bg-accent/10 hover:text-fg"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-gradient text-white shadow-glow-sm transition group-hover:scale-110">
            <Plus className="h-3.5 w-3.5" />
          </span>
          새 페이지
          <span className="ml-auto"><Kbd>N</Kbd></span>
        </button>
      </div>
    </motion.aside>
  )
}
