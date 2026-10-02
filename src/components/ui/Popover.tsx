import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'left-start'

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  placement?: Placement
  className?: string
  open?: boolean
  onOpenChange?: (v: boolean) => void
}

/**
 * Escape handling: one window-level *capture* listener closes only the most recently opened popover
 * and stops the event, so an Esc inside a Popover that lives in a Modal/Drawer doesn't also close the
 * Modal (whose listeners are bubble-phase on window). Nested popovers close innermost-first.
 */
const escStack: { close: () => void }[] = []
let escInstalled = false
function onEscapeCapture(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !escStack.length || e.isComposing) return
  e.stopPropagation()
  e.stopImmediatePropagation()
  escStack[escStack.length - 1].close()
}

/** Anchored floating panel rendered in a portal; closes on outside click / Esc. */
export function Popover({ trigger, children, placement = 'bottom-start', className, open: controlled, onOpenChange }: PopoverProps) {
  const [inner, setInner] = useState(false)
  const open = controlled ?? inner
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInner(v))
  const anchor = useRef<HTMLSpanElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchor.current) return
    const update = () => {
      const r = anchor.current!.getBoundingClientRect()
      const p = panel.current?.getBoundingClientRect()
      const pw = p?.width ?? 240
      const ph = p?.height ?? 200
      let top = r.bottom + 6
      let left = r.left
      if (placement.endsWith('end')) left = r.right - pw
      if (placement.startsWith('top')) top = r.top - ph - 6
      if (placement === 'right-start') { left = r.right + 6; top = r.top }
      if (placement === 'left-start') { left = r.left - pw - 6; top = r.top }
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8))
      top = Math.max(8, Math.min(top, window.innerHeight - ph - 8))
      setPos({ top, left })
    }
    update()
    const id = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, placement])

  const setOpenRef = useRef(setOpen)
  setOpenRef.current = setOpen

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) setOpenRef.current(false)
    }
    const entry = { close: () => setOpenRef.current(false) }
    escStack.push(entry)
    if (!escInstalled) { window.addEventListener('keydown', onEscapeCapture, true); escInstalled = true }
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      const i = escStack.indexOf(entry)
      if (i >= 0) escStack.splice(i, 1)
    }
  }, [open])

  const close = () => setOpen(false)
  return (
    <>
      <span ref={anchor} className="inline-flex">{trigger({ open, toggle: () => setOpen(!open) })}</span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panel}
              className={cn('fixed z-[90] glass-strong rounded-2xl shadow-float p-1.5 min-w-[200px]', className)}
              style={{ top: pos.top, left: pos.left }}
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -2 }}
              transition={{ duration: 0.14 }}
            >
              {typeof children === 'function' ? children(close) : children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export interface MenuItem {
  label: ReactNode
  icon?: ReactNode
  onClick?: () => void
  danger?: boolean
  shortcut?: string
  divider?: boolean
  disabled?: boolean
}

/** Dropdown menu built on Popover. */
export function Menu({ trigger, items, placement = 'bottom-end', className }: { trigger: ReactNode; items: MenuItem[]; placement?: Placement; className?: string }) {
  return (
    <Popover placement={placement} className={className} trigger={({ toggle }) => <span onClick={(e) => { e.stopPropagation(); toggle() }}>{trigger}</span>}>
      {(close) => (
        <div className="flex flex-col">
          {items.map((it, i) =>
            it.divider ? (
              <div key={i} className="my-1 h-px bg-line/10" />
            ) : (
              <button
                key={i}
                disabled={it.disabled}
                onClick={(e) => { e.stopPropagation(); it.onClick?.(); close() }}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-left transition disabled:opacity-40',
                  it.danger ? 'text-danger hover:bg-danger/10' : 'text-fg/90 hover:bg-line/[0.07]',
                )}
              >
                {it.icon && <span className="h-4 w-4 shrink-0 opacity-80 [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>}
                <span className="flex-1">{it.label}</span>
                {it.shortcut && <span className="text-[11px] text-subtle font-mono">{it.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </Popover>
  )
}
