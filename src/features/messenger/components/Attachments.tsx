import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, FileArchive, FileCode2, FileSpreadsheet, FileText, PenTool, File as FileIcon, ImageIcon, Music, Presentation, Video, X } from 'lucide-react'
import { cn, formatBytes, gradientFor } from '@/lib/utils'
import { toast } from '@/store/core'
import { downloadUrl } from '@/lib/upload'
import type { Attachment } from '../types'
import { fileKind } from '../lib'

const KIND_STYLE: Record<ReturnType<typeof fileKind>, { icon: typeof FileIcon; cls: string; label: string }> = {
  image: { icon: ImageIcon, cls: 'from-sky-400 to-indigo-500', label: '이미지' },
  pdf: { icon: FileText, cls: 'from-rose-500 to-red-600', label: 'PDF' },
  sheet: { icon: FileSpreadsheet, cls: 'from-emerald-400 to-green-600', label: '스프레드시트' },
  doc: { icon: FileText, cls: 'from-blue-400 to-blue-600', label: '문서' },
  slide: { icon: Presentation, cls: 'from-orange-400 to-amber-600', label: '프레젠테이션' },
  figma: { icon: PenTool, cls: 'from-fuchsia-500 to-violet-600', label: 'Figma' },
  zip: { icon: FileArchive, cls: 'from-zinc-400 to-zinc-600', label: '압축 파일' },
  video: { icon: Video, cls: 'from-pink-500 to-rose-600', label: '동영상' },
  audio: { icon: Music, cls: 'from-teal-400 to-cyan-600', label: '오디오' },
  code: { icon: FileCode2, cls: 'from-slate-500 to-slate-700', label: '코드' },
  file: { icon: FileIcon, cls: 'from-zinc-400 to-slate-600', label: '파일' },
}

export function FileTypeIcon({ att, className }: { att: Pick<Attachment, 'mime' | 'name'>; className?: string }) {
  const k = KIND_STYLE[fileKind(att.mime, att.name)]
  const Icon = k.icon
  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-card', k.cls, className)}>
      <Icon className="h-5 w-5" />
    </div>
  )
}

function ImageTile({ att, onOpen, single }: { att: Attachment; onOpen: () => void; single: boolean }) {
  const [broken, setBroken] = useState(false)
  const showImg = att.url && !broken
  const aspect = att.aspect ?? 1.5
  return (
    <button
      onClick={onOpen}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line/10 bg-surface-3 shadow-card transition hover:border-accent/40 hover:shadow-glow-sm',
        single ? 'w-[min(380px,100%)]' : 'w-[220px]',
      )}
      style={{ aspectRatio: showImg ? undefined : String(aspect) }}
    >
      {showImg ? (
        <img src={att.url} alt={att.name} onError={() => setBroken(true)} className="block max-h-[320px] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className={cn('absolute inset-0 bg-gradient-to-br transition duration-700 group-hover:scale-105', att.gradient ?? gradientFor(att.name))}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
          <div className="absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-white/70 drop-shadow" />
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-left opacity-0 transition group-hover:opacity-100">
        <span className="truncate text-[12px] font-medium text-white">{att.name}</span>
        <span className="shrink-0 text-[11px] text-white/70">{formatBytes(att.size)}</span>
      </div>
    </button>
  )
}

export function FileCard({ att, compact }: { att: Attachment; compact?: boolean }) {
  const k = KIND_STYLE[fileKind(att.mime, att.name)]
  return (
    <div className={cn('group flex items-center gap-3 rounded-2xl border border-line/10 bg-surface-2/60 p-2.5 pr-3 transition hover:border-accent/30 hover:bg-surface-2', compact ? 'w-full' : 'w-[320px] max-w-full')}>
      <FileTypeIcon att={att} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">{att.name}</div>
        <div className="text-[11.5px] text-subtle">{k.label} · {formatBytes(att.size)}</div>
      </div>
      <a
        href={att.url ? downloadUrl(att.url) : undefined}
        download={att.url ? att.name : undefined}
        title={att.url ? '다운로드' : '샘플 파일'}
        onClick={(e) => {
          if (!att.url) {
            e.preventDefault()
            toast('샘플 데이터라 실제 파일이 없어요', { emoji: '📄', description: att.name })
          }
        }}
        className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-line/10 hover:text-fg', att.url ? 'opacity-70 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100')}
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  )
}

function MediaTile({ att }: { att: Attachment }) {
  const video = att.mime.startsWith('video/')
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line/10 bg-surface-2/60 shadow-card', video ? 'w-[min(420px,100%)]' : 'w-[min(360px,100%)]')}>
      {video ? (
        <video src={att.url} controls preload="metadata" playsInline className="block max-h-[320px] w-full bg-black" />
      ) : (
        <div className="px-3 pt-3"><audio src={att.url} controls preload="metadata" className="w-full" /></div>
      )}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0 truncate text-[12.5px] font-medium">{att.name}</span>
        <a href={downloadUrl(att.url!)} download={att.name} title="다운로드" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-line/10 hover:text-fg">
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}

const isMedia = (a: Attachment) => !!a.url && (a.mime.startsWith('video/') || a.mime.startsWith('audio/'))

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  const [open, setOpen] = useState<Attachment | null>(null)
  const images = attachments.filter((a) => a.mime.startsWith('image/'))
  const media = attachments.filter(isMedia)
  const files = attachments.filter((a) => !a.mime.startsWith('image/') && !isMedia(a))
  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <ImageTile key={a.id} att={a} single={images.length === 1} onOpen={() => setOpen(a)} />
          ))}
        </div>
      )}
      {media.map((a) => (
        <MediaTile key={a.id} att={a} />
      ))}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((a) => (
            <FileCard key={a.id} att={a} />
          ))}
        </div>
      )}
      <Lightbox att={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function Lightbox({ att, onClose }: { att: Attachment | null; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      {att && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-8 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative max-h-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            {att.url ? (
              <img src={att.url} alt={att.name} className="max-h-[80vh] rounded-2xl object-contain shadow-float" />
            ) : (
              <div className={cn('relative w-[min(860px,85vw)] overflow-hidden rounded-3xl bg-gradient-to-br shadow-float', att.gradient ?? gradientFor(att.name))} style={{ aspectRatio: String(att.aspect ?? 1.6) }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
                <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="h-14 w-14 text-white/70" /></div>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-white">
              <div>
                <div className="text-sm font-semibold">{att.name}</div>
                <div className="text-xs text-white/60">{formatBytes(att.size)}</div>
              </div>
              <div className="flex gap-2">
                {att.url && (
                  <a href={downloadUrl(att.url)} download={att.name} title="다운로드" className="rounded-xl bg-white/10 p-2 hover:bg-white/20"><Download className="h-4 w-4" /></a>
                )}
                <button onClick={onClose} title="닫기" className="rounded-xl bg-white/10 p-2 hover:bg-white/20"><X className="h-4 w-4" /></button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
