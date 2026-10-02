import { useState } from 'react'
import { Folder, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileItem } from '../types'
import { KIND_META, artFor, extOf, kindOf } from '../fileTypes'

/** Small rounded icon tile (list rows, menus). */
export function FileIcon({ item, className }: { item: FileItem; className?: string }) {
  const kind = kindOf(item)
  const meta = KIND_META[kind]
  const Icon = kind === 'folder' ? Folder : meta.icon
  const color = kind === 'folder' ? item.color ?? meta.color : meta.color
  const thumb = kind === 'image' ? item.thumbnail ?? item.url : undefined
  if (thumb) return <img src={thumb} alt="" className={cn('h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-line/10', className)} />
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', className)} style={{ background: `${color}22`, color }}>
      <Icon className="h-[18px] w-[18px]" fill={kind === 'folder' ? `${color}55` : 'none'} />
    </span>
  )
}

/** Big preview area for grid cards: real thumbnail, generated art, or a stylised document glyph. */
export function FilePreviewArt({ item, className }: { item: FileItem; className?: string }) {
  const kind = kindOf(item)
  const meta = KIND_META[kind]
  const [broken, setBroken] = useState(false)
  const src = item.thumbnail ?? item.url

  if (kind === 'image' && src && !broken) {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <img src={src} alt={item.name} onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
    )
  }
  if (kind === 'image' || kind === 'video') {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-110" style={{ background: artFor(item.id) }} />
        <div className="noise absolute inset-0" />
        {kind === 'video' && (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-md transition group-hover:scale-110 group-hover:bg-white/30">
                <Play className="ml-0.5 h-5 w-5 fill-white" />
              </span>
            </div>
            <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur">
              {String(2 + (item.id.length % 40)).padStart(2, '0')}:{String((item.id.charCodeAt(3) * 7) % 60).padStart(2, '0')}
            </span>
          </>
        )}
      </div>
    )
  }
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden', className)} style={{ background: `radial-gradient(circle at 50% 40%, ${meta.color}26, transparent 70%)` }}>
      <DocGlyph item={item} />
    </div>
  )
}

/** Paper-with-folded-corner glyph with the extension label. */
export function DocGlyph({ item, size = 1 }: { item: FileItem; size?: number }) {
  const kind = kindOf(item)
  const meta = KIND_META[kind]
  const Icon = meta.icon
  const ext = extOf(item.name).toUpperCase().slice(0, 4) || 'FILE'
  return (
    <div className="relative transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-2deg]" style={{ width: 58 * size, height: 72 * size }}>
      <div className="absolute inset-0 rounded-xl opacity-60 blur-xl" style={{ background: meta.color }} />
      <div
        className="relative h-full w-full rounded-xl shadow-card"
        style={{
          background: `linear-gradient(150deg, ${meta.color}, ${meta.color2})`,
          clipPath: `polygon(0 0, calc(100% - ${16 * size}px) 0, 100% ${16 * size}px, 100% 100%, 0 100%)`,
        }}
      >
        <div className="absolute right-0 top-0 rounded-bl-md bg-white/35" style={{ width: 16 * size, height: 16 * size }} />
        <div className="flex h-full flex-col items-center justify-center gap-1 pt-1 text-white">
          <Icon style={{ width: 22 * size, height: 22 * size }} strokeWidth={2} />
          <span className="font-display font-bold tracking-wide" style={{ fontSize: 9 * size }}>{ext}</span>
        </div>
      </div>
    </div>
  )
}
