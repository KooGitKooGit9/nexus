/** Textarea caret geometry helpers (mirror-div technique). */

const COPY = [
  'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'letterSpacing', 'lineHeight', 'textTransform', 'textIndent', 'wordSpacing', 'tabSize',
] as const

let mirror: HTMLDivElement | null = null

/** Top offset (px, relative to the textarea's content box) of the caret placed at `pos`. */
function caretTop(el: HTMLTextAreaElement, pos: number): number {
  if (!mirror) {
    mirror = document.createElement('div')
    mirror.setAttribute('aria-hidden', 'true')
    document.body.appendChild(mirror)
  }
  const cs = getComputedStyle(el)
  const s = mirror.style
  COPY.forEach((k) => { s[k] = cs[k] })
  s.position = 'absolute'
  s.visibility = 'hidden'
  s.top = '0'
  s.left = '-9999px'
  s.whiteSpace = 'pre-wrap'
  s.overflowWrap = 'break-word'
  s.wordBreak = cs.wordBreak
  s.overflow = 'hidden'
  s.height = 'auto'
  mirror.textContent = el.value.slice(0, pos)
  const marker = document.createElement('span')
  marker.textContent = el.value.slice(pos) || '.'
  mirror.appendChild(marker)
  return marker.offsetTop
}

/** Whether the caret at `pos` sits on the first / last *visual* line of the textarea (wrapping-aware). */
export function caretEdge(el: HTMLTextAreaElement, pos: number): { first: boolean; last: boolean } {
  const len = el.value.length
  if (!len) return { first: true, last: true }
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 24
  const top = caretTop(el, pos)
  return {
    first: top < lh / 2,
    last: top > caretTop(el, len) - lh / 2,
  }
}
