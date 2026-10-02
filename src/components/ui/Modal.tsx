import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  /** hide default header close button */
  hideClose?: boolean
}


/**
 * Stacked Esc handling for Modal/Drawer: only the most recently opened layer closes, so a Modal
 * opened from a Drawer (or a Modal over a Modal) doesn't take the one underneath with it.
 * Bubble phase on purpose: inner widgets (autocomplete lists, Popovers via their capture stack)
 * can consume Esc first by stopping propagation or calling preventDefault.
 */
const layerStack: object[] = []
function useEscapeLayer(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const token = {}
    layerStack.push(token)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return
      if (layerStack[layerStack.length - 1] !== token) return
      e.preventDefault()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const i = layerStack.indexOf(token)
      if (i >= 0) layerStack.splice(i, 1)
    }
  }, [open])
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-[min(1200px,95vw)]' }

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className, hideClose }: ModalProps) {
  useEscapeLayer(open, onClose)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn('relative w-full glass-strong rounded-3xl shadow-float flex flex-col max-h-[90vh]', sizes[size], className)}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
                <div>
                  {title && <h2 className="text-lg font-semibold text-fg">{title}</h2>}
                  {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                </div>
                {!hideClose && (
                  <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-line/10 hover:text-fg transition">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className="px-6 pb-5 overflow-y-auto">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line/10 px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Right-side slide-over panel. */
export function Drawer({ open, onClose, title, children, width = 520, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children?: ReactNode; width?: number; footer?: ReactNode }) {
  useEscapeLayer(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="absolute right-0 top-0 h-full glass-strong shadow-float flex flex-col max-w-full"
            style={{ width }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line/10 px-5 py-4">
              <div className="min-w-0 flex-1 font-semibold">{title}</div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-line/10 hover:text-fg"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="border-t border-line/10 px-5 py-3">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
