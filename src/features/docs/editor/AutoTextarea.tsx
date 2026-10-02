import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type MouseEvent, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Inline, hasInlineMarkdown } from '../components/Inline'

type CaretDoc = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

/** Maps a click inside the rendered preview back to a caret offset in the markdown source. */
function sourceOffsetAt(root: HTMLElement, x: number, y: number, sourceLength: number): number {
  const d = document as CaretDoc
  let node: Node | null = null
  let offset = 0
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y)
    if (p) { node = p.offsetNode; offset = p.offset }
  } else if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(x, y)
    if (r) { node = r.startContainer; offset = r.startOffset }
  }
  if (!node || !root.contains(node)) return sourceLength
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  const host = el?.closest<HTMLElement>('[data-src]')
  if (!host || !root.contains(host)) {
    // clicked on the container itself (e.g. right of the last line) → before/after the child at `offset`
    const child = node === root ? root.childNodes[offset] : null
    const childHost = child instanceof HTMLElement ? child.closest<HTMLElement>('[data-src]') : null
    return childHost ? Number(childHost.dataset.src) : sourceLength
  }
  const base = Number(host.dataset.src) || 0
  return Math.min(sourceLength, base + (node.nodeType === Node.TEXT_NODE ? offset : offset > 0 ? (host.textContent?.length ?? 0) : 0))
}

/**
 * Single-row textarea that grows with its content (no contenteditable).
 * When not focused and the text contains inline markdown, a rendered preview is shown on top
 * (the textarea stays mounted & focusable underneath, so keyboard navigation keeps working).
 * Clicking the preview focuses the textarea with the caret at the matching source position; links stay clickable.
 */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { preview?: boolean }>(function AutoTextarea(
  { className, value, preview = true, onFocus, onBlur, ...props },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const text = typeof value === 'string' ? value : ''
  const showPreview = preview && !focused && text.length > 0 && hasInlineMarkdown(text)
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement)

  const resize = () => {
    const el = inner.current
    if (!el) return
    // while the preview is shown the (invisible) textarea just fills the preview box
    if (el.dataset.preview) { el.style.height = ''; return }
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  // className too: "turn into" keeps the text but changes the font size → re-measure
  useLayoutEffect(resize, [value, showPreview, className])

  // Re-measure when the available width changes (panels toggling, window resize)
  useEffect(() => {
    const parent = inner.current?.parentElement
    if (!parent || typeof ResizeObserver === 'undefined') return
    let lastWidth = parent.clientWidth
    const ro = new ResizeObserver(() => {
      if (parent.clientWidth !== lastWidth) {
        lastWidth = parent.clientWidth
        resize()
      }
    })
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  const onPreviewMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('a')) return
    e.preventDefault()
    const el = inner.current
    const root = previewRef.current
    if (!el || !root) return
    const pos = sourceOffsetAt(root, e.clientX, e.clientY, el.value.length)
    el.focus({ preventScroll: true })
    el.setSelectionRange(pos, pos)
  }

  const textarea = (
    <textarea
      ref={inner}
      rows={1}
      value={value}
      spellCheck={false}
      data-preview={showPreview || undefined}
      onFocus={(e) => { setFocused(true); onFocus?.(e) }}
      onBlur={(e) => { setFocused(false); onBlur?.(e) }}
      className={cn(
        'block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:ring-0',
        className,
        showPreview && 'pointer-events-none absolute inset-0 h-full opacity-0',
      )}
      {...props}
    />
  )
  if (!preview) return textarea
  return (
    <div className="relative w-full min-w-0">
      {textarea}
      {showPreview && (
        <div ref={previewRef} className={cn('w-full cursor-text whitespace-pre-wrap break-words', className)} onMouseDown={onPreviewMouseDown}>
          <Inline text={text} mapped />
        </div>
      )}
    </div>
  )
})
