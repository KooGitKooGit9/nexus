import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, ChevronDown, CloudUpload, Download, FolderInput, RotateCcw, Star, Trash2, X } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import type { MenuItem } from '@/components/ui'
import { useDriveUI } from '../uiStore'
import { KIND_META } from '../fileTypes'
import { useFiles } from '../store'
import { downloadItems } from '../hooks'

/* ───────────── right-click context menu ───────────── */

export function ContextMenu({ items }: { items: MenuItem[] }) {
  const cm = useDriveUI((s) => s.contextMenu)
  const close = useDriveUI((s) => s.closeContextMenu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  // keep the last items while the menu animates out (the parent passes [] once it is closed)
  const lastItems = useRef(items)
  if (items.length) lastItems.current = items
  const shown = items.length ? items : lastItems.current

  useLayoutEffect(() => {
    if (!cm) return
    const r = ref.current?.getBoundingClientRect()
    const w = r?.width ?? 230
    const hgt = r?.height ?? 320
    setPos({ x: Math.min(cm.x, window.innerWidth - w - 8), y: Math.min(cm.y, window.innerHeight - hgt - 8) })
  }, [cm])

  useEffect(() => {
    if (!cm) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onScroll = () => close()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [cm, close])

  return createPortal(
    <AnimatePresence>
      {cm && (
        <motion.div
          ref={ref}
          key={`${cm.id}-${cm.x}-${cm.y}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          style={{ top: pos.y, left: pos.x, transformOrigin: 'top left' }}
          className="fixed z-[95] w-56 rounded-2xl p-1.5 shadow-float glass-strong"
          onContextMenu={(e) => e.preventDefault()}
        >
          {shown.map((it, i) =>
            it.divider ? (
              <div key={i} className="my-1 h-px bg-line/10" />
            ) : (
              <button
                key={i}
                disabled={it.disabled}
                onClick={() => { close(); it.onClick?.() }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition disabled:opacity-40',
                  it.danger ? 'text-danger hover:bg-danger/10' : 'text-fg/90 hover:bg-line/[0.07]',
                )}
              >
                {it.icon && <span className="h-4 w-4 shrink-0 opacity-80 [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>}
                <span className="flex-1">{it.label}</span>
                {it.shortcut && <span className="font-mono text-[11px] text-subtle">{it.shortcut}</span>}
              </button>
            ),
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ───────────── floating multi-select bar ───────────── */

export function SelectionBar({ inTrash, onTrash, onRestore }: { inTrash: boolean; onTrash: () => void; onRestore: () => void }) {
  const selected = useDriveUI((s) => s.selected)
  const clear = useDriveUI((s) => s.clearSelection)
  const files = useFiles((s) => s.files)
  const items = files.filter((f) => selected.includes(f.id))
  const total = items.reduce((s, f) => s + (f.size ?? 0), 0)

  const btn = 'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-fg/85 transition hover:bg-line/10 hover:text-fg'
  return (
    <AnimatePresence>
      {items.length > 1 && (
        <motion.div
          initial={{ y: 40, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 40, opacity: 0, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="absolute bottom-6 left-1/2 z-40 flex w-max max-w-[calc(100%-1.5rem)] items-center gap-1 overflow-x-auto whitespace-nowrap rounded-2xl p-1.5 shadow-float glass-strong scrollbar-none"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-2 px-2.5 text-[13px] font-semibold">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-gradient px-1.5 text-[11px] text-white shadow-glow-sm">{items.length}</span>
            개 선택됨
            {total > 0 && <span className="font-normal text-subtle">· {formatBytes(total)}</span>}
          </span>
          <span className="mx-1 h-5 w-px bg-line/10" />
          {inTrash ? (
            <>
              <button className={btn} onClick={onRestore}><RotateCcw className="h-4 w-4" /> 복원</button>
              <button className={cn(btn, 'text-danger hover:bg-danger/10 hover:text-danger')} onClick={() => useDriveUI.getState().setDeleteIds(selected)}><Trash2 className="h-4 w-4" /> 영구 삭제</button>
            </>
          ) : (
            <>
              <button className={btn} onClick={() => useFiles.getState().toggleStar(selected)}><Star className="h-4 w-4" /> 중요</button>
              <button className={btn} onClick={() => useDriveUI.getState().setMoveIds(selected)}><FolderInput className="h-4 w-4" /> 이동</button>
              <button className={btn} onClick={() => downloadItems(items)}><Download className="h-4 w-4" /> 다운로드</button>
              <button className={cn(btn, 'text-danger hover:bg-danger/10 hover:text-danger')} onClick={onTrash}><Trash2 className="h-4 w-4" /> 휴지통</button>
            </>
          )}
          <span className="mx-1 h-5 w-px bg-line/10" />
          <button onClick={clear} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-line/10 hover:text-fg"><X className="h-4 w-4" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ───────────── drag & drop overlay ───────────── */

export function DropOverlay({ show, target }: { show: boolean; target: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-50 p-4"
        >
          <div className="absolute inset-0 bg-bg/50 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.97 }}
            animate={{ scale: 1 }}
            className="relative flex h-full w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-accent/70 bg-accent/[0.07] shadow-[inset_0_0_80px_rgb(var(--accent)/0.25),0_0_60px_rgb(var(--accent)/0.25)]"
          >
            <div className="relative mb-5">
              <div className="absolute inset-0 animate-pulse rounded-full bg-accent-gradient opacity-60 blur-2xl" />
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-accent-gradient text-white shadow-glow"
              >
                <CloudUpload className="h-9 w-9" />
              </motion.div>
            </div>
            <div className="font-display text-2xl font-bold">여기에 파일을 놓으세요</div>
            <div className="mt-1.5 text-sm text-muted"><span className="font-medium text-accent">{target}</span>에 업로드됩니다</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ───────────── upload progress toasts ───────────── */

export function UploadToasts() {
  const uploads = useDriveUI((s) => s.uploads)
  const clear = useDriveUI((s) => s.clearUploads)
  const [collapsed, setCollapsed] = useState(false)
  const done = uploads.filter((u) => u.done || u.error).length
  const failed = uploads.filter((u) => u.error).length
  // lift above the floating multi-select bar when both are visible
  const lifted = useDriveUI((s) => s.selected.length > 1)

  return createPortal(
    <AnimatePresence>
      {uploads.length > 0 && (
        <motion.div
          initial={{ x: '-50%', y: 30, opacity: 0, scale: 0.96 }}
          animate={{ x: '-50%', y: 0, opacity: 1, scale: 1 }}
          exit={{ x: '-50%', y: 30, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          style={{ bottom: lifted ? 88 : 24 }}
          className="fixed left-1/2 z-[85] w-[min(360px,calc(100vw-3rem))] overflow-hidden rounded-2xl shadow-float glass-strong transition-[bottom] duration-300"
        >
          <div className="flex items-center gap-2 border-b border-line/10 px-4 py-3">
            <CloudUpload className="h-4 w-4 text-accent" />
            <span className="flex-1 text-[13px] font-semibold">
              {done === uploads.length ? (failed ? `${done - failed}개 완료 · ${failed}개 실패` : `${done}개 업로드 완료`) : `${uploads.length - done}개 업로드 중…`}
            </span>
            <button onClick={() => setCollapsed(!collapsed)} className="rounded-md p-1 text-subtle hover:bg-line/10 hover:text-fg">
              <ChevronDown className={cn('h-4 w-4 transition', collapsed && 'rotate-180')} />
            </button>
            <button onClick={clear} className="rounded-md p-1 text-subtle hover:bg-line/10 hover:text-fg"><X className="h-4 w-4" /></button>
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="max-h-64 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {uploads.map((u) => {
                    const meta = KIND_META[u.kind]
                    const Icon = meta.icon
                    return (
                      <motion.div key={u.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.color}22`, color: meta.color }}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12.5px] font-medium">{u.name}</span>
                            {u.error ? (
                              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                            ) : u.done ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                            ) : (
                              <span className="shrink-0 text-[11px] tabular-nums text-subtle">{Math.round(u.progress)}%</span>
                            )}
                          </div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line/10">
                            <motion.div
                              className={cn('relative h-full rounded-full', u.error ? 'bg-danger' : u.done ? 'bg-success' : 'bg-accent-gradient')}
                              animate={{ width: `${u.progress}%` }}
                              transition={{ ease: 'easeOut', duration: 0.2 }}
                            >
                              {!u.done && !u.error && <span className="absolute inset-0 shimmer opacity-60" />}
                            </motion.div>
                          </div>
                          <div className={cn('mt-1 text-[10.5px]', u.error ? 'text-danger' : 'text-subtle')}>
                            {u.error ? u.error : u.done ? `${formatBytes(u.size)} · 완료` : `${formatBytes(Math.round((u.size * u.progress) / 100))} / ${formatBytes(u.size)}`}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
