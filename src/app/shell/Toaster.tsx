import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Info, AlertTriangle, Bell, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUI, useUser } from '@/store/core'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { Avatar } from '@/components/ui'
import type { Toast, ToastVariant } from '@/store/types'

const VARIANT: Record<ToastVariant, { icon: LucideIcon; tile: string; bar: string; glow: string }> = {
  default: { icon: Bell, tile: 'bg-accent-gradient', bar: 'bg-accent-gradient', glow: 'rgb(var(--accent) / 0.35)' },
  success: { icon: CheckCircle2, tile: 'bg-success', bar: 'bg-success', glow: 'rgb(var(--success) / 0.35)' },
  error: { icon: XCircle, tile: 'bg-danger', bar: 'bg-danger', glow: 'rgb(var(--danger) / 0.35)' },
  info: { icon: Info, tile: 'bg-info', bar: 'bg-info', glow: 'rgb(var(--info) / 0.35)' },
  warning: { icon: AlertTriangle, tile: 'bg-warning', bar: 'bg-warning', glow: 'rgb(var(--warning) / 0.35)' },
}

const GAP = 10
const PEEK = 14
const DEFAULT_DURATION = 4200

let seq = 0
const order = new Map<string, number>()
const orderOf = (id: string) => {
  if (!order.has(id)) order.set(id, ++seq)
  return order.get(id)!
}

/**
 * Sonner-style stack. Collapsed: cards peek behind each other. Hover: expands into a list,
 * pauses the progress bars and holds toasts that expire while you're reading them.
 */
export function Toaster() {
  const live = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  const [hovered, setHovered] = useState(false)
  const [held, setHeld] = useState<Toast[]>([])
  const prev = useRef<Toast[]>([])
  const manual = useRef(new Set<string>())
  const [heights, setHeights] = useState<Record<string, number>>({})
  // keep toasts clear of the Nexus AI panel (420px, bottom-right): sit to its left, or at the top on narrow screens
  const aiOpen = useUI((s) => s.aiOpen)
  const roomBeside = useMediaQuery('(min-width: 900px)')

  // hold toasts that time out while hovered
  useEffect(() => {
    if (hovered) {
      const gone = prev.current.filter((t) => !live.some((l) => l.id === t.id) && !manual.current.has(t.id))
      if (gone.length) setHeld((h) => [...h, ...gone.filter((g) => !h.some((x) => x.id === g.id))])
    }
    prev.current = live
  }, [live, hovered])

  useEffect(() => {
    if (hovered || !held.length) return
    const t = setTimeout(() => setHeld([]), 1200)
    return () => clearTimeout(t)
  }, [hovered, held.length])

  const shown = [...live, ...held.filter((h) => !live.some((l) => l.id === h.id))]
    .sort((a, b) => orderOf(b.id) - orderOf(a.id)) // newest first
    .slice(0, 5)

  useEffect(() => {
    if (!shown.length && hovered) setHovered(false)
  }, [shown.length, hovered])

  const close = (id: string) => {
    manual.current.add(id)
    setHeld((h) => h.filter((x) => x.id !== id))
    dismiss(id)
  }

  const expanded = hovered
  const frontH = heights[shown[0]?.id] ?? 72
  const offsets: number[] = []
  let total = 0
  for (let i = 0; i < shown.length; i++) {
    offsets.push(expanded ? total : i * PEEK)
    total += (heights[shown[i].id] ?? 72) + GAP
  }
  const containerH = shown.length === 0 ? 0 : expanded ? total - GAP : frontH + Math.min(shown.length - 1, 2) * PEEK

  return createPortal(
    <div
      className={cn('fixed z-[120] w-[380px] max-w-[calc(100vw-40px)]', aiOpen && !roomBeside ? 'top-[84px]' : 'bottom-5')}
      style={{ height: containerH, right: aiOpen && roomBeside ? 452 : 20, transition: 'height 300ms cubic-bezier(.22,1,.36,1), right 300ms cubic-bezier(.22,1,.36,1)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence initial={false}>
        {shown.map((t, i) => (
          <motion.div
            key={t.id}
            className="absolute bottom-0 right-0 w-full origin-bottom"
            style={{ zIndex: 50 - i }}
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{
              opacity: !expanded && i > 2 ? 0 : 1,
              y: -offsets[i],
              scale: expanded ? 1 : 1 - i * 0.045,
            }}
            exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <ToastCard
              toast={t}
              paused={hovered}
              collapsedBehind={!expanded && i > 0}
              frontHeight={frontH}
              onClose={() => close(t.id)}
              onHeight={(h) => setHeights((m) => (m[t.id] === h ? m : { ...m, [t.id]: h }))}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      <style>{`@keyframes nexus-toast-progress { from { transform: scaleX(1) } to { transform: scaleX(0) } }`}</style>
    </div>,
    document.body,
  )
}

function ToastCard({ toast: t, paused, collapsedBehind, frontHeight, onClose, onHeight }: {
  toast: Toast
  paused: boolean
  collapsedBehind: boolean
  frontHeight: number
  onClose: () => void
  onHeight: (h: number) => void
}) {
  const v = VARIANT[t.variant ?? 'default'] ?? VARIANT.default
  const Icon = v.icon
  const actor = useUser(t.actorId)
  const inner = useRef<HTMLDivElement>(null)
  const duration = t.duration ?? DEFAULT_DURATION

  useLayoutEffect(() => {
    if (!inner.current) return
    const el = inner.current
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight))
    ro.observe(el)
    onHeight(el.offsetHeight)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="relative overflow-hidden rounded-2xl glass-strong shadow-float transition-[height] duration-300"
      style={{ height: collapsedBehind ? frontHeight : undefined, boxShadow: `0 18px 40px -16px ${v.glow}, 0 24px 64px -12px rgb(0 0 0 / 0.45)` }}
    >
      <div ref={inner} className={cn('group flex items-start gap-3 p-3.5 pr-10 transition-opacity', collapsedBehind && 'opacity-0')}>
        <div className="relative shrink-0">
          {actor ? (
            <>
              <Avatar user={actor} size="md" />
              <span className={cn('absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ring-2 ring-surface', t.emoji ? 'bg-surface-3' : v.tile)}>
                {t.emoji ? <span className="text-[10px] leading-none">{t.emoji}</span> : <Icon className="h-2.5 w-2.5" />}
              </span>
            </>
          ) : t.emoji ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-line/[0.07] text-lg leading-none">{t.emoji}</div>
          ) : (
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-card', v.tile)}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-[13.5px] font-semibold leading-snug text-fg">{t.title}</div>
          {t.description && <div className="mt-0.5 line-clamp-3 text-[12.5px] leading-snug text-muted">{t.description}</div>}
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-2.5 top-2.5 rounded-lg p-1 text-subtle opacity-60 transition hover:bg-line/10 hover:text-fg hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-line/[0.06]">
        <div
          className={cn('h-full origin-left opacity-80', v.bar)}
          style={{ animation: `nexus-toast-progress ${duration}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      </div>
    </div>
  )
}
