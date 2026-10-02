import { nanoid } from 'nanoid'

/**
 * Block model for the docs editor + markdown (de)serialization.
 * `Doc.content` is always plain markdown so other modules can read/render it.
 *
 * Supported syntax:
 *   # / ## / ###        headings
 *   - text               bullet          (2-space indent per level)
 *   1. text              numbered
 *   - [ ] / - [x] text   todo
 *   > text               quote
 *   > [!💡] text          callout (GitHub-alert style, emoji inside)
 *   ```lang … ```        code
 *   ---                  divider
 *   ![caption](url)      image
 *   | a | b |            table
 */
export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'code'
  | 'callout'
  | 'divider'
  | 'image'
  | 'table'

export interface Block {
  id: string
  type: BlockType
  text: string
  checked?: boolean
  emoji?: string
  lang?: string
  url?: string
  rows?: string[][]
  indent?: number
}

export const LIST_TYPES: BlockType[] = ['bullet', 'numbered', 'todo']
export const NON_TEXT_TYPES: BlockType[] = ['divider', 'table', 'image']

export const isList = (b?: Block) => !!b && LIST_TYPES.includes(b.type)
/** Blocks whose main content is an editable text field (merge / arrow-nav targets). */
export const isTextBlock = (b?: Block) => !!b && !NON_TEXT_TYPES.includes(b.type)

export function newBlock(type: BlockType = 'paragraph', patch: Partial<Block> = {}): Block {
  const base: Block = { id: nanoid(8), type, text: '' }
  if (type === 'callout') base.emoji = '💡'
  if (type === 'table') base.rows = [['', ''], ['', '']]
  return { ...base, ...patch }
}

