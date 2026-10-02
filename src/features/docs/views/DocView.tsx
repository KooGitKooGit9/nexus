import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, ImagePlus, Plus, Smile, Palette, Type } from 'lucide-react'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { Avatar, Badge, Popover } from '@/components/ui'
import { useUser } from '@/store/core'
import { ancestorsOf, useDocs } from '../store'
import { useCoEditors, useCreateDoc } from '../hooks'
import { stats, excerpt } from '../markdown'
import type { Doc } from '../types'
import { BlockEditor } from '../editor/BlockEditor'
import { AutoTextarea } from '../editor/AutoTextarea'
import { caretEdge } from '../editor/caret'
import { DocHeader } from '../components/DocHeader'
import { Outline } from '../components/Outline'
import { CoverPickerPanel, EmojiPickerPanel } from '../components/Pickers'
import { COVERS } from '../constants'

export function DocView({ doc }: { doc: Doc }) {
  const navigate = useNavigate()
  const updateDoc = useDocs((s) => s.updateDoc)
  const visitDoc = useDocs((s) => s.visitDoc)
  const children = useDocs((s) => s.docs).filter((d) => d.parentId === doc.id)
  const createDoc = useCreateDoc()
  const author = useUser(doc.authorId)
  const coEditors = useCoEditors(doc.id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const st = stats(doc.content)

  useEffect(() => {
    visitDoc(doc.id)
    scrollRef.current?.scrollTo({ top: 0 })
    // reveal the page in the tree: expand every collapsed ancestor
    const st = useDocs.getState()
    ancestorsOf(st.docs, doc.id).forEach((a) => { if (!st.expanded[a.id]) st.setExpanded(a.id, true) })
    // fresh, untitled page → start typing the title right away (the view is reused across docs, so autoFocus alone isn't enough)
    if (!useDocs.getState().docs.find((d) => d.id === doc.id)?.title) {
      const t = setTimeout(() => titleRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [doc.id, visitDoc])

  const focusFirstBlock = () => {
    const el = editorRef.current?.querySelector('textarea')
    if (!el) return
    el.focus()
    el.setSelectionRange(0, 0)
  }
  const focusTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <DocHeader doc={doc} coEditors={coEditors} />

      {/* cover */}
      {doc.cover ? (
        <div className="group/cover relative h-[220px] w-full overflow-hidden">
          <motion.div key={doc.cover} initial={{ opacity: 0.4, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="absolute inset-0" style={{ background: doc.cover }} />
          <div className="noise absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg/70 to-transparent" />
          <div className="absolute bottom-3 right-4 flex gap-1.5 opacity-0 transition group-hover/cover:opacity-100">
            <Popover
              placement="bottom-end"
              trigger={({ toggle }) => (
                <button onClick={toggle} className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition hover:bg-black/60">
                  <Palette className="h-3.5 w-3.5" /> 커버 변경
                </button>
              )}
            >
              {(close) => (
                <CoverPickerPanel
                  value={doc.cover}
                  onPick={(css) => updateDoc(doc.id, { cover: css })}
                  onRemove={() => { updateDoc(doc.id, { cover: undefined }); close() }}
                />
              )}
            </Popover>
          </div>
        </div>
      ) : (
        <div className="h-16" />
      )}

      <div className="flex justify-center px-6">
        <article className="relative w-full max-w-[780px] pl-14 pr-2" style={{ minWidth: 0 }}>
          {/* emoji icon */}
          <div className={cn('group/head relative', doc.cover ? '-mt-[52px]' : 'mt-4')}>
            {doc.emoji ? (
              <Popover
                placement="bottom-start"
                trigger={({ toggle }) => (
                  <motion.button
                    whileHover={{ scale: 1.06, rotate: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggle}
                    className="relative block rounded-2xl p-1 text-[78px] leading-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:bg-line/[0.06]"
                  >
                    {doc.emoji}
                  </motion.button>
                )}
              >
                {(close) => (
                  <EmojiPickerPanel
                    value={doc.emoji}
                    onPick={(e) => { updateDoc(doc.id, { emoji: e }); close() }}
                    onRemove={() => { updateDoc(doc.id, { emoji: '' }); close() }}
                  />
                )}
              </Popover>
            ) : null}

            {/* add icon / cover actions */}
            <div className="mt-3 flex h-7 gap-1 opacity-0 transition group-hover/head:opacity-100">
              {!doc.emoji && (
                <Popover
                  placement="bottom-start"
                  trigger={({ toggle }) => (
                    <button onClick={toggle} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-subtle hover:bg-line/[0.06] hover:text-muted">
                      <Smile className="h-4 w-4" /> 아이콘 추가
                    </button>
                  )}
                >
                  {(close) => <EmojiPickerPanel onPick={(e) => { updateDoc(doc.id, { emoji: e }); close() }} />}
                </Popover>
              )}
              {!doc.cover && (
                <button
                  onClick={() => updateDoc(doc.id, { cover: COVERS[Math.floor(Math.random() * COVERS.length)].css })}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-subtle hover:bg-line/[0.06] hover:text-muted"
                >
                  <ImagePlus className="h-4 w-4" /> 커버 추가
                </button>
              )}
            </div>

            {/* title */}
            <AutoTextarea
              ref={titleRef}
              preview={false}
              value={doc.title}
              onChange={(e) => updateDoc(doc.id, { title: e.target.value.replace(/\n/g, '') })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); focusFirstBlock() }
                if (e.key === 'ArrowDown' && !e.shiftKey && caretEdge(e.currentTarget, e.currentTarget.selectionStart).last) { e.preventDefault(); focusFirstBlock() }
              }}
              placeholder="제목 없음"
              className="font-display text-[40px] font-bold leading-[1.15] tracking-tight text-fg placeholder:text-subtle/40"
            />
          </div>

          {/* meta row */}
          <div className="mt-3 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line/[0.07] pb-4 text-[12.5px] text-subtle">
            <span className="flex items-center gap-1.5">
              {author && <Avatar user={author} size="xs" />}
              <span className="text-muted">{author?.name}</span> 작성 · {formatDate(doc.createdAt, 'yyyy년 M월 d일')}
            </span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {timeAgo(doc.updatedAt)} 업데이트</span>
            <span className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5" /> {st.chars.toLocaleString()}자 · 약 {st.minutes}분 읽기</span>
            {doc.tags?.length ? (
              <span className="flex flex-wrap gap-1">
                {doc.tags.map((t) => <Badge key={t} tone="accent">#{t}</Badge>)}
              </span>
            ) : null}
          </div>

          <div ref={editorRef}>
            <BlockEditor key={doc.id} initial={doc.content} onChange={(md) => updateDoc(doc.id, { content: md })} coEditors={coEditors.filter((c) => !c.live)} onExitTop={focusTitle} />
          </div>

          {/* sub pages */}
          <div className="mb-24 border-t border-line/[0.07] pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-subtle">하위 페이지 {children.length > 0 && children.length}</h4>
              <button onClick={() => createDoc({ parentId: doc.id })} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-line/[0.06] hover:text-fg">
                <Plus className="h-3.5 w-3.5" /> 하위 페이지 추가
              </button>
            </div>
            {children.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/docs/${c.id}`)}
                    className="card-hover group flex items-start gap-3 rounded-xl border border-line/10 bg-line/[0.02] p-3 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl" style={{ background: c.cover ?? undefined }}>
                      <span className="drop-shadow">{c.emoji || '📄'}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium">{c.title || '제목 없음'}</span>
                      <span className="line-clamp-1 text-[11.5px] text-subtle">{excerpt(c.content, 60) || '비어 있는 페이지'}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-subtle">아직 하위 페이지가 없어요.</p>
            )}
          </div>
        </article>

        <aside className="hidden shrink-0 2xl:block">
          <Outline content={doc.content} scrollRef={scrollRef} />
        </aside>
      </div>
    </div>
  )
}
