import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { Ellipsis, Folder, Star, Users } from 'lucide-react'
import { cn, formatBytes, timeAgo } from '@/lib/utils'
import { Avatar, AvatarStack, Menu, type MenuItem } from '@/components/ui'
import { useUser } from '@/store/core'
import { useFiles } from '../store'
import { useDriveUI } from '../uiStore'
import { baseName, KIND_META, kindOf } from '../fileTypes'
import type { FileItem } from '../types'
import { FileIcon, FilePreviewArt } from './FileGlyph'

export interface ItemHandlers {
  onClick: (e: MouseEvent, item: FileItem) => void
  onOpen: (item: FileItem) => void
  onContext: (e: MouseEvent, item: FileItem) => void
  menuItems: (item: FileItem) => MenuItem[]
}

export function RenameInput({ item, className }: { item: FileItem; className?: string }) {
  const [value, setValue] = useState(item.name)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(0, item.kind === 'folder' ? item.name.length : baseName(item.name).length)
    // only on mount / when a different item starts renaming (not on unrelated store updates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])
  const finish = (commit: boolean) => {
    if (done.current) return
    done.current = true
    if (commit && value.trim() && value.trim() !== item.name) useFiles.getState().renameItem(item.id, value)
    useDriveUI.getState().setRenamingId(null)
  }
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
      className={cn('w-full rounded-md border border-accent/60 bg-surface px-1.5 py-0.5 text-[13px] outline-none ring-4 ring-accent/15', className)}
    />
  )
}

function MoreButton({ item, h }: { item: FileItem; h: ItemHandlers }) {
  return (
    <span onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
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
  )
}

export function FolderCard({ item, count, selected, renaming, h, index }: { item: FileItem; count: number; selected: boolean; renaming: boolean; h: ItemHandlers; index: number }) {
  const color = item.color ?? KIND_META.folder.color
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.3 }}
      data-item-id={item.id}
      onClick={(e) => h.onClick(e, item)}
      onDoubleClick={() => h.onOpen(item)}
      onContextMenu={(e) => h.onContext(e, item)}
      className={cn(
        'group glass relative flex cursor-default select-none items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 transition-all duration-200',
        selected ? 'border-accent/50 bg-accent/[0.1] shadow-glow-sm' : 'hover:-translate-y-0.5 hover:border-line/20 hover:shadow-card',
      )}
    >
      <div className="pointer-events-none absolute -left-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50" style={{ background: color }} />
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `linear-gradient(140deg, ${color}40, ${color}14)`, boxShadow: `inset 0 0 0 1px ${color}40` }}>
        <Folder className="h-5 w-5" style={{ color }} fill={`${color}66`} />
      </div>
      <div className="relative min-w-0 flex-1">
        {renaming ? (
          <RenameInput item={item} />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium">{item.name}</span>
            {item.starred && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
          </div>
        )}
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-subtle">
          {item.trashed ? `삭제됨 · ${timeAgo(item.trashedAt ?? item.updatedAt)}` : `항목 ${count}개`}
          {!!item.sharedWith?.length && <Users className="h-3 w-3" />}
        </div>
      </div>
      <MoreButton item={item} h={h} />
    </motion.div>
  )
}

export function FileCard({ item, selected, renaming, h, index }: { item: FileItem; selected: boolean; renaming: boolean; h: ItemHandlers; index: number }) {
  const owner = useUser(item.ownerId)
  const kind = kindOf(item)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 16) * 0.025, duration: 0.32 }}
      data-item-id={item.id}
      onClick={(e) => h.onClick(e, item)}
      onDoubleClick={() => h.onOpen(item)}
      onContextMenu={(e) => h.onContext(e, item)}
      className={cn(
        'group glass relative flex cursor-default select-none flex-col overflow-hidden rounded-2xl p-1.5 transition-all duration-200',
        selected ? 'border-accent/50 bg-accent/[0.08] shadow-glow' : 'hover:-translate-y-1 hover:border-line/20 hover:shadow-card',
      )}
    >
      <FilePreviewArt item={item} className="h-[132px] rounded-xl bg-line/[0.03]" />
      {selected && <div className="pointer-events-none absolute inset-1.5 h-[132px] rounded-xl ring-2 ring-inset ring-accent/60" />}
      {item.starred && (
        <span className="absolute left-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 backdrop-blur">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        </span>
      )}
      <div className="flex items-start gap-2 px-2 pb-1.5 pt-2.5">
        <FileIcon item={item} className="mt-0.5 h-6 w-6 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5" />
        <div className="min-w-0 flex-1">
          {renaming ? <RenameInput item={item} /> : <div className="truncate text-[13px] font-medium" title={item.name}>{item.name}</div>}
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-subtle">
            {owner && <Avatar user={owner} size="xs" className="scale-90" />}
            <span className="truncate">
              {item.trashed ? `삭제됨 · ${timeAgo(item.trashedAt ?? item.updatedAt)}` : `${timeAgo(item.updatedAt)}${item.size ? ` · ${formatBytes(item.size)}` : ''}`}
            </span>
          </div>
        </div>
        <MoreButton item={item} h={h} />
      </div>
      <span className="sr-only">{KIND_META[kind].label}</span>
    </motion.div>
  )
}

export function SharedAvatars({ ids }: { ids?: string[] }) {
  if (!ids?.length) return null
  return <AvatarStack userIds={ids} size="xs" max={3} />
}
