import { ArrowDown, ArrowUp, Ellipsis, Star, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn, formatBytes, formatDate, timeAgo } from '@/lib/utils'
import { Avatar, Menu } from '@/components/ui'
import { useCore } from '@/store/core'
import { useFiles } from '../store'
import { KIND_META, kindOf } from '../fileTypes'
import type { FileItem, SortKey } from '../types'
import { FileIcon } from './FileGlyph'
import { RenameInput, type ItemHandlers } from './ItemCards'

const COLS: { key: SortKey; label: string; className: string }[] = [
  { key: 'name', label: '이름', className: 'flex-1 min-w-0' },
  { key: 'owner', label: '소유자', className: 'w-40 hidden md:flex' },
  { key: 'updatedAt', label: '수정한 날짜', className: 'w-36 hidden sm:flex' },
  { key: 'size', label: '파일 크기', className: 'w-24 hidden lg:flex justify-end' },
]

export function ListView({ items, selected, renamingId, counts, h, showLocation }: {
  items: FileItem[]
  selected: string[]
  renamingId: string | null
  counts: Map<string, number>
  h: ItemHandlers
  showLocation?: boolean
}) {
  const sortKey = useFiles((s) => s.sortKey)
  const sortDir = useFiles((s) => s.sortDir)
  const setSort = useFiles((s) => s.setSort)
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const files = useFiles((s) => s.files)

  return (
    // overflow-clip (not hidden) so the sticky column header sticks to the page scroller
    <div className="glass overflow-clip rounded-2xl">
      <div className="sticky top-0 z-10 flex h-10 items-center gap-4 border-b border-line/10 bg-surface/80 px-4 text-[12px] font-medium text-subtle backdrop-blur">
        {COLS.map((c) => (
          <button key={c.key} onClick={() => setSort(c.key)} className={cn('items-center gap-1 transition hover:text-fg', c.className, c.key === 'name' && 'flex', sortKey === c.key && 'text-fg')}>
            {c.label}
            {sortKey === c.key && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-accent" /> : <ArrowDown className="h-3 w-3 text-accent" />)}
          </button>
        ))}
        <span className="w-8" />
      </div>
      <div>
        {items.map((item, i) => {
          const isSel = selected.includes(item.id)
          const owner = users.find((u) => u.id === item.ownerId)
          const parent = showLocation && item.parentId ? files.find((f) => f.id === item.parentId) : undefined
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 20) * 0.015 }}
              data-item-id={item.id}
              onClick={(e) => h.onClick(e, item)}
              onDoubleClick={() => h.onOpen(item)}
              onContextMenu={(e) => h.onContext(e, item)}
              className={cn(
                'group relative flex h-12 cursor-default select-none items-center gap-4 border-b border-line/[0.05] px-4 text-[13px] transition-colors last:border-0',
                isSel ? 'bg-accent/[0.1]' : 'hover:bg-line/[0.035]',
              )}
            >
              {isSel && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent-gradient" />}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileIcon item={item} />
                <div className="min-w-0 flex-1">
                  {renamingId === item.id ? (
                    <RenameInput item={item} className="max-w-sm" />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{item.name}</span>
                      {item.starred && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                      {!!item.sharedWith?.length && <Users className="h-3 w-3 shrink-0 text-subtle" />}
                    </div>
                  )}
                  <div className="truncate text-[11px] text-subtle">
                    {item.kind === 'folder' ? `폴더 · 항목 ${counts.get(item.id) ?? 0}개` : KIND_META[kindOf(item)].label}
                    {showLocation && ` · ${parent ? parent.name : '내 드라이브'}`}
                    {item.trashed && ` · ${timeAgo(item.trashedAt ?? item.updatedAt)} 삭제됨`}
                  </div>
                </div>
              </div>
              <div className="hidden w-40 items-center gap-2 text-muted md:flex">
                <Avatar userId={item.ownerId} size="xs" />
                <span className="truncate">{item.ownerId === me ? '나' : owner?.name}</span>
              </div>
              <div className="hidden w-36 text-muted sm:block" title={formatDate(item.updatedAt, 'yyyy.MM.dd HH:mm')}>
                {Date.now() - +new Date(item.updatedAt) < 7 * 864e5 ? timeAgo(item.updatedAt) : formatDate(item.updatedAt, 'yyyy. M. d.')}
              </div>
              <div className="hidden w-24 text-right tabular-nums text-muted lg:block">{item.kind === 'folder' ? '—' : item.size ? formatBytes(item.size) : '—'}</div>
              <span className="w-8" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                <Menu
                  placement="bottom-end"
                  className="w-56"
                  trigger={
                    <button className="flex h-7 w-7 items-center justify-center rounded-lg text-subtle opacity-0 transition hover:bg-line/10 hover:text-fg group-hover:opacity-100">
                      <Ellipsis className="h-4 w-4" />
                    </button>
                  }
                  items={h.menuItems(item)}
                />
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
