import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type Side = 'top' | 'bottom' | 'right' | 'left'
const GAP = 8
const MARGIN = 6

/**
 * Lightweight tooltip. Rendered in a portal with fixed positioning so it is never clipped by
 * scrolling / overflow-hidden ancestors (e.g. the collapsed sidebar rail). Wrap any inline element.
 */
export function Tooltip({ content, children, side = 'top', className }: { content: ReactNode; children: ReactNode; side?: Side; className?: string }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!show) return
    const a = anchor.current?.getBoundingClientRect()
    const t = tip.current?.getBoundingClientRect()
    if (!a) return
    const tw = t?.width ?? 0
    const th = t?.height ?? 0
    let left = 0
    let top = 0
    if (side === 'top') { left = a.left + a.width / 2 - tw / 2; top = a.top - th - GAP }
    if (side === 'bottom') { left = a.left + a.width / 2 - tw / 2; top = a.bottom + GAP }
    if (side === 'right') { left = a.right + GAP; top = a.top + a.height / 2 - th / 2 }
    if (side === 'left') { left = a.left - tw - GAP; top = a.top + a.height / 2 - th / 2 }
    // flip vertically if there is no room
    if (side === 'top' && top < MARGIN) top = a.bottom + GAP
    if (side === 'bottom' && top + th > window.innerHeight - MARGIN) top = a.top - th - GAP
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - tw - MARGIN))
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - th - MARGIN))
    setPos({ left, top })
  }, [show, side, content])

  // hide when the page scrolls / a click happens (the anchor may move or unmount)
  useLayoutEffect(() => {
    if (!show) return
    const hide = () => setShow(false)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('pointerdown', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('pointerdown', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [show])

  const origin = { top: 'bottom', bottom: 'top', right: 'left', left: 'right' }[side]
  return (
    <span
      ref={anchor}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={(e) => { if ((e.target as HTMLElement).matches?.(':focus-visible')) setShow(true) }}
      onBlur={() => setShow(false)}
    >
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {show && content && (
              <span
                ref={tip}
                role="tooltip"
                className="pointer-events-none fixed z-[300]"
                style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
              >
                <motion.span
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.12 }}
                  style={{ transformOrigin: origin }}
                  className="block whitespace-nowrap rounded-lg border border-white/10 bg-zinc-950/95 px-2 py-1 text-xs font-medium text-white shadow-lg"
                >
                  {content}
                </motion.span>
              </span>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  )
}
