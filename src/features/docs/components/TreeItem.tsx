import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CopyPlus, Ellipsis, FolderInput, Link2, Plus, Star, StarOff, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Menu, Tooltip } from '@/components/ui'
import { toast } from '@/store/core'
import type { Doc } from '../types'
import { useDocs } from '../store'
import { closeOverlayTree, useDocsUI } from '../uiStore'
import { copyDocLink, useCreateDoc } from '../hooks'

interface Props {
  doc: Doc
  depth: number
  activeId?: string
  childrenMap: Map<string | null, Doc[]>
  /** flat mode (favorites/recent): no nesting */
  flat?: boolean
}

export function TreeItem({ doc, depth, activeId, childrenMap, flat }: Props) {
  const navigate = useNavigate()
  const expanded = useDocs((s) => !!s.expanded[doc.id])
  const setExpanded = useDocs((s) => s.setExpanded)
  const toggleStar = useDocs((s) => s.toggleStar)
  const duplicateDoc = useDocs((s) => s.duplicateDoc)
  const createDoc = useCreateDoc()
  const children = childrenMap.get(doc.id) ?? []
  const active = activeId === doc.id
  const open = expanded && !flat

  return (
    <div>
      <div
        onClick={() => { navigate(`/docs/${doc.id}`); closeOverlayTree() }}
        className={cn(
          'group/tree relative flex h-[30px] cursor-pointer items-center gap-1 rounded-lg pr-1 text-[13.5px] transition-colors',
          active ? 'bg-accent/[0.12] text-fg' : 'text-fg/75 hover:bg-line/[0.05] hover:text-fg',
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {active && <motion.span layoutId={flat ? undefined : 'tree-active'} className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent-gradient shadow-glow-sm" />}
        {!flat && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(doc.id, !expanded) }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-line/10 hover:text-fg"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90', !children.length && 'opacity-40')} />
          </button>
        )}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[15px] leading-none">{doc.emoji || '📄'}</span>
        <span className={cn('min-w-0 flex-1 truncate', active && 'font-medium', !doc.title && 'text-subtle')}>{doc.title || '제목 없음'}</span>

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/tree:opacity-100" onClick={(e) => e.stopPropagation()}>
          <Menu
            placement="bottom-start"
            className="w-52"
            trigger={
              <button className="flex h-6 w-6 items-center justify-center rounded-md text-subtle hover:bg-line/10 hover:text-fg">
                <Ellipsis className="h-4 w-4" />
              </button>
            }
            items={[
              { label: doc.starred ? '즐겨찾기 해제' : '즐겨찾기에 추가', icon: doc.starred ? <StarOff /> : <Star />, onClick: () => toggleStar(doc.id) },
              { label: '링크 복사', icon: <Link2 />, onClick: () => copyDocLink(doc.id) },
              {
                label: '복제',
                icon: <CopyPlus />,
                onClick: () => {
                  const copy = duplicateDoc(doc.id)
                  if (copy) { toast('페이지를 복제했어요', { emoji: '📑', variant: 'success' }); navigate(`/docs/${copy.id}`) }
                },
              },
              { label: '옮기기…', icon: <FolderInput />, onClick: () => useDocsUI.getState().setMoveId(doc.id) },
              { label: '', divider: true },
              { label: '삭제', icon: <Trash2 />, danger: true, onClick: () => useDocsUI.getState().setDeleteId(doc.id) },
            ]}
          />
          {!flat && (
            <Tooltip content="하위 페이지 추가" side="right">
              <button
                onClick={() => createDoc({ parentId: doc.id })}
                className="flex h-6 w-6 items-center justify-center rounded-md text-subtle hover:bg-line/10 hover:text-fg"
              >
                <Plus className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {!flat && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {children.length ? (
                children.map((c) => <TreeItem key={c.id} doc={c} depth={depth + 1} activeId={activeId} childrenMap={childrenMap} />)
              ) : (
                <div className="py-1 text-[12px] text-subtle" style={{ paddingLeft: 34 + depth * 14 }}>
                  하위 페이지 없음
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