const FENCE = /^```\s*([\w+#.-]*)\s*$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const DIVIDER = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/
const HEADING = /^(#{1,3})(?:\s+(.*))?$/
const TODO = /^[-*+]\s+\[( |x|X)\]\s?(.*)$/
const BULLET = /^[-*+](?:\s+(.*))?$/
const NUMBERED = /^\d+[.)](?:\s+(.*))?$/
const CALLOUT = /^>\s?\[!(.+?)\]\s?(.*)$/
const QUOTE = /^>\s?(.*)$/
const IMAGE = /^!\[(.*?)\]\((.*?)\)\s*$/

function isBlockStart(line: string) {
  const t = line.trimStart()
  return (
    FENCE.test(line.trim()) ||
    TABLE_ROW.test(line) ||
    DIVIDER.test(line) ||
    HEADING.test(t) ||
    BULLET.test(t) ||
    NUMBERED.test(t) ||
    QUOTE.test(t) ||
    IMAGE.test(t)
  )
}

/** Splits a `| a | b |` row into cells, honouring `\|` escapes. */
function splitRow(line: string) {
  const t = line.trim()
  return t
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'))
}

/** Paragraph lines that would otherwise parse as another block are escaped with a leading `\`. */
const escapeLine = (l: string) => (isBlockStart(l) ? '\\' + l : l)
const unescapeLine = (l: string) => (l.startsWith('\\') && isBlockStart(l.slice(1)) ? l.slice(1) : l)
/** Block types that are a single markdown line (newlines would break the structure). */
const oneLine = (t: string) => t.replace(/\n+/g, ' ')

export function parseMarkdown(md: string): Block[] {
  const lines = (md ?? '').replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    if (!raw.trim()) { i++; continue }
    const trimmed = raw.trim()

    // fenced code
    const fence = trimmed.match(FENCE)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { body.push(lines[i]); i++ }
      i++
      blocks.push(newBlock('code', { text: body.join('\n'), lang: fence[1] || undefined }))
      continue
    }

    // table
    if (TABLE_ROW.test(raw)) {
      const rows: string[][] = []
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        const cells = splitRow(lines[i])
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const width = Math.max(...rows.map((r) => r.length))
      blocks.push(newBlock('table', { rows: rows.map((r) => [...r, ...Array(width - r.length).fill('')]) }))
      continue
    }

    if (DIVIDER.test(raw)) { blocks.push(newBlock('divider')); i++; continue }

    const spaces = raw.match(/^ */)![0].length
    const indent = Math.min(2, Math.floor(spaces / 2)) || undefined
    const t = raw.trimStart().trimEnd()
    let m: RegExpMatchArray | null

    if ((m = t.match(HEADING))) {
      blocks.push(newBlock(`h${m[1].length}` as BlockType, { text: m[2] ?? '' }))
      i++
      continue
    }
    if ((m = t.match(TODO))) {
      blocks.push(newBlock('todo', { text: m[2], checked: m[1].toLowerCase() === 'x', indent }))
      i++
      continue
    }
    if ((m = t.match(BULLET))) { blocks.push(newBlock('bullet', { text: m[1] ?? '', indent })); i++; continue }
    if ((m = t.match(NUMBERED))) { blocks.push(newBlock('numbered', { text: m[1] ?? '', indent })); i++; continue }
    if ((m = t.match(IMAGE))) { blocks.push(newBlock('image', { text: m[1], url: m[2] })); i++; continue }

    if ((m = t.match(CALLOUT))) {
      const body = [m[2]]
      i++
      while (i < lines.length && QUOTE.test(lines[i].trim()) && !CALLOUT.test(lines[i].trim())) {
        body.push(lines[i].trim().match(QUOTE)![1])
        i++
      }
      blocks.push(newBlock('callout', { emoji: m[1], text: body.join('\n') }))
      continue
    }
    if (QUOTE.test(t)) {
      const body: string[] = []
      while (i < lines.length && QUOTE.test(lines[i].trim()) && !CALLOUT.test(lines[i].trim())) {
        body.push(lines[i].trim().match(QUOTE)![1])
        i++
      }
      blocks.push(newBlock('quote', { text: body.join('\n') }))
      continue
    }

    // paragraph: gather consecutive plain lines
    const body = [unescapeLine(t)]
    i++
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      body.push(unescapeLine(lines[i].trim()))
      i++
    }
    blocks.push(newBlock('paragraph', { text: body.join('\n') }))
  }
  return blocks
}

const pad = (b: Block) => '  '.repeat(b.indent ?? 0)
const prefixLines = (text: string, prefix: string) => text.split('\n').map((l) => prefix + l).join('\n')

/** Number displayed for a numbered block at index (counts consecutive numbered siblings at same indent). */
export function numberAt(blocks: Block[], idx: number): number {
  const b = blocks[idx]
  let n = 1
  for (let j = idx - 1; j >= 0; j--) {
    const p = blocks[j]
    if (p.type !== 'numbered' && !(isList(p) && (p.indent ?? 0) > (b.indent ?? 0))) break
    if (p.type === 'numbered' && (p.indent ?? 0) === (b.indent ?? 0)) n++
    if (p.type === 'numbered' && (p.indent ?? 0) < (b.indent ?? 0)) break
  }
  return n
}

function blockToMd(b: Block, blocks: Block[], idx: number): string {
  switch (b.type) {
    case 'h1': return `# ${oneLine(b.text)}`
    case 'h2': return `## ${oneLine(b.text)}`
    case 'h3': return `### ${oneLine(b.text)}`
    case 'bullet': return `${pad(b)}- ${oneLine(b.text)}`
    case 'numbered': return `${pad(b)}${numberAt(blocks, idx)}. ${oneLine(b.text)}`
    case 'todo': return `${pad(b)}- [${b.checked ? 'x' : ' '}] ${oneLine(b.text)}`
    case 'quote': return prefixLines(b.text, '> ')
    case 'callout': return prefixLines(b.text, '> ').replace(/^> /, `> [!${b.emoji || '💡'}] `)
    case 'code': return '```' + (b.lang ?? '') + '\n' + b.text + '\n```'
    case 'divider': return '---'
    case 'image': return `![${oneLine(b.text).replace(/[[\]]/g, '')}](${(b.url ?? '').replace(/\s/g, '%20')})`
    case 'table': {
      const rows = b.rows?.length ? b.rows : [['']]
      const esc = (c: string) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')
      const line = (r: string[]) => `| ${r.map(esc).join(' | ')} |`
      return [line(rows[0]), `| ${rows[0].map(() => '---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n')
    }
    default: return b.text.split('\n').map((l) => escapeLine(l.trim())).join('\n')
  }
}

export function serializeBlocks(blocks: Block[]): string {
  let out = ''
  blocks.forEach((b, idx) => {
    if (b.type === 'paragraph' && !b.text.trim()) return
    const s = blockToMd(b, blocks, idx)
    if (out) {
      const prev = blocks[idx - 1]
      out += isList(b) && isList(prev) ? '\n' : '\n\n'
    }
    out += s
  })
  return out ? out + '\n' : ''
}

/** Strips markdown syntax → plain text (for search, excerpts, word counts). */
export function plainText(md: string): string {
  return parseMarkdown(md)
    .map((b) => (b.type === 'table' ? (b.rows ?? []).map((r) => r.join(' ')).join(' ') : b.text))
    .filter(Boolean)
    .join('\n')
    .replace(/\*\*|__|`|~~/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
}

export function excerpt(md: string, len = 120): string {
  const t = parseMarkdown(md)
    .filter((b) => b.type === 'paragraph' || b.type === 'callout' || b.type === 'quote' || isList(b))
    .map((b) => b.text)
    .join(' ')
    .replace(/\*\*|`/g, '')
  return t.length > len ? t.slice(0, len).trimEnd() + '…' : t
}

export function stats(md: string) {
  const text = plainText(md)
  const chars = text.replace(/\s/g, '').length
  const words = text.split(/\s+/).filter(Boolean).length
  // Korean reading speed ≈ 500 chars/min
  const minutes = Math.max(1, Math.round(chars / 500))
  return { chars, words, minutes }
}
