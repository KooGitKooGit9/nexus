import { Fragment, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight, CopyPlus, Ellipsis, FileDown, FolderInput, Languages, Link2, ListChecks, ListTree, PanelLeft, Sparkles, Star, Trash2, WandSparkles, BookOpen,
} from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { Avatar, Menu, Popover, Tooltip } from '@/components/ui'
import { toast, useUser } from '@/store/core'
import { ancestorsOf, isDocStarred, useDocs } from '../store'
import { selectTreeVisible, setTreeVisible, useDocsUI } from '../uiStore'
import { askAIAboutDoc, copyDocLink, exportMarkdown } from '../hooks'
import { parseMarkdown, stats } from '../markdown'
import type { Doc } from '../types'
import type { RemoteCursor } from '../editor/BlockView'
import { SharePopover } from './SharePopover'

export function DocHeader({ doc, coEditors }: { doc: Doc; coEditors: RemoteCursor[] }) {
  const navigate = useNavigate()
  const docs = useDocs((s) => s.docs)
  const toggleStar = useDocs((s) => s.toggleStar)
  const duplicateDoc = useDocs((s) => s.duplicateDoc)
  const treeVisible = useDocsUI(selectTreeVisible)
  const editor = useUser(doc.lastEditedBy)
  const chain = ancestorsOf(docs, doc.id)
  const st = stats(doc.content)
  const headings = useMemo(
    () => parseMarkdown(doc.content).filter((b) => (b.type === 'h1' || b.type === 'h2' || b.type === 'h3') && b.text.trim()),
    [doc.content],
  )

  return (
    <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line/[0.06] bg-bg/60 px-3 backdrop-blur-xl">
      {!treeVisible && (
        <Tooltip content="사이드바 열기" side="bottom">
          <button onClick={() => setTreeVisible(true)} className="shrink-0 rounded-lg p-1.5 text-subtle hover:bg-line/10 hover:text-fg">
            <PanelLeft className="h-4 w-4" />
          </button>
        </Tooltip>
      )}

      {/* breadcrumbs */}
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-[13px]">
        <button onClick={() => navigate('/docs')} className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted hover:bg-line/[0.06] hover:text-fg">
          <BookOpen className="h-3.5 w-3.5" /> 위키
        </button>
        {[...chain, doc].map((d, i, arr) => (
          <Fragment key={d.id}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle/70" />
            <button
              onClick={() => navigate(`/docs/${d.id}`)}
              className={cn(
                'flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition hover:bg-line/[0.06]',
                i === arr.length - 1 ? 'text-fg' : 'max-w-[140px] text-muted hover:text-fg',
              )}
            >
              <span className="shrink-0">{d.emoji || '📄'}</span>
              <span className="truncate">{d.title || '제목 없음'}</span>
            </button>
          </Fragment>
        ))}
      </nav>

      {/* last edited */}
      <div className="hidden shrink-0 items-center gap-1.5 text-[12px] text-subtle lg:flex">
        {editor && <Avatar user={editor} size="xs" />}
        <span><span className="text-muted">{editor?.name ?? '알 수 없음'}</span> · {timeAgo(doc.updatedAt)} 편집</span>
      </div>

      {/* live presence */}
      {coEditors.length > 0 && (
        <div className="hidden shrink-0 items-center gap-2 rounded-full border border-line/10 bg-line/[0.03] py-0.5 pl-2.5 pr-1 md:flex">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-success">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-success" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            {coEditors.some((c) => (c as { live?: boolean }).live) ? '함께 보는 중' : '편집 중'}
          </span>
          <div className="flex -space-x-1.5">
            {coEditors.map((c, i) => (
              <Tooltip key={c.id} content={(c as { live?: boolean }).live ? `${c.name}님이 이 문서를 보고 있어요` : `${c.name}님이 편집 중`} side="bottom">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 400, damping: 20 }}
                  className="rounded-full"
                  style={{ boxShadow: `0 0 0 2px rgb(var(--bg)), 0 0 0 3.5px ${c.color}, 0 0 12px ${c.color}66` }}
                >
                  <Avatar userId={c.id} size="xs" />
                </motion.div>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip content={isDocStarred(doc) ? '즐겨찾기 해제' : '즐겨찾기'} side="bottom">
          <button onClick={() => toggleStar(doc.id)} className="rounded-lg p-1.5 text-subtle transition hover:bg-line/10 hover:text-fg">
            <Star className={cn('h-4 w-4 transition', isDocStarred(doc) && 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]')} />
          </button>
        </Tooltip>

        {/* compact table of contents (the floating outline only fits on very wide screens) */}
        {headings.length >= 2 && (
          <span className="2xl:hidden">
            <Popover
              placement="bottom-end"
              className="max-h-[60vh] w-64 overflow-y-auto"
              trigger={({ toggle, open }) => (
                <Tooltip content="목차" side="bottom">
                  <button onClick={toggle} className={cn('rounded-lg p-1.5 transition hover:bg-line/10 hover:text-fg', open ? 'bg-line/10 text-fg' : 'text-subtle')}>
                    <ListTree className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
            >
              {(close) => (
                <div>
                  <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">목차</div>
                  {headings.map((h, i) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        document.querySelectorAll<HTMLElement>('[data-doc-heading]')[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        close()
                      }}
                      className={cn(
                        'block w-full truncate rounded-lg py-1.5 pr-2 text-left text-[13px] text-fg/85 transition hover:bg-line/[0.06] hover:text-fg',
                        h.type === 'h1' ? 'pl-2 font-medium' : h.type === 'h2' ? 'pl-4' : 'pl-6 text-[12.5px] text-muted',
                      )}
                    >
                      {h.text.replace(/\*\*|`|~~/g, '')}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
          </span>
        )}

        <SharePopover doc={doc} />

        <Menu
          placement="bottom-end"
          className="w-56"
          trigger={
            <button className="relative ml-1 flex h-8 items-center gap-1.5 overflow-hidden rounded-lg px-2.5 text-[12.5px] font-semibold text-white">
              <span className="absolute inset-0 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x" />
              <Sparkles className="relative h-3.5 w-3.5" />
              <span className="relative">AI 도우미</span>
            </button>
          }
          items={[
            { label: '문서 요약', icon: <Sparkles />, onClick: () => askAIAboutDoc(doc, 'summary') },
            { label: '영어로 번역', icon: <Languages />, onClick: () => askAIAboutDoc(doc, 'translate') },
            { label: '글 다듬기', icon: <WandSparkles />, onClick: () => askAIAboutDoc(doc, 'polish') },
            { label: '액션 아이템 추출', icon: <ListChecks />, onClick: () => askAIAboutDoc(doc, 'actions') },
          ]}
        />

        <Menu
          placement="bottom-end"
          className="w-60"
          trigger={
            <button className="ml-0.5 rounded-lg p-1.5 text-subtle hover:bg-line/10 hover:text-fg">
              <Ellipsis className="h-4 w-4" />
            </button>
          }
          items={[
            { label: '링크 복사', icon: <Link2 />, onClick: () => copyDocLink(doc.id) },
            {
              label: '복제',
              icon: <CopyPlus />,
              onClick: () => {
                const c = duplicateDoc(doc.id)
                if (c) { toast('페이지를 복제했어요', { emoji: '📑', variant: 'success' }); navigate(`/docs/${c.id}`) }
              },
            },
            { label: '옮기기…', icon: <FolderInput />, onClick: () => useDocsUI.getState().setMoveId(doc.id) },
            { label: 'Markdown으로 내보내기', icon: <FileDown />, onClick: () => exportMarkdown(doc) },
            { label: '', divider: true },
            { label: '삭제', icon: <Trash2 />, danger: true, onClick: () => useDocsUI.getState().setDeleteId(doc.id) },
            { label: '', divider: true },
            { label: <span className="text-[11px] text-subtle">글자 {st.chars.toLocaleString()}자 · 단어 {st.words.toLocaleString()}개 · 약 {st.minutes}분</span>, disabled: true },
          ]}
        />
      </div>
    </div>
  )
}
